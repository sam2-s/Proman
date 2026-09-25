use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;

use crate::auth;
use crate::models::WsEvent;
use crate::state::SharedState;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub project_id: Option<i64>,
    pub token: Option<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(q): Query<WsQuery>,
    State(state): State<SharedState>,
) -> Response {
    let token = match q.token {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, "missing token").into_response(),
    };
    if auth::parse_token(&token).is_err() {
        return (StatusCode::UNAUTHORIZED, "invalid token").into_response();
    }

    let project_id = q.project_id.unwrap_or(0);
    ws.on_upgrade(move |socket| handle_socket(socket, state, project_id))
}

async fn handle_socket(socket: WebSocket, state: SharedState, project_id: i64) {
    let mut rx = state.broadcast.subscribe();
    let (mut sender, mut receiver) = socket.split();
    let mut ping = tokio::time::interval(std::time::Duration::from_secs(30));

    loop {
        tokio::select! {
            _ = ping.tick() => {
                if sender.send(Message::Ping(axum::body::Bytes::new())).await.is_err() {
                    break;
                }
            }
            event = rx.recv() => {
                match event {
                    Ok(ev) => {
                        let pid = event_project_id(&ev);
                        if project_id == 0 || pid == project_id {
                            let text = serde_json::to_string(&ev).unwrap_or_default();
                            if sender.send(Message::Text(text.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            incoming = receiver.next() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => continue,
                }
            }
        }
    }
}

fn event_project_id(ev: &WsEvent) -> i64 {
    match ev {
        WsEvent::CardCreated { project_id, .. }
        | WsEvent::CardUpdated { project_id, .. }
        | WsEvent::CardMoved { project_id, .. }
        | WsEvent::CardDeleted { project_id, .. }
        | WsEvent::ColumnCreated { project_id, .. }
        | WsEvent::ColumnUpdated { project_id, .. }
        | WsEvent::ColumnDeleted { project_id, .. }
        | WsEvent::CommentCreated { project_id, .. }
        | WsEvent::SubtaskUpdated { project_id, .. }
        | WsEvent::NotificationCreated { project_id, .. } => *project_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Card, Column, Comment, Notification};

    fn card(id: i64) -> Card {
        Card {
            id,
            column_id: 3,
            title: "Task".into(),
            description: String::new(),
            priority: "medium".into(),
            position: 0,
            due_date: None,
            start_date: None,
            assignee_id: None,
            created_by: Some(1),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    fn column(id: i64) -> Column {
        Column {
            id,
            board_id: 2,
            name: "To Do".into(),
            position: 0,
        }
    }

    fn comment(id: i64) -> Comment {
        Comment {
            id,
            card_id: 7,
            user_id: 1,
            body: "hi".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            author_name: "Ada".into(),
        }
    }

    fn notification(id: i64) -> Notification {
        Notification {
            id,
            user_id: 1,
            project_id: 5,
            card_id: Some(7),
            body: "assigned".into(),
            read: 0,
            created_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    fn all_events() -> Vec<(WsEvent, i64)> {
        vec![
            (
                WsEvent::CardCreated {
                    project_id: 10,
                    card: card(1),
                },
                10,
            ),
            (
                WsEvent::CardUpdated {
                    project_id: 11,
                    card: card(2),
                },
                11,
            ),
            (
                WsEvent::CardMoved {
                    project_id: 12,
                    card: card(3),
                },
                12,
            ),
            (
                WsEvent::CardDeleted {
                    project_id: 13,
                    card_id: 4,
                },
                13,
            ),
            (
                WsEvent::ColumnCreated {
                    project_id: 14,
                    column: column(5),
                },
                14,
            ),
            (
                WsEvent::ColumnUpdated {
                    project_id: 15,
                    column: column(6),
                },
                15,
            ),
            (
                WsEvent::ColumnDeleted {
                    project_id: 16,
                    column_id: 7,
                },
                16,
            ),
            (
                WsEvent::CommentCreated {
                    project_id: 17,
                    card_id: 8,
                    comment: comment(9),
                },
                17,
            ),
            (
                WsEvent::SubtaskUpdated {
                    project_id: 18,
                    card_id: 10,
                },
                18,
            ),
            (
                WsEvent::NotificationCreated {
                    project_id: 19,
                    notification: notification(11),
                },
                19,
            ),
        ]
    }

    #[test]
    fn event_project_id_covers_every_variant() {
        for (ev, expected) in all_events() {
            assert_eq!(event_project_id(&ev), expected, "variant: {ev:?}");
        }
    }

    #[test]
    fn events_serialize_with_snake_case_type_tag() {
        let cases = [
            (
                WsEvent::CardDeleted {
                    project_id: 1,
                    card_id: 2,
                },
                "card_deleted",
            ),
            (
                WsEvent::ColumnDeleted {
                    project_id: 1,
                    column_id: 2,
                },
                "column_deleted",
            ),
            (
                WsEvent::SubtaskUpdated {
                    project_id: 1,
                    card_id: 2,
                },
                "subtask_updated",
            ),
        ];
        for (ev, tag) in cases {
            let v = serde_json::to_value(&ev).unwrap();
            assert_eq!(v["type"], tag);
            assert_eq!(v["project_id"], 1);
        }
    }
}
