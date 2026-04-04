# Civic Samadhan - Technocrats Innovation Challenge 2k26

Civic Samadhan is a role-based civic issue platform where citizens can report local problems, admins can manage issue flow, and workers can receive and complete assignments.

This repository contains:

- A TypeScript + Express backend API with PostgreSQL
- A React Native (Expo) mobile app for citizen, admin, and worker experiences
- Image verification/classification support (Gemini-assisted when configured)
- Reward points and wallet tracking for issue resolution

## Repository Structure

```text
tic2k26-truecoding/
	backend/    # Express API + PostgreSQL bootstrap/migrations
	mobile/     # Expo app (citizen/admin/worker flows)
```

## Key Features

### Citizen

- Register/login and manage profile state in app
- Report issues with image + location
- Auto-verify uploaded issue images before final submission
- Browse nearby issues, filter by status/category, and upvote
- Track issue timeline and verify resolution

### Admin

- Dashboard stats for queue health and resolution rate
- Create worker accounts (worker self-registration is blocked)
- Assign workers and manage issue lifecycle
- Track high-priority and unresolved issues

### Worker

- Login with admin-provisioned account
- Complete verification + onboarding details
- Accept/reject assignments
- Submit in-progress/completed field reports (with optional image)

### Rewards

- Reporter reward points on resolution
- Worker reward and on-time bonus points
- Wallet value derived from `POINT_TO_MONEY_RATE`

## Tech Stack

- Backend: Node.js, TypeScript, Express, PostgreSQL, JWT, bcrypt, pino
- Mobile: Expo 54, React Native, Expo Router, React Query
- AI/Verification: `@google/genai` (optional via `GEMINI_API_KEY`)

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL instance reachable from backend

## Backend Setup

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

The API starts on `http://localhost:3001` by default, and routes are under `/api`.

Health check:

```text
GET /api/healthz
```

### Backend Environment Variables

Create `backend/.env` from `backend/.env.example` and set values:

- `PORT`: API port (default `3001`)
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JWT_SECRET`: JWT signing secret
- `CORS_ORIGIN`: Allowed origins (`*` for local development)
- `UPLOAD_DIR`: Local upload directory
- `ADMIN_NAME`: Seed admin display name
- `ADMIN_EMAIL`: Seed admin email
- `ADMIN_PASSWORD`: Seed admin password
- `GEMINI_API_KEY`: Optional key for Gemini-powered image analysis
- `POINT_TO_MONEY_RATE`: Conversion rate from points to wallet amount

### Backend Notes

- Database schema bootstraps automatically at startup.
- If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, an admin account is seeded once.
- Uploaded images are served from `/api/uploads/...`.

## Mobile Setup

```bash
cd mobile
npm install
```

Set backend URL before starting Expo (PowerShell example):

```powershell
$env:EXPO_BACKEND_URL="http://<your-machine-ip>:3001"
```

Start app:

```bash
npm run start
```

Optional targets:

```bash
npm run android
npm run ios
npm run web
```

Notes:

- `EXPO_BACKEND_URL` is consumed by Expo config.
- API client automatically normalizes base URL to include `/api`.
- For physical devices, use your LAN IP (not `localhost`) for backend URL.

## Useful Scripts

### Backend (`backend/package.json`)

- `npm run dev`: Run with `tsx watch`
- `npm run start`: Run once with `tsx`
- `npm run typecheck`: TypeScript checks

### Mobile (`mobile/package.json`)

- `npm run start`: Start Expo dev server
- `npm run android`: Launch Android target
- `npm run ios`: Launch iOS target
- `npm run web`: Launch web target
- `npm run lint`: Expo lint
- `npm run typecheck`: TypeScript checks

## API Overview (High Level)

Base path: `/api`

- Health: `/healthz`
- Auth:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
  - `POST /auth/worker-login`
  - `POST /auth/worker-verify`
- Issues:
  - `GET /issues`, `GET /issues/map`, `GET /issues/:id`
  - `POST /issues` (create)
  - `POST /issues/verify-image`
  - `PATCH /issues/:id` (admin)
  - `POST /issues/:id/upvote`
  - `POST /issues/:id/verify-resolution`
  - `GET /issues/:id/timeline`
- Admin:
  - `GET /admin/stats`
  - `GET /admin/workers`
  - `POST /admin/workers`
- Workers:
  - `GET /workers/nearby`
  - `POST /workers/me/onboarding`
  - `GET /workers/me/assignments`
  - `POST /workers/issues/:id/assignment-response`
  - `POST /workers/issues/:id/reports`
- Upload + classify:
  - `POST /upload`
  - `POST /classify`

## Local Development Checklist

1. Start PostgreSQL and confirm `DATABASE_URL` works.
2. Run backend (`npm run dev`) and verify `GET /api/healthz`.
3. Set `EXPO_BACKEND_URL` for mobile.
4. Run mobile (`npm run start`) and open app on simulator/device.
5. Log in as seeded admin to create worker accounts.

## Security Notes

- Change `JWT_SECRET` and admin default credentials for any shared or production environment.
- Restrict `CORS_ORIGIN` in non-local deployments.
- Protect and rotate `GEMINI_API_KEY` if enabled.
