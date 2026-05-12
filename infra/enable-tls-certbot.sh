#!/usr/bin/env bash
# Issue Let's Encrypt certificates and wire nginx + HTTPS (Ubuntu, nginx + certbot).
# Run on the VPS as root after:
#   - DNS A/AAAA for DOMAIN_ROOT, www.DOMAIN_ROOT, and DOMAIN_API point to this server
#   - nginx site configs are installed and HTTP (port 80) works for those names
#
# Usage:
#   export CERTBOT_EMAIL='you@example.com'
#   bash /var/www/burqan-store/infra/enable-tls-certbot.sh
#
# Optional overrides:
#   DOMAIN_ROOT=burqan.store DOMAIN_API=api.burqan.store
set -euo pipefail

DOMAIN_ROOT="${DOMAIN_ROOT:-burqan.store}"
DOMAIN_API="${DOMAIN_API:-api.burqan.store}"
EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$EMAIL" ]]; then
  echo "Set CERTBOT_EMAIL to your real address (Let's Encrypt expiry notices), e.g.:"
  echo "  export CERTBOT_EMAIL='admin@yourdomain.com'"
  echo "  bash $0"
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "Installing certbot + nginx plugin…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi

# Let’s Encrypt must reach port 80 on the public hostname; browsers use 443 for HTTPS.
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "UFW is active — ensuring HTTP/HTTPS are allowed (idempotent)…"
  ufw allow 80/tcp comment 'HTTP ACME + redirect' >/dev/null || true
  ufw allow 443/tcp comment 'HTTPS' >/dev/null || true
fi

nginx -t
systemctl reload nginx

echo "Listening before certbot (expect :80, no :443 until certs exist):"
ss -tlnp | grep -E ':80|:443' || true

echo "Requesting certificates for ${DOMAIN_ROOT}, www.${DOMAIN_ROOT}, ${DOMAIN_API}…"
if ! certbot --nginx \
  --non-interactive \
  --agree-tos \
  --redirect \
  -m "$EMAIL" \
  -d "$DOMAIN_ROOT" \
  -d "www.${DOMAIN_ROOT}" \
  -d "$DOMAIN_API"; then
  echo "Certbot failed — see: sudo tail -80 /var/log/letsencrypt/letsencrypt.log"
  echo "Fix DNS/firewall/nginx, then re-run this script (or: sudo certbot --nginx -d ...)"
  exit 1
fi

nginx -t
systemctl reload nginx

echo "--- After certbot ---"
ss -tlnp | grep -E ':80|:443' || true
certbot certificates 2>/dev/null || true

echo "Done. Check renewal timer: systemctl status certbot.timer || true"
echo "Dry-run renew: sudo certbot renew --dry-run"
