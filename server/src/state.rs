use std::path::PathBuf;
use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::broadcast;

use crate::models::WsEvent;

pub struct AppState {
    pub db: SqlitePool,
    pub upload_dir: PathBuf,
    pub broadcast: broadcast::Sender<WsEvent>,
}

pub type SharedState = Arc<AppState>;
