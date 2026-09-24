# Proman

[![CI](https://github.com/sam2-s/Proman/actions/workflows/ci.yml/badge.svg)](https://github.com/sam2-s/Proman/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-Axum-orange.svg)](https://www.axum.rs)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-blue.svg)](https://expo.dev)

**Proman** is a cross-platform project management tool — Kanban boards, timelines, calendars, and team collaboration that runs on **web**, **iOS**, and **Android** from a single codebase.

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Expo (React Native + react-native-web) |
| Backend  | Rust · Axum · Tokio                 |
| Database | SQLite (via sqlx)                   |
| Auth     | JWT (register / login)              |
| Realtime | WebSockets                          |
| Files    | Local disk uploads                  |

## Features

- **Kanban boards** — drag-and-drop columns (To Do / In Progress / Done…)
- **Tasks & subtasks** — due dates, priorities, assignees, checklists
- **Timeline / Gantt** — schedule view with task bars over time
- **Calendar view** — tasks and deadlines on a monthly calendar
- **Team collaboration** — projects, members, roles, comments
- **File attachments** — upload and download files on tasks
- **Live updates** — board changes sync in real time over WebSockets
- **Cross-platform** — one app runs in the browser and on phones

## Project layout

```
Proman/
├── server/     # Rust API (Axum) + SQLite + WebSocket hub
└── app/        # Expo app (web + iOS + Android)
```

## Quick start

### Prerequisites

- Rust (stable) — https://rustup.rs
- Node.js 20+ — https://nodejs.org
- Expo Go on your phone (for mobile testing)

### 1. Backend

```bash
cd server
cargo run
```

API listens on `http://localhost:3000`. SQLite database is created automatically at `server/proman.db`.

Optional — seed a demo account:

```bash
./scripts/seed.sh
# login: demo@proman.dev / password123
```

### 2. Frontend

```bash
cd app
npm install
npx expo start
```

- Press `w` → open in the browser (web)
- Scan the QR code with **Expo Go** → run on your phone
- Press `a` → Android emulator (requires Android SDK)

### 3. Smoke test

```bash
./scripts/smoke.sh
```

Or use the Makefile:

```bash
make server   # API
make web      # Expo web
make check    # cargo check + tsc
```

## API overview

| Method | Path                          | Description              |
|--------|-------------------------------|--------------------------|
| POST   | `/api/auth/register`          | Create an account        |
| POST   | `/api/auth/login`             | Log in, receive JWT      |
| GET    | `/api/me`                     | Current user             |
| GET    | `/api/projects`               | List my projects         |
| POST   | `/api/projects`               | Create a project         |
| GET    | `/api/projects/:id`           | Project detail + members |
| POST   | `/api/projects/:id/members`   | Add a member             |
| GET    | `/api/boards/:id`             | Board with columns/cards |
| POST   | `/api/projects/:id/boards`    | Create a board           |
| POST   | `/api/boards/:id/columns`     | Create a column          |
| POST   | `/api/columns/:id/cards`      | Create a task card       |
| PATCH  | `/api/cards/:id`              | Update (move, edit)      |
| DELETE | `/api/cards/:id`              | Delete a card            |
| GET    | `/api/cards/:id/subtasks`     | List subtasks            |
| POST   | `/api/cards/:id/subtasks`     | Add a subtask            |
| GET    | `/api/cards/:id/comments`     | List comments            |
| POST   | `/api/cards/:id/comments`     | Add a comment            |
| POST   | `/api/cards/:id/attachments`  | Upload a file            |
| GET    | `/api/attachments/:id`        | Download a file          |
| WS     | `/ws?project_id=`             | Realtime board events    |

## License

MIT
