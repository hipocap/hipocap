// Use dynamic import/require to avoid Turbopack module resolution issues
// This module should only be used server-side (in API routes)
let _sodium: any;
let _sodiumPromise: Promise<any> | null = null;

async function getSodium() {
  // Ensure this only runs server-side
  if (typeof window !== "undefined") {
    throw new Error("libsodium-wrappers can only be used server-side");
  }

  if (!_sodium) {
    if (!_sodiumPromise) {
      _sodiumPromise = (async () => {
        try {
          // Server-side only: load libsodium-wrappers
          // Since libsodium-wrappers is in serverExternalPackages, it won't be bundled
          // and will be loaded at runtime from node_modules
          // Use require for server-side - it's more reliable in Next.js API routes
          // and since it's in serverExternalPackages, it will be externalized
          let sodiumModule: any;
          
          // Check if we're in a Node.js environment with require
          if (typeof require !== "undefined") {
            sodiumModule = require("libsodium-wrappers");
          } else {
            // Fallback to dynamic import if require is not available
            const imported = await import("libsodium-wrappers");
            sodiumModule = imported.default || imported;
          }
          
          // libsodium-wrappers can export in different ways depending on the module system
          // Try different possible structures
          let sodium: any = null;
          
          // Check if it's already the sodium object (CommonJS direct export)
          if (sodiumModule && (sodiumModule.ready !== undefined || typeof sodiumModule.ready === "function")) {
            sodium = sodiumModule;
          }
          // Check if it has a default export (ESM)
          else if (sodiumModule?.default) {
            const defaultExport = sodiumModule.default;
            if (defaultExport.ready !== undefined || typeof defaultExport.ready === "function") {
              sodium = defaultExport;
            } else {
              // Default might be the sodium object itself
              sodium = defaultExport;
            }
          }
          // Last resort: use the module itself
          else if (sodiumModule) {
            sodium = sodiumModule;
          }
          
          if (!sodium) {
            throw new Error(`Invalid module structure. Module keys: ${Object.keys(sodiumModule || {}).join(", ")}`);
          }
          
          // ready is a Promise property, not a function
          if (sodium.ready === undefined) {
            throw new Error(`Module does not have ready property. Available keys: ${Object.keys(sodium).slice(0, 10).join(", ")}`);
          }
          
          // Wait for sodium to be ready (ready is a Promise)
          await sodium.ready;
          return sodium;
        } catch (error) {
          _sodiumPromise = null; // Reset on error so we can retry
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to load libsodium-wrappers: ${errorMessage}`);
        }
      })();
    }
    _sodium = await _sodiumPromise;
  }
  return _sodium;
}

async function getKeyFromEnv(): Promise<Uint8Array> {
  const sodium = await getSodium();
  const keyHex = process.env.AEAD_SECRET_KEY;
  if (!keyHex) {
    throw new Error("AEAD_SECRET_KEY environment variable is not set");
  }
  return Buffer.from(keyHex, "hex");
}

async function getSlackKeyFromEnv(): Promise<Uint8Array> {
  const sodium = await getSodium();
  const keyHex = process.env.SLACK_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("SLACK_ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(keyHex, "hex");
}

export async function encodeApiKey(name: string, value: string): Promise<{ value: string; nonce: string }> {
  try {
    const sodium = await getSodium();
    const key = await getKeyFromEnv();

    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const additionalData = new TextEncoder().encode(name);

    const encrypted = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      new TextEncoder().encode(value),
      additionalData,
      null,
      nonce,
      key
    );

    return {
      value: Buffer.from(encrypted).toString("hex"),
      nonce: Buffer.from(nonce).toString("hex"),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to encode api_key ${name}: ${errorMessage}`);
  }
}

export async function decodeApiKey(name: string, nonce: string, value: string): Promise<string> {
  try {
    const sodium = await getSodium();
    const key = await getKeyFromEnv();

    if (!nonce || !value) {
      throw new Error(`Missing nonce or encrypted value for api_key ${name}`);
    }

    const nonceBytes = Buffer.from(nonce, "hex");
    const encryptedBytes = Buffer.from(value, "hex");
    const additionalData = new TextEncoder().encode(name);

    const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      encryptedBytes,
      additionalData,
      nonceBytes,
      key
    );
    
    const decoded = new TextDecoder().decode(decrypted);
    
    if (!decoded || decoded.trim().length === 0) {
      throw new Error(`Decoded api_key ${name} is empty`);
    }
    
    return decoded;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decode api_key ${name}: ${errorMessage}`);
  }
}

export async function encodeSlackToken(teamId: string, token: string): Promise<{ value: string; nonce: string }> {
  try {
    const sodium = await getSodium();
    const key = await getSlackKeyFromEnv(); // Use Slack-specific key

    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const additionalData = new TextEncoder().encode(teamId);

    const encrypted = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      new TextEncoder().encode(token),
      additionalData,
      null,
      nonce,
      key
    );

    return {
      value: Buffer.from(encrypted).toString("hex"),
      nonce: Buffer.from(nonce).toString("hex"),
    };
  } catch (error) {
    throw new Error(`Failed to encode Slack token for team ${teamId}`);
  }
}
