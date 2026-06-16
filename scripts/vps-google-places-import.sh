#!/usr/bin/env bash
# VPS helper — backup + start Google Places import in background (safe for long runs).
#
#   bash scripts/vps-google-places-import.sh backup
#   bash scripts/vps-google-places-import.sh batch
#   bash scripts/vps-google-places-import.sh batch --include-amman
#   bash scripts/vps-google-places-import.sh single --governorate=الزرقاء
#   bash scripts/vps-google-places-import.sh single --governorate=عمان --regenerate
#   bash scripts/vps-google-places-import.sh status
#   bash scripts/vps-google-places-import.sh counts

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

LOG_DIR="$ROOT/logs"
BACKUP_DIR="$ROOT/backups"
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

load_env() {
  if [[ -f packages/api/.env ]]; then
    set -a
    # shellcheck disable=SC1091
    source packages/api/.env
    set +a
  fi
  if [[ -z "${DATABASE_URL:-}" && -f /root/.burqan-db-url ]]; then
    set -a
    # shellcheck disable=SC1091
    source /root/.burqan-db-url
    set +a
  fi
}

cmd_backup() {
  load_env
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL not set (packages/api/.env or /root/.burqan-db-url)" >&2
    exit 1
  fi
  local out="$BACKUP_DIR/google_map_places_$(date +%F_%H%M%S).sql"
  pg_dump "$DATABASE_URL" -t google_map_places -f "$out"
  echo "Backup: $out"
  ls -lh "$out"
}

cmd_status() {
  echo "=== Running import processes ==="
  ps aux | grep -E '[i]mport-google-places|[v]ps-google-places-import|[i]mport-google-places-batch' || echo "(none)"
  echo ""
  echo "=== Latest runner log ==="
  ls -t "$LOG_DIR"/google_import_runner.out 2>/dev/null | head -1 | xargs -I{} sh -c 'echo {}; tail -30 {}' || echo "(no runner log)"
  echo ""
  echo "=== Latest detail log ==="
  ls -t "$LOG_DIR"/google_import_*.log 2>/dev/null | head -1 | xargs -I{} sh -c 'echo {}; tail -20 {}' || echo "(no detail log)"
}

cmd_counts() {
  load_env
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL not set" >&2
    exit 1
  fi
  psql "$DATABASE_URL" -c "
    SELECT COALESCE(a.governorate, 'unknown') AS governorate, COUNT(*)::int AS stores
    FROM google_map_places g
    LEFT JOIN areas a ON a.id = g.area_id
    WHERE g.matched_store_id IS NULL
    GROUP BY a.governorate
    ORDER BY stores DESC;
  "
}

running_import() {
  if pgrep -f 'import-google-places' >/dev/null 2>&1; then
    echo "ERROR: An import is already running. Check: bash scripts/vps-google-places-import.sh status" >&2
    exit 1
  fi
}

cmd_batch() {
  local include_amman=0 regenerate=0 backup_first=1
  for arg in "$@"; do
    case "$arg" in
      --include-amman) include_amman=1 ;;
      --regenerate) regenerate=1 ;;
      --no-backup) backup_first=0 ;;
    esac
  done

  running_import
  git -C "$ROOT" fetch origin main 2>/dev/null || true
  git -C "$ROOT" reset --hard origin/main 2>/dev/null || true

  if [[ "$backup_first" == 1 ]]; then
    cmd_backup
  fi

  local runner="$LOG_DIR/google_import_runner.out"
  local env_prefix=""
  [[ "$include_amman" == 1 ]] && env_prefix="INCLUDE_AMMAN=1 "
  [[ "$regenerate" == 1 ]] && env_prefix="${env_prefix}REGENERATE=1 "

  echo "Starting batch import in background..."
  nohup env $env_prefix bash "$ROOT/scripts/import-google-places-batch.sh" >"$runner" 2>&1 &
  echo "PID: $!"
  echo "Watch: tail -f $runner"
}

cmd_single() {
  local governorate="" regenerate=0 backup_first=1
  for arg in "$@"; do
    case "$arg" in
      --governorate=*) governorate="${arg#*=}" ;;
      --regenerate) regenerate=1 ;;
      --no-backup) backup_first=0 ;;
    esac
  done

  if [[ -z "$governorate" ]]; then
    echo "ERROR: --governorate=... required (e.g. --governorate=عمان)" >&2
    exit 1
  fi

  running_import
  load_env

  if [[ "$backup_first" == 1 ]]; then
    cmd_backup
  fi

  local runner="$LOG_DIR/google_import_${governorate}_$(date +%F_%H%M%S).out"
  local reg_flag=""
  [[ "$regenerate" == 1 ]] && reg_flag="--regenerate=1"

  echo "Starting import for $governorate in background..."
  nohup bash -c "
    set -u
    cd '$ROOT'
    echo '=== Importing $governorate ==='
    npm run import:google-places -w @burqan/api -- --governorate='$governorate' $reg_flag
    echo '=== Refresh area matching ==='
    npm run refresh:google-place-areas -w @burqan/api
    echo 'Finished: \$(date)'
  " >"$runner" 2>&1 &
  echo "PID: $!"
  echo "Watch: tail -f $runner"
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/vps-google-places-import.sh backup
  bash scripts/vps-google-places-import.sh batch [--include-amman] [--regenerate] [--no-backup]
  bash scripts/vps-google-places-import.sh single --governorate=الزرقاء [--regenerate] [--no-backup]
  bash scripts/vps-google-places-import.sh status
  bash scripts/vps-google-places-import.sh counts
EOF
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    backup) cmd_backup ;;
    batch) cmd_batch "$@" ;;
    single) cmd_single "$@" ;;
    status) cmd_status ;;
    counts) cmd_counts ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
