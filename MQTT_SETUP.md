# MQTT Setup Guide

## Current Configuration

- **MQTT Broker:** Mosquitto
- **Port:** 1883
- **Listen Address:** 0.0.0.0 (all interfaces - allows external connections)
- **Authentication:** Anonymous (allow_anonymous = true)
- **Topic:** `tesa/drones/offensive` (default)

## Server Configuration

### Mosquitto Config Location
- Main config: `/etc/mosquitto/mosquitto.conf`
- External access config: `/etc/mosquitto/conf.d/external.conf`

### Current Config (`/etc/mosquitto/conf.d/external.conf`):
```conf
# Allow MQTT connections from external clients
listener 1883 0.0.0.0

# Allow anonymous connections (for now - can add authentication later)
allow_anonymous true
```

## Firewall

Port 1883 is open in firewall:
```bash
sudo ufw allow 1883/tcp
```

## Testing Connection

### From MATLAB
- **Broker Address:** `mqtt://185.84.160.134:1883`
- **Port:** `1883`
- **Topic:** `tesa/drones/offensive`

### Expected Message Format
```json
{
  "lat": 13.7563,
  "lng": 100.5018,
  "height": 50.5
}
```

## Service Management

### Check Status
```bash
sudo systemctl status mosquitto
```

### Restart Service
```bash
sudo systemctl restart mosquitto
```

### View Logs
```bash
sudo tail -f /var/log/mosquitto/mosquitto.log
```

### Check Listening Ports
```bash
sudo ss -tlnp | grep 1883
```

Should show: `0.0.0.0:1883` (not just `127.0.0.1:1883`)

## Troubleshooting

### Connection Failed from MATLAB

1. **Check if Mosquitto is running:**
   ```bash
   sudo systemctl status mosquitto
   ```

2. **Check if port is listening on all interfaces:**
   ```bash
   sudo ss -tlnp | grep 1883
   ```
   Should show `0.0.0.0:1883`, not `127.0.0.1:1883`

3. **Check firewall:**
   ```bash
   sudo ufw status | grep 1883
   ```

4. **Check Mosquitto logs:**
   ```bash
   sudo tail -f /var/log/mosquitto/mosquitto.log
   ```

5. **Test connection from server:**
   ```bash
   mosquitto_pub -h localhost -t test/topic -m "test message"
   mosquitto_sub -h localhost -t test/topic
   ```

### Common Issues

1. **Mosquitto only listening on localhost:**
   - Check `/etc/mosquitto/conf.d/external.conf` has `listener 1883 0.0.0.0`
   - Restart: `sudo systemctl restart mosquitto`

2. **Firewall blocking:**
   - Open port: `sudo ufw allow 1883/tcp`
   - Check status: `sudo ufw status`

3. **Config errors:**
   - Check logs: `sudo journalctl -u mosquitto -n 50`
   - Test config: `sudo mosquitto -c /etc/mosquitto/mosquitto.conf -v`

## Security Notes

⚠️ **Current setup allows anonymous connections** - suitable for development/testing.

For production, consider:
1. Enable authentication (username/password)
2. Use TLS/SSL (port 8883)
3. Restrict access by IP if possible
4. Use ACLs (Access Control Lists) to limit topics

### Enable Authentication (Optional)
```bash
# Create password file
sudo mosquitto_passwd -c /etc/mosquitto/passwd username

# Update config
sudo nano /etc/mosquitto/conf.d/external.conf
# Change: allow_anonymous false
# Add: password_file /etc/mosquitto/passwd
```

## Server Code Integration

The Node.js server automatically connects to MQTT broker:
- **Broker:** `mqtt://localhost:1883` (from server)
- **Topic:** `tesa/drones/offensive`
- **Environment Variable:** `MQTT_BROKER` (can override default)

The server subscribes to the topic and updates drone data when messages are received from MATLAB.

