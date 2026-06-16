import { webcrypto } from "node:crypto";

/** jose uses the Web Crypto API; ensure it exists on Node 18. */
if (!globalThis.crypto) {
  (globalThis as { crypto: typeof webcrypto }).crypto = webcrypto;
}
