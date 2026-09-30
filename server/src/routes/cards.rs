use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::models::{Card, Subtask, WsEvent};
use crate::permissions::{require, Role};
use crate::routes::boards::ensure_member;
use crate::state::SharedState;

const PRIORITIES: [&str; 4] = ["low", "medium", "high", "urgent"];

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

async fn fetch_card(state: &SharedState, id: i64) -> ApiResult<Card> {
    sqlx::query_as::<_, Card>(
        r#"SELECT id, column_id, title, description, priority, position,
                  due_date, start_date, assignee_id, created_by, created_at, updated_at
           FROM cards WHERE id = ?"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("card not found".into()))
}

fn validate_priority(p: &str) -> ApiResult<()> {
    if PRIORITIES.contains(&p) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(format!(
            "priority must be one of {:?}",
            PRIORITIES
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support;

    #[test]
    fn accepts_valid_priorities() {
        for p in PRIORITIES {
            assert!(validate_priority(p).is_ok());
        }
    }

    #[test]
    fn rejects_unknown_priority() {
        assert!(validate_priority("critical").is_err());
    }

    #[tokio::test]
    async fn viewer_cannot_create_cards() {
        let state = test_support::state().await;
        let owner = test_support::add_user(&state, "owner").await;
        let viewer = test_support::add_user(&state, "viewer").await;
        let project_id = test_support::add_project(&state, owner).await;
        test_support::add_member(&state, project_id, viewer, "viewer").await;

        let board_id: i64 =
            sqlx::query("INSERT INTO boards (project_id, name) VALUES (?, 'Main') RETURNING id")
                .bind(project_id)
                .fetch_one(&state.db)
                .await
                .expect("insert board")
                .get("id");
        let col_id: i64 = sqlx::query(
            "INSERT INTO columns (board_id, name, position) VALUES (?, 'Todo', 0) RETURNING id",
        )
        .bind(board_id)
        .fetch_one(&state.db)
        .await
        .expect("insert column")
        .get("id");

        let req = Json(CreateCard {
            title: "test".into(),
            description: "".into(),
            priority: "medium".into(),
            due_date: None,
            start_date: None,
            position: None,
            assignee_id: None,
        });
        let res = create(State(state.clone()), AuthUser(viewer), Path(col_id), req).await;
        assert!(matches!(res, Err(ApiError::Forbidden(_))));
    }

    #[tokio::test]
    async fn viewer_cannot_update_cards() {
        let state = test_support::state().await;
        let owner = test_support::add_user(&state, "owner").await;
        let viewer = test_support::add_user(&state, "viewer").await;
        let project_id = test_support::add_project(&state, owner).await;
        test_support::add_member(&state, project_id, viewer, "viewer").await;

        let board_id: i64 =
            sqlx::query("INSERT INTO boards (project_id, name) VALUES (?, 'Main') RETURNING id")
                .bind(project_id)
                .fetch_one(&state.db)
                .await
                .expect("insert board")
                .get("id");
        let col_id: i64 = sqlx::query(
            "INSERT INTO columns (board_id, name, position) VALUES (?, 'Todo', 0) RETURNING id",
        )
        .bind(board_id)
        .fetch_one(&state.db)
        .await
        .expect("insert column")
        .get("id");
        let card_id: i64 = sqlx::query("INSERT INTO cards (column_id, title, description, priority, position) VALUES (?, 'Task', '', 'medium', 0) RETURNING id")
            .bind(col_id)
            .fetch_one(&state.db)
            .await
            .expect("insert card")
            .get("id");

        let req = Json(UpdateCard {
            title: Some("updated".into()),
            description: None,
            priority: None,
            due_date: None,
            start_date: None,
            position: None,
            assignee_id: None,
            column_id: None,
        });
        let res = update(State(state.clone()), AuthUser(viewer), Path(card_id), req).await;
        assert!(matches!(res, Err(ApiError::Forbidden(_))));
    }

    #[tokio::test]
    async fn viewer_cannot_delete_cards() {
        let state = test_support::state().await;
        let owner = test_support::add_user(&state, "owner").await;
        let viewer = test_support::add_user(&state, "viewer").await;
        let project_id = test_support::add_project(&state, owner).await;
        test_support::add_member(&state, project_id, viewer, "viewer").await;

        let board_id: i64 =
            sqlx::query("INSERT INTO boards (project_id, name) VALUES (?, 'Main') RETURNING id")
                .bind(project_id)
                .fetch_one(&state.db)
                .await
                .expect("insert board")
                .get("id");
        let col_id: i64 = sqlx::query(
            "INSERT INTO columns (board_id, name, position) VALUES (?, 'Todo', 0) RETURNING id",
        )
        .bind(board_id)
        .fetch_one(&state.db)
        .await
        .expect("insert column")
        .get("id");
        let card_id: i64 = sqlx::query("INSERT INTO cards (column_id, title, description, priority, position) VALUES (?, 'Task', '', 'medium', 0) RETURNING id")
            .bind(col_id)
            .fetch_one(&state.db)
            .await
            .expect("insert card")
            .get("id");

        let res = remove(State(state.clone()), AuthUser(viewer), Path(card_id)).await;
        assert!(matches!(res, Err(ApiError::Forbidden(_))));
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateCard {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub position: Option<i64>,
    #[serde(default)]
    pub assignee_id: Option<i64>,
}

fn default_priority() -> String {
    "medium".into()
}

pub async fn create(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(column_id): Path<i64>,
    Json(req): Json<CreateCard>,
) -> ApiResult<(StatusCode, Json<Card>)> {
    let project_id = super::boards::column_project(&state, column_id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;

    let title = req.title.trim();
    if title.is_empty() {
        return Err(ApiError::BadRequest("title required".into()));
    }
    validate_priority(&req.priority)?;

    let position = match req.position {
        Some(p) => p,
        None => {
            let row = sqlx::query(
                "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE column_id = ?",
            )
            .bind(column_id)
            .fetch_one(&state.db)
            .await?;
            row.get::<i64, _>("p")
        }
    };

    let card = sqlx::query_as::<_, Card>(
        r#"INSERT INTO cards (column_id, title, description, priority, position, due_date, start_date, assignee_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id, column_id, title, description, priority, position,
                     due_date, start_date, assignee_id, created_by, created_at, updated_at"#,
    )
    .bind(column_id)
    .bind(title)
    .bind(req.description.trim())
    .bind(&req.priority)
    .bind(position)
    .bind(&req.due_date)
    .bind(&req.start_date)
    .bind(req.assignee_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    let _ = state.broadcast.send(WsEvent::CardCreated {
        project_id,
        card: card.clone(),
    });
    crate::feed_helpers::log_activity(
        &state.db,
        project_id,
        Some(user_id),
        Some(card.id),
        "card_created",
        &format!("Created task \"{}\"", card.title),
    )
    .await;
    Ok((StatusCode::CREATED, Json(card)))
}

pub async fn detail(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    let project_id = card_project(&state, id).await?;
    ensure_member(&state, project_id, user_id).await?;
    let card = fetch_card(&state, id).await?;

    let members = sqlx::query(
        r#"SELECT m.user_id, u.name, u.username, u.avatar_url, m.role
           FROM project_members m JOIN users u ON u.id = m.user_id
           WHERE m.project_id = ?"#,
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;
    let members: Vec<Value> = members
        .iter()
        .map(|r| {
            serde_json::json!({
                "user_id": r.get::<i64, _>("user_id"),
                "name": r.get::<String, _>("name"),
                "username": r.get::<String, _>("username"),
                "avatar_url": r.get::<Option<String>, _>("avatar_url"),
                "role": r.get::<String, _>("role"),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "card": card,
        "members": members,
    })))
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateCard {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<Option<String>>,
    pub start_date: Option<Option<String>>,
    pub position: Option<i64>,
    pub column_id: Option<i64>,
    pub assignee_id: Option<Option<i64>>,
}

pub async fn update(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateCard>,
) -> ApiResult<Json<Card>> {
    let project_id = card_project(&state, id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;

    if let Some(p) = &req.priority {
        validate_priority(p)?;
    }
    if let Some(t) = &req.title {
        if t.trim().is_empty() {
            return Err(ApiError::BadRequest("title cannot be empty".into()));
        }
        sqlx::query("UPDATE cards SET title = ? WHERE id = ?")
            .bind(t.trim())
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(d) = &req.description {
        sqlx::query("UPDATE cards SET description = ? WHERE id = ?")
            .bind(d)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(p) = &req.priority {
        sqlx::query("UPDATE cards SET priority = ? WHERE id = ?")
            .bind(p)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(d) = req.due_date {
        sqlx::query("UPDATE cards SET due_date = ? WHERE id = ?")
            .bind(d)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(s) = req.start_date {
        sqlx::query("UPDATE cards SET start_date = ? WHERE id = ?")
            .bind(s)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(col) = req.column_id {
        sqlx::query("UPDATE cards SET column_id = ? WHERE id = ?")
            .bind(col)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(pos) = req.position {
        sqlx::query("UPDATE cards SET position = ? WHERE id = ?")
            .bind(pos)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(a) = req.assignee_id {
        sqlx::query("UPDATE cards SET assignee_id = ? WHERE id = ?")
            .bind(a)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    sqlx::query("UPDATE cards SET updated_at = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;

    let card = fetch_card(&state, id).await?;
    let _ = state.broadcast.send(WsEvent::CardUpdated {
        project_id,
        card: card.clone(),
    });
    if let Some(Some(assignee)) = req.assignee_id {
        if assignee != user_id {
            crate::feed_helpers::notify_user(
                &state,
                assignee,
                project_id,
                Some(id),
                &format!("You were assigned to \"{}\"", card.title),
            )
            .await;
        }
    }
    crate::feed_helpers::log_activity(
        &state.db,
        project_id,
        Some(user_id),
        Some(id),
        "card_updated",
        &format!("Updated task \"{}\"", card.title),
    )
    .await;
    Ok(Json(card))
}

pub async fn remove(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    let project_id = card_project(&state, id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;
    sqlx::query("DELETE FROM cards WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;
    let _ = state.broadcast.send(WsEvent::CardDeleted {
        project_id,
        card_id: id,
    });
    crate::feed_helpers::log_activity(
        &state.db,
        project_id,
        Some(user_id),
        Some(id),
        "card_deleted",
        "Deleted a task",
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_subtasks(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Vec<Subtask>>> {
    let project_id = card_project(&state, id).await?;
    ensure_member(&state, project_id, user_id).await?;
    let rows = sqlx::query_as::<_, Subtask>(
        "SELECT id, card_id, title, done, position FROM subtasks WHERE card_id = ? ORDER BY position, id",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateSubtask {
    pub title: String,
}

pub async fn add_subtask(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<CreateSubtask>,
) -> ApiResult<(StatusCode, Json<Subtask>)> {
    let project_id = card_project(&state, id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;
    let title = req.title.trim();
    if title.is_empty() {
        return Err(ApiError::BadRequest("subtask title required".into()));
    }

    let pos_row =
        sqlx::query("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM subtasks WHERE card_id = ?")
            .bind(id)
            .fetch_one(&state.db)
            .await?;
    let position: i64 = pos_row.get("p");

    let sub = sqlx::query_as::<_, Subtask>(
        "INSERT INTO subtasks (card_id, title, position) VALUES (?, ?, ?) RETURNING id, card_id, title, done, position",
    )
    .bind(id)
    .bind(title)
    .bind(position)
    .fetch_one(&state.db)
    .await?;

    let _ = state.broadcast.send(WsEvent::SubtaskUpdated {
        project_id,
        card_id: id,
    });
    Ok((StatusCode::CREATED, Json(sub)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSubtask {
    pub title: Option<String>,
    pub done: Option<bool>,
    pub position: Option<i64>,
}

pub async fn update_subtask(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateSubtask>,
) -> ApiResult<Json<Subtask>> {
    let row = sqlx::query("SELECT card_id FROM subtasks WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("subtask not found".into()))?;
    let card_id: i64 = row.get("card_id");
    let project_id = card_project(&state, card_id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;

    if let Some(t) = &req.title {
        sqlx::query("UPDATE subtasks SET title = ? WHERE id = ?")
            .bind(t.trim())
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(d) = req.done {
        sqlx::query("UPDATE subtasks SET done = ? WHERE id = ?")
            .bind(d as i64)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    if let Some(p) = req.position {
        sqlx::query("UPDATE subtasks SET position = ? WHERE id = ?")
            .bind(p)
            .bind(id)
            .execute(&state.db)
            .await?;
    }

    let sub = sqlx::query_as::<_, Subtask>(
        "SELECT id, card_id, title, done, position FROM subtasks WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let _ = state.broadcast.send(WsEvent::SubtaskUpdated {
        project_id,
        card_id,
    });
    Ok(Json(sub))
}

pub async fn delete_subtask(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<StatusCode> {
    let row = sqlx::query("SELECT card_id FROM subtasks WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("subtask not found".into()))?;
    let card_id: i64 = row.get("card_id");
    let project_id = card_project(&state, card_id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;

    sqlx::query("DELETE FROM subtasks WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;
    let _ = state.broadcast.send(WsEvent::SubtaskUpdated {
        project_id,
        card_id,
    });
    Ok(StatusCode::NO_CONTENT)
}

/// All cards in a project that have dates — used by Gantt + calendar views.
pub async fn timeline_for_project(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Vec<Card>>> {
    ensure_member(&state, id, user_id).await?;
    let cards = sqlx::query_as::<_, Card>(
        r#"SELECT c.id, c.column_id, c.title, c.description, c.priority, c.position,
                  c.due_date, c.start_date, c.assignee_id, c.created_by, c.created_at, c.updated_at
           FROM cards c
           JOIN columns col ON col.id = c.column_id
           JOIN boards b ON b.id = col.board_id
           WHERE b.project_id = ?
           ORDER BY c.due_date IS NULL, c.due_date, c.position"#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(cards))
}
