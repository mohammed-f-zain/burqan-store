# Burqan Store — monorepo

This repository contains:

- `packages/api` — Node.js + Express + PostgreSQL REST API (`/api/v1/...`)
- `packages/dashboard` — React (Vite) admin + public store-owner page (`/owner?t=...`)
- `packages/mobile` — Expo (React Native) rep app (QR scan + registration)

## Security (read first)

- **Never commit `.env` files or server passwords.** If any password was shared in chat, email, or tickets, treat it as compromised: **change it immediately** on the server and anywhere else it was reused.
- Prefer **SSH keys** for deployment and disable password SSH logins after keys work.
- Put production secrets only in **GitHub Actions secrets** or your VPS environment — not in the repo.

## Local development

### 1) PostgreSQL

**Option A — Docker (recommended for local testing)**

From the repo root:

```bash
npm run docker:up
```

Use this in `packages/api/.env`:

`DATABASE_URL=postgresql://burqan:burqan@127.0.0.1:15433/burqan`

(Default in `docker-compose.yml` maps container port **5432** to host **15433** to avoid clashes with a local Postgres on **5432**.)

**Option B — Your own Postgres**

Create a database and user, then set `packages/api/.env` (copy from `packages/api/.env.example`).

Run schema + seed + QR pool (use `QR_POOL_TARGET=100` for a faster local pool):

```bash
cd packages/api
cp .env.example .env   # then edit DATABASE_URL and JWT secrets
npm run migrate
npm run seed
QR_POOL_TARGET=100 npm run gen:qr
```

### 2) API

```bash
npm run api:dev
```

Postman: import `tools/postman/Burqan-Store.postman_collection.json` and set `baseUrl`.

### 3) Dashboard

```bash
cp packages/dashboard/.env.example packages/dashboard/.env.local
npm run dashboard:dev
```

### 4) Mobile (Expo)

```bash
npm run mobile:start
```

Set `EXPO_PUBLIC_API_URL` (e.g. in `packages/mobile/.env`) to a reachable URL for a physical device (not `localhost`).

### APK (internal distribution)

From `packages/mobile` (requires an Expo account for EAS):

```bash
npx eas-cli@latest build --profile preview --platform android
```

## VPS (Hostinger KVM, Ubuntu) — outline

1. Install Node 20+, PostgreSQL, nginx, certbot, pm2, git.
2. Create a **non-root** deploy user with sudo for service reloads only if needed.
3. Clone this repo to e.g. `/var/www/burqan-store`, configure `packages/api/.env` on the server, run `npm ci`, `npm run build -w @burqan/api`, `npm run migrate -w @burqan/api`, `npm run seed -w @burqan/api`, `npm run gen:qr -w @burqan/api` once, then `pm2 start ecosystem.config.cjs --only burqan-api` from the repo root.
4. Point **api.** subdomain to nginx `proxy_pass` to `http://127.0.0.1:4000` (see `infra/nginx-api.conf.example`).
5. Build the dashboard (`npm run build -w @burqan/dashboard`) and serve `packages/dashboard/dist` as static files for `burqan.store` (or use a separate static host).

## GitHub → auto deploy

Workflow: `.github/workflows/deploy-api.yml` (SSH pull + build + `pm2 reload`).

Configure repository secrets:

- `VPS_HOST` — server IP or hostname  
- `VPS_USER` — SSH user (not root)  
- `VPS_SSH_KEY` — **private** key (full PEM)  
- `VPS_SSH_PORT` — optional, default 22  
- `DEPLOY_PATH` — absolute path to the git clone on the server  

## QR printing

Each row in `qr_codes` has a `public_token`. Encode URLs like:

`https://burqan.store/r/<public_token>` (you can add a tiny public redirect page later) or a custom scheme for the app. The rep app resolves tokens via `GET /api/v1/rep/qr/:token`.

**Where to see generated pool codes:** after `npm run gen:qr` (or `QR_POOL_TARGET=… npm run gen:qr`) in `packages/api`, open the admin dashboard → **Card QR codes** (`/app/qr-pool`). You need the `qr_pool.read` permission (super admins have all permissions). The page lists tokens that are **not** linked to a store yet, with optional QR images. Set `VITE_QR_PAYLOAD_BASE_URL` in the dashboard env (see `packages/dashboard/.env.example`) so each QR encodes the same URL shape you print on cards.

Owner portal link format (returned after registration): `https://burqan.store/owner?t=<owner_portal_token>` (dashboard route reads `t` and calls the public API).
