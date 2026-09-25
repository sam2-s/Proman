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
                if Role::Admin >= min {
                    return Ok(Role::Admin);
                }
                return Err(ApiError::Forbidden(format!(
                    "requires {} permissions",
                    min.as_str()
                )));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support;

    #[tokio::test]
    async fn role_matrix_is_enforced() {
        let state = test_support::state().await;
        let owner = test_support::add_user(&state, "owner").await;
        let editor = test_support::add_user(&state, "editor").await;
        let viewer = test_support::add_user(&state, "viewer").await;
        let project_admin = test_support::add_user(&state, "padmin").await;
        let outsider = test_support::add_user(&state, "outsider").await;
        let global = test_support::add_user(&state, "global").await;

        let project_id = test_support::add_project(&state, owner).await;
        test_support::add_member(&state, project_id, editor, "editor").await;
        test_support::add_member(&state, project_id, viewer, "viewer").await;
        test_support::add_member(&state, project_id, project_admin, "admin").await;
        test_support::set_global_admin(&state, global).await;

        // viewer: reads only
        assert_eq!(
            require(&state, project_id, viewer, Role::Viewer)
                .await
                .unwrap(),
            Role::Viewer
        );
        assert!(matches!(
            require(&state, project_id, viewer, Role::Editor).await,
            Err(ApiError::Forbidden(_))
        ));

        // editor: content yes, management no
        assert!(require(&state, project_id, editor, Role::Editor)
            .await
            .is_ok());
        assert!(matches!(
            require(&state, project_id, editor, Role::Admin).await,
            Err(ApiError::Forbidden(_))
        ));

        // project admin: management yes, owner no
        assert!(require(&state, project_id, project_admin, Role::Admin)
            .await
            .is_ok());
        assert!(matches!(
            require(&state, project_id, project_admin, Role::Owner).await,
            Err(ApiError::Forbidden(_))
        ));

        // owner: everything
        assert_eq!(
            require(&state, project_id, owner, Role::Owner)
                .await
                .unwrap(),
            Role::Owner
        );

        // outsider: no access at all
        assert!(matches!(
            require(&state, project_id, outsider, Role::Viewer).await,
            Err(ApiError::Forbidden(_))
        ));

        // global admin: admin power everywhere, membership not required
        assert_eq!(
            require(&state, project_id, global, Role::Admin)
                .await
                .unwrap(),
            Role::Admin
        );
        assert!(require(&state, project_id, global, Role::Viewer)
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn unknown_stored_role_treated_as_viewer() {
        let state = test_support::state().await;
        let owner = test_support::add_user(&state, "owner").await;
        let weird = test_support::add_user(&state, "weird").await;
        let project_id = test_support::add_project(&state, owner).await;
        test_support::add_member(&state, project_id, weird, "superuser").await;

        assert_eq!(
            require(&state, project_id, weird, Role::Viewer)
                .await
                .unwrap(),
            Role::Viewer
        );
        assert!(matches!(
            require(&state, project_id, weird, Role::Editor).await,
            Err(ApiError::Forbidden(_))
        ));
    }

    #[test]
    fn parses_known_roles_only() {
        assert_eq!(Role::parse("owner"), Some(Role::Owner));
        assert_eq!(Role::parse("admin"), Some(Role::Admin));
        assert_eq!(Role::parse("editor"), Some(Role::Editor));
        assert_eq!(Role::parse("viewer"), Some(Role::Viewer));
        assert_eq!(Role::parse("superuser"), None);
        assert!(Role::Owner > Role::Admin && Role::Admin > Role::Editor);
    }

    #[tokio::test]
    async fn global_admin_bypasses_membership() {
        let state = test_support::state().await;
        let owner = test_support::add_user(&state, "owner").await;
        let stranger = test_support::add_user(&state, "stranger").await;
        let pid = test_support::add_project(&state, owner).await;
        test_support::set_global_admin(&state, stranger).await;

        // no membership, but reads work with at least admin power
        assert_eq!(
            require(&state, pid, stranger, Role::Viewer).await.unwrap(),
            Role::Admin
        );
        assert_eq!(
            require(&state, pid, stranger, Role::Admin).await.unwrap(),
            Role::Admin
        );
        // ...but global admin is not the project owner
        assert!(matches!(
            require(&state, pid, stranger, Role::Owner).await,
            Err(ApiError::Forbidden(_))
        ));
    }
}
