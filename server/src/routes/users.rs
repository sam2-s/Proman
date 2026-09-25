use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::{header, StatusCode};
use axum::response::Response;
use axum::Json;
use serde_json::Value;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::state::SharedState;

const MAX_AVATAR: usize = 5 * 1024 * 1024; // 5 MB

/// multipart content-type -> stored file extension
fn image_ext(mime: &str) -> Option<&'static str> {
    match mime {
        "image/png" => Some("png"),
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        _ => None,
    }
}

/// POST /api/me/avatar — store the caller's profile picture.
/// Accepts multipart field "file" with an image/png|jpeg|webp|gif payload.
pub async fn upload_avatar(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    mut multipart: Multipart,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let mut mime = String::new();
    let mut data = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("invalid multipart: {e}")))?
    {
        if field.name().map(|n| n == "file").unwrap_or(false) {
            if let Some(m) = field.content_type() {
                mime = m.to_string();
            }
            data = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| ApiError::BadRequest(format!("read file: {e}")))?,
            );
            break;
        }
    }

    let data = data.ok_or_else(|| ApiError::BadRequest("missing 'file' field".into()))?;
    if data.is_empty() {
        return Err(ApiError::BadRequest("empty file".into()));
    }
    if data.len() > MAX_AVATAR {
        return Err(ApiError::BadRequest("avatar exceeds 5 MB limit".into()));
    }
    let ext =
        image_ext(&mime).ok_or_else(|| ApiError::BadRequest("unsupported image type".into()))?;

    // One deterministic file per user; drop stale files from other formats.
    for old in ["png", "jpg", "webp", "gif"] {
        if old != ext {
            let _ =
                tokio::fs::remove_file(state.upload_dir.join(format!("avatar_{user_id}.{old}")))
                    .await;
        }
    }
    let stored = format!("avatar_{user_id}.{ext}");
    tokio::fs::write(state.upload_dir.join(&stored), &data)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("write avatar: {e}")))?;

    let public_url = format!("/api/avatars/{user_id}");
    sqlx::query("UPDATE users SET avatar_url = ? WHERE id = ?")
        .bind(&public_url)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    tracing::info!("avatar updated for user {user_id}");
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "avatar_url": public_url })),
    ))
}

/// GET /api/avatars/:user_id — public avatar bytes (web <img> cannot send auth headers).
pub async fn get_avatar(
    State(state): State<SharedState>,
    Path(user_id): Path<i64>,
) -> ApiResult<Response> {
    let row = sqlx::query("SELECT avatar_url FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
    let avatar_url: Option<String> = row.and_then(|r| r.get("avatar_url"));
    if avatar_url.is_none() {
        return Err(ApiError::NotFound("no avatar".into()));
    }

    // avatar_url stores the public path; find the deterministic file on disk.
    let mut dir = tokio::fs::read_dir(&state.upload_dir)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("read upload dir: {e}")))?;
    let prefix = format!("avatar_{user_id}.");
    let mut found: Option<(String, std::path::PathBuf)> = None;
    while let Some(entry) = dir
        .next_entry()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("read upload dir: {e}")))?
    {
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(ext) = name.strip_prefix(&prefix) {
            found = Some((ext.to_string(), entry.path()));
            break;
        }
    }
    let (ext, path) = found.ok_or_else(|| ApiError::NotFound("avatar missing on disk".into()))?;
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|_| ApiError::NotFound("avatar missing on disk".into()))?;

    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    };
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        mime.parse()
            .unwrap_or(header::HeaderValue::from_static("application/octet-stream")),
    );
    // Avatars are public profile data.
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("public, max-age=300"),
    );
    Ok(response)
}
