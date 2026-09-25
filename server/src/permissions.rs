use sqlx::Row;

use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

/// Project role with ordinal ranking (higher = more power).
///
/// The enforced matrix:
/// - `viewer`  — read-only
/// - `editor`  — content mutations (cards, columns, comments, attachments)
/// - `admin`   — editor + member management
/// - `owner`   — admin + delete the project
///
/// Global admins (`users.is_admin`) act with at least `admin` power
/// in every project and gain access even without membership.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Role {
    Viewer = 1,
    Editor = 2,
    Admin = 3,
    Owner = 4,
}

impl Role {
    pub fn parse(s: &str) -> Option<Role> {
        match s {
            "viewer" => Some(Role::Viewer),
            "editor" => Some(Role::Editor),
            "admin" => Some(Role::Admin),
            "owner" => Some(Role::Owner),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Role::Viewer => "viewer",
            Role::Editor => "editor",
            Role::Admin => "admin",
            Role::Owner => "owner",
        }
    }
}

/// Whether the user is a global administrator (`users.is_admin`).
pub async fn is_global_admin(state: &SharedState, user_id: i64) -> ApiResult<bool> {
    let row = sqlx::query("SELECT is_admin FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
    Ok(row.is_some_and(|r| r.get::<bool, _>("is_admin")))
}

/// Enforce the role matrix for `project_id`.
///
/// Returns the effective role (`global admin` bumps to at least `admin`).
/// Errors:
/// - `Forbidden` when not a member (and not a global admin),
/// - `Forbidden` when the effective role is below `min`.
pub async fn require(
    state: &SharedState,
    project_id: i64,
    user_id: i64,
    min: Role,
) -> ApiResult<Role> {
    let row = sqlx::query("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;

    match row {
        None => {
            if is_global_admin(state, user_id).await? {
                return Ok(Role::Admin);
            }
            Err(ApiError::Forbidden("not a project member".into()))
        }
        Some(r) => {
            let stored = Role::parse(&r.get::<String, _>("role")).unwrap_or(Role::Viewer);
            let mut effective = stored;
            if is_global_admin(state, user_id).await? && effective < Role::Admin {
                effective = Role::Admin;
            }
            if effective < min {
                return Err(ApiError::Forbidden(format!(
                    "requires {} permissions",
                    min.as_str()
                )));
            }
            Ok(effective)
        }
    }
}
