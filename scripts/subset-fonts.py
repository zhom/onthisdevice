#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.60.2", "uharfbuzz==0.51.1"]
# ///
"""Cut the Archivo web fonts from the sources in scripts/fonts. Writes public/fonts/*.woff2, the
Archivo @font-face rules in src/styles/global.css and the font preload in
src/layouts/BaseLayout.astro. The build does not run this script: run it by hand from the repo root
and keep what it writes.

  uv run scripts/subset-fonts.py           write the fonts, the @font-face rules and the preload
  uv run scripts/subset-fonts.py --check   fail when the shipped fonts are not what the script
                                           makes, or when the CSS asks for something they lack

Run it again after a new version of the font (replace the files in scripts/fonts), or when the CSS
asks for something the cut drops: a width other than normal (font-stretch) or an OpenType feature
other than the ones in FEATURES (old-style figures, for example: add it there).
`--check` finds both; run it after `npm run build` so that it also reads the built pages.

The sources are the two files the site served before: the Google Fonts latin and latin-ext subsets
of Archivo 2.001 (wght 100-900, wdth 62-125, no hinting instructions). The site shows file names and
text that people type, so each output keeps every character of its source and the unicode-range the
site used before. The ranges also have characters that the files lack, and Chrome draws some of them
with this font all the same: an accented letter that HarfBuzz builds from a letter and a mark (Ǭ is
Ǫ + U+0304), U+2010 and U+2011 (drawn as "-"), and the .notdef box for a character that no font has.
Ranges cut to the files would give these to other fonts. The cut:
- fixes wdth at 100, the only width the site uses, and keeps the source's wght deltas as they are,
  so each glyph has the outline and advance it had at normal width (the script checks this);
- keeps the full wght range: the masters are at 100, 600 and 900 and the site uses 400 to 900, so a
  cut at 400 would only scale and round the deltas of the 100 master;
- keeps the shaping features that browsers apply by default, tnum, and the fraction features (see
  FEATURES); pnum goes (it changes no glyph);
- drops the named instances and STAT, and keeps the glyph names, the bounding boxes, prep and gasp.
The file names have a hash of the contents: the service worker and the browser cache keep /fonts/*.
"""

import hashlib
import io
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

import uharfbuzz as hb
from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "scripts/fonts"
OUT = ROOT / "public/fonts"
CSS = ROOT / "src/styles/global.css"
LAYOUT = ROOT / "src/layouts/BaseLayout.astro"
DIST = ROOT / "dist"

# Each file with its unicode-range (the one the site used before, see above), in CSS order: where two
# ranges overlap (U+0304, U+0308, U+0329), the browser asks the later file first.
FILES = {
    "archivo-latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
    "U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    "archivo-latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,"
    "U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
}
# Every page draws ASCII, so the first view needs this file.
PRELOAD = "archivo-latin"
WDTH = 100
# The shaping features that browsers apply by default, and tnum for the `num` class and
# tabular-nums. Chrome also applies frac, numr and dnom to the digits around U+2044 (1⁄760 on
# /pressure-converter). The subsetter keeps only the ones the font has.
FEATURES = ["ccmp", "locl", "mark", "mkmk", "kern", "liga", "clig", "calt", "rlig", "rclt", "rvrn", "curs"]
FEATURES += ["tnum", "frac", "numr", "dnom"]
# CSS that needs what the cut drops.
DROPPED = re.compile(
    r"font-stretch|fontStretch|font-variation-settings|fontVariationSettings|font-feature-settings|"
    r"fontFeatureSettings"
)
# Weights for the checks: the masters, and values between them.
WEIGHTS = [100, 250, 400, 500, 600, 700, 760, 900]
CSS_START = "/* Archivo: written by scripts/subset-fonts.py. Change the script, not these rules. */\n"
CSS_END = "/* End of the Archivo rules. */\n"
PRELOAD_LINK = re.compile(r'(<link rel="preload" href=")/fonts/[^"]+(" as="font")')


def parse_ranges(s: str) -> set[int]:
    out = set()
    for part in s.split(","):
        a, _, b = part.strip()[2:].partition("-")
        out |= set(range(int(a, 16), int(b or a, 16) + 1))
    return out


def format_ranges(cps) -> str:
    out = []
    for cp in sorted(cps):
        if out and cp == out[-1][1] + 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return ", ".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in out)


def load(data: bytes) -> TTFont:
    return TTFont(io.BytesIO(data), recalcTimestamp=False, recalcBBoxes=False)


def save(font: TTFont, flavor=None) -> bytes:
    font.flavor = flavor
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def pin_width(source: TTFont, data: bytes) -> TTFont:
    """The source at wdth 100. The instancer interpolates the gvar deltas and rounds them again, which
    moves some points: keep the source's wght deltas instead, without the ones that use wdth."""
    cut = load(save(instancer.instantiateVariableFont(load(data), {"wdth": WDTH})))
    for name, variations in source["gvar"].variations.items():
        cut["gvar"].variations[name] = [tv for tv in variations if "wdth" not in tv.axes]
    return cut


def cut(font: TTFont) -> bytes:
    font = load(save(font))
    # Browsers use neither the named instances nor STAT, nor the names that only these two refer to.
    font["fvar"].instances = []
    del font["STAT"]
    options = subset.Options()
    options.layout_features = FEATURES
    options.name_IDs = list(range(26)) + [a.axisNameID for a in font["fvar"].axes]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.glyph_names = True
    options.notdef_outline = True
    options.recalc_bounds = False
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=font.getBestCmap())
    subsetter.subset(font)
    return save(font, "woff2")


def verify(name: str, source: TTFont, out: bytes):
    """Every glyph of the output has the source's outline and advance at normal width, and text
    shapes the same: each character alone and next to each ASCII character, with and without tnum."""
    font = load(out)
    for w in WEIGHTS:
        a = source.getGlyphSet(location={"wght": w, "wdth": WDTH})
        b = font.getGlyphSet(location={"wght": w})
        for g in font.getGlyphOrder():
            pa, pb = DecomposingRecordingPen(a), DecomposingRecordingPen(b)
            a[g].draw(pa)
            b[g].draw(pb)
            if pa.value != pb.value or a[g].width != b[g].width:
                sys.exit(f"{name}: {g} differs from the source at wght {w}")
    faces = [hb.Face(hb.Blob(save(f))) for f in (source, font)]
    chars = [chr(c) for c in sorted(font.getBestCmap())]
    ascii_ = [chr(c) for c in range(0x20, 0x7F)]
    fractions = [f"{a}\u2044{b}" for a in ("1", "12", "1000") for b in ("2", "760", "3600")]
    texts = chars + [a + c for c in chars for a in ascii_] + [c + a for c in chars for a in ascii_] + fractions
    for w in (100, 400, 600, 900):
        fonts = []
        for face, axes in zip(faces, ({"wght": w, "wdth": WDTH}, {"wght": w})):
            f = hb.Font(face)
            f.set_variations(axes)
            fonts.append(f)
        for features in ({}, {"tnum": True}):
            for text in texts:
                runs = []
                for f in fonts:
                    buf = hb.Buffer()
                    buf.add_str(text)
                    buf.guess_segment_properties()
                    hb.shape(f, buf, features)
                    runs.append([(f.glyph_to_string(g.codepoint), p.x_advance, p.x_offset, p.y_offset) for g, p in zip(buf.glyph_infos, buf.glyph_positions)])
                if runs[0] != runs[1]:
                    sys.exit(f"{name}: {text!r} shapes differently at wght {w} {features}: {runs}")


class PageText(HTMLParser):
    """The text of a built page, with form values and placeholders, without scripts and styles."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = []
        self.chars = set()

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip.append(tag)
        for k, v in attrs:
            if v and k in ("placeholder", "value"):
                self.chars |= {ord(c) for c in v}

    def handle_endtag(self, tag):
        if self.skip and self.skip[-1] == tag:
            self.skip.pop()

    def handle_data(self, data):
        if not self.skip:
            self.chars |= {ord(c) for c in data}


def used_chars() -> set[int]:
    """Characters in the built pages and in the source tree (text that a tool shows after a file is
    picked is only in the source)."""
    used = set()
    for p in DIST.rglob("*.html"):
        parser = PageText()
        parser.feed(p.read_text(encoding="utf-8"))
        used |= parser.chars
    for p in (ROOT / "src").rglob("*"):
        if p.suffix in (".astro", ".ts", ".tsx", ".json", ".md"):
            used |= {ord(c) for c in p.read_text(encoding="utf-8")}
    return used


def dropped_in_css() -> list[str]:
    hits = []
    for p in (ROOT / "src").rglob("*"):
        if p.suffix not in (".astro", ".ts", ".tsx", ".css"):
            continue
        text = p.read_text(encoding="utf-8")
        if p == CSS:
            before, _, after = css_rules(text)
            text = before + after
        for n, line in enumerate(text.splitlines(), 1):
            if DROPPED.search(line):
                hits.append(f"{p.relative_to(ROOT)}:{n}: {line.strip()[:100]}")
    return hits


def css_rules(text: str) -> tuple[str, str, str]:
    """global.css split into the text before, the Archivo rules and the text after."""
    start = text.find(CSS_START)
    end = text.find(CSS_END)
    if start < 0 or end < start:
        sys.exit(f"{CSS.relative_to(ROOT)}: the Archivo rules must sit between {CSS_START.strip()!r} and {CSS_END.strip()!r}")
    return text[:start], text[start : end + len(CSS_END)], text[end + len(CSS_END) :]


def face_rule(file: str, ranges: str) -> str:
    return (
        "@font-face {\n"
        "  font-family: 'Archivo';\n"
        "  font-style: normal;\n"
        "  font-display: swap;\n"
        "  font-weight: 100 900;\n"
        f"  font-stretch: {WDTH}%;\n"
        f"  src: url('/fonts/{file}') format('woff2-variations');\n"
        f"  unicode-range: {wrap(ranges)};\n"
        "}\n"
    )


def wrap(ranges: str) -> str:
    lines = [""]
    for r in ranges.split(", "):
        if lines[-1] and len(lines[-1]) + len(r) > 100:
            lines.append("")
        lines[-1] += (", " if lines[-1] else "") + r
    return ",\n    ".join(lines)


def main():
    check = "--check" in sys.argv
    outputs = {}
    rules = []
    shipped = set()
    source_chars = set()
    for stem, unicode_range in FILES.items():
        data = (SOURCES / f"{stem}.woff2").read_bytes()
        source = load(data)
        source_chars |= set(source.getBestCmap())
        out = cut(pin_width(source, data))
        file = f"{stem}.{hashlib.sha256(out).hexdigest()[:8]}.woff2"
        cmap = set(load(out).getBestCmap())
        if cmap != set(source.getBestCmap()):
            sys.exit(f"{file}: the cut lost {format_ranges(set(source.getBestCmap()) - cmap)}")
        shipped |= parse_ranges(unicode_range) & cmap
        outputs[file] = out
        rules.append(face_rule(file, format_ranges(parse_ranges(unicode_range))))
        if not check:
            verify(file, source, out)
        print(f"{file}: {len(out)} B (source {len(data)} B), {len(parse_ranges(unicode_range) & cmap)} characters in its unicode-range")

    css = CSS.read_text(encoding="utf-8")
    before, _, after = css_rules(css)
    new_css = before + CSS_START + "".join(rules) + CSS_END + after
    layout = LAYOUT.read_text(encoding="utf-8")
    preload = next(f for f in outputs if f.startswith(PRELOAD + "."))
    if len(PRELOAD_LINK.findall(layout)) != 1:
        sys.exit(f"{LAYOUT.relative_to(ROOT)} needs one <link rel=\"preload\" href=\"/fonts/...\" as=\"font\">")
    new_layout = PRELOAD_LINK.sub(rf"\g<1>/fonts/{preload}\g<2>", layout)

    used = used_chars()
    system = sorted(c for c in used & source_chars - shipped if c > 0x7E)
    if system:
        print(f"Used, in a source, outside the ranges, so drawn by a system font as before: {format_ranges(system)}")

    if check:
        problems = []
        have = {p.name: p.read_bytes() for p in OUT.glob("*.woff2")}
        if have != outputs:
            problems.append(f"public/fonts has {sorted(have)}, the script makes {sorted(outputs)}")
        if css != new_css:
            problems.append(f"the Archivo rules in {CSS.relative_to(ROOT)} differ from the fonts")
        if layout != new_layout:
            problems.append(f"the preload in {LAYOUT.relative_to(ROOT)} is not {preload}")
        hits = dropped_in_css()
        if hits:
            problems.append(
                f"the fonts have only wdth {WDTH} and the features {' '.join(FEATURES)}; check these and "
                "change WDTH or FEATURES:\n    " + "\n    ".join(hits)
            )
        if not DIST.exists():
            print("No dist/: checked the source tree only. Run `npm run build` first to check the built pages too.")
        if problems:
            print("The fonts do not fit the site:\n  " + "\n  ".join(problems))
            sys.exit(1)
        print("The fonts fit the site.")
        return

    OUT.mkdir(parents=True, exist_ok=True)
    for p in OUT.glob("*.woff2"):
        if p.name not in outputs:
            p.unlink()
    for file, out in outputs.items():
        (OUT / file).write_bytes(out)
    CSS.write_text(new_css, encoding="utf-8")
    LAYOUT.write_text(new_layout, encoding="utf-8")
    print(f"wrote public/fonts, {CSS.relative_to(ROOT)} and {LAYOUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
