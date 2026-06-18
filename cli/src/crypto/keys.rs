use anyhow::{Context, Result};
use argon2::{Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use std::fs;
use zeroize::Zeroizing;

use crate::crypto::chacha;

const KEY_LEN: usize = 32;

fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    let params = Params::new(65540, 3, 4, Some(KEY_LEN))
        .map_err(|e| anyhow::anyhow!("argon2 params: {}", e))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    argon2
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|e| anyhow::anyhow!("argon2 derive: {}", e))?;
    Ok(key)
}

/// Load and decrypt the private key from ~/.void/private_key.enc
/// Format (written by the web frontend): base64(salt):base64(nonce):base64(ciphertext+tag)
pub fn load_private_key(password: &str) -> Result<Zeroizing<[u8; 32]>> {
    let key_path = crate::config::global::config_dir().join("private_key.enc");
    let encoded = fs::read_to_string(&key_path)
        .with_context(|| format!("read private key: {}", key_path.display()))?;

    let parts: Vec<&str> = encoded.trim().splitn(3, ':').collect();
    if parts.len() != 3 {
        return Err(anyhow::anyhow!("invalid private key format (expected 3 parts)"));
    }

    let salt = B64.decode(parts[0]).context("decode salt")?;
    let nonce_cipher = format!("{}:{}", parts[1], parts[2]);

    let password_key = derive_key(password, &salt)?;
    let plaintext = chacha::decrypt(&password_key, &nonce_cipher)
        .context("decrypt private key (wrong password?)")?;

    let key_bytes: [u8; 32] = plaintext
        .try_into()
        .map_err(|_| anyhow::anyhow!("private key wrong length after decryption"))?;

    Ok(Zeroizing::new(key_bytes))
}

/// Save encrypted private key to ~/.void/private_key.enc
pub fn save_private_key(encrypted: &str) -> Result<()> {
    let dir = crate::config::global::config_dir();
    fs::create_dir_all(&dir).context("create ~/.void")?;
    let path = dir.join("private_key.enc");
    fs::write(&path, encrypted)
        .with_context(|| format!("write private key: {}", path.display()))
}
