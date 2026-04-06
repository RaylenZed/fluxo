# Contributing to Fluxo

Thank you for your interest in contributing to Fluxo!

## Development Setup

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- A running Mihomo instance (for testing API integration)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/raylenzed/fluxo.git
cd fluxo

# Install dependencies
pnpm install

# Copy environment file
cp apps/server/.env.example apps/server/.env

# Start development servers
pnpm dev
# Web UI: http://localhost:38080
# API:    http://localhost:8090
```

### Project Structure

```
fluxo/
├── apps/
│   ├── web/          # Next.js 16 frontend
│   └── server/       # Fastify 5 backend
├── packages/
│   └── shared/       # Shared TypeScript types
├── docker-compose.yml
├── Dockerfile
└── install.sh
```

## Submitting Changes

### Issues

- Search existing issues before opening a new one
- For bugs, include steps to reproduce, expected behavior, and environment details
- For feature requests, describe the use case clearly

### Pull Requests

1. Fork the repository and create a branch from `main`
2. Make your changes following the code style below
3. Test your changes locally
4. Submit a PR with a clear description

### Code Style

- TypeScript: strict mode enabled
- Frontend: React functional components with hooks
- No `any` types without a comment explaining why
- Run `pnpm typecheck` before submitting

### Commit Messages

Use conventional commits format:

```
feat: add proxy latency test button
fix: websocket reconnection on page focus
chore: update dependencies
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
