import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_SECRET_VERSION = 'v1';

// Derives a fixed-size encryption key from the configured master key.
function deriveMasterKey(masterKey: string): Buffer {
  return createHash('sha256').update(masterKey).digest();
}

// Produces a deterministic SHA-256 hash for secret verification.
export function hashDeviceSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

// Encrypts a device secret using AES-256-GCM for secure at-rest verification.
export function encryptDeviceSecret(
  deviceSecret: string,
  masterKey: string,
): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, deriveMasterKey(masterKey), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(deviceSecret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_SECRET_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

// Decrypts a persisted device secret value for HMAC signature verification.
export function decryptDeviceSecret(
  encryptedSecret: string,
  masterKey: string,
): string {
  const [version, ivBase64Url, authTagBase64Url, encryptedBase64Url] =
    encryptedSecret.split(':');

  if (
    version !== ENCRYPTED_SECRET_VERSION ||
    !ivBase64Url ||
    !authTagBase64Url ||
    !encryptedBase64Url
  ) {
    throw new Error('Invalid encrypted device secret format');
  }

  const iv = Buffer.from(ivBase64Url, 'base64url');
  const authTag = Buffer.from(authTagBase64Url, 'base64url');
  const encrypted = Buffer.from(encryptedBase64Url, 'base64url');

  const decipher = createDecipheriv(
    AES_ALGORITHM,
    deriveMasterKey(masterKey),
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    },
  );
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
