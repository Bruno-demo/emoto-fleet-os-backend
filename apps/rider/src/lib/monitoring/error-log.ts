interface ErrorLogMeta {
  feature?: string;
  operation?: string;
  status?: number;
}

// Emits PII-safe error telemetry for rider app failures and recoverable warnings.
export function logAppError(
  context: string,
  error: unknown,
  meta: ErrorLogMeta = {},
): void {
  const event = {
    context,
    feature: meta.feature,
    operation: meta.operation,
    status: meta.status,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    timestamp: new Date().toISOString(),
  };

  console.warn('[rider-app-error]', JSON.stringify(event));
}
