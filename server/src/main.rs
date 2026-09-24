use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

mod auth;
mod db;
mod error;
mod feed_helpers;
mod models;
mod routes;
mod state;
mod ws;

pub use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "proman_server=info,tower_http=info".into()),
        )
        .init();

    let upload_dir =
        PathBuf::from(std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "../uploads".to_string()));
    std::fs::create_dir_all(&upload_dir)?;

    let db = db::init().await?;
    let state = Arc::new(AppState {
        db,
        upload_dir,
        broadcast: tokio::sync::broadcast::channel(256).0,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = std::env::var("BIND")
        .unwrap_or_else(|_| "127.0.0.1:3000".into())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Proman API listening on http://{addr}");

    axum::serve(listener, app).await?;
    Ok(())
}
