# Kids AI Workshop

A guided web application where children aged 6–12 use AI to turn their own paper drawings into playable browser games. Runs in supervised workshop sessions of up to 20 kids, roughly 90 minutes each.

## What children learn

Every child walks away understanding three things about AI:

1. **You are the director** — AI does what you describe, not what you imagine. Words matter.
2. **AI makes mistakes** — that's okay. You can describe it differently and try again.
3. **AI learned from humans** — it's a very good guesser.

These ideas are woven into the flow of the app rather than taught as a lesson. The child experiences them directly.

## How a session works

A facilitator creates a session in advance (choosing the AI provider and whether to show the AI prompt to children). Children join on their own device or a shared tablet and go through these steps:

1. Enter their name
2. Pick a game type — only **Catcher** is available now; more game types are on the roadmap
3. Draw a character on paper and photograph it (phone camera or tablet)
4. Optionally draw a background for their game world
5. Answer a few structured questions about the character (what is it, how does it feel, how does it move)
6. Watch the AI generate a sprite pack — idle, moving, action, and celebrate poses
7. Play an instant preview of their game
8. Optionally assign sounds and peek at the game code
9. Publish to the session gallery so everyone can play each other's games

When a child gets their sprite back it looks different to what they imagined — that moment of surprise is when the first two AI concepts land.

## Project structure

```
kidsproject/
├── apps/
│   ├── session/        # Child-facing guided flow (Vite + TypeScript)
│   ├── admin/          # Facilitator dashboard — in progress
│   └── games/
│       └── catcher/    # Standalone game template (plain HTML/CSS/JS)
├── packages/
│   ├── ai/             # Pluggable AI provider interface
│   ├── assets/         # Pre-made sound library
│   └── shared/         # Shared TypeScript types
├── server/             # Express API (sessions, uploads, AI proxy, moderation)
│   └── ai/             # Server-side AI provider implementations
├── docker/             # Dockerfiles and nginx config
├── docker-compose.yml
├── .env.example        # All supported environment variables
├── .env.acceptance     # Ready-to-use template for acceptance on your laptop
└── CLAUDE.md           # Full technical spec and design decisions
```

## Environments

There are three environments and they are kept deliberately simple.

### Development — runs on your machine, no API key needed

```bash
npm install
npm run dev
```

- Session app: `http://localhost:3000`
- API server:  `http://localhost:3002`

The client runs in **mock mode** by default — all AI responses are instant SVG placeholders and there are no real API calls. To connect to the real server, add `VITE_MOCK=false` to your `.env` file. You can then use either OpenAI or a local model (see below).

### Development with a local model — realistic AI, no API key

Run Ollama in Docker alongside the app. The server uses it for vision analysis; image generation falls back to SVG sprites unless you also configure Stable Diffusion. The recommended model is `gemma4:12b` — it supports multimodal vision input and fits comfortably in 12 GB VRAM (e.g. RTX 5070).

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

When a child uploads a drawing, Ollama analyses it and describes the character. Generated sprites are distinctive SVG illustrations colour-coded by character type (dragon → red, robot → blue, etc.).

**GPU acceleration** — the Ollama container uses NVIDIA GPU passthrough automatically when `nvidia-container-toolkit` is installed on the host. Without it Ollama falls back to CPU (still works, noticeably slower). Install guide: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

**Adding real image generation** — run [Automatic1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) with `--api`, then add `LOCAL_SD_URL=http://host.docker.internal:7860` to `.env`. The server will use Stable Diffusion instead of SVG sprites.

**Other local-model servers** — llama.cpp server, LM Studio, and cloud alternatives like Together.ai or Groq all expose an OpenAI-compatible API. Point `LOCAL_BASE_URL` at any of them. For image generation on Together.ai, also set `LOCAL_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell`.

### Acceptance — Docker on your laptop, real OpenAI key

```bash
# 1. Copy the template and fill in your key
cp .env.acceptance .env
#    open .env and set OPENAI_API_KEY=sk-...

# 2. Build and start
docker compose up --build -d

# 3. Open in a browser
open http://localhost:3000
```

**Acceptance with a local model** — no OpenAI key needed, Ollama runs in Docker:

```bash
cp .env.local-ai .env
docker compose --profile local-ai up --build -d
docker compose exec ollama ollama pull gemma4:12b
```

`LOCAL_BASE_URL` in `.env.local-ai` already points to `http://ollama:11434/v1` (the Docker service name), so no further changes are needed.

To update after a `git pull`:

```bash
docker compose up --build -d
```

Docker handles everything — SQLite database and uploaded files are stored in named volumes (`db_data` and `uploads`) that survive container restarts.

To stop:

```bash
docker compose down
```

To stop and wipe all data (full reset):

```bash
docker compose down -v
```

### Production — same Docker setup on your hosting provider

Use the same `docker-compose.yml`. Create a `.env` file on the server with your production keys. If you need HTTPS, put the hoster's reverse proxy (Caddy, nginx, Traefik) in front of port 3000 — nothing inside the app changes.

## Environment variables

See `.env.example` for a full reference with comments. Templates:

| File | Use for |
|---|---|
| `.env.acceptance` | Docker on laptop with OpenAI key |
| `.env.local-ai` | Local model (Ollama / llama.cpp / any OAI-compatible) |

Key variables:

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `openai` | `openai` \| `local` \| `gemini` — also updates the demo session on startup |
| `OPENAI_API_KEY` | — | Required when `AI_PROVIDER=openai` |
| `LOCAL_BASE_URL` | `http://localhost:11434/v1` | Chat/vision endpoint (Ollama, llama.cpp, LM Studio, …) |
| `LOCAL_API_KEY` | `ollama` | API key for the local endpoint (often a dummy value) |
| `LOCAL_CHAT_MODEL` | `gemma4:12b` | Vision-capable model to use |
| `LOCAL_IMAGE_MODEL` | — | If set, use this model for image generation via the same endpoint |
| `LOCAL_SD_URL` | — | If set, use Automatic1111-compatible API for image generation |
| `SESSION_PORT` | `3000` | Host port for the session app container |
| `PORT` | `3002` | API server port |
| `DB_PATH` | `./data/kidsproject.db` | SQLite database file |
| `UPLOAD_DIR` | `./uploads` | Where drawings and generated sprites are stored |

## AI providers

| Provider | Set `AI_PROVIDER=` | Vision | Image generation |
|---|---|---|---|
| OpenAI | `openai` | GPT-4o | DALL-E 3 |
| Local (Ollama, llama.cpp, …) | `local` | any vision model | SVG sprites, or SD via `LOCAL_SD_URL`, or OAI-compatible via `LOCAL_IMAGE_MODEL` |
| Gemini | `gemini` | — | not yet implemented |

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vite + vanilla TypeScript (no framework — games must run without a build step) |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| File storage | Local disk (Docker volume) — S3 swap is on the roadmap |
| AI provider | Pluggable — OpenAI, local (Ollama / llama.cpp / any OAI-compatible), Gemini stub |
| Container serving | nginx:alpine |

## API overview

The server runs on port 3002. All paths are under `/api/`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sessions/:id` | Load session config |
| `POST` | `/api/sessions` | Create a session (facilitator) |
| `POST` | `/api/sessions/:id/children` | Register a child, returns `childId` |
| `POST` | `/api/sessions/publish` | Publish a game to the gallery |
| `GET` | `/api/sessions/:id/gallery` | All published games in a session |
| `POST` | `/api/uploads/drawing` | Upload a photo (drawing or background) |
| `POST` | `/api/ai/sprites` | Generate a sprite pack from a drawing |
| `POST` | `/api/moderation/check` | Check free text before sending to AI |

A demo session with `id: demo` is seeded automatically on first run.

## Roadmap

- Jumper game type (spacebar controls)
- Memory card group game
- Admin dashboard for facilitators (create sessions, live view of all children's prompts)
- Voice input for children who cannot read or type
- Children recording their own sound effects
- Gemini AI provider (OpenAI is fully implemented; Gemini is a stub)
- S3-compatible file storage for production scale
- Multi-provider comparison dashboard
