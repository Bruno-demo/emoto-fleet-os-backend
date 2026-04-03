// Browser sessions now rely on httpOnly cookies; the helpers remain no-ops for compatibility.
export function readAuthToken(): string | null {
  return null;
}

export function writeAuthToken(): void {}

export function clearAuthToken(): void {}
