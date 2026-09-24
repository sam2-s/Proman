# Database schema

SQLite schema (created automatically by `server/src/db.rs`).

```
users
  id, email (unique), password_hash, name, created_at

projects
  id, name, description, owner_id → users.id, created_at

project_members
  project_id → projects.id, user_id → users.id, role, added_at
  PK (project_id, user_id)

boards
  id, project_id → projects.id, name, created_at

columns
  id, board_id → boards.id, name, position

cards
  id, column_id → columns.id, title, description, priority,
  position, due_date, start_date, assignee_id, created_by,
  created_at, updated_at

subtasks
  id, card_id → cards.id, title, done, position

comments
  id, card_id → cards.id, user_id → users.id, body, created_at

attachments
  id, card_id → cards.id, filename, stored_name, mime, size,
  uploaded_by, created_at
```

## Roles

| Role   | Can…                                        |
|--------|---------------------------------------------|
| owner  | everything + delete project, manage members |
| editor | create/edit cards, columns, comments, files |
| viewer | read-only                                   |

## Priorities

`low` · `medium` · `high` · `urgent`
