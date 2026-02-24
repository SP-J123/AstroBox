# AstroBox

**Unrestricted, high-performance media downloader.**

AstroBox is a sleek, web-based media downloader powered by `yt-dlp` and `ffmpeg`. It solves the problem of unreliable, ad-ridden online downloaders by giving you a beautiful orchestration engine running on your own hardware. 

Target Audience: Data hoarders, archivists, video editors, and home lab enthusiasts.

## Features
- 🚀 **Universal Compatibility**: Download from YouTube, Twitch, Twitter, Reddit, Soundcloud, and thousands more.
- 🎨 **Beautiful Glassmorphism UI**: Dynamic Astro/Galaxy dark themes and Sunrise light themes.
- ⚙️ **Advanced Workflows**: Fine-tune Audio Extraction, 4K priority, 60FPS preference, and HDR handling.
- 🎬 **Post-Processing**: Built-in SponsorBlock skipping, chapter splitting, and metadata embedding.
- 🛡️ **Security Built-In**: Optional API authentication and rigid SSRF protection out of the box.
- 🗂️ **Profile Management**: Save reusable configurations for different types of media (e.g., MP3 Quick, FLAC Archive, Best Video).

## Screenshots
*(Images located in `docs/images/`)*

- **Dashboard**: `![Dashboard Setup](docs/images/dashboard.png)`
- **Advanced Options**: `![Options Panel](docs/images/options.png)`

## Tech Stack
- **Backend**: Node.js 18, Express.js, Zod
- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Database**: Ephemeral Local JSON (`history.json`)
- **Infrastructure**: Native Linux (systemd) or Docker (Alpine Linux)

---

## Installation Methods

### Method 1 — Direct VPS Install (Debian / Ubuntu)

For dedicated servers or bare metal usage. This script installs all prerequisites (Node, Python, FFmpeg, yt-dlp) and configures a resilient `systemd` service.

```bash
git clone https://github.com/SP-J123/AstroBox.git
cd AstroBox/Final
chmod +x install.sh
sudo ./install.sh
```

**Post-Install Configuration**:
- Edit environment limits: `sudo nano /opt/astrobox/.env`
- Restart the service: `sudo systemctl restart astrobox`
- View live logs: `sudo journalctl -fu astrobox`

### Method 2 — Docker Install

The recommended deployment strategy for scalability and dependency isolation.

```bash
# 1. Clone the repository
git clone https://github.com/SP-J123/AstroBox.git
cd AstroBox/Final

# 2. Create your environment config
cp .env.example .env

# 3. Add an API Token to .env for security (Optional but highly recommended)
# WRITE_API_TOKEN=your_secure_random_string

# 4. Build and launch
docker-compose up -d --build
```
    
**Post-Install Configuration**:
- **Ports**: Exposes port `3536` by default.
- **Volumes**: Media is saved to `./downloads`, and DB/Options are stored in `./config`.
- **Stopping**: `docker-compose down`

---

## Environment Variables

Configure AstroBox entirely through the `.env` file. Do not run in production without configuring limits if exposed to the internet.

| Variable | Description | Required |
| --- | --- | --- |
| `PORT` | Node.js Express Server Port | No (Default: 3536) |
| `WRITE_API_TOKEN` | Token required for download/delete requests | No (Strongly Recommended) |
| `MAX_ACTIVE_UNITS` | Concurrency limit (Audio=1, HD=2, 4K=4) | No (Default: 8) |
| `DOWNLOAD_DIR` | Host volume storage for downloaded files | No |
| `CONFIG_DIR` | Host volume storage for DB/History | No |
| `COOKIES_FILE` | Path to a Netscape cookies.txt | No |

---

## Folder Structure (Production)

```text
Final/
├── docs/                 # Extended Deployment and Troubleshooting manuals
├── config/               # Stored UI profiles and job history
├── scripts/              # Internal application scripts 
├── src/                  # Application Source Code
├── docker-compose.yml    # Docker orchestration
├── Dockerfile            # Lightweight Alpine Multi-stage image
├── install.sh            # One-click Ubuntu/Debian deployment
├── package.json          # Node dependencies
└── .env.example          # Environment defaults
```

---

## Production Notes

- **Security Requirements**: DO NOT expose port `3536` directly to the open internet without generating a `WRITE_API_TOKEN` in the `.env` file first.
- **Reverse Proxy**: AstroBox should be deployed behind an Nginx or Caddy proxy. Note that proxy configurations MUST disable buffering (`proxy_buffering off`) to support Real-Time Progress Bars (Server-Sent Events).
- **SSL Certificates**: Handle SSL termination at your proxy layer using Certbot/Let's Encrypt. 

---

## License

ISC License. See `package.json` for details. Use responsibly and adhere to local copyright classifications when downloading media.
