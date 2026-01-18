# Contribute to HipoCap

Thank you very much for showing interest in contributing to HipoCap!

## How to contribute

If you want to contribute to HipoCap, first check open and closed issues
for any similar items. If you can find an existing issue, only add to it if you believe
you have additional context that will help us locate and debug the issue. 

If you want to contribute your code, ask in an open issue if it can be assigned to you.
Then fork the repo, and develop locally. Once you are done with your change, submit a pull
request through your fork. Our active development branch is `dev`, and we merge it into
`main` periodically. Please submit your PRs to `dev`, and consider including `dev`
when you fork the repo.

### Contributor License Agreement

When you open a pull request, CLA bot will ask you to sign our Contributor License Agreement (CLA).
We do this to avoid legal issues and disputes, and to stay compliant with relevant IP laws.

## Why are there so many docker-compose files?

Don't get overwhelmed by the number of docker-compose files. Here's a quick overview:

- `docker-compose.yml` uses pre-built images from Docker Hub. Good for quickstarts and testing.
- `docker-compose.prod.yml` is optimized for production deployments with restart policies and production settings.
- `docker-compose-local-dev.yml` is the one you want to use for local frontend development. It runs all services including frontend in Docker with hot-reload enabled. The frontend runs in dev mode from your local directory.
- `docker-compose-local-dev-full.yml` (if it exists) is for full stack development. It runs dependency services (postgres, clickhouse, rabbitmq) while you run app-server, frontend, and hipocap-server manually.
- `docker-compose-local-build.yml` (if it exists) builds services from source and runs them in production mode. Good for self-hosting with your own changes or testing before opening a PR.

| Service | docker-compose.yml | docker-compose.prod.yml | docker-compose-local-dev.yml |
|---------|-------------------|------------------------|----------------------------|
| postgres | ✅ | ✅ | ✅ |
| clickhouse | ✅ | ✅ | ✅ |
| quickwit | ✅ | ✅ | ✅ |
| query-engine | ✅ | ✅ | ✅ |
| app-server | ✅ | ✅ | ✅ |
| hipocap-server | ✅ | ✅ | ✅ |
| frontend | ✅ | ✅ | ✅ |

- ✅ – service present, image is pulled from a container registry or built from source.
- 🔧 – service present, image is built from the source. This may take a while.
- ℹ️ - service present, but is a lightweight version.
- 💻 – service needs to be run manually (see below).
- ❌ – service not present.

## Running HipoCap locally for development

### Quick Start: Frontend Development

Use this guide if you are changing frontend code only. The frontend will run in Docker with hot-reload enabled.

#### 0. Configure environment variables

Create a `.env` file in the project root with required environment variables:

```bash
# Copy example file (if available)
cp .env.example .env

# Or create manually with at minimum:
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
HIPOCAP_DB_NAME=hipocap_second
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
SHARED_SECRET_TOKEN=your-secret-token
AEAD_SECRET_KEY=your-aead-key
HIPOCAP_API_KEY=your-api-key
```

For frontend-specific environment variables:

```bash
cd frontend
cp .env.local.example .env.local  # if example exists
```

#### 1. Start all services (including frontend in Docker)

```bash
docker compose -f docker-compose-local-dev.yml up
```

This will:
- Start postgres, clickhouse, quickwit, query-engine, app-server, and hipocap-server
- Build and run the frontend in development mode from your local directory
- Enable hot-reload for frontend changes

The frontend will be available at `http://localhost:3000` (or the port specified by `FRONTEND_HOST_PORT`).

#### 2. Making changes

Since the frontend runs in Docker with your local directory mounted, any changes you make to the frontend code will be automatically reflected thanks to Next.js hot-reload.

## [Advanced] Running full stack locally for development

This guide is for when you are changing backend code (app-server, hipocap-server, query-engine), or when you want to run services manually outside of Docker.

### 0. Configure environment variables

For both app-server and frontend, the environment is defined
in `.env.example` files, and you need to copy that to `.env` files, i.e.

```bash
cp .env.example .env
# and for frontend:
cp frontend/.env.local.example frontend/.env.local
```

### 1. Spin up dependency containers

If you have `docker-compose-local-dev-full.yml`:

```bash
docker compose -f docker-compose-local-dev-full.yml up
```

This will spin up postgres, clickhouse, quickwit, and RabbitMQ (if needed).

Alternatively, you can use `docker-compose-local-dev.yml` and stop the services you want to run manually:

```bash
docker compose -f docker-compose-local-dev.yml up postgres clickhouse quickwit query-engine
```

### 2. Run app-server in development mode

```bash
cd app-server
cargo r
```

Rust is compiled and not hot-reloadable, so you will need to rerun `cargo r` every time you want
to test a change.

### 3. Run hipocap-server in development mode

```bash
cd hipocap_server
# Install dependencies if needed
pip install -e .

# Run the server
python -m hipocap_server.main  # or the appropriate entry point
```

### 4. Run frontend in development mode

```bash
cd frontend
pnpm install  # if needed
pnpm run dev
```

### 5. After finishing your changes

Make sure everything runs well in integration in Docker:

```bash
# Stop all the development servers
docker compose down

# Test with production-like setup
docker compose -f docker-compose-local-build.yml up  # if available
# or
docker compose -f docker-compose.yml up
```

Note that these Docker compose files will build and run services from local code in production mode.

## Environment Variables

When running in Docker, most environment variables are configured in the docker-compose files. Key variables include:

### Required for Docker Compose

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - Database credentials
- `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` - ClickHouse credentials
- `SHARED_SECRET_TOKEN`, `AEAD_SECRET_KEY` - Security tokens
- `HIPOCAP_API_KEY` - API key for hipocap-server
- `OPENAI_API_KEY`, `OPENAI_MODEL` - LLM configuration (for hipocap-server)

### Frontend-specific

- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` - NextAuth configuration
- `DATABASE_URL` - PostgreSQL connection string (auto-configured in Docker)
- `BACKEND_URL`, `BACKEND_RT_URL` - App-server URLs (auto-configured in Docker)
- `HIPOCAP_SERVER_URL` - Hipocap-server URL (auto-configured in Docker)

See `DEPLOYMENT.md` for a complete list of environment variables.

## Database migrations

We use [drizzle ORM](https://orm.drizzle.team/) to manage database migrations. However,
our source of truth is always the database itself. In other words, the schema in the code 
is generated from the database state. Do NOT change the schema files directly.
If you need to make changes to the database schema, you will need to manually apply
those changes to the database, and then update the migration files by running
`npx drizzle-kit generate`.

Migrations are applied on frontend startup. This is done in the `instrumentation.ts` file,
which is a [recommended](https://github.com/vercel/next.js/discussions/15341#discussioncomment-7091594)
place to run one-time startup scripts in Next.js. This means that if you 
need to re-apply migrations, restarting the frontend service will trigger them automatically.

## Troubleshooting

### Frontend not connecting to services

- Ensure all services are running: `docker compose -f docker-compose-local-dev.yml ps`
- Check service logs: `docker compose -f docker-compose-local-dev.yml logs frontend`
- Verify environment variables are set correctly in your `.env` file
- Check that services are using Docker service names (e.g., `http://app-server:8000`) not `localhost`

### Port conflicts

- Change port mappings in docker-compose files using environment variables:
  - `FRONTEND_HOST_PORT` (default: 3000)
  - `APP_SERVER_HOST_PORT` (default: 8000)
  - `HIPOCAP_SERVER_HOST_PORT` (default: 8006)

### Database connection issues

- Ensure postgres is healthy: `docker compose -f docker-compose-local-dev.yml ps postgres`
- Check postgres logs: `docker compose -f docker-compose-local-dev.yml logs postgres`
- Verify `DATABASE_URL` uses the Docker service name `postgres:5432`, not `localhost`

## Getting Help

- Check existing issues on GitHub
- Review the `DEPLOYMENT.md` guide for production setup
- Open a new issue if you encounter problems
