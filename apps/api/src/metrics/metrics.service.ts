import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDurationSeconds: Histogram<string>;
  private readonly mqttIngestionTotal: Counter<string>;
  private readonly eventsCreatedTotal: Counter<string>;
  private readonly commandStatusTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests processed by the API.',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds.',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.mqttIngestionTotal = new Counter({
      name: 'mqtt_ingest_total',
      help: 'Total MQTT ingestion messages processed.',
      labelNames: ['kind', 'status'],
      registers: [this.registry],
    });

    this.eventsCreatedTotal = new Counter({
      name: 'events_created_total',
      help: 'Total events created by the rules engine or API.',
      labelNames: ['type', 'severity'],
      registers: [this.registry],
    });

    this.commandStatusTotal = new Counter({
      name: 'command_status_total',
      help: 'Total device command status transitions.',
      labelNames: ['status', 'type'],
      registers: [this.registry],
    });
  }

  // Returns Prometheus-compatible metrics output for scraping.
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Records one HTTP request count and duration with normalized labels.
  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    const normalizedRoute = route || 'unknown';
    const statusLabel = String(status);
    this.httpRequestsTotal.labels(method, normalizedRoute, statusLabel).inc();
    this.httpRequestDurationSeconds
      .labels(method, normalizedRoute, statusLabel)
      .observe(durationSeconds);
  }

  // Tracks MQTT ingestion counts for telemetry, event, and command acknowledgements.
  incrementMqttIngestion(kind: string, status: 'accepted' | 'rejected'): void {
    this.mqttIngestionTotal.labels(kind, status).inc();
  }

  // Tracks event creation counts by type and severity.
  incrementEventCreated(type: string, severity: string): void {
    this.eventsCreatedTotal.labels(type, severity).inc();
  }

  // Tracks device command status transitions by type and status.
  incrementCommandStatus(status: string, type: string): void {
    this.commandStatusTotal.labels(status, type).inc();
  }
}
