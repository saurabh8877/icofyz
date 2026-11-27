# iCoFyz — GoDaddy Node.js Hosting edition

This edition is adapted for GoDaddy Node.js Hosting's managed MySQL database. It uses `mysql2`, not PostgreSQL. It includes the React/Vite storefront, Express API, MySQL-backed admin accounts/content/settings, a MySQL-backed Express session store, secure admin authentication, and image upload conversion to WebP.

## Important GoDaddy setup

GoDaddy's Hosted Database page says it automatically injects these secrets when the database is attached to the app:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Do not manually overwrite those values. The application reads them from `process.env`.

### 1. Add the session secret

In the GoDaddy app dashboard, open **Settings → Secrets**. Configure `SESSION_SECRET` separately for **Preview** and **Publish** (use a different random value for each if desired). Generate a value on your Mac with:

```bash
openssl rand -hex 32
```

Paste the output as the secret value. Keep it private. Do not add `NODE_ENV` manually if GoDaddy marks it as reserved.

If GoDaddy's app UI has Preview and Publish tabs, save the secret in the environment you are currently deploying. Preview and Publish share the hosted database according to GoDaddy's Hosted Database guide, but their app secrets are managed separately.

### 2. Build and start commands

Use the repository root as the app root. `package.json` must be directly in that root (not one folder below).

- Install: `npm install`
- Build: `npm run build`
- Start: `npm start`

The `start` script runs `node server/server.js`. GoDaddy should supply `PORT`; the server binds to `0.0.0.0` and uses that port.

### 3. Database initialization

The server creates the required MySQL tables on startup:

- `admins`
- `content_items`
- `site_settings`
- `user_sessions`

The default homepage settings row is inserted only if it does not already exist. No manual SQL import is required for a fresh database. The database must be attached to the GoDaddy app so the five `DB_*` variables are injected.

### 4. Create the first admin account

In GoDaddy Secrets, add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the **Preview** environment. Use a unique password of at least 14 characters. The server creates this admin only if the email does not already exist; it does not overwrite an existing password on every restart.

For a password reset, update the secrets and run `npm run create-admin` from the app's terminal/console if GoDaddy exposes one. That command updates the password hash for the specified email. If GoDaddy does not provide a terminal/console, ask GoDaddy support how to run a one-off npm script; do not expose credentials in source code.

Configure the same admin secrets in **Publish** when ready to launch. Preview and Publish share the same database, so they share admin accounts and CMS content.

### 5. Image uploads — verify persistence before production

Uploaded images are converted to WebP and written to `server/uploads` by default, then served from `/uploads/...`. This path is inside the app directory. Before relying on CMS image uploads, confirm in GoDaddy's documentation or with support that app filesystem writes persist across app restarts and redeploys. If GoDaddy provides a persistent writable storage path, set `UPLOAD_DIR` to that exact path in both Preview and Publish secrets. Do not guess a path. If the filesystem is ephemeral, use external object storage before launch.

### 6. Verify Preview

After saving secrets and redeploying/restarting Preview, check:

- `/api/health` returns `{"ok":true,"database":"connected"}`.
- Homepage loads.
- `/admin` loads and admin login works.
- Save a homepage setting, refresh, and confirm it persists.
- Upload a small test image, open its returned `/uploads/...` URL, then restart/redeploy Preview and check that the image still loads. Remove test uploads after verification.

### 7. Security

- Keep the GitHub repository private.
- Never commit `.env` or share database/password/session secret values.
- Keep `SESSION_SECRET` stable for each environment; changing it signs out existing sessions.
- Use a unique admin password and enable MFA on GoDaddy and GitHub.
- Do not publish until database, admin login, image persistence, and domain settings have been tested.

## Local development

Requires Node.js 20+ and a local MySQL 8-compatible database.

```bash
cp .env.example .env
# Edit DB_* and SESSION_SECRET in .env
npm install
npm run db:setup
npm run create-admin
npm run dev:all
```

- Storefront: http://localhost:5173
- Admin: http://localhost:5173/admin
- API health: http://localhost:4000/api/health

In local development, Vite proxies `/api` and `/uploads` to Express on port 4000. In production, Express serves the built `dist` folder and API from the same origin.


## Storefront photography update

The homepage category tiles and Trending on iCoFyz product cards now use locally bundled WebP lifestyle/product photography in `public/images/storefront/`. The storefront renderer in `src/main.jsx` ensures these visual sections are populated even if the legacy catalogue renderer does not populate them. Images are served from the same GoDaddy app origin; no external image service or API key is required.

## Customer accounts (retailers and brands)

The storefront provides customer registration and login separately from the CMS administrator login. Customer records are stored in the GoDaddy MySQL database in the `customers` table; passwords are hashed with bcrypt. Registration requires a name, business name, account type, email, and a password of at least 12 characters. Customer sessions use the application's existing secure session store and are distinct from administrator authorization.

Set `SESSION_SECRET` in GoDaddy Secrets (32+ characters). GoDaddy automatically supplies `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The schema is applied by the server at startup. Email verification, password reset, and transactional email are not included yet and require an email provider integration.
