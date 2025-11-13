# Tesa Drone Detector (React JS + Express)

React (JSX) frontend with Vite and a Node/Express backend.

## Requirements
- Node.js 18+
- npm 8+

## Install
```bash
npm install
```

## Run (development)
Two terminals:

1) Backend (Express at http://localhost:3000)
```bash
npm run dev
```

2) Frontend (Vite at http://localhost:5173)
```bash
npm run client:dev
```

Or run both with one command:
```bash
npm run dev:all
```

## Scripts
- `npm run dev`: start backend with nodemon (server/src/index.js)
- `npm run client:dev`: start frontend Vite dev server
- `npm run dev:all`: run both backend and frontend
- `npm run build`: build frontend to `client/dist`
- `npm run preview`: preview built frontend locally
- `npm start`: start backend with Node (production-style)

## Project structure
```
client/                 # React (JS) app via Vite
  index.html
  vite.config.js
  src/
    main.jsx
    index.css
    layouts/
      AppLayout.jsx
      AppLayout.css
    pages/
      MainDashboard.jsx
      DefensiveDashboard.jsx
      OffensiveDashboard.jsx
      SettingsPage.jsx

server/                 # Node/Express backend (JS)
  src/
    index.js
  nodemon.json

package.json            # Scripts and deps (JS only)
```

## API
- Healthcheck: `GET /api/health` → `{ status: "ok", service: "tesa-drone-detector-backend" }`

## Frontend → Backend (dev)
Vite dev server proxies `/api` to `http://localhost:3000` (see `client/vite.config.js`).

## Production deployment (Ubuntu + Nginx + PM2)

**Current Production Setup:**
- **Server IP:** `185.84.160.134`
- **Project Path:** `/home/xver/Tesa_Project/Tesa_Drone_Detector`
- **Frontend Deploy Path:** `/var/www/tesa/client/dist`
- **Nginx Config:** `/etc/nginx/sites-available/tesa`
- **PM2 Process:** `tesa-backend`

### 1) Build frontend:
```bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
npm install
npm run build
```
Output: `client/dist`

### 2) Deploy frontend to nginx directory:
```bash
sudo rm -rf /var/www/tesa/client/dist
sudo cp -r client/dist /var/www/tesa/client/
sudo chown -R www-data:www-data /var/www/tesa/client/dist
```

### 3) Start backend with PM2:
```bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
npm i -g pm2  # if not installed
pm2 start server/src/index.js --name tesa-backend
pm2 save && pm2 startup
```

### 4) Nginx Configuration

**Current nginx config location:** `/etc/nginx/sites-available/tesa`

The server is configured with:
- **Server IP:** `185.84.160.134` (port 80)
- **Root:** `/var/www/tesa/client/dist`
- **Backend Proxy:** `http://127.0.0.1:3000`
- **Cache Control:** HTML files no-cache, static assets cached 1 year

**To update nginx config:**
```bash
sudo nano /etc/nginx/sites-available/tesa
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Reload nginx
```

**Current nginx config structure:**
```nginx
server {
    listen 80;
    server_name 185.84.160.134;

    root /var/www/tesa/client/dist;
    index index.html index.jsx;

    # Disable cache for HTML files
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri =404;
    }

    # Cache static assets (JS, CSS) with versioning
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy Socket.IO requests to backend
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

### 5) Server Code Updates for Nginx

The server code has been updated to support nginx reverse proxy:
- ✅ **Trust Proxy:** `app.set('trust proxy', true)` - for correct IP addresses
- ✅ **CORS:** Configured to work with nginx
- ✅ **Socket.IO:** Configured with proper transports for nginx proxy

### Optional (HTTPS with Let's Encrypt):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```
See `HTTPS_DOMAIN_SETUP.md` for detailed HTTPS setup instructions.

## Operations cheatsheet (Ubuntu production)

### Start services
```bash
# ensure backend is running (systemd will usually start it on boot)
pm2 start tesa-backend
sudo systemctl start nginx
```

### Stop services
```bash
pm2 stop tesa-backend
sudo systemctl stop nginx
```

### Restart services
```bash
pm2 restart tesa-backend
sudo systemctl restart nginx
```

### View logs
```bash
pm2 logs tesa-backend
sudo journalctl -u nginx -n 100 --no-pager
```

### Redeploy after pulling new code
```bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
pm2 stop tesa-backend

git pull origin main
npm install
npm run build

# Deploy frontend
sudo rm -rf /var/www/tesa/client/dist
sudo cp -r client/dist /var/www/tesa/client/
sudo chown -R www-data:www-data /var/www/tesa/client/dist

# Restart services
pm2 restart tesa-backend
sudo systemctl reload nginx
```

### Full shutdown (including PM2 autostart)
```bash
pm2 stop tesa-backend
pm2 delete tesa-backend
sudo systemctl stop pm2-$(whoami)
sudo systemctl disable pm2-$(whoami)
sudo systemctl stop nginx
sudo systemctl disable nginx
```

## Troubleshooting
- White screen on http://localhost:5173:
  - Ensure `npm run client:dev` is running, then refresh.
  - Check browser console for errors.
  - Confirm `client/index.html` has `<div id="root"></div>` and `<script type="module" src="/src/main.jsx">`.
- Backend not starting via `npm run dev`:
  - Confirm `server/nodemon.json` points to `server/src/index.js`.
  - Port 3000 not in use.

## Notes
- Frontend is JavaScript-only React (no TypeScript). JSX lives under `client/src/`.
- If you need realtime updates, we can add Socket.IO on both server and client.