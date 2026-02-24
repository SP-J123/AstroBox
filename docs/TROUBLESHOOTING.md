# Troubleshooting Guide

This guide covers common errors encountered when deploying or running AstroBox in production.

## 1. Installation Failures (VPS)

### Error: `yt-dlp: command not found`
If the `.sh` script failed to fetch yt-dlp, it may be due to a DNS block or proxy issue fetching from GitHub.
**Fix**: Manually install using `wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp`

### Error: Permission denied (`EACCES`) internally
If the application is throwing `EACCES` when attempting to save the database or download files:
**Fix**: Ensure the system user owns the directory:
```bash
sudo chown -R astrobox:astrobox /opt/astrobox
sudo systemctl restart astrobox
```

## 2. Docker Build Failures

### Error: `npm ERR! code ERESOLVE` during build
This occurs if package dependencies are suddenly conflicting.
**Fix**: Re-run the build explicitly omitting dev dependencies and forcing resolution:
```bash
docker-compose build --no-cache
```

### Error: `standard_init_linux.go: exec user process caused: exec format error`
This means the image was built for the wrong CPU architecture (e.g., building on M-series Mac and deploying to x86 Linux).
**Fix**: Build the image locally on target machine, or use Docker buildx for multi-arch:
```bash
docker buildx build --platform linux/amd64 -t astrobox:latest .
```

## 3. Runtime & Download Errors

### Error: `Video unavailable`, `Sign in to confirm you're not a bot`
YouTube and other platforms frequently block datacenters or demand captchas.
**Fix**: Provide a `cookies.txt` file exported from a browser logged into an account.
1. Place the `cookies.txt` in `/opt/astrobox/config/cookies.txt` (or `./config/cookies.txt` for Docker).
2. Update `.env` to set `COOKIES_FILE=./config/cookies.txt`.
3. Restart the service/container.

### Progress bar isn't moving, or Dashboard drops connection
This almost always indicates an incorrectly configured Reverse Proxy. Server-Sent Events (SSE) require long-lived HTTP connections that do not buffer.
**Fix**: Ensure Nginx includes:
```nginx
proxy_set_header Connection '';
chunked_transfer_encoding off;
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 86400s;
```

## 4. Systemd Debugging (VPS)
If `systemctl status astrobox` shows "failed", examine the logs:
```bash
journalctl -u astrobox -e -n 100
```
Common fatal crashes include missing `.env` variables or port bindings already in use by another application.
