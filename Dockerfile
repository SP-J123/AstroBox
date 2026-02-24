# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
RUN apk add --no-cache python3 make g++

# Copy package files and install all dependencies (including dev deps to build)
COPY package*.json ./
RUN npm install

# Copy full source and build
COPY . .
RUN npm run build

# Production Stage
FROM node:18-alpine AS production

WORKDIR /app

# Install runtime dependencies: ffmpeg, python3, and curl (for yt-dlp check)
RUN apk add --no-cache ffmpeg python3 curl ca-certificates

# Install yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Copy production package files
COPY package*.json ./
# Install only production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy built assets and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/scripts ./scripts

# Create necessary directories and set ownership to 'node' user
RUN mkdir -p /app/downloads /app/config && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend service port
EXPOSE 3536

# Set environment to production
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3536/api/health || exit 1

# Start server
CMD ["npm", "run", "start"]
