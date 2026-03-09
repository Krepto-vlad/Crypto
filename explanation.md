# Cryptographic Task — Step-by-Step Explanation

## Task Overview

The goal was to:
1. Identify the correct 128-bit symmetric key from three candidates.
2. Decrypt an AES-128-CBC encrypted message using that key.
3. Generate an Elliptic Curve asymmetric key-pair.
4. Create a digital signature over the decrypted plaintext.

All operations were implemented in **Node.js** using the built-in `crypto` module.

---

## Step 1 — Identify the Correct Symmetric Key

**Given:**
- Three candidate 128-bit keys (in HEX):
  - `68544020247570407220244063724074`
  - `54684020247570407220244063724074`
  - `54684020247570407220244063727440`
- SHA-256 hash of the correct key:
  - `f28fe539655fd6f7275a09b7c3508a3f81573fc42827ce34ddf1ec8d5c2421c3`

**What was done:**

Each candidate key was converted from its HEX string into a binary buffer, then hashed with **SHA-256**. The resulting hash was compared to the provided target hash.

**Result — Correct symmetric key:** `54684020247570407220244063724074`

---

## Step 2 — Decrypt the AES-128-CBC Encrypted Message

**Given:**
- AES encrypted message (HEX): `876b4e970c3516f333bcf5f16d546a87aaeea5588ead29d213557efc1903997e`
- CBC initialization vector (HEX): `656e6372797074696f6e496e74566563`
- Symmetric key (from Step 1): `54684020247570407220244063724074`

**What was done:**

1. Converted the key, IV, and ciphertext from HEX strings to binary buffers.
2. Created an AES-128-CBC decipher using `crypto.createDecipheriv()`.
3. Fed the ciphertext into the decipher and called `.final()` to obtain the plaintext.

AES-128-CBC uses the 128-bit key and a 128-bit IV. Each plaintext block is XORed with the previous ciphertext block before encryption, and the IV is used for the first block. Decryption reverses this process. PKCS#7 padding is automatically removed by Node.js.

**Result — Decrypted message:** `Hello Blockchain!`

---

## Step 3 — Generate an Elliptic Curve Key-Pair

**What was done:**

Used `crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" })` to generate an ECDSA key-pair on the **P-256 (prime256v1)** curve.

**Result — Public key (PEM):**

```
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
-----END PUBLIC KEY-----
```

---

## Step 4 — Create a Digital Signature

**What was done:**

1. Created a `Sign` object with **SHA-256** as the digest algorithm.
2. Fed the decrypted plaintext (`Hello Blockchain!`) into the signer.
3. Signed the data using the EC private key generated in Step 3.
4. Output the signature in HEX format.


**Result — Digital signature (HEX):** *(printed by the script; changes on every run)*

---

## Summary

| # | Result | Value |
|---|---|---|
| 1 | Correct Symmetric Key | `54684020247570407220244063724074` |
| 2 | Decrypted Message | `Hello Blockchain!` |
| 3 | Asymmetric Public Key | EC P-256 key in PEM (see script output) |
| 4 | Digital Signature | ECDSA-SHA256 signature in HEX (see script output) |

## How to Run

```bash
node cryptoTask.js
```

Requires **Node.js** (any modern version with built-in `crypto` module).

---

## Output after Run:

Correct symmetric key:
54684020247570407220244063724074

Decrypted message:
Hello Blockchain!

Public key:
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZPs9B1sjbBwbEnhu3pFSF0UD8It5
jIv6yRm8PXrTv2iWCA1chuTIKFuEy/qJPgVjda2zvhioFxz/tWFUeWFCPw==
-----END PUBLIC KEY-----

Digital signature:
3045022016e72fba05319e75ec9de2d3333382d6d9e64faa74071324d3b189589256d349022100e388c93344f2ad996e7e334c1c0f9d32dd18054ecc4033e92899c99ec32b02bf