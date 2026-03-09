#!/bin/sh
set -eu

# Restores a pg_dump archive into the configured database.
restore_backup() {
  if [ -z "${1:-}" ]; then
    echo "Usage: /backup/restore.sh /backups/your-backup.dump"
    exit 1
  fi

  dump_path="$1"

  if [ ! -f "${dump_path}" ]; then
    echo "Backup file not found: ${dump_path}"
    exit 1
  fi

  echo "Restoring ${dump_path}"

  PGPASSWORD="${POSTGRES_PASSWORD}" \
    pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --host="${POSTGRES_HOST:-postgres}" \
    --port="${POSTGRES_PORT:-5432}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    "${dump_path}"

  echo "Restore completed"
}

restore_backup "$@"
