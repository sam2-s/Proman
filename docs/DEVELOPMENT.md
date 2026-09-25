# Development

## Prerequisites

- Rust stable (`rustup`)
- Node.js 22+
- Expo Go (mobile testing)
- Optional: Android SDK for emulator builds

## Running locally

```bash
# Terminal 1 — API
cd server
cargo run
# → http://127.0.0.1:3000

# Terminal 2 — App
cd app
npm install          # first time only
npx expo start
# press w for web, scan QR for phone
```

## Environment variables

| Variable          | Default                         | Purpose              |
|-------------------|---------------------------------|----------------------|
| `BIND`            | `127.0.0.1:3000`                | API listen address   |
| `DATABASE_URL`    | `sqlite:proman.db?mode=rwc`     | SQLite location      |
| `JWT_SECRET`      | dev fallback                    | Token signing key    |
| `UPLOAD_DIR`      | `../uploads`                    | Attachment storage   |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` (web) | Frontend API base    |

For a phone on the same Wi-Fi, set:

```bash
export EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000
npx expo start
```

## Useful commands

```bash
make check      # cargo check + tsc
make test       # cargo unit tests
make fmt        # rustfmt
make server     # cargo run
make web        # expo start --web
make smoke      # end-to-end API smoke test
```

## Android APK

EAS cloud (APK for preview):

```bash
cd app
npx eas-cli build --platform android --profile preview
```

Local Gradle (requires Android SDK + JDK 17+):

```bash
make prebuild   # expo prebuild --platform android --clean
make apk        # ./gradlew assembleDebug
# → app/android/app/build/outputs/apk/debug/app-debug.apk
```

`app/eas.json` sets `preview.android.buildType = "apk"` so cloud preview builds
emit an installable APK rather than an AAB.

## Testing the stack

```bash
# health
curl http://127.0.0.1:3000/api/health

# register
curl -X POST http://127.0.0.1:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"you","password":"password123","name":"You"}'
```

## Project layout

```
server/          Rust (Axum) API
  src/routes/    REST handlers
  src/ws.rs      WebSocket hub
app/             Expo app
  src/app/       expo-router screens (file-based routes)
  src/api/       typed fetch client
  src/hooks/     board state + socket hooks
  src/components/ UI pieces
docs/            API + design docs
```
