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
  server.js              # starts the HTTP server
  app.js                 # express app, middleware, routes
  config/env.js          # environment variables
  lib/supabase.js        # supabaseAdmin (service role) + supabaseForUser (RLS)
  middleware/auth.js     # requireAuth: verifies Supabase access token
  middleware/errorHandler.js
  routes/                # one file per feature, mounted in routes/index.js
```

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
