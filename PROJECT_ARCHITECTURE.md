# AstroBox Project Architecture

## Project Purpose
AstroBox (formerly HarborFlow / yt-dlp-web) is a high-performance, quiet media downloader and processing engine. It provides a sleek, modern web interface (frontend) that securely communicates with a Node.js backend to orchestrate `yt-dlp` and `ffmpeg` processes for extracting, converting, and downloading media from thousands of supported sites. 

## Core Features
- **URL Analysis & Media Extraction**: Instantly parse URLs and fetch available video/audio streams.
- **Advanced Format Options**: Precise control over container formats, quality tiers, 60fps/HDR prioritization, and audio extraction.
- **Post-Processing Pipeline**: Native support for SponsorBlock, embedded subtitles, chapter splitting, and metadata embedding.
- **Workflow Profiles**: Save and load custom configuration presets.
- **Concurrent Job Queue**: Real-time progress tracking via Server-Sent Events (SSE) with robust concurrency and system resource management.
- **Security & Access Control**: Ticket-based API access, rate limiting, SSRF protection against private IP access, and optional API token authentication.

## Tech Stack
### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Key Libraries**: `zod` (validation), `helmet` (security headers), `express-rate-limit`, `node-fetch`.
- **Core Dependencies**: `yt-dlp` (extraction), `ffmpeg` (conversion/post-processing), `curl`.

### Frontend
- **Framework**: React 18 + TypeScript
- **Tooling**: Vite (build & dev server)
- **Styling**: Tailwind CSS (custom glassmorphism UI)
- **State Management**: Zustand (modular slice pattern)
- **Icons**: Lucide React

## Folder Structure
```text
.
├── src/
│   ├── client/       # React Frontend (App, Components, Store, Styles)
│   └── server/       # Node.js Backend (Express API, DB, Job Manager)
├── config/           # Server configuration and environment profiles
├── scripts/          # Build scripts, health checks, and test runner
├── docs/             # Application documentation and guides
├── test/             # Vitest unit & integration tests
├── .env.example      # Environment variables template
├── package.json      # Dependencies and execution scripts
├── tailwind.config.ts# Tailwind CSS configuration
└── vite.config.ts    # Vite bundler configuration
```

## Application Request Flow
1. **Client Request**: User inputs a URL and selects options in the React frontend.
2. **Authentication**: If enabled, the client exchanges an API token for a short-lived access ticket.
3. **API Routing**: The frontend sends a POST request to `/api/download` with the URL and parameters.
4. **Validation & Security**: The backend validates the payload using Zod and confirms the target URL is safe (not SSRF).
5. **Job Queueing**: The request enters the internal job queue, reserving estimated system resources (CPU/RAM).
6. **Execution**: A child process spawns `yt-dlp` with the requested arguments (`ffmpeg` handles post-processing if needed).
7. **Real-Time Updates**: Progress metrics are parsed from stdout and streamed back to the client via Server-Sent Events (SSE).
8. **Completion & Persistence**: The finished file is saved to the `downloads` directory, and the job state is persisted to the local JSON database (`history.json`).

## Runtime Requirements
- Node.js 18.0 or higher
- Python 3+ (required by yt-dlp)
- FFmpeg (required for extraction, merging, and metadata formatting)
- Storage access (read/write permissions for `/downloads` and `/config`)

## Deployment Architecture Overview
The application is designed to run via two primary methods:
- **Direct VPS / Bare Metal**: Installed via a setup script, running continuously as a `systemd` background service.
- **Containerized**: Run via Docker/Docker Compose, leveraging a multi-stage Alpine Linux image to keep the footprint minimal while bundling all necessary native binaries (`ffmpeg`, `python`, `yt-dlp`).
