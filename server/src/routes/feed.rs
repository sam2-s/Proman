use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::models::{Activity, Notification};
use crate::routes::boards::ensure_member;
use crate::state::SharedState;

#[derive(Debug, Deserialize)]
pub struct ActivityQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

pub async fn list_activity(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(project_id): Path<i64>,
    Query(q): Query<ActivityQuery>,
) -> ApiResult<Json<Vec<Activity>>> {
    ensure_member(&state, project_id, user_id).await?;
    let limit = q.limit.clamp(1, 200);
    let rows = sqlx::query_as::<_, Activity>(
        r#"SELECT a.id, a.project_id, a.user_id, a.card_id, a.verb, a.summary, a.created_at
           FROM activity a
           WHERE a.project_id = ?
           ORDER BY a.created_at DESC, a.id DESC
           LIMIT ?"#,
    )
    .bind(project_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn list_notifications(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
) -> ApiResult<Json<Vec<Notification>>> {
    let rows = sqlx::query_as::<_, Notification>(
        r#"SELECT id, user_id, project_id, card_id, body, read, created_at
           FROM notifications
           WHERE user_id = ?
           ORDER BY created_at DESC, id DESC
           LIMIT 50"#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn mark_notification_read(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<serde_json::Value>> {
    let res = sqlx::query("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("notification not found".into()));
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn mark_all_notifications_read(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
) -> ApiResult<Json<serde_json::Value>> {
    sqlx::query("UPDATE notifications SET read = 1 WHERE user_id = ?")
        .bind(user_id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
}

/// Search cards (title/description) across projects the user belongs to.
pub async fn search_cards(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Query(q): Query<SearchQuery>,
) -> ApiResult<Json<Vec<Value>>> {
    let term = q.q.unwrap_or_default().trim().to_string();
    if term.is_empty() {
        return Ok(Json(vec![]));
    }
    let pattern = format!("%{}%", term.replace('%', "\\%").replace('_', "\\_"));
    let rows = sqlx::query(
        r#"SELECT c.id, c.title, c.priority, c.due_date, c.column_id,
                  col.name AS column_name, b.id AS board_id, b.name AS board_name,
                  p.id AS project_id, p.name AS project_name
           FROM cards c
           JOIN columns col ON col.id = c.column_id
           JOIN boards b ON b.id = col.board_id
           JOIN projects p ON p.id = b.project_id
           JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
           WHERE c.title LIKE ? ESCAPE '\\' OR c.description LIKE ? ESCAPE '\\'
           ORDER BY c.updated_at DESC
           LIMIT 40"#,
    )
    .bind(user_id)
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&state.db)
    .await?;

    let out: Vec<Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<i64, _>("id"),
                "title": r.get::<String, _>("title"),
                "priority": r.get::<String, _>("priority"),
                "due_date": r.get::<Option<String>, _>("due_date"),
                "column_id": r.get::<i64, _>("column_id"),
                "column_name": r.get::<String, _>("column_name"),
                "board_id": r.get::<i64, _>("board_id"),
                "board_name": r.get::<String, _>("board_name"),
                "project_id": r.get::<i64, _>("project_id"),
                "project_name": r.get::<String, _>("project_name"),
            })
        })
        .collect();
    Ok(Json(out))
}
