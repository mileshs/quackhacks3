# QuackHacks 3 — Team Defenestrator

A two-player pose-matching survival game. One player (the **athlete**) contorts
to fit through pose-shaped "holes" tracked live via webcam; the other (the
**saboteur**) draws those holes in real time. See [AGENTS.md](./AGENTS.md) for
the full game design.

> **Status:** scaffold only. This repo currently wires up every piece of the
> stack with temp routes/pages to prove the plumbing works — the actual game is
> not implemented yet.

## Stack

| Layer       | Tech                                                              |
| ----------- | ----------------------------------------------------------------- |
| Client      | Vite + React + TypeScript                                         |
| Computer vision | MediaPipe Tasks Vision (pose)                                 |
| Graphics    | p5.js                                                             |
| Backend     | Node.js + [Hono](https://hono.dev) (TypeScript)                  |
| Realtime    | Socket.IO **and** Hono native websockets (`@hono/node-ws`)       |
| API typing  | Hono RPC client (`hono/client`) — typed end-to-end from the server |
| Database    | SQLite via `better-sqlite3` (local file)                          |
| Tooling     | pnpm workspace monorepo                                           |

## Prerequisites

- **Node.js** ≥ 20 (developed on 23.x)
- **pnpm** ≥ 8 — install with `npm i -g pnpm` or `corepack enable`

`better-sqlite3` is a native module; pnpm fetches a prebuilt binary on install.
If that fails you'll need a C/C++ toolchain (Xcode CLT on macOS,
`build-essential` + `python3` on Linux) so `node-gyp` can compile it.

## Layout

```
quackhacks3/
├── apps/
│   ├── client/        # Vite + React frontend (smoke-test UI for now)
│   └── server/        # Hono + Socket.IO + Hono-WS + SQLite
├── packages/
│   └── shared/        # Types shared between client and server
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

The frontend consumes the server's `AppType` through the Hono RPC client
(`apps/client/src/api.ts`), so API routes and response shapes are fully typed —
no hand-rolled fetch wrapper.

## Getting started

```bash
pnpm install          # install all workspaces
pnpm dev              # run client + server together
```

Then open:

- **Client:** http://localhost:5173 — a smoke-test page with buttons to hit the
  server health route, read/write the SQLite leaderboard, connect Socket.IO, and
  ping the Hono websocket echo endpoint.
- **Server:** http://localhost:3001

The Vite dev server proxies `/api`, `/ws`, and `/socket.io` to the backend, so
everything is same-origin in development.

### Run just one side

```bash
pnpm dev:client       # frontend only (Vite, port 5173)
pnpm dev:server       # backend only (Hono, port 3001)
```

### Other scripts

```bash
pnpm build            # build every package
pnpm typecheck        # typecheck every package
pnpm clean            # remove build output
```

## API (temp routes)

| Method | Route                | Description                          |
| ------ | -------------------- | ------------------------------------ |
| GET    | `/api/health`        | Health check                         |
| GET    | `/api/leaderboard`   | Top scores (`?limit=`)               |
| POST   | `/api/leaderboard`   | Submit `{ name, score, survivalTime }` |
| WS     | `/ws`                | Hono native websocket echo           |
| WS     | `/socket.io`         | Socket.IO (pose relay between players) |

## Database

A SQLite file is created on first run at `apps/server/data/quackhacks.sqlite`
(override with the `DB_PATH` env var). The schema lives in
`apps/server/src/db.ts`. Database files and the `data/` directory are gitignored.

## Environment variables

| Variable  | Default                              | Used by |
| --------- | ------------------------------------ | ------- |
| `PORT`    | `3001`                               | server  |
| `DB_PATH` | `apps/server/data/quackhacks.sqlite` | server  |
