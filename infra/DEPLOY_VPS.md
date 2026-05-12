# VPS deploy (Burqan monorepo)

## Security first

- **Do not commit** server passwords, `.env`, or private keys to git.
- After first login, **rotate the root password**, create an SSH key (`ssh-copy-id`), and consider disabling password SSH in `/etc/ssh/sshd_config`.
- The GitHub Action (`.github/workflows/deploy-api.yml`) only redeploys the **API**; rebuild the dashboard on the server (or in CI) when the SPA changes.

## One-time server bootstrap

From your laptop (with `sshpass` installed), after DNS points `burqan.store` and `api.burqan.store` to the VPS:

```bash
scp infra/bootstrap-burqan-vps.sh infra/nginx-api.conf infra/nginx-dashboard.conf root@YOUR_VPS_IP:/root/
ssh root@YOUR_VPS_IP 'bash /root/bootstrap-burqan-vps.sh'
```

Or clone already includes these files on `main` — then SSH and run:

```bash
bash /var/www/burqan-store/infra/bootstrap-burqan-vps.sh
```

The script installs Node 20, nginx, PostgreSQL, pm2, UFW; creates DB/user `burqan`; clones the repo (default `https://github.com/mohammed-f-zain/burqan-store.git`); writes `packages/api/.env` once; migrates, seeds, builds API + dashboard; configures nginx; starts pm2.

**TLS:**

```bash
certbot --nginx -d burqan.store -d www.burqan.store -d api.burqan.store
```

Use a real email when certbot asks.

## Env overrides (optional)

```bash
export REPO_URL='https://github.com/you/burqan-store.git'
export DEPLOY_PATH=/var/www/burqan-store
export DOMAIN_ROOT=burqan.store
export DOMAIN_API=api.burqan.store
export SKIP_QR_POOL=1          # skip QR pool generation
export QR_POOL_TARGET=500      # smaller pool on small VPS
bash /root/bootstrap-burqan-vps.sh
```

## Credentials on the server

- **PostgreSQL app user:** `burqan` — connection string is saved once at **`/root/.burqan-db-url`** (mode `600`). The same value is copied into `packages/api/.env` on first run only.
- **JWT secrets** are generated into `packages/api/.env` on first run only.
- **Default seeded admin** (unless `SEED_*` overrides): see `packages/api/src/scripts/seed.ts` / README — **change password after first login.**
