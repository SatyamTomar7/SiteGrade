# SiteGrade

SiteGrade is a full-stack website analysis platform that checks a website, scores it, explains what is good or weak, and turns technical findings into simple next steps.

In one line:

- User enters a URL
- SiteGrade scans the site
- The backend stores a report
- The frontend shows a clean summary, fixes, details, trends, and collaboration tools

## What This System Does

SiteGrade helps users understand website quality in a practical way.

It analyzes:

- Performance
- SEO
- Accessibility
- Security
- Best practices
- Real browser behavior
- Multi-page crawl coverage
- Competitor benchmarking
- AI-generated explanation and fixes

It also supports:

- Saved reports
- Report comparison
- Public sharing
- Scheduled scans
- Deploy-triggered scans
- Workspaces
- Comments and tasks
- Branded export

## Why This Project Exists

Most audit tools give raw numbers first and meaning second.

SiteGrade is built to solve that problem by doing three things well:

1. Measure the site using real tools like Puppeteer and Lighthouse.
2. Convert those raw findings into simple human explanations.
3. Keep the final UI readable so users see the most important signals first.

That is why this system is split into a lightweight frontend, an API, and a background analysis worker.

## High-Level Architecture

The system has 4 main runtime parts:

1. `client/`
   React + Vite frontend
2. `server/`
   Express API
3. `PostgreSQL`
   Stores users, reports, schedules, hooks, notifications, and workspaces
4. `Redis + BullMQ`
   Handles background analysis jobs and caching

Simple architecture flow:

```text
Browser UI
   ->
Frontend API call
   ->
Express backend
   ->
PostgreSQL report record + Redis queue job
   ->
Analysis worker
   ->
Puppeteer + Lighthouse + CrUX + AI review
   ->
PostgreSQL updated report
   ->
Frontend reads and displays results
```

## Project Structure

### Root

- `client/` frontend application
- `server/` backend application
- `docker-compose.yml` local container setup
- `render.yaml` Render deployment definition
- `vercel.json` frontend deployment/rewrite config

### Frontend

- `client/src/pages/`
  Main screens like analysis, dashboard, report details, compare, auth pages
- `client/src/components/`
  Shared UI like navbar, footer, report content, charts, cards, loaders
- `client/src/api/`
  Axios clients and API wrappers
- `client/src/hooks/`
  Auth and analysis logic
- `client/src/store/`
  Zustand auth state
- `client/src/routes/`
  App route map

### Backend

- `server/src/app.js`
  Express entry point
- `server/src/modules/`
  Feature modules like auth, analysis, schedules, hooks, workspaces
- `server/src/services/`
  Low-level services like Puppeteer, Lighthouse, AI review, email, CrUX
- `server/src/models/`
  Postgres-backed models
- `server/src/queues/`
  Analysis queue, worker, and schedule worker
- `server/src/config/`
  Database, Redis, and logger setup
- `server/src/utils/`
  Helpers for browser boot, safety checks, responses, and diagnostics

## How The System Works

## 1. User Starts an Analysis

Frontend page:

- `client/src/pages/Analysis.jsx`

The user enters:

- a URL
- scan mode
- optional crawl size
- optional device profiles
- optional competitor URLs
- optional website type
- optional fix mode

The frontend sends this to:

- `client/src/api/analysis.api.js`

The request hits:

- `POST /api/analysis`

Defined in:

- `server/src/modules/analysis/analysis.routes.js`
- `server/src/modules/analysis/analysis.controller.js`

## 2. Backend Validates and Queues the Job

The backend does not run the scan directly inside the request.

Instead it:

1. normalizes the URL and config
2. creates a pending report record in PostgreSQL
3. adds a job to Redis/BullMQ
4. returns `jobId` and `reportId`

Why:

- browser-based analysis is slow
- Lighthouse and Puppeteer use a lot of memory
- background jobs are safer and more scalable

Relevant files:

- `server/src/modules/analysis/analysis.controller.js`
- `server/src/modules/analysis/analysis.service.js`
- `server/src/queues/analysisQueue.js`

## 3. Worker Runs the Real Scan

The worker is the heart of the system.

Main file:

- `server/src/queues/analysisWorker.js`

The worker processes one queued job and runs multiple analysis phases.

### Phase A: Puppeteer browser analysis

File:

- `server/src/services/puppeteer.service.js`

What it does:

- opens the page in a real browser
- measures load timing
- captures screenshot
- checks meta tags
- checks canonical and robots data
- checks heading structure
- counts images, links, forms, tables, media
- detects missing alt text and basic accessibility samples
- detects security headers
- checks broken links and redirect chains
- detects tech stack
- optionally crawls extra internal pages

Why it exists:

- Lighthouse alone is not enough
- many useful site quality signals come from direct DOM and browser inspection

### Phase B: Lighthouse analysis

File:

- `server/src/services/lighthouse.service.js`

What it does:

- runs Lighthouse for mobile and/or desktop
- produces scores for:
  - performance
  - accessibility
  - best practices
  - SEO
- extracts:
  - Core Web Vitals style metrics
  - diagnostics
  - opportunities
  - accessibility issue details
  - SEO details

Why it exists:

- Lighthouse is the standard source for structured technical auditing

### Phase C: CrUX field data

File:

- `server/src/services/crux.service.js`

What it does:

- queries Chrome UX Report if `CRUX_API_KEY` is configured
- gets real-world field metrics like:
  - LCP
  - INP
  - CLS
  - FCP

Why it exists:

- lab data is useful
- real user data is even better when available

### Phase D: AI review

File:

- `server/src/services/aiReview.service.js`

What it does:

- sends the technical findings to Gemini
- asks for structured output
- returns:
  - recruiter-style review
  - strengths
  - weaknesses
  - overall grade
  - portfolio readiness summary
  - recruiter verdict
  - action plan
  - AI fixes
  - reusable interview/project summary

Why it exists:

- raw technical output is hard for many users to act on
- AI turns data into understandable guidance

Fallback behavior:

- if Gemini is unavailable, the system generates a simpler rule-based review instead

## 4. Report Is Saved

After all phases finish, the worker builds one final report object and stores it in PostgreSQL.

Main save logic:

- `server/src/modules/analysis/analysis.service.js`

Main report model:

- `server/src/models/WebsiteReport.js`

The saved report includes:

- target URL
- status
- overall score
- detailed category scores
- full AI review text
- structured AI review data
- Lighthouse data
- Puppeteer data
- crawl data
- competitor benchmark data
- CrUX field data
- site profile
- fix mode data
- collaboration comments/tasks
- workspace context
- public share token data

## How Reports Are Displayed

The main report UI is:

- `client/src/components/ReportContent.jsx`

It is intentionally organized into 3 sections:

1. `Overview`
2. `Fixes`
3. `Details`

### Overview

Shows the things most users care about first:

- overall score
- score cards
- at-a-glance summary
- top next steps
- AI review
- optional extra insight under `View more`

Why:

- the first screen should answer: "How good is this site and what should I do first?"

### Fixes

Shows action-oriented data:

- prioritized action plan
- fix mode checklist
- AI fix generator
- reusable summary content

Why:

- once users understand the problem, they need next actions quickly

### Details

Shows secondary and advanced information:

- audit configuration
- crawl intelligence
- competitor benchmark
- field data
- audit profiles
- raw advanced data

Why:

- power users still need full depth
- that depth should not overwhelm the default view

## Main Frontend Screens

### Landing

Public marketing page.

Purpose:

- explain the product
- guide users into auth or analysis flow

### Login / Register / Verify / Forgot Password

Files:

- `client/src/pages/Login.jsx`
- `client/src/pages/Register.jsx`
- `client/src/pages/VerifyEmail.jsx`
- `client/src/pages/ForgotPassword.jsx`

Purpose:

- account creation
- email verification
- login
- password reset

### Analysis

File:

- `client/src/pages/Analysis.jsx`

Purpose:

- collect URL and scan settings
- start a scan
- keep advanced options hidden until needed

### Report

File:

- `client/src/pages/Report.jsx`

Purpose:

- temporary loading route for live analysis progress

### Report Details

File:

- `client/src/pages/ReportDetails.jsx`

Purpose:

- show final saved report
- allow re-run
- export
- share
- assign to workspace
- add comments
- add tasks
- generate GitHub issues

### Dashboard

File:

- `client/src/pages/Dashboard.jsx`

Purpose:

- manage saved reports
- compare reports
- see insights and trends
- use automation features

Dashboard tabs:

- `Reports`
- `Insights`
- `Automation`

### Compare Reports

File:

- `client/src/pages/CompareReports.jsx`

Purpose:

- compare two completed reports
- show score changes
- highlight regressions and improvements

### Shared Report

File:

- `client/src/pages/SharedReport.jsx`

Purpose:

- display a public read-only shared report using a share token

## Authentication System

Main files:

- `server/src/modules/auth/auth.routes.js`
- `server/src/modules/auth/auth.service.js`
- `server/src/modules/auth/auth.middleware.js`
- `client/src/api/auth.api.js`
- `client/src/store/authStore.js`
- `client/src/hooks/useAuth.js`

How it works:

1. User registers
2. Backend stores user in PostgreSQL
3. Verification OTP is emailed
4. User verifies email
5. Login returns access token + refresh token behavior
6. Frontend stores session state in Zustand
7. Axios refreshes tokens automatically when needed

Why this design:

- protects private reports and automation features
- supports smoother long-lived sessions
- avoids forcing the user to sign in repeatedly

## Database Design

Database bootstrap:

- `server/src/config/db.js`

Custom model layer:

- `server/src/models/_sqlModel.js`

This system uses PostgreSQL, but the code gives it a developer experience similar to a document model.

That model layer supports methods like:

- `find`
- `findOne`
- `findById`
- `create`
- `save`
- `deleteOne`
- `countDocuments`
- `updateMany`

### Main tables

`users`
- account identity
- password hash
- email verification state
- password reset state

`website_reports`
- central audit report storage

`scan_schedules`
- recurring automated scans

`notifications`
- in-app alerts

`deploy_hooks`
- deploy-triggered scan configuration

`workspaces`
- team/client/project grouping and membership

## Redis, Queue, and Caching

Redis config:

- `server/src/config/redis.js`

Queue config:

- `server/src/queues/analysisQueue.js`

Redis is used for two jobs:

1. background queue execution
2. short-lived caching for things like report lists and dashboard insights

Why Redis matters:

- queue jobs need a broker
- repeated dashboard/report list queries become cheaper
- long-running analysis should not block API requests

If Redis is unavailable:

- the API may still boot
- queue and cache features may partially fail
- analysis creation may return queue-related failure

## Scheduling System

Files:

- `server/src/modules/schedules/schedules.service.js`
- `server/src/queues/scheduleWorker.js`

What it does:

- lets users create daily or weekly recurring scans
- checks due schedules on a timer
- queues new analysis jobs automatically
- updates last run / next run / status
- sends alerts

Alert channels supported:

- in-app
- email
- Slack webhook

Why it exists:

- many teams want recurring monitoring, not one-time scanning only

## Deploy Hooks

Files:

- `server/src/modules/hooks/hooks.service.js`

What it does:

- creates webhook URLs
- external systems can call those URLs after deployment
- SiteGrade creates a new report and queues a scan

Why it exists:

- users often want a new audit after each production deploy

## Workspaces and Collaboration

Files:

- `server/src/modules/workspaces/workspaces.service.js`

What it does:

- group reports under a workspace
- invite members
- assign roles
- attach reports to team/client/project contexts

Collaboration on reports also includes:

- comments
- tasks
- task status updates

Why it exists:

- audits are often reviewed by more than one person
- teams need shared ownership, not just single-user storage

## Sharing and Export

### Public sharing

Analysis routes support:

- create share link
- disable share link
- fetch shared report by token

Why:

- useful for clients, hiring reviews, and stakeholders

### Export

Frontend utilities:

- `client/src/utils/reportExport.js`

Supports:

- downloadable HTML export
- print / save PDF
- branded export options

Why:

- reports often need to leave the app and be shared externally

## Frontend State and Data Flow

### API layer

- `client/src/api/axios.js`
- `client/src/api/analysis.api.js`
- `client/src/api/auth.api.js`

Purpose:

- centralize API requests
- attach auth token
- refresh token on 401 when appropriate

### Auth state

- `client/src/store/authStore.js`

Purpose:

- store current user
- store auth token
- track hydration and auth check state

### Analysis hook

- `client/src/hooks/useAnalysis.js`

Purpose:

- create new analysis
- poll job status
- stream live job updates using server-sent events
- expose progress and final report state

Why it matters:

- this is what makes the UI feel live during analysis instead of static

## Routes and APIs

### Auth routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-otp`
- `POST /api/auth/reset-password`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Analysis routes

- `POST /api/analysis`
- `GET /api/analysis/:jobId`
- `GET /api/analysis/stream/:jobId`
- `GET /api/analysis/reports`
- `GET /api/analysis/reports/:reportId`
- `GET /api/analysis/reports/:reportId/regression`
- `GET /api/analysis/reports/compare`
- `POST /api/analysis/reports/:reportId/rerun`
- `DELETE /api/analysis/reports/:reportId`
- `POST /api/analysis/reports/:reportId/share`
- `DELETE /api/analysis/reports/:reportId/share`
- `GET /api/analysis/shared/:shareToken`

### Collaboration routes

- `POST /api/analysis/reports/:reportId/comments`
- `POST /api/analysis/reports/:reportId/tasks`
- `PATCH /api/analysis/reports/:reportId/tasks/:taskId`
- `POST /api/analysis/reports/:reportId/github-issues`

### Schedule routes

- `GET /api/schedules`
- `POST /api/schedules`
- `PUT /api/schedules/:scheduleId`
- `DELETE /api/schedules/:scheduleId`
- `GET /api/schedules/notifications/list`
- `PATCH /api/schedules/notifications/:notificationId/read`

### Hook routes

- `GET /api/hooks`
- `POST /api/hooks`
- `PUT /api/hooks/:hookId`
- `DELETE /api/hooks/:hookId`
- `POST /api/hooks/deploy/:token`

### Workspace routes

- `GET /api/workspaces`
- `POST /api/workspaces`
- `PUT /api/workspaces/:workspaceId`
- `DELETE /api/workspaces/:workspaceId`
- `POST /api/workspaces/:workspaceId/members`
- `PATCH /api/workspaces/:workspaceId/members/:memberId`
- `DELETE /api/workspaces/:workspaceId/members/:memberId`
- `POST /api/workspaces/invites/:token/accept`
- `PATCH /api/workspaces/reports/:reportId/assign`

## Local Development

## Frontend

```bash
cd client
npm install
npm run dev
```

## Backend

```bash
cd server
npm install
npm run dev
```

## Worker

For local testing of queued analysis:

```bash
cd server
npm run worker
```

## Required Environment Files

Copy:

- `client/.env.example` -> `client/.env`
- `server/.env.example` -> `server/.env`

### Important frontend env

- `VITE_API_URL`

### Important backend env

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_URL`
- `PUBLIC_APP_URL`
- `GEMINI_API_KEY`

Optional but useful:

- `CRUX_API_KEY`
- Gmail OAuth email settings
- Slack webhook

## Deployment Notes

## Docker

Included files:

- `client/Dockerfile`
- `server/Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

## Render

Included file:

- `render.yaml`

Recommended production setup:

- `sitegrade-backend` as the API web service
- `sitegrade-analysis-worker` as the dedicated background worker
- `sitegrade-frontend` as the static frontend

Recommended flags:

- `RUN_ANALYSIS_WORKER_IN_API=false`
- `RUN_SCHEDULE_WORKER_IN_API=true`

If you do not run a dedicated worker:

- set `RUN_ANALYSIS_WORKER_IN_API=true`

Otherwise analysis jobs may be created but never processed.

## Why the production worker split matters

Puppeteer and Lighthouse are heavy.

Separating them from the API:

- keeps the API responsive
- reduces request timeouts
- avoids freezing the UI during heavy runs
- makes failures easier to isolate

Useful memory-related options:

- `ANALYSIS_CLOSE_PUPPETEER_BEFORE_LIGHTHOUSE=true`
- `ANALYSIS_MEMORY_LOGGING=true`

## Current Design Philosophy

The system tries to balance power and simplicity.

That means:

- deep raw data is still available
- but the main UI leads with important signals first
- advanced options are available
- but hidden until needed
- automation exists
- but is separated from the default day-to-day report view

This is intentional.

The goal is not just "collect more data."

The goal is:

- make the data understandable
- make actions obvious
- keep the interface clean

## Quick Mental Model

If you want the simplest way to understand the whole system, think of it like this:

`Analysis Form`
-> creates `Report Job`
-> worker runs `Browser + Lighthouse + Field Data + AI`
-> backend saves `Structured Report`
-> frontend shows `Overview + Fixes + Details`
-> dashboard adds `History + Trends + Automation`

## Summary

SiteGrade is not only a scanner.

It is a complete reporting workflow system for website quality:

- analyze
- explain
- prioritize
- compare
- share
- automate
- collaborate

That full flow is what makes the system useful.
