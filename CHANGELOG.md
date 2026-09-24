# Changelog

All notable changes to Proman are documented here.

## [Unreleased]

### Added
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

## [0.1.0] — 2026-09-24

### Added
- Rust Axum API with SQLite, JWT auth, and WebSocket hub
- Projects, boards, columns, cards, subtasks, comments, attachments
- Expo (React Native + web) client with expo-router
- Kanban board screen with move controls and quick-add
- Task detail modal: priority, dates, subtasks, comments, files
- Monthly calendar view with due-date indicators
- Gantt timeline with priority-colored bars and today marker
- Team members screen with invite-by-email
- Realtime board sync over WebSockets with reconnect
- CI workflow (cargo fmt/clippy/build + TypeScript check)
- Docs: API, data model, security, development guide
