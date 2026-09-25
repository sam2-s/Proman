use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::models::{Comment, WsEvent};
use crate::permissions::{require, Role};
use crate::routes::boards::ensure_member;
use crate::state::SharedState;

async fn card_project(state: &SharedState, card_id: i64) -> ApiResult<i64> {
    sqlx::query(
        r#"SELECT b.project_id FROM cards c
           JOIN columns col ON col.id = c.column_id
           JOIN boards b ON b.id = col.board_id
           WHERE c.id = ?"#,
    )
    .bind(card_id)
    .fetch_optional(&state.db)
    .await?
    .map(|r| r.get::<i64, _>("project_id"))
    .ok_or_else(|| ApiError::NotFound("card not found".into()))
}

pub async fn list(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(card_id): Path<i64>,
) -> ApiResult<Json<Vec<Comment>>> {
    let project_id = card_project(&state, card_id).await?;
    ensure_member(&state, project_id, user_id).await?;

    let rows = sqlx::query_as::<_, Comment>(
        r#"SELECT c.id, c.card_id, c.user_id, c.body, c.created_at, u.name AS author_name
           FROM comments c JOIN users u ON u.id = c.user_id
           WHERE c.card_id = ? ORDER BY c.created_at, c.id"#,
    )
    .bind(card_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateComment {
    pub body: String,
}

pub async fn create(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(card_id): Path<i64>,
    Json(req): Json<CreateComment>,
) -> ApiResult<(StatusCode, Json<Comment>)> {
    let project_id = card_project(&state, card_id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;

    let body = req.body.trim();
    if body.is_empty() {
        return Err(ApiError::BadRequest("comment body required".into()));
    }

    let row = sqlx::query(
        r#"INSERT INTO comments (card_id, user_id, body) VALUES (?, ?, ?)
           RETURNING id, card_id, user_id, body, created_at"#,
    )
    .bind(card_id)
    .bind(user_id)
    .bind(body)
    .fetch_one(&state.db)
    .await?;

    let author_row = sqlx::query("SELECT name FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;

    let comment = Comment {
        id: row.get("id"),
        card_id: row.get("card_id"),
        user_id: row.get("user_id"),
        body: row.get("body"),
        created_at: row.get("created_at"),
        author_name: author_row.get("name"),
    };

    let _ = state.broadcast.send(WsEvent::CommentCreated {
        project_id,
        card_id,
        comment: comment.clone(),
    });
    let title_row = sqlx::query("SELECT title FROM cards WHERE id = ?")
        .bind(card_id)
        .fetch_optional(&state.db)
        .await;
    let title = title_row
        .ok()
        .flatten()
        .map(|r| r.get::<String, _>("title"))
        .unwrap_or_else(|| "a task".into());
    crate::feed_helpers::log_activity(
        &state.db,
        project_id,
        Some(user_id),
        Some(card_id),
        "comment_created",
        &format!("Commented on \"{}\"", title),
    )
    .await;
    crate::feed_helpers::notify_members(
        &state,
        project_id,
        Some(user_id),
        Some(card_id),
        &format!("New comment on \"{}\": {}", title, body),
    )
    .await;
    Ok((StatusCode::CREATED, Json(comment)))
}
