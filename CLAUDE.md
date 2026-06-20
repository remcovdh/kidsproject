# Kids AI Workshop

A hosted, guided web app where children (ages 6–12) use AI to turn their drawings into simple browser games. Runs in supervised sessions of max 20 kids, ~90 minutes each.

## Project goals

Three AI concepts every child should walk away with:
1. **You are the director** — AI does what you describe, not what you think
2. **AI makes mistakes** — and that's okay, you can try again
3. **AI learned from humans** — it's a very good guesser, not alive

## Architecture overview

```
kidsproject/
├── apps/
│   ├── admin/          # Facilitator: create sessions, teacher dashboard
│   ├── session/        # Child-facing: guided step-by-step workshop flow
│   └── games/          # Standalone game templates (run at home, no server)
├── packages/
│   ├── ai/             # Pluggable AI provider abstraction (OpenAI, Gemini, etc.)
│   ├── assets/         # Pre-made sound library, UI icons
│   └── shared/         # Types, utilities shared across apps
├── server/             # API: sessions, uploads, AI proxy, moderation
└── CLAUDE.md
```

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Vite + vanilla TypeScript | No framework overhead, games must run standalone |
| Backend | Node.js + Express | Simple, fast to iterate |
| Database | SQLite (via better-sqlite3) | Zero-config for MVP, easy to inspect |
| File storage | Local disk for MVP | Simple; swap to S3-compatible later |
| AI images | Pluggable — see `packages/ai/` | Provider swappable per session config |
| Styling | CSS custom properties + BEM | Visual-first UI, no build-time CSS dependency |

## Key design decisions

**Visual-first UI** — all interactions must work without reading for younger kids. Use icons, images, and large tap targets. Text is supplementary.

**Pluggable AI provider** — `packages/ai/` exposes a single `generateSprites(prompt, image)` interface. Concrete implementations: OpenAI (GPT-4o), Google (Gemini). Provider is set per session in config.

**Prompt visibility is session-configurable** — facilitator sets `showPrompt: true/false` when creating a session, based on reading ability of the group.

**Full version history** — every AI generation creates a named snapshot automatically. Labels are auto-generated plain-language descriptions. History is shown as visual thumbnails, never a text list.

**Games run standalone** — the game templates in `apps/games/` are plain HTML+CSS+JS with no server dependency. After the session, a child gets a zip of their game folder to run at home.

**Moderation is light** — word filter on free-text inputs, all prompts logged, live teacher dashboard shows every child's current prompt in real time.

## Session flow (MVP — Catcher game only)

1. Child enters name on session welcome screen
2. Picks game type (Catcher, with playable demo)
3. Draws on paper → photographs → uploads via phone
4. Answers 2–3 structured prompts describing their character
5. System builds AI prompt → shows it (if session config allows) → sends
6. AI generates sprite pack → child watches progress → sees result
7. Instant game preview with their character
8. Optional: customize (sound assignment, light code peek)
9. Publishes to session gallery → plays other kids' games

## Backlog (not in MVP)

- Jumper game type (spacebar controls)
- Memory card group game (drawing + name pairs as default)
- Other facilitators can create sessions (admin-only for now)
- Voice interaction and voice prompting
- Kids recording their own sounds
- Multi-provider AI comparison and cost dashboard
- Tablet/webcam drawing input
- Memory card variants: prompt pairs, sprite pairs

## Running locally

```bash
npm install
npm run dev
```

Starts:
- `http://localhost:3000` — session app (child-facing)
- `http://localhost:3001` — admin app (facilitator)
- `http://localhost:3002` — API server

## Environment variables

```
AI_PROVIDER=openai          # openai | gemini
OPENAI_API_KEY=...
GEMINI_API_KEY=...
SESSION_SECRET=...
UPLOAD_DIR=./uploads
```

## Code conventions

- No frameworks in `apps/games/` — pure HTML/CSS/JS, must open with `file://`
- TypeScript everywhere else
- No comments unless the why is non-obvious
- Visual components get a matching `*.css` file, not inline styles
- All AI calls go through `packages/ai/` — never call provider SDKs directly from apps
