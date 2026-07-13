# Deployment Guide — FarmEvidence Platform

---

## Option A: Render (Recommended)

The repo root has a `render.yaml` Blueprint that defines all three services
(`farmevidence-api`, `farmevidence-charts`, `farmevidence-client`) with the
correct **Root Directory** already set per service. Fastest path: Render
dashboard → **New** → **Blueprint** → point at this repo → Render reads
`render.yaml` and provisions all three; you only need to fill in the
`sync: false` secrets it leaves blank. The manual per-service steps below
are the alternative if you'd rather click through each service yourself
(or already have services and are fixing one).

> **The most common failure mode**: creating a service without setting
> **Root Directory**, so Render builds from the repo root instead of
> `server`/`client`/`python-service`. For the frontend this shows up as
> `sh: 1: react-scripts: not found` — the root `yarn install`/`npm install`
> only installs the root `package.json`'s own (empty) dependency list, never
> `client/node_modules`. `npm run build` at the repo root now also installs
> `client`'s deps first as a fallback, but **Root Directory: client is still
> the correct fix** — don't rely on the fallback for a real deploy.

### Backend → Render Web Service

1. Push code to GitHub (backend in `server/` directory).

2. Create a new **Web Service** on [render.com](https://render.com):
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node 20

3. Set environment variables in Render dashboard:
   ```
   PORT=10000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://<db-user>:<db-password>@<cluster-host>/farmevidence?appName=Cluster0
   CLERK_SECRET_KEY=sk_test_<your-clerk-secret-key>
   CLIENT_ORIGIN=https://<your-frontend-domain>
   PYTHON_SERVICE_URL=https://<your-python-chart-service>.onrender.com
   ```

4. Render auto-deploys on every push to `main`.

### Chart service → Render Web Service

The Python chart-rendering microservice (`python-service/`, FastAPI +
uvicorn) needs its own Web Service — the backend calls it over HTTP for
every rendered chart, so without it, chart images fail to load.

1. Create a new **Web Service** on Render:
   - **Root Directory**: `python-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3

2. No environment variables needed — nothing in `main.py`/`chart_style.py`
   reads `os.environ`.

3. Copy its `onrender.com` URL into the backend's `PYTHON_SERVICE_URL` above.

### Frontend → Render Static Site

1. Create a new **Static Site** on Render:
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

2. Set environment variables:
   ```
   REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_Y29tcG9zZWQta2luZ2Zpc2gtMTEuY2xlcmsuYWNjb3VudHMuZGV2JA
   REACT_APP_API_BASE_URL=https://<your-render-backend>.onrender.com/api
   ```

3. Add a rewrite rule: `/* → /index.html` (for React Router).

4. Once you have this service's URL, go back and set the backend's
   `CLIENT_ORIGIN` to it (CORS requires the exact origin).

---

## Option B: AWS

### Backend → EC2 + Node.js

```bash
# 1. Launch EC2: Ubuntu 22.04, t3.small minimum
# 2. SSH in and setup

sudo apt update && sudo apt install -y nodejs npm nginx

# Clone repo
git clone <repo> /home/ubuntu/farmevidence
cd /home/ubuntu/farmevidence/server
npm install

# Create .env
nano .env
# (paste env vars from above)

# Install PM2 for process management
npm install -g pm2
pm2 start server.js --name farmevidence-api
pm2 startup && pm2 save
```

**Nginx reverse proxy** (`/etc/nginx/sites-available/farmevidence`):
```nginx
server {
  listen 80;
  server_name <your-domain>;

  location /api {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/farmevidence /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain>
```

### Frontend → S3 + CloudFront

```bash
# Build
cd client && npm run build

# Create S3 bucket (public website hosting enabled)
aws s3 mb s3://farmevidence-frontend
aws s3 sync build/ s3://farmevidence-frontend --acl public-read

# Set bucket policy for static website hosting
# Create CloudFront distribution pointing to S3 bucket
# Set error page: 404 → /index.html (for React Router)
```

---

## MongoDB Atlas Setup

1. Cluster is already created at `cluster0.3awwdes.mongodb.net`
2. Database: `farmevidence` (created automatically on first write)
3. Ensure Network Access allows Render/EC2 IP (or `0.0.0.0/0` for development)
4. User: `yangabenjamin03_db_user` with `readWrite` on `farmevidence`

---

## Clerk Configuration

1. In Clerk dashboard → **API Keys** → confirm publishable key matches `.env`
2. Add production domain to **Allowed Origins**
3. In **JWT Templates** → ensure `publicMetadata` is included in token claims (role field)
4. Set **Redirect URLs** for sign-in/sign-up to production frontend domain

---

## PWA Service Worker (Production)

React's `create-react-app` with Workbox generates the service worker during `npm run build`. To enable it:

In `client/src/index.js`:
```javascript
// Change serviceWorker.unregister() to:
serviceWorkerRegistration.register();
```

The manifest.json must reference the correct `start_url` and `scope` for the deployed domain.

---

## Environment Files Reference

**`server/.env.example`**
```
PORT=5000
NODE_ENV=development
MONGODB_URI=
CLERK_SECRET_KEY=
CLIENT_ORIGIN=http://localhost:3000
```

**`client/.env.example`**
```
REACT_APP_CLERK_PUBLISHABLE_KEY=
REACT_APP_API_BASE_URL=http://localhost:5000/api
```

**`.gitignore` (root)**
```
node_modules/
server/.env
client/.env
build/
.DS_Store
*.log
```

---

## Health Check Endpoint

```
GET /api/health

Response: { "status": "ok", "timestamp": "2024-05-15T10:00:00Z", "db": "connected" }
```

Used by Render/AWS load balancer health checks.

---

## Estimated Costs

| Service | Tier | Est. Monthly Cost |
|---|---|---|
| Render Web Service | Starter (512MB RAM) | $7/mo |
| Render Static Site | Free | $0 |
| MongoDB Atlas | M0 Free (512MB) → M2 ($9) | $0–$9 |
| AWS EC2 t3.small | On-demand | ~$15/mo |
| AWS S3 + CloudFront | Pay-per-use | ~$1–3/mo |

**Recommended start**: Render (backend) + Render Static (frontend) + MongoDB M0 = $7/mo total.
