#!/usr/bin/env bash
# Safe batch import for Google Places — skips عمان by default (keeps existing Amman data).
#
# Usage (on VPS):
#   cd /var/www/burqan-store
#   nohup bash scripts/import-google-places-batch.sh > logs/google_import_runner.out 2>&1 &
#   tail -f logs/google_import_runner.out
#
# Options (env):
#   SKIP_GOVERNORATES="عمان الزرقاء"   # extra governorates to skip
#   INCLUDE_AMMAN=1                    # also import عمان (uses upsert, no --regenerate)
#   REGENERATE=1                       # pass --regenerate=1 per governorate (destructive for that gov)
#   RETRIES=1                          # retry count on failure (default 1)

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%F_%H%M%S)"
LOG_FILE="$LOG_DIR/google_import_${STAMP}.log"
RETRIES="${RETRIES:-1}"

GOVS=(
  "الزرقاء" "إربد" "المفرق" "العقبة" "الكرك" "معان"
  "الطفيلة" "مادبا" "جرش" "عجلون" "البلقاء"
)

if [[ "${INCLUDE_AMMAN:-0}" == "1" ]]; then
  GOVS=("عمان" "${GOVS[@]}")
fi

should_skip() {
  local g="$1"
  if [[ "$g" == "عمان" && "${INCLUDE_AMMAN:-0}" != "1" ]]; then
    return 0
  fi
  for s in ${SKIP_GOVERNORATES:-}; do
    if [[ "$s" == "$g" ]]; then
      return 0
    fi
  done
  return 1
}

import_one() {
  local g="$1"
  local args=(--governorate="$g")
  if [[ "${REGENERATE:-0}" == "1" ]]; then
    args+=(--regenerate=1)
  fi
  npm run import:google-places -w @burqan/api -- "${args[@]}"
}

log() {
  echo "$*" | tee -a "$LOG_FILE"
}

log "Started: $(date)"
log "Log file: $LOG_FILE"
log "Root: $ROOT"
log "INCLUDE_AMMAN=${INCLUDE_AMMAN:-0} REGENERATE=${REGENERATE:-0} RETRIES=$RETRIES"

FAILED=()
OK=()
SKIPPED=()

for g in "${GOVS[@]}"; do
  if should_skip "$g"; then
    log ""
    log "SKIP: $g"
    SKIPPED+=("$g")
    continue
  fi

  log ""
  log "=== Importing $g ==="

  attempt=0
  success=0
  while [[ $attempt -le $RETRIES ]]; do
    if [[ $attempt -gt 0 ]]; then
      log "Retry $attempt for $g ..."
    fi
    if import_one "$g" 2>&1 | tee -a "$LOG_FILE"; then
      log "OK: $g"
      OK+=("$g")
      success=1
      break
    fi
    attempt=$((attempt + 1))
  done

  if [[ $success -eq 0 ]]; then
    log "FAILED: $g (after $RETRIES retries)"
    FAILED+=("$g")
  fi
done

log ""
log "=== Refresh area matching ==="
if npm run refresh:google-place-areas -w @burqan/api 2>&1 | tee -a "$LOG_FILE"; then
  log "Refresh: OK"
else
  log "Refresh: FAILED (imported rows may need manual refresh)"
fi

log ""
log "Finished: $(date)"
log "OK (${#OK[@]}): ${OK[*]:-none}"
log "SKIP (${#SKIPPED[@]}): ${SKIPPED[*]:-none}"
log "FAILED (${#FAILED[@]}): ${FAILED[*]:-none}"

if [[ ${#FAILED[@]} -gt 0 ]]; then
  exit 1
fi
