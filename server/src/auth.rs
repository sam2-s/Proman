use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,
    pub exp: usize,
    pub iat: usize,
}

fn jwt_secret() -> Vec<u8> {
    std::env::var("JWT_SECRET")
        .map(|s| s.into_bytes())
        .unwrap_or_else(|_| b"proman-dev-secret-change-me-in-prod".to_vec())
}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("hash failed: {e}")))?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed = match PasswordHash::new(hash) {
        Ok(p) => p,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

pub fn issue_token(user_id: i64) -> Result<String, ApiError> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id,
        iat: now,
        exp: now + 60 * 60 * 24 * 7, // 7 days
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&jwt_secret()),
    )
    .map_err(|e| ApiError::Internal(anyhow::anyhow!("token encode: {e}")))
}

pub fn parse_token(token: &str) -> Result<Claims, ApiError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(&jwt_secret()),
        &Validation::default(),
    )
    .map(|d| d.claims)
    .map_err(|_| ApiError::Unauthorized("invalid or expired token".into()))
}

pub struct AuthUser(pub i64);

impl FromRequestParts<crate::state::SharedState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &crate::state::SharedState,
    ) -> Result<Self, Self::Rejection> {
        let auth = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| ApiError::Unauthorized("missing Authorization header".into()))?;

        let token = auth
            .strip_prefix("Bearer ")
            .ok_or_else(|| ApiError::Unauthorized("expected Bearer token".into()))?;

        let claims = parse_token(token)?;
        Ok(AuthUser(claims.sub))
    }
}
