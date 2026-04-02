# Contributing to TaskFlow API

## Getting Started
1. Fork the repository
2. Clone your fork locally
3. Create a feature branch: git checkout -b feat/your-feature

## Branch Naming
- feat/description — new features
- fix/description — bug fixes
- docs/description — documentation only

## Commit Messages
Follow conventional commits:
- feat: add new feature
- fix: resolve bug
- docs: update documentation
- refactor: code restructure

## Pull Request Requirements
- All tests must pass: npm test
- No ESLint errors: npm run lint
- Add tests for new features
- Update README if needed

## Code Style
- Use const/let, never var
- Async/await over callbacks
- Meaningful variable names
