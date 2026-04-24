# portfolio-api

Express + MongoDB backend for the Khaled Ayman portfolio dashboard.

Companion frontend: https://github.com/khaled-brr/my-portfolio

## Features

- JWT auth via httpOnly cookies (cross-origin safe: `SameSite=None; Secure` in production)
- CORS allow-list configurable via `FRONTEND_ORIGIN`
- Mongoose models for Hero, About, Experience, Skills, Projects, Testimonials, Contact, Messages, Analytics, Activity
- CRUD + reorder endpoints for every collection
- Analytics aggregation, activity log, JSON export/import
- Auto-seeds from static data on first boot

## Run locally

```bash
npm install
cp .env.example .env   # edit MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD, FRONTEND_ORIGIN
npm run dev            # http://localhost:4000
```

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST   | `/api/auth/login` | — |
| POST   | `/api/auth/logout` | — |
| GET    | `/api/auth/me` | cookie |
| GET    | `/api/public/{hero,about,experience,skills,projects,testimonials,contact}` | — |
| POST   | `/api/public/contact` | — |
| POST   | `/api/public/track` | — |
| GET/PUT   | `/api/admin/{hero,about,contact}` | cookie |
| GET/POST  | `/api/admin/{experience,skills,projects,testimonials}` | cookie |
| PUT/DELETE| `/api/admin/{…}/:id` | cookie |
| POST      | `/api/admin/{…}/reorder` `{ ids: [...] }` | cookie |
| GET       | `/api/admin/messages?archived=&unread=` | cookie |
| PATCH/DELETE | `/api/admin/messages/:id` | cookie |
| GET       | `/api/admin/analytics/summary?days=30` | cookie |
| GET       | `/api/admin/activity` | cookie |
| GET       | `/api/admin/backup/export` | cookie |
| POST      | `/api/admin/backup/import` | cookie |

## Deploy to Vercel

Already wired with `vercel.json`. Set these env vars in the Vercel project:

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `FRONTEND_ORIGIN` (the frontend's production URL, e.g. `https://my-portfolio.vercel.app`)
- `NODE_ENV=production`

Then `vercel --prod`.
