/**
 * VOID Crypto Layer
 *
 * Uses @noble/curves (X25519) + @noble/ciphers (ChaCha20-Poly1305) +
 * Web Crypto API PBKDF2 for private-key encryption.
 *
 * Pure TypeScript — zero WASM, zero async init, works in any bundler.
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";

// ── Utilities ─────────────────────────────────────────────────────────────────

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toBase64(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Key Pair (X25519) ─────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

// ── Symmetric Key ─────────────────────────────────────────────────────────────

export async function generateSymmetricKey(): Promise<Uint8Array> {
  return randomBytes(32); // ChaCha20 key size
}

// ── Encrypt / Decrypt Secret Value ───────────────────────────────────────────
// ChaCha20-Poly1305, nonce 12 bytes
// Format: base64(nonce):base64(ciphertext+tag)

export async function encryptValue(
  symmetricKey: Uint8Array,
  plaintext: string
): Promise<string> {
  const nonce = randomBytes(12);
  const cipher = chacha20poly1305(symmetricKey, nonce);
  const ciphertext = cipher.encrypt(new TextEncoder().encode(plaintext));
  return toBase64(nonce) + ":" + toBase64(ciphertext);
}

export async function decryptValue(
  symmetricKey: Uint8Array,
  encoded: string
): Promise<string> {
  const colonIdx = encoded.indexOf(":");
  if (colonIdx < 0) throw new Error("Invalid encrypted format");
  const nonce = fromBase64(encoded.slice(0, colonIdx));
  const ciphertext = fromBase64(encoded.slice(colonIdx + 1));
  const cipher = chacha20poly1305(symmetricKey, nonce);
  const plaintext = cipher.decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ── Encrypt Symmetric Key for Recipient (X25519 ECDH + ChaCha20) ─────────────
// Format: base64(ephemeralPub):base64(nonce):base64(ciphertext+tag)

export async function encryptSymKeyForRecipient(
  recipientPublicKey: Uint8Array,
  symmetricKey: Uint8Array
): Promise<string> {
  const ephemeralPriv = x25519.utils.randomSecretKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
  const sharedSecret = x25519.getSharedSecret(ephemeralPriv, recipientPublicKey);

  const nonce = randomBytes(12);
  const cipher = chacha20poly1305(sharedSecret, nonce);
  const ciphertext = cipher.encrypt(symmetricKey);

  return toBase64(ephemeralPub) + ":" + toBase64(nonce) + ":" + toBase64(ciphertext);
}

export async function decryptSymKey(
  encryptedSymKey: string,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  const parts = encryptedSymKey.split(":");
  if (parts.length !== 3)
    throw new Error("Invalid encrypted sym key format (expected 3 parts)");

  const ephemeralPub = fromBase64(parts[0]);
  const nonce = fromBase64(parts[1]);
  const ciphertext = fromBase64(parts[2]);

  const sharedSecret = x25519.getSharedSecret(privateKey, ephemeralPub);
  const cipher = chacha20poly1305(sharedSecret, nonce);
  return cipher.decrypt(ciphertext);
}

// ── Private Key Protection (Argon2id + ChaCha20) ─────────────────────────────
// Argon2id (m=65540 KB, t=3, p=4) as the KDF.
// Format: base64(salt):base64(nonce):base64(ciphertext+tag)

import { argon2id } from "@noble/hashes/argon2.js";

function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Uint8Array {
  return argon2id(
    new TextEncoder().encode(password),
    salt,
    { m: 65540, t: 3, p: 4, dkLen: 32 }
  );
}

export async function encryptPrivateKey(
  password: string,
  privateKey: Uint8Array
): Promise<string> {
  const salt = randomBytes(32);
  const key = deriveKeyFromPassword(password, salt);
  const nonce = randomBytes(12);
  const cipher = chacha20poly1305(key, nonce);
  const encrypted = cipher.encrypt(privateKey);
  return toBase64(salt) + ":" + toBase64(nonce) + ":" + toBase64(encrypted);
}

export async function decryptPrivateKey(
  password: string,
  encoded: string
): Promise<Uint8Array> {
  const parts = encoded.split(":");
  if (parts.length !== 3)
    throw new Error("Invalid encrypted private key format (expected 3 parts)");
  const salt = fromBase64(parts[0]);
  const nonce = fromBase64(parts[1]);
  const encrypted = fromBase64(parts[2]);
  const key = deriveKeyFromPassword(password, salt);
  const cipher = chacha20poly1305(key, nonce);
  try {
    return cipher.decrypt(encrypted);
  } catch {
    throw new Error("Wrong password or corrupted key");
  }
}
