# Kilimanjaro Hotels Sotik

This repo holds the booking website and admin panel for Kilimanjaro Hotels, Sotik (Bomet County, Kenya).

- **Website** (`/`): guests check availability, see prices and send booking requests. Each request is saved to the database, and the guest can also send it on WhatsApp.
- **Admin panel** (`/admin/`): staff manage bookings, rooms and prices, availability, payments and all website content.

It uses React and Vite for the front end, and an Express API with SQLite (built into Node, no separate database server) for the back end.

## Requirements

You need Node.js 22.13 or newer.

## Run it locally

```bash
npm install
cp .env.example .env      # then set ADMIN_PASSWORD to something long
npm run dev               # website http://localhost:5173, admin http://localhost:5173/admin/
```

On first start, the server creates the database in `data/` and fills it with the current rooms, prices, photos and settings. It also creates the admin account from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. If `ADMIN_PASSWORD` is empty, it generates a password and writes it to `data/initial-admin-password.txt`. Change it in **Settings** after logging in.

## Admin panel

| Section | What you can do |
| --- | --- |
| Dashboard | Pending requests, today's arrivals and departures, tonight's occupancy, this month's booked and collected revenue, outstanding balances |
| Bookings | Search and filter; confirm, decline, check in, check out, mark no-show; record payments; edit dates, room, rate (for discounts) and guest details; staff notes; WhatsApp or call the guest; print; export to CSV |
| New booking | Enter walk-in, phone or WhatsApp bookings yourself |
| Availability | 14-day room calendar; click a free day to book it or block it; block dates for maintenance |
| Rooms & prices | Add, edit, hide or delete rooms; prices, guest limits, features and photo uploads |
| Settings | Phone, WhatsApp, email, check-in times, map link, the coming-soon box, payment methods, facilities, banner, about and gallery photos, admin password |

**How bookings work**

- **Website requests:** guest requests arrive as **Pending**. A pending request does not block the room, so fake requests can't lock rooms.
- **Confirming:** once you confirm a booking, those dates are blocked on the website. Confirming is refused if the room is already taken; clashing requests show a **Clash** badge.
- **Check-out day:** a guest can check in on the day the previous guest checks out.
- **Price changes:** they apply to new bookings only. Existing bookings keep their rate.

## Production

```bash
npm install
npm run build
NODE_ENV=production npm start      # serves the website, admin panel and API on $PORT (default 3001)
```

Set these environment variables on the host (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | First admin account (used only when the database is first created) |
| `DATA_DIR` | Folder for `hotel.db` and uploaded photos. **It must be on a persistent disk.** |
| `PORT` | Port to listen on |
| `NODE_ENV=production` | Sends the login cookie over HTTPS only |
| `TRUST_PROXY=0` | Set this only if the app is **not** behind a reverse proxy (Render, Railway and nginx are proxies). Otherwise clients could spoof their IP and get around the login rate limit. |

### Deploying with GitHub Actions and Render

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds the app and smoke-tests the server on every push and pull request. After a push to `master` passes, it triggers a deploy on Render.

One-time setup:

1. In Render, choose **New > Blueprint** and pick this repo. [render.yaml](render.yaml) creates the web service with a 1 GB persistent disk at `/var/data` (Starter plan). Render asks you for `ADMIN_PASSWORD`.
2. In the Render service, open **Settings > Deploy Hook** and copy the URL.
3. In GitHub, open **Settings > Secrets and variables > Actions** and add it as `RENDER_DEPLOY_HOOK_URL`.

Render's own auto-deploy is turned off, so only commits that pass the build get deployed.

> **Important: hosting.** This app needs a Node server, so GitHub Pages alone won't work. On Render or Railway, attach a **persistent disk or volume** and point `DATA_DIR` at it. Without one, every redeploy wipes the bookings and uploaded photos. A small VPS works too. Serve it over HTTPS.

**Backups:** copy the `DATA_DIR` folder (`hotel.db` plus `uploads/`) regularly. You can also export bookings to CSV from the Bookings page.

## Project structure

```
server/
  index.js            Express app: API, uploads, serves dist/ in production
  db.js               SQLite schema, first-run seed, overlap check
  auth.js             scrypt passwords, cookie sessions, CSRF header check
  routes/public.js    /api/site, /api/availability, /api/bookings
  routes/admin.js     /api/admin/* (login, dashboard, bookings, calendar, blocks, rooms, settings, upload)
  seed-data.js        first-run content; seed-images/ holds the original photos
src/                  public website (React)
  site/SiteContext.jsx  loads content from the API
src/admin/            admin panel (React), built as a separate page
admin/index.html      admin page entry
```

The two original HTML templates are kept in the repo root for reference.
