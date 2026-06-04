#!/usr/bin/env bash
# Allow GitHub Actions runner IPs to reach SSH (port 22) through UFW.
# Run on the VPS as root when deploy fails with: dial tcp *:22: i/o timeout
#
#   sudo bash /var/www/burqan-store/infra/sync-github-actions-ufw.sh
#
# Also check your hosting panel "cloud firewall" — UFW alone is not enough if the
# provider blocks port 22 except your home IP.

set -euo pipefail

if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw not installed — skip or install ufw first."
  exit 0
fi

if ! ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "UFW is inactive. If deploy still times out, open TCP 22 in your provider firewall."
  exit 0
fi

echo "Ensuring OpenSSH is allowed (not rate-limited)…"
ufw allow OpenSSH comment 'SSH' >/dev/null 2>&1 || ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true

META_JSON="$(curl -fsSL --max-time 30 https://api.github.com/meta)"
if ! command -v jq >/dev/null 2>&1; then
  apt-get install -y -qq jq >/dev/null 2>&1 || {
    echo "Install jq (apt install jq) and re-run."
    exit 1
  }
fi

COUNT=0
while IFS= read -r cidr; do
  [[ -n "$cidr" ]] || continue
  ufw allow from "$cidr" to any port 22 proto tcp comment 'GitHub Actions' >/dev/null 2>&1 || true
  COUNT=$((COUNT + 1))
done < <(echo "$META_JSON" | jq -r '.actions[]?')

echo "Added/updated UFW rules for $COUNT GitHub Actions CIDRs on port 22."
ufw status numbered | head -40
echo ""
echo "Re-run the GitHub Actions deploy workflow. If it still times out, allow TCP 22 from 0.0.0.0/0 in your VPS provider control panel."
