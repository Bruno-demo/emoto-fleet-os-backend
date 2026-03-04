export type DependencyStatus = 'up' | 'down';

export interface HealthChecks {
  db: DependencyStatus;
  redis: DependencyStatus;
}

export interface HealthResponse {
  status: 'ok';
  checks: HealthChecks;
}

export interface HealthErrorResponse {
  status: 'error';
  checks: HealthChecks;
  errors: Partial<Record<keyof HealthChecks, string>>;
}
