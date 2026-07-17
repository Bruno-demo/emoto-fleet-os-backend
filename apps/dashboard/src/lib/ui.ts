// Joins optional class names without adding a runtime dependency.
export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

// Converts backend enum-like values into compact UI labels.
export function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

// Formats date-like values into a concise operator-facing timestamp.
export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

// Formats a relative age string for volatile telemetry surfaces.
export function formatTimeAgo(value: string) {
  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaSeconds = Math.max(0, Math.round(deltaMs / 1000));

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  if (deltaSeconds < 3600) {
    return `${Math.round(deltaSeconds / 60)}m ago`;
  }
  if (deltaSeconds < 86400) {
    return `${Math.round(deltaSeconds / 3600)}h ago`;
  }
  return `${Math.round(deltaSeconds / 86400)}d ago`;
}

// Returns the local date string (YYYY-MM-DD) in timezone-safe format
export function getLocalDateString(date: Date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

// Returns the local datetime string (YYYY-MM-DDTHH:mm) in timezone-safe format
export function getLocalDatetimeString(date: Date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}
