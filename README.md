# SiteGrade

SiteGrade is a full-stack website analysis platform that audits performance, SEO, accessibility, security, and AI-driven improvement opportunities.

## Project Structure

- `client/` React + Vite frontend
- `server/` Express + MongoDB + Redis backend

## Local Development

### Frontend

```bash
cd client
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

## Required Environment Files

- `client/.env.example`
- `server/.env.example`

Copy them to `.env` files before running locally or deploying.

## Deployment Notes

- Frontend expects `VITE_API_URL`
- Backend expects MongoDB, Redis, JWT secrets, and client URL configuration
- Redis should use an Upstash-compatible TLS URL:

```env
REDIS_URL=rediss://default:<password>@<database>.upstash.io:6379
```

## Docker

This repo includes:

- `client/Dockerfile`
- `server/Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

## Render

This repo includes `render.yaml` with separate frontend and backend services.

If you deploy only the API web service and do not run a separate worker service, set `RUN_ANALYSIS_WORKER_IN_API=true` so queued analysis jobs actually get processed. Otherwise reports can remain stuck at `0%` in production.
