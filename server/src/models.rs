use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub is_admin: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub owner_id: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Member {
    pub project_id: i64,
    pub user_id: i64,
    pub role: String,
    pub name: String,
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Board {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Column {
    pub id: i64,
    pub board_id: i64,
    pub name: String,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Card {
    pub id: i64,
    pub column_id: i64,
    pub title: String,
    pub description: String,
    pub priority: String,
    pub position: i64,
    pub due_date: Option<String>,
    pub start_date: Option<String>,
    pub assignee_id: Option<i64>,
    pub created_by: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Subtask {
    pub id: i64,
    pub card_id: i64,
    pub title: String,
    pub done: i64,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Comment {
    pub id: i64,
    pub card_id: i64,
    pub user_id: i64,
    pub body: String,
    pub created_at: String,
    pub author_name: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Attachment {
    pub id: i64,
    pub card_id: i64,
    pub filename: String,
    pub stored_name: String,
    pub mime: String,
    pub size: i64,
    pub uploaded_by: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsEvent {
    CardCreated {
        project_id: i64,
        card: Card,
    },
    CardUpdated {
        project_id: i64,
        card: Card,
    },
    CardMoved {
        project_id: i64,
        card: Card,
    },
    CardDeleted {
        project_id: i64,
        card_id: i64,
    },
    ColumnCreated {
        project_id: i64,
        column: Column,
    },
    ColumnUpdated {
        project_id: i64,
        column: Column,
    },
    ColumnDeleted {
        project_id: i64,
        column_id: i64,
    },
    CommentCreated {
        project_id: i64,
        card_id: i64,
        comment: Comment,
    },
    SubtaskUpdated {
        project_id: i64,
        card_id: i64,
    },
    NotificationCreated {
        project_id: i64,
        notification: Notification,
    },
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Activity {
    pub id: i64,
    pub project_id: i64,
    pub user_id: Option<i64>,
    pub card_id: Option<i64>,
    pub verb: String,
    pub summary: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Notification {
    pub id: i64,
    pub user_id: i64,
    pub project_id: i64,
    pub card_id: Option<i64>,
    pub body: String,
    pub read: i64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterReq {
    pub username: String,
    pub password: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginReq {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[allow(dead_code)]
pub fn now() -> DateTime<Utc> {
    Utc::now()
}
