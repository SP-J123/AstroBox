#!/usr/bin/env bash

# AstroBox VPS Installation Script
# Compatible with Ubuntu 20.04+ / Debian 11+

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AstroBox Installation...${NC}"

# 1. Check Root Privileges
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root. Please run with sudo.${NC}"
   exit 1
fi

# 2. System Packages & Prerequisites
echo -e "${YELLOW}Installing system dependencies (curl, ffmpeg, python3)...${NC}"
apt-get update
apt-get install -y curl dirmngr apt-transport-https lsb-release ca-certificates python3 python3-pip ffmpeg dnsutils

# 3. Handle yt-dlp installation (requires Python)
echo -e "${YELLOW}Installing latest yt-dlp...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    chmod a+rx /usr/local/bin/yt-dlp
else
    echo -e "${GREEN}yt-dlp is already installed. Updating...${NC}"
    yt-dlp -U
fi

# 4. Install Node.js 18.x
echo -e "${YELLOW}Installing Node.js 18...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js is already installed. Skipping...${NC}"
fi

# 5. Application Setup
INSTALL_DIR="/opt/astrobox"
REPO_URL="https://github.com/SP-J123/AstroBox.git"

echo -e "${YELLOW}Setting up AstroBox in ${INSTALL_DIR}...${NC}"

# Create directories or use existing
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Cloning AstroBox repository to ${INSTALL_DIR}...${NC}"
    mkdir -p "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
else
    echo -e "${GREEN}Directory $INSTALL_DIR already exists. Updating from Git...${NC}"
    cd "$INSTALL_DIR"
    git pull origin master || echo -e "${YELLOW}Warning: Git pull failed or not a git repository. Continuing...${NC}"
fi

# Ensure basic subdirectories exist
mkdir -p "$INSTALL_DIR/Final/downloads"
mkdir -p "$INSTALL_DIR/Final/config"

cd "$INSTALL_DIR/Final"

# Ensure environment file exists safely without overwriting user configs
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating default .env from .env.example...${NC}"
    cp .env.example .env
    # Generate a random initial API Token for security out of the box
    RANDOM_TOKEN=$(openssl rand -hex 16)
    sed -i "s/WRITE_API_TOKEN=.*/WRITE_API_TOKEN=${RANDOM_TOKEN}/g" .env
else
    echo -e "${GREEN}Existing .env found. Preserving configuration.${NC}"
fi

# 6. Install Node Modules & Build Production Bundle
echo -e "${YELLOW}Installing NPM dependencies and building...${NC}"
npm ci --omit=dev  
# For a production release, we assume a pre-built dist OR we build here
if [ -f "package.json" ]; then
    # We shouldn't rely on devDependencies being missing if we need to build Vite. 
    # For robust production install:
    npm install
    npm run build
    npm prune --omit=dev
fi

# 7. Setup Systemd Service
SERVICE_FILE="/etc/systemd/system/astrobox.service"
echo -e "${YELLOW}Configuring systemd service...${NC}"

# Create a non-root user to run the service safely
if ! id -u astrobox &>/dev/null; then
    useradd -r -s /bin/false astrobox
fi
chown -R astrobox:astrobox "$INSTALL_DIR"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=AstroBox Media Downloader
After=network.target

[Service]
Type=simple
User=astrobox
Group=astrobox
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=astrobox

[Install]
WantedBy=multi-user.target
EOF

# Reload and Enable Service
systemctl daemon-reload
systemctl enable astrobox

# 8. Firewall setup (UFW)
PORT=$(grep '^PORT=' .env | cut -d '=' -f2)
PORT=${PORT:-3536} # Fallback to 3536 if not defined

if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}Opening port $PORT in UFW...${NC}"
    ufw allow "$PORT/tcp"
fi

# 9. Start the application
systemctl start astrobox

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}AstroBox Installation Complete!${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e ""
echo -e "Service Name:  astrobox.service"
echo -e "Running Port:  $PORT"
echo -e "Status:        sudo systemctl status astrobox"
echo -e "Logs:          sudo journalctl -fu astrobox"
echo -e ""
echo -e "Access URL:    http://$(curl -s ifconfig.me):$PORT"
echo -e ""
echo -e "Note: Update the .env file in ${INSTALL_DIR} to configure advanced limits,"
echo -e "concurrency, and your WRITE_API_TOKEN."

exit 0
