# VPS deploy (Burqan monorepo)

## Security first

- **Do not commit** server passwords, `.env`, or private keys to git.
- After first login, **rotate the root password**, create an SSH key (`ssh-copy-id`), and consider disabling password SSH in `/etc/ssh/sshd_config`.
- The GitHub Action (`.github/workflows/deploy-api.yml`) redeploys the **API** and **dashboard** on each push to `main` (`npm run build` for `@burqan/api` and `@burqan/dashboard` on the VPS; nginx serves `packages/dashboard/dist`).

## GitHub Actions (API + dashboard on push to `main`)

Add **repository secrets**: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret | Example | Notes |
|--------|---------|--------|
| `VPS_HOST` | `187.127.84.143` | **Required.** If missing, the workflow fails with *“missing server host”*. |
| `VPS_USER` | `root` or `deploy` | SSH login |
| `VPS_SSH_KEY` | Full `-----BEGIN … PRIVATE KEY-----` … `-----END …` block | **Private** key whose **public** key is in `~/.ssh/authorized_keys` on the server. This action does **not** use SSH passwords. |
| `DEPLOY_PATH` | `/var/www/burqan-store` | Path to the git clone on the VPS |

**Optional repository variables** (same page → **Variables**): set so CI writes `packages/dashboard/.env.production` before each dashboard build (recommended):

| Variable | Example |
|----------|---------|
| `DASHBOARD_VITE_API_URL` | `https://api.burqan.store` |
| `DASHBOARD_VITE_QR_PAYLOAD_BASE_URL` | `https://burqan.store` |

If `DASHBOARD_VITE_API_URL` is unset, the workflow keeps the server’s existing `packages/dashboard/.env.production` (e.g. from bootstrap). If that file is missing or has no `VITE_API_URL=`, the dashboard build step fails with a clear Actions log message.

### If Actions fails: `unable to authenticate … no supported methods remain`

That message means the runner reached your host over SSH, but **no public key you offered was accepted**. The Action only uses **`VPS_SSH_KEY`** (no password). Fix it on the server side:

1. **`VPS_USER` must be the account whose `authorized_keys` you edit.** If the secret says `deploy`, the public key must be in `/home/deploy/.ssh/authorized_keys`, not only in `root`.

2. **The public key on the server must be the pair of the private key in `VPS_SSH_KEY`.** On any machine that has the **same** private key file you pasted into GitHub (saved locally as `key.pem` for this check only):

   ```bash
   ssh-keygen -lf key.pem          # fingerprint
   ssh-keygen -y -f key.pem        # prints the ONE-line public key — must appear verbatim in authorized_keys
   ```

3. **On the VPS** (use your host’s web console / recovery login if normal SSH still fails):

   ```bash
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   nano ~/.ssh/authorized_keys     # paste the single ssh-ed25519 or ssh-rsa line from step 2
   chmod 600 ~/.ssh/authorized_keys
   ```

4. **Test from your laptop** before re-running the workflow (use the same private key file):

   ```bash
   ssh -i ./key.pem -o IdentitiesOnly=yes "${VPS_USER}@${VPS_HOST}" 'echo ok'
   ```

5. **Common mistakes:** private key pasted into GitHub without the first/last line (`-----BEGIN` / `-----END`); extra spaces; only the `.pub` file was pasted into the secret (wrong — the secret must be the **private** key); key was created with a **passphrase** — then `appleboy/ssh-action` needs a `passphrase` input wired to another secret (see [ssh-action](https://github.com/appleboy/ssh-action) README).

Generate a deploy key (on your Mac):

```bash
ssh-keygen -t ed25519 -f ./burqan-github-deploy -N ""
cat burqan-github-deploy.pub   # add this ONE line to /root/.ssh/authorized_keys on the server
cat burqan-github-deploy       # paste ENTIRE output into GitHub secret VPS_SSH_KEY
```

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

**TLS (HTTPS):** DNS for `burqan.store`, `www.burqan.store`, and `api.burqan.store` must point to this server **before** you run certbot.

**Option A — scripted (recommended):** on the VPS, set your email and run:

```bash
export CERTBOT_EMAIL='your-real-email@example.com'
bash /var/www/burqan-store/infra/enable-tls-certbot.sh
```

Optional: `DOMAIN_ROOT=burqan.store DOMAIN_API=api.burqan.store` (same defaults).

**Option B — interactive:**

```bash
sudo certbot --nginx -d burqan.store -d www.burqan.store -d api.burqan.store
```

Use a real email when certbot asks. After success, **renewal** is usually enabled automatically (`certbot.timer`). Test with: `sudo certbot renew --dry-run`.

### HTTP works but HTTPS does not

Our nginx repo configs are **HTTP-only on port 80** until certbot succeeds; then certbot adds `listen 443 ssl` and certificate paths. If you never ran certbot (or it failed), **nothing listens on 443** — browsers time out or show “connection refused” for `https://…`.

On the **VPS**, run in order:

```bash
# 1) Is anything listening on 443?
sudo ss -tlnp | grep ':443'

# 2) Does nginx mention SSL for your hosts?
sudo nginx -T 2>/dev/null | grep -E 'listen 443|ssl_certificate' | head -20

# 3) Did Let’s Encrypt issue a cert?
sudo certbot certificates
```

- If **step 1 is empty** and **step 3 shows no certificate**, run `infra/enable-tls-certbot.sh` (with `CERTBOT_EMAIL`) or interactive `sudo certbot --nginx -d …` and fix any error in `/var/log/letsencrypt/letsencrypt.log`.
- **Firewall:** Ubuntu UFW should allow 443 (`sudo ufw status`; use `sudo ufw allow 443/tcp` or `sudo ufw allow 'Nginx Full'`). Also open **TCP 443** in your **hosting panel** (cloud “firewall” / security group) if the provider has one — HTTP can work while 443 is still blocked there.
- **DNS:** `dig +short burqan.store A` and `dig +short api.burqan.store A` must return **this server’s IPv4**. If you have **AAAA** (IPv6) records, they must point to this box too; a wrong AAAA often breaks HTTPS for some networks while HTTP “works” over IPv4.
- After certbot edits nginx, always: `sudo nginx -t && sudo systemctl reload nginx`.

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
