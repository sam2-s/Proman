# Contributing to Proman

Thanks for your interest in contributing!

## Workflow

1. Fork the repository and create a feature branch from `main`.
2. Make your changes in small, focused commits.
3. Ensure `cargo check` passes in `server/` and `npx tsc --noEmit` passes in `app/`.
4. Open a pull request describing the change and why it's needed.

## Commit style

Use short, imperative subjects:

```
add drag-and-drop between columns
fix token refresh on app resume
```

## Code style

- **Rust**: follow `rustfmt` defaults (`cargo fmt`).
- **TypeScript**: follow the existing Expo/React Native patterns in `app/`.
- Prefer small components and modules over large files.

## Reporting bugs

Open an issue with:

- What you expected
- What actually happened
- Steps to reproduce
- Platform (web / iOS / Android / server)
