# Security

## Reporting

Please report security issues privately via GitHub Security Advisories on this
repository rather than opening a public issue.

## Measures in place

- Passwords hashed with **Argon2id** (memory-hard KDF)
- Stateless **JWT** auth (7-day expiry) sent as `Authorization: Bearer`
- SQL uses **parameterized queries** exclusively (no string interpolation)
- **SQLite foreign keys** enabled (`PRAGMA foreign_keys=ON`) for cascade deletes
- CORS defaults to open origin in development — restrict before deploying
- File uploads capped at **20 MB**; stored outside the web root under `uploads/`
- WebSocket connections require a valid JWT at upgrade time
- Project routes check **role** on every request
  (`owner`/`admin`/`editor`/`viewer`; viewers are strictly read-only)
- Global admin flag (`users.is_admin`) elevates to admin power everywhere;
  admins cannot self-revoke, self-delete, or strip the project owner
- Accounts are **username-only** — no email is collected, returned, or rendered
- Avatar uploads: multipart, 5 MB cap, content-type allowlist, stored as
  `avatar_<id>.<ext>` outside the web root
- Search and activity endpoints filter by project membership

## Before production

1. Set a strong `JWT_SECRET` environment variable.
2. Tighten `CorsLayer` to your real web origin.
3. Serve the API behind TLS.
4. Back up `proman.db` and the `uploads/` directory.
