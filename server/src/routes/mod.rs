pub mod attachments;
pub mod auth;
pub mod boards;
pub mod cards;
pub mod comments;
pub mod feed;
pub mod projects;

use axum::routing::{get, patch, post};
use axum::Router;

use crate::state::SharedState;

pub fn router(state: SharedState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/me", get(auth::me))
        .route("/api/search", get(feed::search_cards))
        .route("/api/notifications", get(feed::list_notifications))
        .route(
            "/api/notifications/unread-count",
            get(feed::unread_notification_count),
        )
        .route(
            "/api/notifications/read-all",
            post(feed::mark_all_notifications_read),
        )
        .route(
            "/api/notifications/{id}/read",
            post(feed::mark_notification_read),
        )
        .route("/api/projects", get(projects::list).post(projects::create))
        .route(
            "/api/projects/{id}",
            get(projects::detail).delete(projects::remove),
        )
        .route("/api/projects/{id}/members", post(projects::add_member))
        .route("/api/projects/{id}/activity", get(feed::list_activity))
        .route(
            "/api/projects/{id}/boards",
            get(boards::list_for_project).post(boards::create),
        )
        .route("/api/projects/{id}/cards", get(cards::timeline_for_project))
        .route("/api/boards/{id}", get(boards::detail))
        .route("/api/boards/{id}/columns", post(boards::create_column))
        .route(
            "/api/columns/{id}",
            patch(boards::update_column).delete(boards::delete_column),
        )
        .route("/api/columns/{id}/cards", post(cards::create))
        .route(
            "/api/cards/{id}",
            get(cards::detail)
                .patch(cards::update)
                .delete(cards::remove),
        )
        .route(
            "/api/cards/{id}/subtasks",
            get(cards::list_subtasks).post(cards::add_subtask),
        )
        .route(
            "/api/subtasks/{id}",
            patch(cards::update_subtask).delete(cards::delete_subtask),
        )
        .route(
            "/api/cards/{id}/comments",
            get(comments::list).post(comments::create),
        )
        .route(
            "/api/cards/{id}/attachments",
            get(attachments::list).post(attachments::upload),
        )
        .route("/api/attachments/{id}", get(attachments::download))
        .route("/ws", get(crate::ws::ws_handler))
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
