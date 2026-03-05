-- Adds encrypted device secrets for secure server-side MQTT signature verification.
ALTER TABLE "Device"
ADD COLUMN IF NOT EXISTS "secretEncrypted" TEXT;
