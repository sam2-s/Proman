# API Design

Base URL: `http://localhost:3000`

All authenticated routes require:

```
Authorization: Bearer <jwt>
```

## Auth

### POST /api/auth/register

```json
{ "email": "a@b.com", "password": "secret123", "name": "Ada" }
```

→ `201` `{ "token": "...", "user": { "id": 1, "email": "...", "name": "..." } }`

### POST /api/auth/login

```json
{ "email": "a@b.com", "password": "secret123" }
```

→ `200` `{ "token": "...", "user": { ... } }`

### GET /api/me

→ `200` `{ "id": 1, "email": "...", "name": "..." }`

## Projects

### GET /api/projects
List projects the current user belongs to.

### POST /api/projects
```json
{ "name": "Website Redesign", "description": "..." }
```

### GET /api/projects/:id
Project + members + boards summary.

### POST /api/projects/:id/members
```json
{ "email": "teammate@x.com", "role": "editor" }
```

Roles: `owner` | `editor` | `viewer`

## Boards

### GET /api/boards/:id
Board with ordered columns, each with ordered cards.

### POST /api/projects/:id/boards
```json
{ "name": "Main" }
```

### POST /api/boards/:id/columns
```json
{ "name": "In Progress", "position": 1 }
```

### PATCH /api/columns/:id
Rename / reposition.

## Cards (tasks)

### POST /api/columns/:id/cards
```json
{
  "title": "Design homepage",
  "description": "...",
  "priority": "high",
  "due_date": "2026-10-01",
  "start_date": "2026-09-24",
  "position": 0,
  "assignee_id": 2
}
```

### PATCH /api/cards/:id
Partial update; also used for moving:
```json
{ "column_id": 2, "position": 1 }
```

### DELETE /api/cards/:id

## Subtasks

### GET|POST /api/cards/:id/subtasks
```json
{ "title": "Sketch layout" }
```

### PATCH /api/subtasks/:id  `{ "done": true }`
### DELETE /api/subtasks/:id

## Comments

### GET|POST /api/cards/:id/comments
```json
{ "body": "Looks good!" }
```

## Attachments

### POST /api/cards/:id/attachments  (multipart/form-data, field `file`)
### GET /api/attachments/:id  → file bytes

## Search

### GET /api/search?q=design

Cards (title/description) across projects the caller belongs to.

```json
[
  {
    "id": 9,
    "title": "Design homepage",
    "priority": "high",
    "due_date": "2026-10-01",
    "column_name": "In Progress",
    "board_name": "Main",
    "project_id": 1,
    "project_name": "Website"
  }
]
```

## Activity

### GET /api/projects/:id/activity?limit=50&offset=0

Recent project activity (`verb`, `summary`, `created_at`).
`limit` is clamped to 1–200; `offset` defaults to 0.

## Notifications

### GET /api/notifications?limit=50&offset=0&unread=true
### GET /api/notifications/unread-count
### POST /api/notifications/:id/read
### POST /api/notifications/read-all

In-app notifications (comments, assignments). Unread count is `read == 0`.
`limit` is clamped to 1–200, `offset` defaults to 0, and `unread=true`
returns only unread rows. `unread-count` returns `{ "count": n }` for the
header badge.

## Realtime

### WS /ws?project_id=1&token=<jwt>

Server pushes:

```json
{ "type": "card_created", "project_id": 1, "card": { ... } }
{ "type": "card_updated", "project_id": 1, "card": { ... } }
{ "type": "card_moved",   "project_id": 1, "card": { ... } }
{ "type": "card_deleted", "project_id": 1, "card_id": 9 }
{ "type": "column_created", "project_id": 1, "column": { ... } }
{ "type": "column_deleted", "project_id": 1, "column_id": 3 }
{ "type": "comment_created", "project_id": 1, "card_id": 9, "comment": { ... } }
{ "type": "notification_created", "project_id": 1, "notification": { ... } }
```

Clients do not send mutations over WS — mutations go over REST, server broadcasts.
