# Security Best Practices for AstroBox

AstroBox orchestrates external network requests (via `yt-dlp`) and executes system binaries (`ffmpeg`). As such, deploying it securely requires adhering to strict environment safeguards.

## 1. Authentication (`WRITE_API_TOKEN`)

AstroBox is equipped with optional API token authentication for all state-mutating requests (e.g., starting downloads, deleting profiles).
By default, the `install.sh` script automatically generates a secure 16-byte hex token. 

**Recommendation**: Always define `WRITE_API_TOKEN` in production. Never expose the dashboard without authentication if the port is accessible over the public internet. Alternatively, secure the entire endpoint using HTTP Basic Auth or Authelia at the reverse proxy layer.

## 2. Server-Side Request Forgery (SSRF) Protection

AstroBox has built-in SSRF protection that denies `yt-dlp` from downloading URLs pointing to local, loopback, or private IP spaces (e.g., `127.0.0.1`, `192.168.x.x`, `10.x.x.x`).

**Recommendation**: Do not modify or bypass the `assertSafeRemoteUrl` validation in `src/server/index.ts`. If you intentionally need AstroBox to download media from a private NAS/LAN server, you must explicitly whitelist that IP in the codebase or run AstroBox in an isolated network segment.

## 3. Sandboxing & User Permissions

**VPS Deployment (`install.sh`)**: 
The script automatically provisions a non-privileged `astrobox` system user. The application *must not* run as `root`. The `systemd` service is locked to this limited user, granting it read/write access only to `/opt/astrobox/downloads` and `/opt/astrobox/config`.

**Docker Deployment**:
The `Dockerfile` employs a multi-stage Alpine build and explicitly switches to the non-root `node` user before launching.

## 4. Resource Exhaustion Controls

Publicly exposing the downloader can invite abuse (DDoS via massive concurrent 4K downloads). AstroBox includes the following mitigations you should configure via `.env`:
- `MAX_ACTIVE_UNITS`: Constrains concurrent `yt-dlp` strings (e.g., audio=1 unit, 4K video=4 units). Set this relatively low (e.g., `8`) on lower-end VPS instances.
- `MAX_RATE_LIMIT`: Define a hard cap for maximum download bandwidth per child process (e.g., `10M`).

## 5. Reverse Proxy Security

Always terminate SSL/TLS via a reverse proxy (e.g., Nginx, Traefik, Caddy). Do not expose the Node.js Express server directly on port 80/443. 
Ensure your reverse proxy sets standard security headers:
```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header X-Content-Type-Options "nosniff";
```
