use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::models::{Board, Card, Column, WsEvent};
use crate::state::SharedState;

async fn board_project(state: &SharedState, board_id: i64) -> ApiResult<i64> {
    sqlx::query("SELECT project_id FROM boards WHERE id = ?")
        .bind(board_id)
        .fetch_optional(&state.db)
        .await?
        .map(|r| r.get::<i64, _>("project_id"))
        .ok_or_else(|| ApiError::NotFound("board not found".into()))
}

pub async fn column_project(state: &SharedState, column_id: i64) -> ApiResult<i64> {
    sqlx::query(
        "SELECT b.project_id FROM columns c JOIN boards b ON b.id = c.board_id WHERE c.id = ?",
    )
    .bind(column_id)
    .fetch_optional(&state.db)
    .await?
    .map(|r| r.get::<i64, _>("project_id"))
    .ok_or_else(|| ApiError::NotFound("column not found".into()))
}

pub async fn ensure_member(
    state: &SharedState,
    project_id: i64,
    user_id: i64,
) -> ApiResult<String> {
    let row = sqlx::query("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
    row.map(|r| r.get::<String, _>("role"))
        .ok_or_else(|| ApiError::Forbidden("not a project member".into()))
}

pub async fn list_for_project(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Vec<Board>>> {
    ensure_member(&state, id, user_id).await?;
    let boards = sqlx::query_as::<_, Board>(
        "SELECT id, project_id, name, created_at FROM boards WHERE project_id = ? ORDER BY id",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(boards))
}

#[derive(Debug, Deserialize)]
pub struct CreateBoard {
    pub name: String,
}

pub async fn create(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<CreateBoard>,
) -> ApiResult<(StatusCode, Json<Board>)> {
    ensure_member(&state, id, user_id).await?;
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("board name required".into()));
    }
    let board = sqlx::query_as::<_, Board>(
        "INSERT INTO boards (project_id, name) VALUES (?, ?) RETURNING id, project_id, name, created_at",
    )
    .bind(id)
    .bind(name)
    .fetch_one(&state.db)
    .await?;
    Ok((StatusCode::CREATED, Json(board)))
}

pub async fn detail(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    let project_id = board_project(&state, id).await?;
    ensure_member(&state, project_id, user_id).await?;

    let board = sqlx::query_as::<_, Board>(
        "SELECT id, project_id, name, created_at FROM boards WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let columns = sqlx::query_as::<_, Column>(
        "SELECT id, board_id, name, position FROM columns WHERE board_id = ? ORDER BY position, id",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let mut cols_out = Vec::new();
    for col in columns {
        let cards = sqlx::query_as::<_, Card>(
            r#"SELECT id, column_id, title, description, priority, position,
                      due_date, start_date, assignee_id, created_by, created_at, updated_at
               FROM cards WHERE column_id = ? ORDER BY position, id"#,
        )
        .bind(col.id)
        .fetch_all(&state.db)
        .await?;
        cols_out.push(serde_json::json!({
            "column": col,
            "cards": cards,
        }));
    }

    Ok(Json(serde_json::json!({
        "board": board,
        "columns": cols_out,
    })))
}

#[derive(Debug, Deserialize)]
pub struct CreateColumn {
    pub name: String,
    #[serde(default)]
    pub position: Option<i64>,
}

pub async fn create_column(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<CreateColumn>,
) -> ApiResult<(StatusCode, Json<Column>)> {
    let project_id = board_project(&state, id).await?;
    ensure_member(&state, project_id, user_id).await?;

    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("column name required".into()));
    }

    let position = match req.position {
        Some(p) => p,
        None => {
            let row = sqlx::query(
                "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM columns WHERE board_id = ?",
            )
            .bind(id)
            .fetch_one(&state.db)
            .await?;
            row.get::<i64, _>("p")
        }
    };

    let col = sqlx::query_as::<_, Column>(
        "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?) RETURNING id, board_id, name, position",
    )
    .bind(id)
    .bind(name)
    .bind(position)
    .fetch_one(&state.db)
    .await?;

    let _ = state.broadcast.send(WsEvent::ColumnCreated {
        project_id,
        column: col.clone(),
    });
    Ok((StatusCode::CREATED, Json(col)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateColumn {
    pub name: Option<String>,
    pub position: Option<i64>,
}

pub async fn update_column(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateColumn>,
) -> ApiResult<Json<Column>> {
    let project_id = column_project(&state, id).await?;
    ensure_member(&state, project_id, user_id).await?;

    if let Some(name) = &req.name {
        sqlx::query("UPDATE columns SET name = ? WHERE id = ?")
            .bind(name.trim())
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(pos) = req.position {
        sqlx::query("UPDATE columns SET position = ? WHERE id = ?")
            .bind(pos)
            .bind(id)
            .execute(&state.db)
            .await?;
    }

    let col = sqlx::query_as::<_, Column>(
        "SELECT id, board_id, name, position FROM columns WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let _ = state.broadcast.send(WsEvent::ColumnUpdated {
        project_id,
        column: col.clone(),
    });
    Ok(Json(col))
}

pub async fn delete_column(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    let project_id = column_project(&state, id).await?;
    ensure_member(&state, project_id, user_id).await?;
    sqlx::query("DELETE FROM columns WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
