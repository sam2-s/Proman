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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{AppState, SharedState};
    use std::sync::Arc;

    async fn test_state() -> SharedState {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("memory db");
        crate::db::run_migrations(&pool).await.expect("migrations");
        let dir = std::env::temp_dir().join(format!("proman-auth-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("upload dir");
        let (broadcast, _) = tokio::sync::broadcast::channel(16);
        Arc::new(AppState {
            db: pool,
            upload_dir: dir,
            broadcast,
        })
    }

    fn register_req(username: &str) -> Json<RegisterReq> {
        Json(RegisterReq {
            username: username.into(),
            password: "password123".into(),
            name: "Test User".into(),
        })
    }

    #[test]
    fn normalize_username_lowercases_and_accepts_valid() {
        assert_eq!(normalize_username("TUI-Tester").unwrap(), "tui-tester");
        assert_eq!(normalize_username(" some_user ").unwrap(), "some_user");
        assert_eq!(normalize_username("a1b2c3").unwrap(), "a1b2c3");
    }

    #[test]
    fn normalize_username_rejects_bad_shapes() {
        for bad in [
            "ab",
            "has space",
            "-lead",
            "plus+sign",
            "dots.no",
            "ünicode",
        ] {
            assert!(
                normalize_username(bad).is_err(),
                "expected {bad:?} to be rejected"
            );
        }
    }

    #[tokio::test]
    async fn register_login_me_flow_has_no_email() {
        let state = test_state().await;

        let (status, Json(resp)) = register(State(state.clone()), register_req("Flow-Tester"))
            .await
            .expect("register");
        assert_eq!(status, axum::http::StatusCode::CREATED);
        let v = serde_json::to_value(&resp).expect("serialize");
        assert_eq!(v["user"]["username"], "flow-tester");
        assert_eq!(v["user"]["is_admin"], false);
        assert!(
            v["user"].get("email").is_none(),
            "email must never be returned"
        );

        match register(State(state.clone()), register_req("flow-tester")).await {
            Err(ApiError::Conflict(_)) => {}
            other => panic!("expected conflict, got {other:?}"),
        }

        let Json(auth) = login(
            State(state.clone()),
            Json(LoginReq {
                username: "Flow-Tester".into(),
                password: "password123".into(),
            }),
        )
        .await
        .expect("login");
        assert_eq!(auth.user.username, "flow-tester");

        let err = login(
            State(state.clone()),
            Json(LoginReq {
                username: "flow-tester".into(),
                password: "wrong-password".into(),
            }),
        )
        .await;
        assert!(matches!(err, Err(ApiError::Unauthorized(_))));

        let Json(me) = me(State(state.clone()), AuthUser(auth.user.id))
            .await
            .expect("me");
        assert_eq!(me["username"], "flow-tester");
        assert!(me.get("email").is_none());
    }

    #[tokio::test]
    async fn register_validates_inputs() {
        let state = test_state().await;
        let short = register(State(state.clone()), register_req("ab")).await;
        assert!(matches!(short, Err(ApiError::BadRequest(_))));

        let no_name = register(
            State(state.clone()),
            Json(RegisterReq {
                username: "valid-user".into(),
                password: "password123".into(),
                name: "  ".into(),
            }),
        )
        .await;
        assert!(matches!(no_name, Err(ApiError::BadRequest(_))));

        let weak_pw = register(
            State(state.clone()),
            Json(RegisterReq {
                username: "valid-user".into(),
                password: "short".into(),
                name: "Valid".into(),
            }),
        )
        .await;
        assert!(matches!(weak_pw, Err(ApiError::BadRequest(_))));
    }
}
