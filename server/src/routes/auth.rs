use axum::extract::State;
use axum::Json;
use serde_json::Value;
use sqlx::Row;

use crate::auth::{self, AuthUser};
use crate::error::{ApiError, ApiResult};
use crate::models::{AuthResponse, LoginReq, RegisterReq, User};
use crate::state::SharedState;

const USER_COLS: &str = "id, username, name, avatar_url, is_admin, created_at";

fn user_from_row(row: &sqlx::sqlite::SqliteRow) -> User {
    User {
        id: row.get("id"),
        username: row.get("username"),
        name: row.get("name"),
        avatar_url: row.get("avatar_url"),
        is_admin: row.get("is_admin"),
        created_at: row.get("created_at"),
    }
}

/// Normalize + validate a username: 3-32 chars, lowercase letters,
/// digits, `_` and `-`, starting with a letter or digit.
fn normalize_username(raw: &str) -> ApiResult<String> {
    let username = raw.trim().to_lowercase();
    if username.len() < 3 || username.len() > 32 {
        return Err(ApiError::BadRequest(
            "username must be 3-32 characters".into(),
        ));
    }
    let mut chars = username.chars();
    let first = chars.next().expect("non-empty after length check");
    if !first.is_ascii_alphanumeric() {
        return Err(ApiError::BadRequest(
            "username must start with a letter or digit".into(),
        ));
    }
    if !username
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
    {
        return Err(ApiError::BadRequest(
            "username may only contain letters, digits, _ and -".into(),
        ));
    }
    Ok(username)
}

pub async fn register(
    State(state): State<SharedState>,
    Json(req): Json<RegisterReq>,
) -> ApiResult<(axum::http::StatusCode, Json<AuthResponse>)> {
    let username = normalize_username(&req.username)?;
    if req.password.len() < 8 {
        return Err(ApiError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }
    if req.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }

    let exists = sqlx::query("SELECT 1 FROM users WHERE username = ?")
        .bind(&username)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_some() {
        return Err(ApiError::Conflict("username already taken".into()));
    }

    let hash = auth::hash_password(&req.password)?;
    // The email column stays for legacy schema reasons but is never used,
    // shown, or returned — accounts are username-only.
    let row = sqlx::query(&format!(
        "INSERT INTO users (email, username, password_hash, name) \
         VALUES (?, ?, ?, ?) RETURNING {USER_COLS}"
    ))
    .bind(format!("{username}@users.proman"))
    .bind(&username)
    .bind(&hash)
    .bind(req.name.trim())
    .fetch_one(&state.db)
    .await?;

    let user = user_from_row(&row);
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
    let username = req.username.trim().to_lowercase();
    let row = sqlx::query(&format!(
        "SELECT {USER_COLS}, password_hash FROM users WHERE username = ?"
    ))
    .bind(&username)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or_else(|| ApiError::Unauthorized("invalid credentials".into()))?;
    let hash: String = row.get("password_hash");
    if !auth::verify_password(&req.password, &hash) {
        return Err(ApiError::Unauthorized("invalid credentials".into()));
    }

    let user = user_from_row(&row);
    let token = auth::issue_token(user.id)?;
    Ok(Json(AuthResponse { token, user }))
}

pub async fn me(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
) -> ApiResult<Json<Value>> {
    let row = sqlx::query(&format!("SELECT {USER_COLS} FROM users WHERE id = ?"))
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(serde_json::json!({
        "id": row.get::<i64, _>("id"),
        "username": row.get::<String, _>("username"),
        "name": row.get::<String, _>("name"),
        "avatar_url": row.get::<Option<String>, _>("avatar_url"),
        "is_admin": row.get::<bool, _>("is_admin"),
        "created_at": row.get::<String, _>("created_at"),
    })))
}
