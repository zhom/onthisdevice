/** .gitignore templates by language, framework family and operating system. */

export const GITIGNORE: { id: string; label: string; lines: string }[] = [
  { id: 'node', label: 'Node.js', lines: 'node_modules/\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\n.npm/\n.pnpm-store/\n.yarn/*\n!.yarn/releases\n.eslintcache\n*.tsbuildinfo\ncoverage/\n.nyc_output/\ndist/\nbuild/\n.cache/\n.parcel-cache/\n.next/\n.nuxt/\n.output/\n.svelte-kit/\n.astro/\n.turbo//\n.env\n.env.*\n!.env.example' },
  { id: 'python', label: 'Python', lines: '__pycache__/\n*.py[cod]\n*$py.class\n*.so\n.Python\nbuild/\ndist/\n*.egg-info/\n.eggs/\nwheels/\n.venv/\nvenv/\nenv/\n.env\n.pytest_cache/\n.mypy_cache/\n.ruff_cache/\n.tox/\n.nox/\n.coverage\nhtmlcov/\n.ipynb_checkpoints/\n.python-version\ninstance/\n*.sqlite3' },
  { id: 'java', label: 'Java', lines: '*.class\n*.jar\n*.war\n*.ear\n*.log\nhs_err_pid*\ntarget/\n.mvn/wrapper/maven-wrapper.jar\n.gradle/\nbuild/\n!gradle/wrapper/gradle-wrapper.jar\nout/' },
  { id: 'kotlin', label: 'Kotlin and Android', lines: '*.apk\n*.aab\n*.ap_\n*.dex\n.gradle/\nbuild/\nlocal.properties\ncaptures/\n.externalNativeBuild/\n.cxx/\n*.keystore\n!debug.keystore' },
  { id: 'go', label: 'Go', lines: '*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\n*.test\n*.out\ncoverage.*\n*.coverprofile\ngo.work\ngo.work.sum\nvendor/\nbin/' },
  { id: 'rust', label: 'Rust', lines: 'target/\n**/*.rs.bk\n*.pdb' },
  { id: 'c', label: 'C and C++', lines: '*.o\n*.obj\n*.ko\n*.elf\n*.a\n*.lib\n*.so\n*.so.*\n*.dylib\n*.dll\n*.exe\n*.out\n*.app\n*.gch\n*.pch\n*.d\nbuild/\ncmake-build-*/\nCMakeFiles/\nCMakeCache.txt\ncmake_install.cmake\ncompile_commands.json\n.cache/' },
  { id: 'dotnet', label: 'C# and .NET', lines: 'bin/\nobj/\n*.user\n*.suo\n*.userosscache\n*.sln.docstates\n.vs/\n[Dd]ebug/\n[Rr]elease/\nx64/\nx86/\n[Ll]og/\nTestResults/\n*.nupkg\npackages/\n!packages/build/\nproject.lock.json\nartifacts/' },
  { id: 'ruby', label: 'Ruby', lines: '*.gem\n*.rbc\n.bundle/\nvendor/bundle/\nlog/*\ntmp/*\n!log/.keep\n!tmp/.keep\n.byebug_history\ncoverage/\n.rspec_status\n/public/assets\n/storage/*\n.env' },
  { id: 'php', label: 'PHP', lines: 'vendor/\ncomposer.phar\n.phpunit.result.cache\n.phpunit.cache/\n.php-cs-fixer.cache\n.env\nstorage/*.key\nbootstrap/cache/*\n!bootstrap/cache/.gitignore' },
  { id: 'swift', label: 'Swift', lines: 'build/\nDerivedData/\n*.xcuserstate\nxcuserdata/\n*.xccheckout\n*.moved-aside\n*.hmap\n*.ipa\n*.dSYM.zip\n*.dSYM\n.build/\n.swiftpm/\nPods/\nCarthage/Build/\nfastlane/report.xml\nfastlane/screenshots/' },
  { id: 'dart', label: 'Dart', lines: '.dart_tool/\n.packages\nbuild/\n.flutter-plugins\n.flutter-plugins-dependencies\n*.g.dart.bak\ncoverage/\n.pub-cache/\n.pub/' },
  { id: 'elixir', label: 'Elixir', lines: '_build/\ndeps/\n*.ez\ncover/\ndoc/\nerl_crash.dump\n.elixir_ls/\n.fetch' },
  { id: 'haskell', label: 'Haskell', lines: 'dist/\ndist-newstyle/\n.stack-work/\n*.hi\n*.o\n*.dyn_o\n*.dyn_hi\n*.prof\n*.aux\n*.hp\ncabal.project.local*\n.ghc.environment.*' },
  { id: 'r', label: 'R', lines: '.Rhistory\n.Rapp.history\n.RData\n.Ruserdata\n.Rproj.user/\n*.Rcheck/\nvignettes/*.html\nvignettes/*.pdf\n.httr-oauth\n*_cache/\n/cache/\nrsconnect/' },
  { id: 'latex', label: 'LaTeX', lines: '*.aux\n*.bbl\n*.blg\n*.fdb_latexmk\n*.fls\n*.log\n*.out\n*.toc\n*.lof\n*.lot\n*.synctex.gz\n*.nav\n*.snm\n*.vrb\n*.xdv\n_minted*/\n*.run.xml\n*.bcf' },
  { id: 'macos', label: 'macOS', lines: '.DS_Store\n.AppleDouble\n.LSOverride\n._*\n.DocumentRevisions-V100\n.fseventsd\n.Spotlight-V100\n.TemporaryItems\n.Trashes\n.VolumeIcon.icns\n.com.apple.timemachine.donotpresent' },
  { id: 'windows', label: 'Windows', lines: 'Thumbs.db\nThumbs.db:encryptable\nehthumbs.db\nehthumbs_vista.db\n*.stackdump\n[Dd]esktop.ini\n$RECYCLE.BIN/\n*.lnk' },
  { id: 'linux', label: 'Linux', lines: '*~\n.fuse_hidden*\n.directory\n.Trash-*\n.nfs*' },
  { id: 'editors', label: 'Editors and IDEs', lines: '.idea/\n*.iml\n.vscode/*\n!.vscode/extensions.json\n!.vscode/settings.json\n*.swp\n*.swo\n*~\n.project\n.classpath\n.settings/\n.history/' },
  { id: 'secrets', label: 'Secrets and keys', lines: '.env\n.env.*\n!.env.example\n*.pem\n*.key\n*.p12\n*.pfx\nid_rsa*\nid_ed25519*\n*.keystore\nsecrets.*\ncredentials.json' },
  { id: 'logs', label: 'Logs and temp files', lines: '*.log\nlogs/\n*.tmp\n*.temp\n*.bak\n*.swp\ntmp/\ntemp/' },
]

export function buildGitignore(ids: string[], extra: string): string {
  const seen = new Set<string>()
  const blocks: string[] = []
  for (const t of GITIGNORE.filter((g) => ids.includes(g.id))) {
    // A pattern already listed by an earlier block is not repeated.
    const lines = t.lines.split('\n').filter((l) => l.startsWith('#') || !seen.has(l))
    for (const l of lines) seen.add(l)
    if (lines.some((l) => !l.startsWith('#'))) blocks.push(`# ${t.label}\n${lines.join('\n')}`)
  }
  const custom = extra.trim()
  if (custom) blocks.push(`# Project\n${custom}`)
  return blocks.join('\n\n') + (blocks.length ? '\n' : '')
}
