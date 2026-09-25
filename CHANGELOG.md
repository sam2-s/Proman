# Changelog

All notable changes to Proman are documented here.

## [Unreleased]

### Added
- Username-only accounts: register/login/invite by username; email removed
  from every API response and UI surface (legacy DB rows backfilled)
- User avatars: upload (`POST /api/me/avatar`), public
  (`GET /api/avatars/:id`), initials fallback component
- Global admin (`users.is_admin`, bootstrap via `PROMAN_ADMIN_USERNAME`)
  plus project roles `owner`/`admin`/`editor`/`viewer` — enforced
  server-side on every mutation route
- Member management: invite by username, `PATCH` role change, `DELETE` remove
- Admin console (`/admin`): user list, grant/revoke admin, delete user
- Viewer read-only everywhere: board drag, column/card create/delete,
  task edits, comments, subtasks, uploads all disabled for viewers
- Full TUI redesign: monospace, box-drawing panels, `[ bracket ]` buttons,
  status bars, zero radius; dark terminal (default), light paper, and
  system themes persisted locally
- Unified `Loading` and `EmptyState` components across screens
- Touch drag-and-drop on the Kanban board with ghost preview
- Column rename (✎) and delete with cascade confirm
- Assignee picker on tasks and avatar initials on cards
- Mobile file attach via expo-document-picker
- Project-wide task search (`GET /api/search`)
- Activity feed per project
- In-app notifications (comments, assignments) with unread list
- Dark mode via system color scheme (`userInterfaceStyle: automatic`)
- EAS `preview` profile builds Android APK (`buildType: "apk"`)
- Local Gradle `make apk` target and `expo prebuild`
- SQLite foreign keys enabled for cascade deletes
- Server unit tests for auth JWT/password and priority validation
- Pagination (`limit`/`offset`) for activity and notifications,
  plus `GET /api/notifications/unread-count`
- Unread badge on the bell; "Load more" on notifications and activity
- Friendlier empty states for search, notifications, and activity
- ESLint (eslint-config-expo) with a clean lint run
- CI: lint step, concurrency cancellation, and job timeouts
- Server unit tests for API error responses and WebSocket event routing

## [0.1.0] — 2026-09-24

### Added
- Rust Axum API with SQLite, JWT auth, and WebSocket hub
- Projects, boards, columns, cards, subtasks, comments, attachments
- Expo (React Native + web) client with expo-router
- Kanban board screen with move controls and quick-add
- Task detail modal: priority, dates, subtasks, comments, files
- Monthly calendar view with due-date indicators
- Gantt timeline with priority-colored bars and today marker
- Team members screen
- Realtime board sync over WebSockets with reconnect
- CI workflow (cargo fmt/clippy/build + TypeScript check)
- Docs: API, data model, security, development guide
