# iCoFyz Visual CMS — Render production deployment

This repository contains the iCoFyz React/Vite storefront, Express API, PostgreSQL-backed visual CMS, admin authentication, and image uploads.

## Production architecture

- One Render Node web service serves the built React app, `/admin`, `/api/*`, and `/uploads/*` from the same origin.
- Render Postgres stores admin accounts, sessions, products, categories, brands, banners, and site settings.
- A Render persistent disk mounted at `/var/data` stores uploaded WEBP images under `/var/data/uploads`.
- Render's internal database URL is used for service-to-database traffic in the same region.

## Deploy with Render Blueprint (recommended)

The included `render.yaml` declares:

- Web service: `icofyz`, Node runtime, Singapore region, Starter web plan.
- Managed PostgreSQL: `icofyz-db`, database `icofyz`, PostgreSQL 18, Singapore region.
- Persistent disk: 1 GB mounted at `/var/data`.
- Environment variables for the upload path, generated session secret, internal database URL, and initial admin credentials.

**Review Render's current pricing and resource sizes before approving the Blueprint.** A persistent disk requires a paid web service. Render disks are attached to one service instance; this deployment is intentionally single-instance while using local persistent uploads.

### 1. Put the project on GitHub

1. Extract this ZIP.
2. Create a **private** GitHub repository, for example `icofyz-website`.
3. From the extracted `icofyz` project directory, run:

   ```bash
   git init
   git add .
   git status
   ```

4. Confirm `.env` is not listed. Never commit `.env`, database passwords, admin passwords, or session secrets.
5. Commit and push:

   ```bash
   git commit -m "Prepare iCoFyz for Render production"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/icofyz-website.git
   git push -u origin main
   ```

### 2. Deploy the Blueprint

1. Sign in at <https://dashboard.render.com/> and connect GitHub if prompted.
2. Choose **New → Blueprint**.
3. Select the private `icofyz-website` repository and branch `main`.
4. Render reads `render.yaml`. Review the proposed web service, database, region, plan, and disk size.
5. When prompted for `ADMIN_EMAIL`, enter the administrator email you want to use.
6. When prompted for `ADMIN_PASSWORD`, enter a unique password of at least 14 characters. Do not reuse a personal or email password.
7. Approve **Deploy Blueprint**.
8. Wait for the database and web service to become ready. The app applies `server/schema.sql` at startup and creates the initial admin only if that email does not already exist.

The web service uses the Render-internal database connection string via `fromDatabase`, which is appropriate because both resources are declared in the same region. Do not replace it with the external database URL for app-to-database traffic.

### 3. Verify the Render deployment

Open the service URL shown by Render, for example `https://YOUR-SERVICE.onrender.com`.

Check:

- `https://YOUR-SERVICE.onrender.com/api/health` returns `{"ok":true}`.
- The storefront homepage loads.
- `/admin` loads after a direct browser refresh.
- Admin login works with the credentials supplied during Blueprint creation.
- Upload a small JPEG/PNG/WEBP from the CMS, save settings, and verify the image remains available after a redeploy.
- Edit a homepage setting, save, refresh the storefront, and confirm it persists.

### 4. Connect `icofyz.com` and `www.icofyz.com`

1. In Render, open the `icofyz` web service → **Settings → Custom Domains**.
2. Add `icofyz.com` and `www.icofyz.com`.
3. Render will show the DNS records required for your service. Sign in to the registrar/DNS provider where `icofyz.com` is managed and enter those exact records. Do not guess IP addresses or reuse old hosting records.
4. Remove conflicting A/AAAA/CNAME records only when you have confirmed they point to the previous host and are not used by other services.
5. Wait for DNS verification and Render's TLS certificate provisioning.
6. Choose one canonical hostname in Render (typically `icofyz.com`) and configure the other to redirect if Render offers that option. Verify both `https://icofyz.com` and `https://www.icofyz.com`.
7. Keep DNS at the registrar; do not change nameservers unless you intentionally want to move all DNS management.

### 5. Admin password management

- Initial administrator is created once at application startup if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured and the email does not exist.
- The startup bootstrap does **not** overwrite an existing admin password.
- To reset the password later, update `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the Render service environment, open the service Shell, run `npm run create-admin`, then remove or rotate the temporary password environment variable after confirming the reset. The script updates the matching account's bcrypt hash.
- Never put credentials in source code, GitHub, screenshots, or support chats.

### 6. Image storage and backups

Uploads are written to `UPLOAD_DIR` (Render Blueprint: `/var/data/uploads`) and served from `/uploads/<filename>`. The disk preserves files across service restarts and deploys.

Important Render disk constraints:

- Only files under `/var/data` persist.
- A persistent disk is attached to one service instance and prevents horizontal scaling beyond one instance for this service.
- Disk-backed deploys may involve a short restart/downtime.
- Back up uploaded assets separately on a schedule. PostgreSQL backups do not include image files on the web-service disk.
- If you later need multiple web instances, move images to S3-compatible object storage before scaling.

### 7. Local development

Requirements: Node.js 20+ and PostgreSQL.

```bash
cp .env.example .env
# Edit .env with local PostgreSQL credentials and a random SESSION_SECRET
npm install
npm run db:setup
npm run create-admin
npm run dev:all
```

- Storefront: <http://localhost:5173>
- Admin: <http://localhost:5173/admin>
- API health: <http://localhost:4000/api/health>

For local development, Vite proxies `/api` and `/uploads` to Express on port 4000. In production, Express serves `dist` and handles the API on the same origin; no Vite dev proxy is used.

## Security and operational checklist

- Use a private GitHub repository and never commit `.env`.
- Use the Render-generated `SESSION_SECRET`; keep it private and stable across deploys.
- Use a unique admin password (14+ characters minimum) and rotate it if exposed.
- Keep the PostgreSQL database and web service in the same Render region; use the internal database URL.
- Enable MFA on GitHub, Render, and the domain registrar.
- Keep dependencies updated and review `npm audit` output before releases.
- Monitor Render logs and database health; configure backups for both PostgreSQL and uploaded images.
- The legacy storefront script is executed as an inline script for compatibility. The CSP retains `unsafe-inline` for scripts/styles until the legacy page is refactored into bundled React components. Do not add `unsafe-eval`.
- This is a production deployment baseline, not a guarantee that a site is unhackable. Add MFA/SSO for admins, audit logs, alerting, tested restores, and a security review before handling sensitive customer or payment data.

## Troubleshooting

- **Build fails with missing Vite:** confirm build command is `npm install --include=dev && npm run build && npm prune --omit=dev`.
- **Service fails health check:** inspect Render logs for database connection/schema errors; confirm `DATABASE_URL` is populated from `icofyz-db`.
- **Admin login fails:** verify the email used in the Blueprint and reset with `npm run create-admin` from Render Shell after setting the environment values.
- **Images disappear after deploy:** verify the disk is mounted at `/var/data` and `UPLOAD_DIR=/var/data/uploads`.
- **Domain doesn't resolve:** compare registrar DNS records with the exact records displayed in Render Custom Domains; allow time for DNS propagation and certificate issuance.
