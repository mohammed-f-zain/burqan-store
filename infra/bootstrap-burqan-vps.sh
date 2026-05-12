#!/usr/bin/env bash
# First-time Ubuntu VPS setup for Burqan monorepo (API + Postgres + nginx + pm2).
# Run as root. Safe to re-run: skips clone if repo exists, skips .env if present.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

REPO_URL="${REPO_URL:-https://github.com/mohammed-f-zain/burqan-store.git}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/burqan-store}"
DOMAIN_ROOT="${DOMAIN_ROOT:-burqan.store}"
DOMAIN_API="${DOMAIN_API:-api.burqan.store}"

log() { echo "[burqan-bootstrap] $*"; }

log "apt update / install base packages (may take a few minutes)…"
apt-get update -qq
apt-get install -y -qq curl ca-certificates git nginx postgresql postgresql-contrib ufw \
  build-essential certbot python3-certbot-nginx gnupg lsb-release

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  log "Installing Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

log "Node: $(node -v)  npm: $(npm -v)"
npm install -g pm2

log "Configuring PostgreSQL user/database burqan…"
DB_PASS=$(openssl rand -hex 24)
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='burqan'" | grep -q 1; then
  log "Role burqan already exists; leaving password unchanged (see /root/.burqan-db-url if missing)."
  if [[ ! -f /root/.burqan-db-url ]]; then
    log "WARNING: /root/.burqan-db-url missing — set DATABASE_URL in packages/api/.env manually."
  fi
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER burqan WITH PASSWORD '${DB_PASS}';"
  printf 'DATABASE_URL=postgresql://burqan:%s@127.0.0.1:5432/burqan\n' "$DB_PASS" >/root/.burqan-db-url
  chmod 600 /root/.burqan-db-url
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='burqan'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE burqan OWNER burqan;"
fi

mkdir -p /var/www
if [[ ! -d "${DEPLOY_PATH}/.git" ]]; then
  log "Cloning ${REPO_URL} → ${DEPLOY_PATH}…"
  git clone --depth 1 "$REPO_URL" "$DEPLOY_PATH"
else
  log "Repo exists; pulling latest…"
  git -C "$DEPLOY_PATH" fetch --depth 1 origin main || true
  git -C "$DEPLOY_PATH" reset --hard origin/main || true
fi

cd "$DEPLOY_PATH"
log "npm ci…"
npm ci

DASH_ENV="${DEPLOY_PATH}/packages/dashboard/.env.production"
log "Writing dashboard build env → ${DASH_ENV}"
cat >"$DASH_ENV" <<EOF
VITE_API_URL=https://${DOMAIN_API}
VITE_QR_PAYLOAD_BASE_URL=https://${DOMAIN_ROOT}
EOF

ENV_FILE="${DEPLOY_PATH}/packages/api/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  log "Creating packages/api/.env (first run only)…"
  ADMIN_JWT=$(openssl rand -hex 32)
  REP_JWT=$(openssl rand -hex 32)
  DATABASE_URL_LINE=$(cat /root/.burqan-db-url)
  cat >"$ENV_FILE" <<EOF
NODE_ENV=production
PORT=4000
${DATABASE_URL_LINE}
JWT_ADMIN_SECRET=${ADMIN_JWT}
JWT_REP_SECRET=${REP_JWT}
BCRYPT_ROUNDS=12
CORS_ORIGINS=https://${DOMAIN_ROOT},https://www.${DOMAIN_ROOT}
OWNER_PORTAL_BASE_URL=https://${DOMAIN_ROOT}
QR_PAYLOAD_BASE_URL=https://${DOMAIN_ROOT}
UPLOAD_DIR=${DEPLOY_PATH}/packages/api/uploads
EOF
  chmod 600 "$ENV_FILE"
else
  log "packages/api/.env already exists — not overwriting secrets."
fi

mkdir -p "${DEPLOY_PATH}/packages/api/uploads"

log "Building API…"
npm run build -w @burqan/api

log "Running migrations…"
(cd "${DEPLOY_PATH}/packages/api" && npm run migrate)

log "Seeding (idempotent where possible)…"
(cd "${DEPLOY_PATH}/packages/api" && npm run seed) || log "seed exited non-zero — check logs if DB already seeded"

if [[ "${SKIP_QR_POOL:-}" != "1" ]]; then
  log "Generating QR pool (QR_POOL_TARGET=${QR_POOL_TARGET:-300})…"
  (cd "${DEPLOY_PATH}/packages/api" && QR_POOL_TARGET="${QR_POOL_TARGET:-300}" npm run gen:qr) || true
fi

log "Building dashboard…"
npm run build -w @burqan/dashboard

log "Installing nginx site configs…"
install -m 644 "${DEPLOY_PATH}/infra/nginx-api.conf" /etc/nginx/sites-available/burqan-api
install -m 644 "${DEPLOY_PATH}/infra/nginx-dashboard.conf" /etc/nginx/sites-available/burqan-dashboard
ln -sf /etc/nginx/sites-available/burqan-api /etc/nginx/sites-enabled/burqan-api
ln -sf /etc/nginx/sites-available/burqan-dashboard /etc/nginx/sites-enabled/burqan-dashboard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Starting PM2 API…"
pm2 delete burqan-api 2>/dev/null || true
pm2 start "${DEPLOY_PATH}/ecosystem.config.cjs" --only burqan-api
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || log "pm2 startup: run manually if needed"

log "UFW (allow SSH + HTTP/HTTPS)…"
ufw allow OpenSSH
ufw allow 'Nginx Full' || true
ufw --force enable || true

log "Done."
log "Next: obtain TLS with certbot, e.g.:"
log "  certbot --nginx -d ${DOMAIN_ROOT} -d www.${DOMAIN_ROOT} -d ${DOMAIN_API}"
log "Super admin (if seed defaults): check packages/api seed / SEED_* env — then change password after login."
