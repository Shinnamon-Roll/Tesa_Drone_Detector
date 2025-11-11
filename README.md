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
1) Build frontend:
```bash
npm install
npm run build
```
Output: `client/dist`

2) Start backend with PM2:
```bash
npm i -g pm2
pm2 start server/src/index.js --name tesa-backend
pm2 save && pm2 startup
```

3) Nginx (serve static frontend + proxy /api to backend):
```
server {
    listen 80;
    server_name YOUR.SERVER.IP.ADDRESS;

    root /var/www/tesa/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

Optional (HTTPS):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain
```

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
cd /opt/Tesa_Drone_Detector
pm2 stop tesa-backend
sudo systemctl stop nginx

git pull
sudo npm install
sudo npm run build
sudo rm -rf /var/www/tesa/client/dist
sudo cp -r client/dist /var/www/tesa/client/

pm2 start tesa-backend
sudo systemctl start nginx
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