use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::{header, StatusCode};
use axum::response::Response;
use axum::Json;
use sqlx::Row;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::models::Attachment;
use crate::permissions::{require, Role};
use crate::routes::boards::ensure_member;
use crate::state::SharedState;

const MAX_SIZE: usize = 20 * 1024 * 1024; // 20 MB

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

pub async fn list(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(card_id): Path<i64>,
) -> ApiResult<Json<Vec<Attachment>>> {
    let project_id = card_project(&state, card_id).await?;
    ensure_member(&state, project_id, user_id).await?;

    let rows = sqlx::query_as::<_, Attachment>(
        r#"SELECT id, card_id, filename, stored_name, mime, size, uploaded_by, created_at
           FROM attachments WHERE card_id = ? ORDER BY created_at, id"#,
    )
    .bind(card_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn upload(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(card_id): Path<i64>,
    mut multipart: Multipart,
) -> ApiResult<(StatusCode, Json<Attachment>)> {
    let project_id = card_project(&state, card_id).await?;
    require(&state, project_id, user_id, Role::Editor).await?;

    let mut filename = String::from("upload.bin");
    let mut mime = String::from("application/octet-stream");
    let mut data = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("invalid multipart: {e}")))?
    {
        if field.name().map(|n| n == "file").unwrap_or(false) {
            if let Some(f) = field.file_name() {
                filename = f.to_string();
            }
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
    if data.len() > MAX_SIZE {
        return Err(ApiError::BadRequest("file exceeds 20 MB limit".into()));
    }

    let stored_name = format!("{}_{}", uuid::Uuid::new_v4(), filename.replace('/', "_"));
    let path = state.upload_dir.join(&stored_name);
    tokio::fs::write(&path, &data)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("write file: {e}")))?;

    let row = sqlx::query(
        r#"INSERT INTO attachments (card_id, filename, stored_name, mime, size, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)
           RETURNING id, card_id, filename, stored_name, mime, size, uploaded_by, created_at"#,
    )
    .bind(card_id)
    .bind(&filename)
    .bind(&stored_name)
    .bind(&mime)
    .bind(data.len() as i64)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    let att = Attachment {
        id: row.get("id"),
        card_id: row.get("card_id"),
        filename: row.get("filename"),
        stored_name: row.get("stored_name"),
        mime: row.get("mime"),
        size: row.get("size"),
        uploaded_by: row.get("uploaded_by"),
        created_at: row.get("created_at"),
    };
    Ok((StatusCode::CREATED, Json(att)))
}

pub async fn download(
    State(state): State<SharedState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<i64>,
) -> ApiResult<Response> {
    let row = sqlx::query(
        r#"SELECT a.card_id, a.filename, a.stored_name, a.mime,
                  b.project_id
           FROM attachments a
           JOIN cards c ON c.id = a.card_id
           JOIN columns col ON col.id = c.column_id
           JOIN boards b ON b.id = col.board_id
           WHERE a.id = ?"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("attachment not found".into()))?;

    let project_id: i64 = row.get("project_id");
    ensure_member(&state, project_id, user_id).await?;

    let filename: String = row.get("filename");
    let stored: String = row.get("stored_name");
    let mime: String = row.get("mime");

    let path = state.upload_dir.join(&stored);
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|_| ApiError::NotFound("file missing on disk".into()))?;

    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        mime.parse()
            .unwrap_or(header::HeaderValue::from_static("application/octet-stream")),
    );
    let disposition = format!("attachment; filename=\"{}\"", filename.replace('"', ""));
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        disposition
            .parse()
            .unwrap_or_else(|_| header::HeaderValue::from_static("attachment")),
    );
    Ok(response)
}
