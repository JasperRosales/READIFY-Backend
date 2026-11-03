# READIFY Backend

Express (JavaScript, ES modules) API for READIFY, backed by Supabase. See `schema.md` for the database.

## Setup

```bash
npm install
cp .env.sample .env   # then fill in your Supabase / Gemini keys
npm run dev            # http://localhost:3000/api/health
```

Requires Node 20.6+ (uses built-in `--env-file`, no dotenv).

## Structure

```
src/
  server.js                 # starts the HTTP server
  app.js                    # express app: middleware, routes, error handling
  config/
    env.js                  # environment variables
    supabase.js             # supabaseAdmin (service role) + supabaseForUser (RLS)
  routes/                   # URL -> controller mapping, one file per feature
    index.js                # mounts all feature routes under /api
  controllers/              # handle req/res, call services
  services/                 # business logic + Supabase queries
  middlewares/
    auth.middleware.js      # requireAuth: verifies Supabase access token
    error.middleware.js     # 404 + JSON error responses
  utils/
    ApiError.js             # throw ApiError.notFound(...) etc. for HTTP errors
```

### Adding a feature (e.g. chapters)

1. `services/chapter.service.js`: Supabase queries
2. `controllers/chapter.controller.js`: reads `req`, calls the service, sends the response
3. `routes/chapter.routes.js`: maps URLs to controllers (add `requireAuth` where needed)
4. Mount it in `routes/index.js`: `router.use('/chapters', chapterRoutes)`

## Auth

Sign up / log in happens on the frontend with Supabase Auth. The frontend sends the
session's access token to this API:

```
Authorization: Bearer <access_token>
```

Protected routes use `requireAuth`, which sets `req.user` and `req.supabase`
(a client scoped to that user, so RLS applies).

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | no | Health check |
| GET | `/api/profile/me` | yes | Current user's profile, XP and level |
