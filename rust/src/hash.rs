//! Streaming digests. One update per chunk of a file.

use md5::Digest as _;

pub enum Hasher {
    Md5(md5::Md5),
    Sha1(sha1::Sha1),
    Sha256(sha2::Sha256),
    Sha384(sha2::Sha384),
    Sha512(sha2::Sha512),
    Crc32(crc32fast::Hasher),
}

impl Hasher {
    pub fn new(id: u32) -> Option<Self> {
        Some(match id {
            0 => Self::Md5(md5::Md5::new()),
            1 => Self::Sha1(sha1::Sha1::new()),
            2 => Self::Sha256(sha2::Sha256::new()),
            3 => Self::Sha512(sha2::Sha512::new()),
            4 => Self::Crc32(crc32fast::Hasher::new()),
            5 => Self::Sha384(sha2::Sha384::new()),
            _ => return None,
        })
    }

    pub fn update(&mut self, data: &[u8]) {
        match self {
            Self::Md5(h) => h.update(data),
            Self::Sha1(h) => h.update(data),
            Self::Sha256(h) => h.update(data),
            Self::Sha384(h) => h.update(data),
            Self::Sha512(h) => h.update(data),
            Self::Crc32(h) => h.update(data),
        }
    }

    /// Writes the digest and returns its length. `out` holds at least 64 bytes.
    pub fn finish(self, out: &mut [u8]) -> usize {
        let mut put = |d: &[u8]| {
            out[..d.len()].copy_from_slice(d);
            d.len()
        };
        match self {
            Self::Md5(h) => put(&h.finalize()),
            Self::Sha1(h) => put(&h.finalize()),
            Self::Sha256(h) => put(&h.finalize()),
            Self::Sha384(h) => put(&h.finalize()),
            Self::Sha512(h) => put(&h.finalize()),
            Self::Crc32(h) => put(&h.finalize().to_be_bytes()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(id: u32, data: &[u8]) -> String {
        let mut h = Hasher::new(id).unwrap();
        // Split the input so the streaming path is what gets tested.
        let (a, b) = data.split_at(data.len() / 2);
        h.update(a);
        h.update(b);
        let mut out = [0; 64];
        let n = h.finish(&mut out);
        out[..n].iter().map(|b| format!("{b:02x}")).collect()
    }

    #[test]
    fn known_digests() {
        assert_eq!(hex(0, b"abc"), "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(hex(1, b"abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");
        assert_eq!(hex(2, b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(
            hex(3, b"abc"),
            "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
        );
        assert_eq!(hex(4, b"123456789"), "cbf43926");
        assert_eq!(
            hex(5, b"abc"),
            "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7"
        );
    }
}
