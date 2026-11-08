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

### Free static version on GitHub Pages

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) publishes the public website to GitHub Pages on every push to `master`. It runs `npm run build:static`, which builds the site with no server:

- Rooms, prices, photos and contact details come from [server/seed-data.js](server/seed-data.js). Edit that file to change them, because the admin panel is not included.
- Every room shows as available for any dates.
- Booking requests are not saved. The guest fills in the form, then sends the request to the hotel on WhatsApp.

One-time setup: in GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**. The site is then at `https://<user>.github.io/<repo>/`.

### Full version on a hotel PC (admin panel included)

The PC runs the website, admin panel and database. A free Cloudflare Tunnel gives it an HTTPS address, so staff and guests can reach it from anywhere, without opening router ports. When the PC is off, the site is down. Keep the GitHub Pages site as the backup.

1. **Domain on Cloudflare.** Create a free Cloudflare account and add the hotel's domain to it. Your registrar must point the domain's nameservers at Cloudflare.
2. **Tunnel.** In Cloudflare, open **Zero Trust > Networks > Tunnels > Create a tunnel**, choose **Cloudflared**, and copy the token. Add a public hostname, for example `book.yourdomain.co.ke`, with service `http://localhost:3001`.
3. **Install on the PC.** Install Git, clone this repo, then run PowerShell **as Administrator**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File hotel-pc\install.ps1 -TunnelToken <token>
   ```
   The script installs Node.js if needed and asks for an admin password. It builds the app and sets the server to start at boot, restarting it if it stops. It also schedules a daily backup at 02:00 into `backups/` (the last 30 days are kept) and installs the tunnel as a Windows service.
4. **Power.** Set Windows to never sleep. A UPS is worth having.
5. **Admin link on Pages (optional).** In GitHub, open **Settings > Secrets and variables > Actions > Variables** and add `ADMIN_URL` = `https://book.yourdomain.co.ke/admin/`. After the next deploy, `/admin/` on the Pages site opens the PC's admin panel.

Staff log in at `https://book.yourdomain.co.ke/admin/`. Use the HTTPS address, even on the PC itself, or `http://localhost:3001/admin/` on that PC. Logging in over a plain-HTTP LAN address such as `http://192.168.x.x` won't work, because the login cookie is sent over HTTPS only.

To update the PC after pushing changes, run `hotel-pc\update.ps1` as Administrator. It backs up, pulls, rebuilds and restarts. Copy `backups/` to a USB drive or Google Drive now and then. If the PC's disk fails, those copies are the only ones.

> **Important: full version hosting.** The admin panel, saved bookings and live availability need the Node server, so they don't work on GitHub Pages. On Render or Railway, attach a **persistent disk or volume** and point `DATA_DIR` at it. Without one, every redeploy wipes the bookings and uploaded photos. A small VPS works too. Serve it over HTTPS.

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
