.PHONY: help server app web typecheck check fmt clean apk prebuild test smoke

help:
	@echo "Proman make targets:"
	@echo "  make server     - run Rust API on :3000"
	@echo "  make app        - start Expo dev server"
	@echo "  make web        - start Expo for web"
	@echo "  make typecheck  - TypeScript check"
	@echo "  make check      - cargo check + tsc"
	@echo "  make test       - cargo test"
	@echo "  make fmt        - cargo fmt"
	@echo "  make smoke      - API smoke tests (server must be running)"
	@echo "  make prebuild   - generate native android/ios projects"
	@echo "  make apk        - local Android debug APK via Gradle"
	@echo "  make clean      - remove build artifacts"

server:
	cd server && cargo run

app:
	cd app && npx expo start

web:
	cd app && npx expo start --web

typecheck:
	cd app && npx tsc --noEmit

check:
	cd server && cargo check
	cd app && npx tsc --noEmit

test:
	cd server && cargo test

fmt:
	cd server && cargo fmt

smoke:
	bash scripts/smoke.sh

prebuild:
	cd app && npx expo prebuild --platform android --clean

apk: prebuild
	cd app/android && ./gradlew assembleDebug
	@echo "APK: app/android/app/build/outputs/apk/debug/app-debug.apk"

clean:
	cd server && cargo clean
	rm -rf app/dist app/.expo app/android app/ios
