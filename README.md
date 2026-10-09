# LabVault

LabVault is a campus laboratory equipment and resource booking portal. The repository is a monorepo with an Express/PostgreSQL API in `backend/` and a Vite/React application in `frontend/`.

## Features

- Student registration and JWT login, plus administrator-only routes.
- Searchable equipment catalog with the four starter resources seeded at backend startup.
- Date/time booking requests with server-side overlap detection. Overlapping active reservations return HTTP 400 with `Time slot already booked!`.
- Student booking history and approved booking slips generated as PDFs.
- Admin booking approvals, equipment availability controls, equipment creation, summary metrics, and usage chart.

## Requirements

- Node.js 18 or later and npm.
- PostgreSQL 14 or later running locally or an accessible PostgreSQL connection string.

## Configure and run

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Create a database role and database in PostgreSQL. First generate an alphanumeric password and save it temporarily so you can use it in both commands:

```bash
openssl rand -hex 24
```

On Ubuntu, run `sudo -u postgres psql` to open the PostgreSQL shell, substituting that generated password below:

```sql
CREATE USER labvault_app WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE labvault OWNER labvault_app;
\q
```

Edit `backend/.env` and replace `replace-with-your-db-password` in `DATABASE_URL` with the same password used for `CREATE USER`. Generate a separate `JWT_SECRET` with `openssl rand -hex 32`; set that value in the environment file too. Set `JWT_EXPIRES_IN=30d` to make new login tokens valid for 30 days (the application default). Then start the API with `npm start`. The API creates its tables and starter equipment on first connection. Changing this setting does not extend tokens already issued; sign in again to receive a token with the new expiry.

Edit `backend/.env` and set `DATABASE_URL` to your PostgreSQL connection string and set a private `JWT_SECRET` of at least 32 characters. The API creates its tables and seeds starter equipment the first time it connects. To create or reset the administrator at startup, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters); `ADMIN_NAME` is optional. These configured admin credentials are applied each time the backend starts. Public registration always creates student accounts so a user cannot self-assign administrator access.

```bash
npm start
```

The API runs at `http://localhost:5000/api`; its health endpoint is `http://localhost:5000/api/health`.

If PostgreSQL reports that the password authentication failed, ensure the password in `DATABASE_URL` matches the role created above. The backend must be able to connect to the selected PostgreSQL database before it starts.

## Deploy to Render

The repository includes [`render.yaml`](./render.yaml), a Render Blueprint for the Node API, static React app, and PostgreSQL database. The Blueprint uses Render's free web and database plans for a course-project demo. Free PostgreSQL databases have limited lifetime/storage/backup guarantees and may expire; check the current plan details in Render before relying on this deployment for durable data.

1. Push this project to a GitHub repository. If you have not created one yet, create an empty repository on GitHub, then from this project folder run:

   ```bash
   git init
   git add .
   git status --short
   ```

   Confirm no `.env` files appear in the staged file list, then commit and push:

   ```bash
   git commit -m "Prepare LabVault for Render deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

   Replace the remote URL with your repository's HTTPS URL. Do not commit `.env` files; `.gitignore` excludes them. Before deployment, rotate any database password, JWT secret, or admin password that has been exposed, and only enter replacement secrets in Render's private environment-variable form.
2. In Render, choose **New → Blueprint**, connect the GitHub repository, and select the branch containing `render.yaml`.
3. Review the resources and set the prompted `ADMIN_EMAIL` and `ADMIN_PASSWORD` secrets to your private administrator credentials. Apply the Blueprint. Render generates `JWT_SECRET` and provides the PostgreSQL connection string to the API.
4. Wait until the API and static-site deployments finish. The API health check is `/api/health`. Open the `labvault-web` URL from the Render dashboard and sign in with the configured administrator email and password.
5. If Render assigns a different frontend hostname because the suggested name is unavailable, update `CLIENT_ORIGIN` on the `labvault-api` service to the exact frontend origin (scheme and host only, no trailing slash), then redeploy the API. If the API hostname differs from `labvault-api.onrender.com`, update `VITE_API_URL` on the `labvault-web` static site to `https://<actual-api-host>/api` and trigger a new frontend deployment because Vite embeds this value at build time.

The free API service may spin down while idle, so its first request after inactivity can take longer. Use a database plan with durable storage for ongoing use, and configure backups before storing important data.

### 2. Frontend

In another terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm start
```

Open `http://localhost:5173`. The provided `VITE_API_URL` points to the local backend. If the API runs elsewhere, update that value and set the backend `CLIENT_ORIGIN` to the frontend's origin. Vite reads environment changes on startup.

### Development and production build

Run `npm run dev` in `frontend/` for Vite development mode. Run `npm run build` there to generate the static production bundle in `frontend/dist/`. Run `npm run check` in `backend/` for backend JavaScript syntax checks.

## API overview

All API routes are prefixed with `/api`.

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/auth/register` | Public (creates student) |
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Authenticated |
| GET | `/equipment` | Public |
| POST | `/equipment` | Admin |
| PATCH | `/equipment/:id` | Admin |
| PATCH | `/equipment/:id/availability` | Admin |
| POST | `/bookings` | Authenticated student |
| GET | `/bookings` | Authenticated (students see their own; admins see all) |
| PATCH | `/bookings/:id/status` | Admin |

Booking creation expects an equipment ID, a `date` in `YYYY-MM-DD` format, `startTime` and `endTime` in `HH:mm` format. A booking remains pending until approved or rejected by an administrator.
