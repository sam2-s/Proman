//! Test-only helpers: in-memory database with migrations and quick fixtures.

use std::sync::Arc;

use sqlx::Row;

use crate::state::{AppState, SharedState};

pub async fn state() -> SharedState {
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("memory db");
    crate::db::run_migrations(&pool).await.expect("migrations");
    let dir = std::env::temp_dir().join(format!("proman-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("upload dir");
    let (broadcast, _) = tokio::sync::broadcast::channel(16);
    Arc::new(AppState {
        db: pool,
        upload_dir: dir,
        broadcast,
    })
}

pub async fn add_user(state: &SharedState, username: &str) -> i64 {
    sqlx::query(
        "INSERT INTO users (email, username, password_hash, name) VALUES (?, ?, 'x', ?) RETURNING id",
    )
    .bind(format!("{username}@test.local"))
    .bind(username)
    .bind(username)
    .fetch_one(&state.db)
    .await
    .expect("insert user")
    .get("id")
}

pub async fn add_project(state: &SharedState, owner_id: i64) -> i64 {
    let project_id: i64 =
        sqlx::query("INSERT INTO projects (name, owner_id) VALUES ('Test', ?) RETURNING id")
            .bind(owner_id)
            .fetch_one(&state.db)
            .await
            .expect("insert project")
            .get("id");
    sqlx::query("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')")
        .bind(project_id)
        .bind(owner_id)
        .execute(&state.db)
        .await
        .expect("insert owner membership");
    project_id
}

pub async fn add_member(state: &SharedState, project_id: i64, user_id: i64, role: &str) {
    sqlx::query("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)")
        .bind(project_id)
        .bind(user_id)
        .bind(role)
        .execute(&state.db)
        .await
        .expect("insert membership");
}

pub async fn set_global_admin(state: &SharedState, user_id: i64) {
    sqlx::query("UPDATE users SET is_admin = 1 WHERE id = ?")
        .bind(user_id)
        .execute(&state.db)
        .await
        .expect("grant admin");
}
