use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroizing;

use crate::crypto::chacha;

/// Encrypt a symmetric key for a recipient using their X25519 public key.
/// Returns "base64(ephemeral_pub):base64(nonce):base64(ciphertext)"
pub fn encrypt_for_recipient(recipient_pub_bytes: &[u8], sym_key: &[u8]) -> Result<String> {
    let recipient_pub_arr: [u8; 32] = recipient_pub_bytes
        .try_into()
        .map_err(|_| anyhow!("recipient public key must be 32 bytes"))?;
    let recipient_pub = PublicKey::from(recipient_pub_arr);

    // Generate ephemeral key pair
    let mut rng = rand::rngs::OsRng;
    let ephemeral_secret = StaticSecret::random_from_rng(&mut rng);
    let ephemeral_pub = PublicKey::from(&ephemeral_secret);

    // ECDH
    let shared = ephemeral_secret.diffie_hellman(&recipient_pub);
    let shared_bytes: [u8; 32] = *shared.as_bytes();
    let shared_key = Zeroizing::new(shared_bytes);

    // Encrypt sym key with shared secret
    let sym_key_arr: [u8; 32] = sym_key
        .try_into()
        .map_err(|_| anyhow!("sym key must be 32 bytes"))?;
    let encrypted = chacha::encrypt(&shared_key, &sym_key_arr).context("encrypt sym key")?;

    Ok(format!("{}:{}", B64.encode(ephemeral_pub.as_bytes()), encrypted))
}

/// Decrypt a symmetric key encrypted by encrypt_for_recipient.
/// encoded format: "base64(ephemeral_pub):base64(nonce):base64(ciphertext)"
pub fn decrypt_sym_key(
    recipient_priv_bytes: &[u8; 32],
    encoded: &str,
) -> Result<Zeroizing<Vec<u8>>> {
    let first_colon = encoded
        .find(':')
        .ok_or_else(|| anyhow!("invalid encrypted sym key format"))?;

    let ephemeral_pub_b64 = &encoded[..first_colon];
    let nonce_cipher = &encoded[first_colon + 1..];

    let ephemeral_pub_bytes: [u8; 32] = B64
        .decode(ephemeral_pub_b64)
        .context("decode ephemeral pub")?
        .try_into()
        .map_err(|_| anyhow!("ephemeral pub must be 32 bytes"))?;

    let our_secret = StaticSecret::from(*recipient_priv_bytes);
    let their_pub = PublicKey::from(ephemeral_pub_bytes);
    let shared = our_secret.diffie_hellman(&their_pub);
    let shared_arr: [u8; 32] = *shared.as_bytes();
    let shared_key = Zeroizing::new(shared_arr);

    let plaintext = chacha::decrypt(&shared_key, nonce_cipher)
        .context("decrypt sym key")?;

    Ok(Zeroizing::new(plaintext))
}
