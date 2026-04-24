// ─── E2E Encryption Utilities ─────────────────────────────────────
// Uses Web Crypto API (X25519 ECDH + AES-GCM)
// Keypair stored in IndexedDB – private key NEVER leaves the device
//
// Browser support for X25519 is still limited, so we use ECDH with
// the P-256 curve which is universally supported. The security
// properties are equivalent for this use case.

const DB_NAME = 'the-secret-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';
const KEY_ID = 'main-keypair';

// ── IndexedDB Helpers ─────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveKeyPair(keyPair, publicKeyBase64) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      id: KEY_ID,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyBase64,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadKeyPair() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ── Key Generation ────────────────────────────────────────────────

export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // not extractable (private key stays in CryptoKey)
    ['deriveKey']
  );

  // Export public key as base64 for sharing with server
  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubRaw)));

  await saveKeyPair(keyPair, publicKeyBase64);
  return publicKeyBase64;
}

export async function getOrCreateKeyPair() {
  const existing = await loadKeyPair();
  if (existing && existing.privateKey && existing.publicKeyBase64) {
    return {
      privateKey: existing.privateKey,
      publicKey: existing.publicKey,
      publicKeyBase64: existing.publicKeyBase64,
    };
  }
  const publicKeyBase64 = await generateKeyPair();
  const saved = await loadKeyPair();
  return {
    privateKey: saved.privateKey,
    publicKey: saved.publicKey,
    publicKeyBase64,
  };
}

// ── Shared Key Derivation (ECDH) ─────────────────────────────────

async function importPublicKey(base64) {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

export async function deriveSharedKey(myPrivateKey, theirPublicKeyBase64) {
  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────

export async function encryptMessage(sharedKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
}

export async function decryptMessage(sharedKey, ivBase64, ciphertextBase64) {
  try {
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return '[Unable to decrypt — key may have changed]';
  }
}
