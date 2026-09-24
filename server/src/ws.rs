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
        | WsEvent::SubtaskUpdated { project_id, .. } => *project_id,
    }
}
