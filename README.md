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

## Configuration

All runtime configuration lives in `data/config.yaml`. See spec §4 for the full schema (P0 ships only the `owner` and `log` sections).

## Reset Owner Password

Edit `data/config.yaml` → restart the app. The bootstrap step replaces the owner's password hash on every boot.

## Project Spec

`docs/superpowers/specs/2026-05-15-babyloom-v2-rebuild-design.md`
