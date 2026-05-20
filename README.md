# Babyloom V2

家庭宝宝成长记录,自托管 PWA。

## P0 Status

Foundation in place: Next.js 15 + SQLite + better-auth + config-driven owner.

## Quick Start

```bash
pnpm install
mkdir -p data
cat > data/config.yaml <<'EOF'
owner:
  username: owner
  password: <at-least-6-chars>
  nickname: Owner
family:
  name: 我们家
app:
  baseUrl: http://localhost:3000
  secret: <at-least-32-chars-random-string>
  timezone: Asia/Shanghai
log:
  level: info
EOF
chmod 600 data/config.yaml
pnpm dev
```

Open http://localhost:3000, log in with the username + password from `data/config.yaml`.

## Tests

```bash
pnpm test           # unit + integration
pnpm test:e2e       # Playwright
pnpm typecheck
```

## Scripts

- `pnpm dev` — Next.js dev server
- `pnpm build` — production build (standalone output)
- `pnpm db:generate` — generate Drizzle migrations from schema changes
- `pnpm db:migrate` — apply pending migrations to the configured SQLite file
- `pnpm docker:build` — build `babyloom:local`
- `pnpm docker:up` — start the Docker Compose stack
- `pnpm docker:logs` — follow app container logs

## Configuration

All runtime configuration lives in `data/config.yaml`. Use `config.yaml.example` as the starting point.

## Deploy on QNAP

1. Clone this repository on the NAS.
2. Copy `config.yaml.example` to `data/config.yaml`.
3. Edit `data/config.yaml`: set a strong owner password, set `app.secret` to at least 32 random characters, and set `app.baseUrl` to the NAS-accessible URL, such as `http://192.168.1.10` or `https://baby.mynas.local`. Leaving `app.baseUrl` at localhost will break login from other devices.
4. Run `pnpm docker:build`, then `pnpm docker:up`.
5. Browse to `http://<nas-ip>` and log in with the configured owner account.

BabyLoom does not terminate HTTPS. Put it behind the NAS reverse proxy, or use a Caddy/Traefik sidecar for TLS. A minimal Caddy front door looks like:

```caddyfile
baby.mynas.local {
  reverse_proxy 127.0.0.1:80
}
```

Daily logs live in `data/logs/`. Owner-only backups are available from `/profile/data`.

## Reset Owner Password

Edit `data/config.yaml` → restart the app. The bootstrap step replaces the owner's password hash on every boot.

## Project Spec

`docs/superpowers/specs/2026-05-15-babyloom-v2-rebuild-design.md`
