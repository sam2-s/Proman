use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::permissions::is_global_admin;
use crate::state::SharedState;

async fn require_admin(state: &SharedState, user_id: i64) -> ApiResult<()> {
    if is_global_admin(state, user_id).await? {
        Ok(())
    } else {
        Err(ApiError::Forbidden("admin access required".into()))
    }
}

/// GET /api/admin/users — every account (admin only).
pub async fn list_users(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
) -> ApiResult<Json<Vec<Value>>> {
    require_admin(&state, user_id).await?;

    let rows = sqlx::query(
        r#"SELECT id, username, name, avatar_url, is_admin, created_at,
                  (SELECT count(*) FROM project_members pm WHERE pm.user_id = u.id) AS projects
           FROM users u ORDER BY u.id"#,
    )
    .fetch_all(&state.db)
    .await?;

    let out = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<i64, _>("id"),
                "username": r.get::<String, _>("username"),
                "name": r.get::<String, _>("name"),
                "avatar_url": r.get::<Option<String>, _>("avatar_url"),
                "is_admin": r.get::<bool, _>("is_admin"),
                "created_at": r.get::<String, _>("created_at"),
                "projects": r.get::<i64, _>("projects"),
            })
        })
        .collect();
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct UpdateIsAdmin {
    pub is_admin: bool,
}

/// PATCH /api/admin/users/{id} — grant or revoke global admin.
pub async fn set_is_admin(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(target_id): Path<i64>,
    Json(req): Json<UpdateIsAdmin>,
) -> ApiResult<Json<Value>> {
    require_admin(&state, user_id).await?;

    if target_id == user_id && !req.is_admin {
        return Err(ApiError::BadRequest(
            "you cannot revoke your own admin access".into(),
        ));
    }
    let updated = sqlx::query("UPDATE users SET is_admin = ? WHERE id = ?")
        .bind(req.is_admin)
        .bind(target_id)
        .execute(&state.db)
        .await?;
    if updated.rows_affected() == 0 {
        return Err(ApiError::NotFound("user not found".into()));
    }
    tracing::info!("admin {user_id} set is_admin={} for user {target_id}", req.is_admin);
    Ok(Json(serde_json::json!({
        "id": target_id,
        "is_admin": req.is_admin,
    })))
}

/// DELETE /api/admin/users/{id} — remove an account (admin only, no self-delete).
/// Owned projects and memberships cascade at the database level.
pub async fn delete_user(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(target_id): Path<i64>,
) -> ApiResult<StatusCode> {
    require_admin(&state, user_id).await?;

    if target_id == user_id {
        return Err(ApiError::BadRequest("you cannot delete your own account".into()));
    }
    let deleted = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(target_id)
        .execute(&state.db)
        .await?;
    if deleted.rows_affected() == 0 {
        return Err(ApiError::NotFound("user not found".into()));
    }
    tracing::warn!("admin {user_id} deleted user {target_id}");
    Ok(StatusCode::NO_CONTENT)
}
