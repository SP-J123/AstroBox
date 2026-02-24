# Environment Variables Reference

AstroBox is configured almost entirely through the `.env` file, allowing seamless portability across different environments (Docker, bare metal).

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| **Server Settings** | | | |
| `PORT` | The port the Node.js Express server runs on. | No | `3536` |
| `HOST` | The interface to bind to (`0.0.0.0` for all). | No | `0.0.0.0` |
| **Security** | | | |
| `WRITE_API_TOKEN` | A secret token required by clients to initiate downloads or mutate state. | **Recommended** | None (Disabled) |
| `AUTH_TICKET_TTL_MS`| Web socket / SSE ticket expiration time in ms. | No | `15000` |
| **Paths** | | | |
| `DOWNLOAD_DIR` | Absolute or relative path to store completed files. | No | `./downloads` |
| `CONFIG_DIR` | Directory for History database and UI options. | No | `./config` |
| `COOKIES_FILE` | (Optional) Path to a Netscape format cookies.txt file for yt-dlp to bypass auth walls. | No | None |
| **Resource Limits** | | | |
| `MAX_ACTIVE_UNITS` | Concurrency soft-limit. Audio=1 unit, 1080p=2, 4k=4. Prevents memory limits. | No | `8` |
| `MAX_HISTORY_ITEMS` | Maximum number of completed jobs to keep in `history.json`. | No | `2000` |
| `MAX_STORED_LOGS` | Maximum length of the stdout/stderr log rolling buffer kept per job. | No | `100` |
| `DB_FLUSH_DEBOUNCE_MS`| Batching window for disk writes (improves IOPS). | No | `3000` |
| **Default Overrides** | | | |
| `DEFAULT_RATE_LIMIT`| Default `yt-dlp` `--limit-rate` (e.g. `5M`). | No | None |
| `DEFAULT_OUTPUT_TEMPLATE` | Final filename syntax for yt-dlp. | No | `%(title)s [%(id)s].%(ext)s` |
