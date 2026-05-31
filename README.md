# QuackHacks 3

Team Defenestrator's monorepo scaffold for a browser-based pose party game.

This repository wires the game frontend and backend into a single Cloudflare Worker deployment while keeping separate `apps/web` and `apps/server` workspaces for day-to-day development.

## Prerequisites

- Node.js 24 or newer
- PNPM 10 or newer
- A logged-in Wrangler session for Cloudflare deploys

The Worker uses Hono for HTTP routes, Durable Objects for live game coordination, and Drizzle over Cloudflare D1 for SQL data.

## Project Structure

```text
apps/
  server/   Hono Worker API, Durable Object WebSocket coordinator, Drizzle schema
  web/      Vite React TypeScript frontend
packages/
  shared/   Shared pose, scoring, and leaderboard types/utilities
```

## Install

```powershell
pnpm install
```

## Run In Development

Start the API and web app together:

```powershell
pnpm dev
```

Default local URLs:

- Web app: http://localhost:5173
- Worker API/WebSocket: http://localhost:8787
- API health route: http://localhost:8787/api/health

The Vite dev server proxies `/api` and `/ws` to Wrangler.

## Useful Commands

```powershell
pnpm typecheck
pnpm build
pnpm db:generate
pnpm cf:types
```

`pnpm db:generate` creates Drizzle SQL migrations under `apps/server/drizzle`. `wrangler.jsonc` points D1 at that folder through the built-in `migrations_dir` field, so you should not pass migration file paths around by hand.

You usually do not need to run migrations manually:

- `pnpm dev` applies local D1 migrations before starting Wrangler.
- `pnpm cf:dev` applies local D1 migrations before starting only the Worker.
- `pnpm cf:deploy` applies remote D1 migrations before deploying.

The direct migration commands are still available for debugging or CI plumbing:

```powershell
pnpm db:migrate:local
pnpm db:migrate:remote
```

## Deploy

```powershell
pnpm cf:provision
pnpm cf:deploy
```

`pnpm cf:provision` creates or finds the `quackhacks3` D1 database on the configured account and writes the database id into `wrangler.jsonc`. `pnpm cf:deploy` builds the workspaces, applies remote D1 migrations, and deploys the single Worker to `workers.dev`.

## Included Pieces

- PNPM monorepo workspace
- Vite + React + TypeScript frontend
- Hono + Cloudflare Workers TypeScript backend
- Hono typed client usage from the frontend via `hono/client`
- Drizzle ORM schema and Cloudflare D1 migrations
- Durable Object WebSocket route at `/ws`
- MediaPipe Tasks Vision dependency and a webcam test page
- p5.js placeholder canvas on the temp game page
- p2 physics dependency ready for later game logic
- Temp pages for home, game, saboteur, settings, leaderboard, and score