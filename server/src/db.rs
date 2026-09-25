use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;

pub async fn init() -> anyhow::Result<SqlitePool> {
    let url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:proman.db?mode=rwc".to_string());

    let opts = SqliteConnectOptions::from_str(&url)?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(opts)
        .await?;

    run_migrations(&pool).await?;
    Ok(pool)
}

pub(crate) async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            username TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            avatar_url TEXT,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS project_members (
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'editor',
            added_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (project_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL DEFAULT 'Main',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS columns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            priority TEXT NOT NULL DEFAULT 'medium',
            position INTEGER NOT NULL DEFAULT 0,
            due_date TEXT,
            start_date TEXT,
            assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS subtasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            position INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            mime TEXT NOT NULL DEFAULT 'application/octet-stream',
            size INTEGER NOT NULL DEFAULT 0,
            uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id);
        CREATE INDEX IF NOT EXISTS idx_subtasks_card ON subtasks(card_id);
        CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id);
        CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);

        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
            verb TEXT NOT NULL,
            summary TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id, created_at);

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);
        "#,
    )
    .execute(pool)
    .await?;

    migrate_users_table(pool).await?;

    tracing::info!("database ready");
    Ok(())
}

/// Idempotent upgrades for databases created before these columns existed,
/// plus backfilling usernames for pre-existing email-only accounts.
async fn migrate_users_table(pool: &SqlitePool) -> anyhow::Result<()> {
    add_column_if_missing(pool, "users", "username", "TEXT NOT NULL DEFAULT ''").await?;
    add_column_if_missing(pool, "users", "avatar_url", "TEXT").await?;
    add_column_if_missing(pool, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0").await?;

    // username = email local-part (legacy accounts), with a unique suffix on collision.
    sqlx::query(
        r#"UPDATE users
           SET username = CASE
             WHEN instr(email, '@') > 0 THEN lower(substr(email, 1, instr(email, '@') - 1))
             ELSE lower(email)
           END
           WHERE username = ''"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"UPDATE users
           SET username = username || '_' || id
           WHERE id IN (
             SELECT u1.id FROM users u1
             WHERE EXISTS (
               SELECT 1 FROM users u2
               WHERE u2.username = u1.username AND u2.id < u1.id
             )
           )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("UPDATE users SET username = 'user_' || id WHERE username = ''")
        .execute(pool)
        .await?;

    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        .execute(pool)
        .await?;
    Ok(())
}

async fn add_column_if_missing(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    definition: &str,
) -> anyhow::Result<()> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT name FROM pragma_table_info(?) WHERE name = ?")
            .bind(table)
            .bind(column)
            .fetch_optional(pool)
            .await?;
    if existing.is_none() {
        sqlx::query(&format!(
            "ALTER TABLE {table} ADD COLUMN {column} {definition}"
        ))
        .execute(pool)
        .await?;
        tracing::info!("migrated: added {table}.{column}");
    }
    Ok(())
}
