# AstroBox Deployment Guide

This guide covers the two supported methods for deploying AstroBox to a production environment.

## Method 1: Bare Metal / VPS Deployment (Recommended for Local NAS or Dedicated Seedboxes)

The included `install.sh` script automates the setup process on Ubuntu 20.04+ or Debian 11+ systems.

### Prerequisites
- SSH access with `root` or `sudo` privileges.
- At least 1GB of RAM (2GB+ recommended for concurrent 4K downloads or heavy ffmpeg usage).

### Steps
1. Clone the AstroBox repository to your server:
```bash
git clone https://github.com/SP-J123/AstroBox.git
cd AstroBox/Final
```
2. Run the installation script:
```bash
chmod +x install.sh
sudo ./install.sh
```
3. The script will install Node.js 18, Python, FFmpeg, and yt-dlp. It will also copy the files to `/opt/astrobox` and set up a systemd service.
4. After completion, check the status:
```bash
sudo systemctl status astrobox
```

### Updates and Restarts
To update the `.env` configuration file:
```bash
sudo nano /opt/astrobox/.env
sudo systemctl restart astrobox
```

---

## Method 2: Docker Deployment (Recommended for Scalability & Portability)

Using Docker ensures that AstroBox runs isolated with all required native dependencies (`ffmpeg`, `python`) perfectly matched to the applicationversion.

### Prerequisites
- Docker Engine (v20+)
- Docker Compose (v2+)

### Steps
1. Clone the repository and navigate to the Docker directory:
```bash
git clone https://github.com/SP-J123/AstroBox.git
cd AstroBox/Final
```
2. Copy the environment template:
```bash
cp .env.example .env
```
3. Generate a secure `WRITE_API_TOKEN` and add it to `.env`:
```bash
openssl rand -hex 16
```
4. Build and start the container in detached mode:
```bash
docker-compose up -d --build
```
5. View the logs to ensure successful startup:
```bash
docker-compose logs -f
```

### Updating the Container
If you modify `.env` or application files, rebuild the container:
```bash
docker-compose up -d --build
```

---

## Reverse Proxy Setup (Nginx)

Regardless of the deployment method, we highly recommend operating AstroBox behind an Nginx reverse proxy to handle SSL/TLS termination and provide standard HTTP routing.

### Example Nginx config (`/etc/nginx/sites-available/astrobox`):
```nginx
server {
    listen 80;
    server_name astrobox.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3536;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Required for Server-Sent Events (SSE) Progress Bars!
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

Enable the site and obtain an SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/astrobox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d astrobox.yourdomain.com
```
