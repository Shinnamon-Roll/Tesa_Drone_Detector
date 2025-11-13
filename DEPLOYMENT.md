# Production Deployment Guide

## Current Production Environment

- **Server:** Ubuntu Server with Public IP
- **IP Address:** `185.84.160.134`
- **Web Server:** Nginx (reverse proxy)
- **Backend Process Manager:** PM2
- **Project Location:** `/home/xver/Tesa_Project/Tesa_Drone_Detector`
- **Frontend Deploy Path:** `/var/www/tesa/client/dist`
- **Backend Port:** `3000` (internal, proxied by nginx)

## Initial Setup

### 1. Install Dependencies
```bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
npm install
```

### 2. Build Frontend
```bash
npm run build
```

### 3. Setup Deployment Directory
```bash
sudo mkdir -p /var/www/tesa/client
sudo cp -r client/dist /var/www/tesa/client/
sudo chown -R www-data:www-data /var/www/tesa/client
```

### 4. Setup Nginx
```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/tesa

# Enable site
sudo ln -s /etc/nginx/sites-available/tesa /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Setup PM2
```bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
pm2 start server/src/index.js --name tesa-backend
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

## Deployment Workflow

### Quick Deploy (Frontend + Backend)
```bash
#!/bin/bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Deploy frontend
sudo rm -rf /var/www/tesa/client/dist
sudo cp -r client/dist /var/www/tesa/client/
sudo chown -R www-data:www-data /var/www/tesa/client/dist

# Restart backend
pm2 restart tesa-backend

# Reload nginx
sudo systemctl reload nginx

echo "Deployment complete!"
```

### Deploy Frontend Only
```bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
npm run build
sudo rm -rf /var/www/tesa/client/dist
sudo cp -r client/dist /var/www/tesa/client/
sudo chown -R www-data:www-data /var/www/tesa/client/dist
sudo systemctl reload nginx
```

### Deploy Backend Only
```bash
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
pm2 restart tesa-backend
```

## Service Management

### Check Status
```bash
# Backend
pm2 status
pm2 logs tesa-backend

# Nginx
sudo systemctl status nginx
sudo nginx -t
```

### Restart Services
```bash
pm2 restart tesa-backend
sudo systemctl restart nginx
```

### Stop Services
```bash
pm2 stop tesa-backend
sudo systemctl stop nginx
```

## Troubleshooting

### Backend not responding
```bash
# Check PM2 status
pm2 status
pm2 logs tesa-backend

# Check if port 3000 is in use
sudo netstat -tlnp | grep 3000

# Restart backend
pm2 restart tesa-backend
```

### Nginx errors
```bash
# Test nginx config
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Check if nginx is running
sudo systemctl status nginx
```

### Frontend not updating
```bash
# Clear browser cache
# Or check if files are deployed correctly
ls -la /var/www/tesa/client/dist/

# Rebuild and redeploy
cd /home/xver/Tesa_Project/Tesa_Drone_Detector
npm run build
sudo rm -rf /var/www/tesa/client/dist
sudo cp -r client/dist /var/www/tesa/client/
sudo chown -R www-data:www-data /var/www/tesa/client/dist
sudo systemctl reload nginx
```

### Socket.IO not working
- Check that `/socket.io/` location is properly configured in nginx
- Verify backend is running: `pm2 status`
- Check browser console for WebSocket errors
- Verify `proxy_set_header Upgrade` and `Connection "upgrade"` in nginx config

## File Permissions

Important directories and their permissions:
```bash
/var/www/tesa/client/dist  # www-data:www-data (755)
/home/xver/Tesa_Project/Tesa_Drone_Detector  # xver:xver (755)
```

## Environment Variables

Backend uses these environment variables (if needed):
- `PORT` - Backend port (default: 3000)
- `DATA_DIR` - Path to dataForWeb directory

Set in PM2 ecosystem or `.env` file if needed.

## Monitoring

### View Real-time Logs
```bash
# Backend
pm2 logs tesa-backend --lines 100

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check Resource Usage
```bash
pm2 monit
htop
```

## Security Notes

- Backend runs on localhost:3000 (not exposed publicly)
- Only nginx (port 80/443) is exposed
- Firewall should allow ports 80 and 443 only
- Consider setting up HTTPS with Let's Encrypt (see `HTTPS_DOMAIN_SETUP.md`)

