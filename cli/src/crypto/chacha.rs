use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, CHACHA20_POLY1305};
use ring::rand::{SecureRandom, SystemRandom};

/// Encrypt plaintext with ChaCha20-Poly1305.
/// Returns "base64(nonce):base64(ciphertext+auth_tag)"
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<String> {
    let rng = SystemRandom::new();
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes).map_err(|_| anyhow!("generate nonce failed"))?;

    let unbound =
        UnboundKey::new(&CHACHA20_POLY1305, key).map_err(|_| anyhow!("invalid key"))?;
    let sealing_key = LessSafeKey::new(unbound);

    let mut in_out = plaintext.to_vec();
    sealing_key
        .seal_in_place_append_tag(
            Nonce::assume_unique_for_key(nonce_bytes),
            Aad::empty(),
            &mut in_out,
        )
        .map_err(|_| anyhow!("encryption failed"))?;

    Ok(format!("{}:{}", B64.encode(nonce_bytes), B64.encode(&in_out)))
}

/// Decrypt a value produced by encrypt().
/// Expects "base64(nonce):base64(ciphertext+auth_tag)"
pub fn decrypt(key: &[u8; 32], encoded: &str) -> Result<Vec<u8>> {
    let parts: Vec<&str> = encoded.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err(anyhow!("invalid encrypted format"));
    }

    let nonce_bytes: [u8; 12] = B64
        .decode(parts[0])
        .context("decode nonce")?
        .try_into()
        .map_err(|_| anyhow!("nonce wrong length"))?;

    let mut ciphertext = B64.decode(parts[1]).context("decode ciphertext")?;

    let unbound =
        UnboundKey::new(&CHACHA20_POLY1305, key).map_err(|_| anyhow!("invalid key"))?;
    let opening_key = LessSafeKey::new(unbound);

    let plaintext = opening_key
        .open_in_place(
            Nonce::assume_unique_for_key(nonce_bytes),
            Aad::empty(),
            &mut ciphertext,
        )
        .map_err(|_| anyhow!("decryption failed — wrong key or corrupted data"))?;

    Ok(plaintext.to_vec())
}
