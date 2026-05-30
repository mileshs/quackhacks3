# QuackHacks 3

Team Defenestrator's monorepo scaffold for a browser-based pose party game.

This repository does not implement the game yet. It only wires the project pieces together so the team can build on a working frontend, backend, realtime, and local database foundation.

## Prerequisites

- Node.js 24 or newer
- PNPM 10 or newer

The server uses Drizzle with a local SQLite database, so Node 24 is recommended for this scaffold.

## Project Structure

```text
apps/
  server/   Hono API, Socket.IO, Hono WebSocket route, Drizzle + local SQLite
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

Default URLs:

- Web app: http://localhost:5173
- API: http://localhost:8787
- API health route: http://localhost:8787/api/health

The Vite dev server proxies `/api`, `/ws`, and `/socket.io` to the Hono server.

## Useful Commands

```powershell
pnpm typecheck
pnpm build
pnpm db:push
```

`pnpm db:push` applies the Drizzle schema to the local SQLite database at `apps/server/data/quackhacks.sqlite`.

## Included Pieces

- PNPM monorepo workspace
- Vite + React + TypeScript frontend
- Hono + Node TypeScript backend
- Hono typed client usage from the frontend via `hono/client`
- Drizzle ORM schema for local SQLite
- Socket.IO server and client dependency
- Hono WebSocket route at `/ws`
- MediaPipe Tasks Vision dependency and a webcam test page
- p5.js placeholder canvas on the temp game page
- p2 physics dependency ready for later game logic
- Temp pages for home, game, poser, saboteur, settings, leaderboard, and score

## Environment

Copy `.env.example` values into your shell or a local `.env` loader later if needed.

```powershell
$env:PORT = "8787"
$env:CLIENT_ORIGIN = "http://localhost:5173"
$env:SQLITE_PATH = "data/quackhacks.sqlite"
```

## Notes For Next Steps

- The frontend currently has scaffold routes and proof-of-life controls only.
- The pose test starts a webcam stream and lazy-loads MediaPipe, but it does not run full pose landmark detection yet.
- The saboteur and poser pages are placeholders for the future realtime pose editor and universal-human display.
- The leaderboard writes to local SQLite through the typed Hono API.
