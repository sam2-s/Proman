use sqlx::Row;
use sqlx::SqlitePool;

use crate::models::{Notification, WsEvent};
use crate::state::SharedState;

pub async fn log_activity(
    pool: &SqlitePool,
    project_id: i64,
    user_id: Option<i64>,
    card_id: Option<i64>,
    verb: &str,
    summary: &str,
) {
    let _ = sqlx::query(
        "INSERT INTO activity (project_id, user_id, card_id, verb, summary) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(project_id)
    .bind(user_id)
    .bind(card_id)
    .bind(verb)
    .bind(summary)
    .execute(pool)
    .await;
}

pub async fn notify_user(
    state: &SharedState,
    user_id: i64,
    project_id: i64,
    card_id: Option<i64>,
    body: &str,
) {
    let inserted = sqlx::query_as::<_, Notification>(
        r#"INSERT INTO notifications (user_id, project_id, card_id, body)
           VALUES (?, ?, ?, ?)
           RETURNING id, user_id, project_id, card_id, body, read, created_at"#,
    )
    .bind(user_id)
    .bind(project_id)
    .bind(card_id)
    .bind(body)
    .fetch_one(&state.db)
    .await;
    if let Ok(n) = inserted {
        let _ = state.broadcast.send(WsEvent::NotificationCreated {
            project_id,
            notification: n,
        });
    }
}

pub async fn notify_members(
    state: &SharedState,
    project_id: i64,
    except_user: Option<i64>,
    card_id: Option<i64>,
    body: &str,
) {
    let rows = match sqlx::query("SELECT user_id FROM project_members WHERE project_id = ?")
        .bind(project_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(r) => r,
        Err(_) => return,
    };

    for row in rows {
        let uid: i64 = row.get("user_id");
        if Some(uid) == except_user {
            continue;
        }
        notify_user(state, uid, project_id, card_id, body).await;
    }
}
