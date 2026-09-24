.PHONY: help server app web typecheck check fmt clean

help:
	@echo "Proman make targets:"
	@echo "  make server     - run Rust API on :3000"
	@echo "  make app        - start Expo dev server"
	@echo "  make web        - start Expo for web"
	@echo "  make typecheck  - TypeScript check"
	@echo "  make check      - cargo check + tsc"
	@echo "  make fmt        - cargo fmt"
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

fmt:
	cd server && cargo fmt

clean:
	cd server && cargo clean
	rm -rf app/dist app/.expo
