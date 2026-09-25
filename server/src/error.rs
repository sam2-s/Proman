use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("database error")]
    Db(#[from] sqlx::Error),
    #[error("internal error")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
            ApiError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m.clone()),
            ApiError::Forbidden(m) => (StatusCode::FORBIDDEN, m.clone()),
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m.clone()),
            ApiError::Conflict(m) => (StatusCode::CONFLICT, m.clone()),
            ApiError::Db(e) => {
                tracing::error!("db error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, "database error".into())
            }
            ApiError::Internal(e) => {
                tracing::error!("internal error: {e:?}");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error".into())
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;

    use super::*;

    async fn body_json(resp: Response) -> serde_json::Value {
        let bytes = to_bytes(resp.into_body(), 4096).await.unwrap();
        serde_json::from_slice(&bytes).unwrap()
    }

    #[tokio::test]
    async fn client_errors_map_to_status_and_message() {
        let cases = [
            (
                ApiError::BadRequest("bad input".into()),
                StatusCode::BAD_REQUEST,
                "bad input",
            ),
            (
                ApiError::Unauthorized("no token".into()),
                StatusCode::UNAUTHORIZED,
                "no token",
            ),
            (
                ApiError::Forbidden("not a member".into()),
                StatusCode::FORBIDDEN,
                "not a member",
            ),
            (
                ApiError::NotFound("card not found".into()),
                StatusCode::NOT_FOUND,
                "card not found",
            ),
            (
                ApiError::Conflict("already exists".into()),
                StatusCode::CONFLICT,
                "already exists",
            ),
        ];
        for (err, status, message) in cases {
            let resp = err.into_response();
            assert_eq!(resp.status(), status);
            assert_eq!(body_json(resp).await["error"], message);
        }
    }

    #[tokio::test]
    async fn server_errors_hide_details() {
        let db_err: sqlx::Error = sqlx::Error::RowNotFound;
        let resp = ApiError::from(db_err).into_response();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body_json(resp).await["error"], "database error");

        let internal = ApiError::from(anyhow::anyhow!("secret connection string"));
        let resp = internal.into_response();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body_json(resp).await["error"], "internal error");
    }
}
