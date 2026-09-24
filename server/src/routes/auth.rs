use axum::extract::State;
use axum::Json;
use serde_json::Value;
use sqlx::Row;

use crate::auth::{self, AuthUser};
use crate::error::{ApiError, ApiResult};
use crate::models::{AuthResponse, LoginReq, RegisterReq, User};
use crate::state::SharedState;

pub async fn register(
    State(state): State<SharedState>,
    Json(req): Json<RegisterReq>,
) -> ApiResult<(axum::http::StatusCode, Json<AuthResponse>)> {
    let email = req.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(ApiError::BadRequest("valid email required".into()));
    }
    if req.password.len() < 8 {
        return Err(ApiError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }
    if req.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }

    let exists = sqlx::query("SELECT 1 FROM users WHERE email = ?")
        .bind(&email)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_some() {
        return Err(ApiError::Conflict("email already registered".into()));
    }

    let hash = auth::hash_password(&req.password)?;
    let row = sqlx::query(
        "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id, email, name, created_at",
    )
    .bind(&email)
    .bind(&hash)
    .bind(req.name.trim())
    .fetch_one(&state.db)
    .await?;

    let user = User {
        id: row.get("id"),
        email: row.get("email"),
        name: row.get("name"),
        created_at: row.get("created_at"),
    };
    let token = auth::issue_token(user.id)?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(AuthResponse { token, user }),
    ))
}

pub async fn login(
    State(state): State<SharedState>,
    Json(req): Json<LoginReq>,
) -> ApiResult<Json<AuthResponse>> {
    let email = req.email.trim().to_lowercase();
    let row =
        sqlx::query("SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?")
            .bind(&email)
            .fetch_optional(&state.db)
            .await?;

    let row = row.ok_or_else(|| ApiError::Unauthorized("invalid credentials".into()))?;
    let hash: String = row.get("password_hash");
    if !auth::verify_password(&req.password, &hash) {
        return Err(ApiError::Unauthorized("invalid credentials".into()));
    }

    let user = User {
        id: row.get("id"),
        email: row.get("email"),
        name: row.get("name"),
        created_at: row.get("created_at"),
    };
    let token = auth::issue_token(user.id)?;
    Ok(Json(AuthResponse { token, user }))
}

pub async fn me(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
) -> ApiResult<Json<Value>> {
    let row = sqlx::query("SELECT id, email, name, created_at FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(serde_json::json!({
        "id": row.get::<i64, _>("id"),
        "email": row.get::<String, _>("email"),
        "name": row.get::<String, _>("name"),
        "created_at": row.get::<String, _>("created_at"),
    })))
}
