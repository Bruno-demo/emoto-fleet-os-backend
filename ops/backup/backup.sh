#!/bin/sh
set -eu

# Creates the backup directory if it does not already exist.
ensure_backup_dir() {
  mkdir -p "${BACKUP_DIR}"
}

# Performs a single pg_dump and writes a timestamped archive.
run_backup() {
  timestamp="$(date +%Y%m%d_%H%M%S)"
  filename="${BACKUP_PREFIX:-emoto}-postgres-${timestamp}.dump"
  target_path="${BACKUP_DIR}/${filename}"

  echo "Starting backup to ${target_path}"

  PGPASSWORD="${POSTGRES_PASSWORD}" \
    pg_dump \
    --format=custom \
    --no-owner \
    --no-acl \
    --host="${POSTGRES_HOST:-postgres}" \
    --port="${POSTGRES_PORT:-5432}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --file="${target_path}"

  echo "Backup completed"
}

# Removes backups older than the configured retention window.
prune_backups() {
  retention_days="${BACKUP_RETENTION_DAYS:-14}"
  find "${BACKUP_DIR}" -type f -name "*.dump" -mtime "+${retention_days}" -delete
}

# Runs backups either once or in a continuous loop for cron-like behavior.
main() {
  ensure_backup_dir

  if [ "${BACKUP_LOOP:-false}" = "true" ]; then
    interval="${BACKUP_INTERVAL_SECONDS:-86400}"
    while true; do
      run_backup
      prune_backups
      echo "Sleeping for ${interval}s"
      sleep "${interval}"
    done
  else
    run_backup
    prune_backups
  fi
}

main
