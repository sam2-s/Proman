use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::models::{Board, Member, Project};
use crate::permissions::{require, Role};
use crate::state::SharedState;

pub async fn list(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
) -> ApiResult<Json<Vec<Value>>> {
    let rows = sqlx::query(
        r#"SELECT p.id, p.name, p.description, p.owner_id, p.created_at, m.role
           FROM projects p
           JOIN project_members m ON m.project_id = p.id
           WHERE m.user_id = ?
           ORDER BY p.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let out = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<i64, _>("id"),
                "name": r.get::<String, _>("name"),
                "description": r.get::<String, _>("description"),
                "owner_id": r.get::<i64, _>("owner_id"),
                "created_at": r.get::<String, _>("created_at"),
                "role": r.get::<String, _>("role"),
            })
        })
        .collect();
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct CreateProject {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

pub async fn create(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<CreateProject>,
) -> ApiResult<(StatusCode, Json<Project>)> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("project name required".into()));
    }

    let mut tx = state.db.begin().await?;
    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?) RETURNING id, name, description, owner_id, created_at",
    )
    .bind(name)
    .bind(req.description.trim())
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')")
        .bind(project.id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    // Default board with columns
    let board = sqlx::query_as::<_, Board>(
        "INSERT INTO boards (project_id, name) VALUES (?, 'Main') RETURNING id, project_id, name, created_at",
    )
    .bind(project.id)
    .fetch_one(&mut *tx)
    .await?;

    for (i, col) in ["To Do", "In Progress", "Done"].iter().enumerate() {
        sqlx::query("INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)")
            .bind(board.id)
            .bind(col)
            .bind(i as i64)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn detail(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    require(&state, id, user_id, Role::Viewer).await?;

    let project = sqlx::query_as::<_, Project>(
        "SELECT id, name, description, owner_id, created_at FROM projects WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("project not found".into()))?;

    let members = sqlx::query_as::<_, Member>(
        r#"SELECT m.project_id, m.user_id, m.role, u.name, u.username, u.avatar_url
           FROM project_members m JOIN users u ON u.id = m.user_id
           WHERE m.project_id = ?"#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let boards = sqlx::query_as::<_, Board>(
        "SELECT id, project_id, name, created_at FROM boards WHERE project_id = ? ORDER BY id",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "project": project,
        "members": members,
        "boards": boards,
    })))
}

pub async fn remove(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    require(&state, id, user_id, Role::Owner).await?;
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct AddMember {
    pub username: String,
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "editor".into()
}

pub async fn add_member(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<AddMember>,
) -> ApiResult<(StatusCode, Json<Member>)> {
    require(&state, id, user_id, Role::Admin).await?;
    if !["owner", "admin", "editor", "viewer"].contains(&req.role.as_str()) {
        return Err(ApiError::BadRequest("invalid role".into()));
    }

    let target = sqlx::query(
        "SELECT id, name, username, avatar_url FROM users WHERE username = ? COLLATE NOCASE",
    )
    .bind(req.username.trim())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("no user with that username".into()))?;

    let target_id: i64 = target.get("id");

    sqlx::query(
        "INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
    )
    .bind(id)
    .bind(target_id)
    .bind(&req.role)
    .execute(&state.db)
    .await?;

    let member = Member {
        project_id: id,
        user_id: target_id,
        role: req.role,
        name: target.get("name"),
        username: target.get("username"),
        avatar_url: target.get("avatar_url"),
    };
    Ok((StatusCode::CREATED, Json(member)))
}
