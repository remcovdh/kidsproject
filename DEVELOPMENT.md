# Development & Deployment

This document covers everything needed to get the project running locally, in acceptance, and in production.

## Prerequisites

- Node.js 20+
- npm 9+ (workspaces support)
- Docker + Docker Compose (for acceptance, production, and local AI)
- For GPU-accelerated local AI: `nvidia-container-toolkit` on the host

## Quick start — development

```bash
npm install
npm run dev
```

- Session app: `http://localhost:3000`
- API server: `http://localhost:3002`

The frontend runs in **mock mode** by default — AI responses are instant SVG placeholders, no API key needed, no server required. This is intentional so that `npm run dev` works immediately after cloning.

To switch off mock mode and connect to the real server, add this to a `.env` file in the project root:

```
VITE_MOCK=false
```

From there you can point the server at OpenAI, a local model, or any other provider by setting `AI_PROVIDER` (see [Environment variables](#environment-variables) below).

## Environments

Three environments, all using the same `docker-compose.yml` in acceptance and production. The only difference between environments is the `.env` file.

### Development — npm, no Docker needed

Best for active feature work. Mock mode means there are no external dependencies. When you need realistic AI output, switch to mock-off with a local model (see [Local model](#local-model--no-api-key-needed)).

### Acceptance — Docker on your laptop

The closest thing to production without deploying. Runs the same containers, same nginx, same build pipeline.

**With OpenAI:**

```bash
# 1. Copy the template and fill in your key
cp .env.acceptance .env
#    Edit .env: set OPENAI_API_KEY=sk-...

# 2. Build and start
docker compose up --build -d

# 3. Open in a browser
open http://localhost:3000
```

**With a local model instead of OpenAI:**

```bash
cp .env.local-ai .env
docker compose --profile local-ai up --build -d
docker compose exec ollama ollama pull gemma4:12b
open http://localhost:3000
```

**After a `git pull`:**

```bash
docker compose up --build -d
```

**Stop the stack:**

```bash
docker compose down          # keeps data (db + uploads survive in named volumes)
docker compose down -v       # full reset, wipes all data
```

### Production — same Docker on your hosting provider

Copy `docker-compose.yml` and create a `.env` file on the server with production values. No code changes are needed between environments.

If you need HTTPS, put a reverse proxy (Caddy, nginx, Traefik) in front of port 3000. Nothing inside the app changes.

## Local model — no API key needed

Run [Ollama](https://ollama.com) in Docker alongside the app. The server sends drawing uploads to Ollama for vision analysis; image generation falls back to distinctive SVG sprites (colour-coded by character type) unless you also configure Stable Diffusion.

The recommended model is **`gemma4:12b`** — Gemma 4 supports encoder-free multimodal vision input and fits in 12 GB VRAM (e.g. RTX 5070) at 4-bit quantization (~6.7 GB weights).

```bash
# 1. Copy the local-ai template
cp .env.local-ai .env

# 2. Start the app + Ollama container
docker compose --profile local-ai up --build -d

# 3. Pull the model (one-time, ~8 GB download)
docker compose exec ollama ollama pull gemma4:12b

# 4. Open in a browser
open http://localhost:3000
```

**GPU acceleration** — the Ollama container uses NVIDIA GPU passthrough automatically when `nvidia-container-toolkit` is installed. Without it Ollama falls back to CPU (still works, noticeably slower).

Install guide: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

**Real image generation (optional)** — by default the local provider generates SVG sprite placeholders. Two alternatives:

- **Stable Diffusion (Automatic1111)** — run with `--api` flag, then add `LOCAL_SD_URL=http://host.docker.internal:7860` to `.env`
- **Any OAI-compatible image endpoint** (Together.ai, etc.) — set `LOCAL_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell` (or whichever model the endpoint serves)

**Other model servers** — llama.cpp, LM Studio, LM Studio, Together.ai, and Groq all expose an OpenAI-compatible API. Point `LOCAL_BASE_URL` at any of them and set `LOCAL_CHAT_MODEL` to the vision-capable model you want to use.

## Environment variables

See `.env.example` for the full reference with inline comments. Ready-to-use templates:

| File | Use for |
|---|---|
| `.env.example` | Full reference, all variables documented |
| `.env.acceptance` | Docker on laptop with OpenAI |
| `.env.local-ai` | Docker on laptop with local Ollama model |

Key variables:

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `openai` | `openai` \| `local` \| `gemini` — updates the demo session on every server start |
| `OPENAI_API_KEY` | — | Required when `AI_PROVIDER=openai` |
| `LOCAL_BASE_URL` | `http://ollama:11434/v1` | Chat/vision endpoint (Ollama Docker service, or any OAI-compatible URL) |
| `LOCAL_API_KEY` | `ollama` | API key for the local endpoint (often a dummy value) |
| `LOCAL_CHAT_MODEL` | `gemma4:12b` | Vision-capable model to use |
| `LOCAL_IMAGE_MODEL` | — | If set, use this model for image generation via the same endpoint |
| `LOCAL_SD_URL` | — | If set, use Automatic1111-compatible API for image generation |
| `VITE_MOCK` | `true` | Set to `false` to connect the frontend to the real server |
| `SESSION_PORT` | `3000` | Host port for the session app container |
| `PORT` | `3002` | API server port |
| `DB_PATH` | `./data/kidsproject.db` | SQLite database file |
| `UPLOAD_DIR` | `./uploads` | Where drawings and generated sprites are stored |

## AI providers

| Provider | `AI_PROVIDER=` | Vision model | Image generation |
|---|---|---|---|
| OpenAI | `openai` | GPT-4o | DALL-E 3 |
| Local | `local` | Any vision model via Ollama / llama.cpp / LM Studio / … | SVG sprites (default), or Stable Diffusion (`LOCAL_SD_URL`), or OAI-compatible endpoint (`LOCAL_IMAGE_MODEL`) |
| Gemini | `gemini` | — | Not yet implemented |

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + vanilla TypeScript | No framework overhead; games must run as plain `file://` with no build step |
| Backend | Node.js + Express | Simple, fast to iterate |
| Database | SQLite via `better-sqlite3` | Zero-config for MVP; easy to inspect; survives in a Docker volume |
| File storage | Local disk (Docker named volume) | Simple; swap to S3-compatible later |
| AI | Pluggable server-side abstraction | Provider swappable per session without touching app code |
| Serving | nginx:alpine | Static session app + reverse proxy to API in one container |

## API overview

The server runs on port 3002. All paths are prefixed `/api/`. A demo session (`id: demo`) is seeded automatically on first run.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sessions/:id` | Load session config |
| `POST` | `/api/sessions` | Create a session (facilitator) |
| `POST` | `/api/sessions/:id/children` | Register a child, returns `childId` |
| `POST` | `/api/sessions/publish` | Publish a finished game to the gallery |
| `GET` | `/api/sessions/:id/gallery` | All published games in a session |
| `POST` | `/api/uploads/drawing` | Upload a drawing photo or background image |
| `POST` | `/api/ai/sprites` | Generate a sprite pack from a drawing + description |
| `POST` | `/api/moderation/check` | Check free-text input before it reaches the AI |

## Troubleshooting

### Where to look for errors

**Server logs**

- Development (`npm run dev`): output appears directly in the terminal where you ran the command.
- Docker: `docker compose logs server --tail=100 --follow` streams live server output. Look for lines starting with `Sprite generation error:` or HTTP 4xx/5xx lines.

**Browser**

Open DevTools (F12) and check two tabs:
- **Console** — JavaScript errors from the frontend are logged here, prefixed with `[upload-drawing]` or `[generate-sprites]`.
- **Network** — filter by XHR/Fetch. A red row means a failed API call. Click it and check the **Response** tab to see the server's error message.

The app now also shows the raw server error message in the UI next to "Ask your teacher for help" — so a facilitator watching over the child's shoulder can read it directly.

### Common problems and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Upload button goes back to normal with no progress | Server not reachable (wrong `VITE_MOCK`, server not running, CORS) | Check server terminal; check `VITE_MOCK=false` in `.env`; check `http://localhost:3002/api/sessions/demo` returns JSON |
| Upload works but sprite generation shows "Ask your teacher" | `OPENAI_API_KEY` missing or quota exceeded | Check server log for `Sprite generation error:`; verify key in `.env` |
| App loads but everything is instant placeholder sprites | `VITE_MOCK` is still `true` | Add `VITE_MOCK=false` to `.env` and restart the dev server |
| Docker container starts then immediately stops | Port conflict, or missing `.env` | Run `docker compose logs server` to see the crash reason |
| Ollama times out on first request | Model not pulled yet | `docker compose exec ollama ollama pull gemma4:12b` |

### Quick sanity check (Docker)

```bash
# Is the server healthy?
curl http://localhost:3002/api/sessions/demo

# Expected: {"id":"demo","name":"Dragon Workshop 🐉",...}
# If you get connection refused: server container is not running
# If you get {"error":"..."}: server started but hit a config problem (check logs)
```

```bash
# Full log tail for all services
docker compose logs --tail=50 --follow
```

## Code conventions

- No framework in `apps/games/` — plain HTML/CSS/JS only, must open with `file://`
- TypeScript everywhere else
- All AI calls go through `server/ai/` — never call provider SDKs directly from app code
- Visual components get a matching `*.css` file, no inline styles
- No comments unless the *why* is non-obvious
