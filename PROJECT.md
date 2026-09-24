# Proman 📋

> Cross-platform project management — Kanban, Gantt, calendar & team collaboration on web, iOS, and Android.

**Status:** 🚧 under active development

## What is Proman?

Proman is a project management tool built with a **single Expo codebase** (web + mobile) and a **lightweight Rust backend**.

### Highlights

- ✅ Kanban boards with drag & drop
- ✅ Tasks, subtasks, priorities, due dates
- ✅ Timeline / Gantt scheduling
- ✅ Calendar view
- ✅ Team members, roles & comments
- ✅ File attachments
- ✅ Realtime sync over WebSockets
- ✅ JWT authentication

## Quick start

```bash
# Backend
cd server && cargo run

# Frontend (new terminal)
cd app && npm install && npx expo start
```

Then open `http://localhost:8081` in a browser or scan the QR code with Expo Go.

See [README.md](README.md) for full documentation and the API reference.

## Architecture

```
┌─────────────────────────────┐
│   Expo App (RN + Web)       │
│  Kanban · Gantt · Calendar  │
└──────────────┬──────────────┘
               │ REST + WebSocket
┌──────────────▼──────────────┐
│   Rust · Axum · Tokio       │
│   JWT auth · WS hub         │
└──────────────┬──────────────┘
               │ sqlx
┌──────────────▼──────────────┐
│        SQLite DB            │
└─────────────────────────────┘
```

## License

MIT © [Sammy](https://github.com/sam2-s)
