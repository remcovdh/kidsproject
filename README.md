# Kids AI Workshop

A guided web application where children aged 6–12 use AI to turn their own paper drawings into playable browser games. Runs in supervised workshop sessions of up to 20 kids, roughly 90 minutes each.

## What children learn

Every child walks away understanding three things about AI:

1. **You are the director** — AI does what you describe, not what you imagine. Words matter.
2. **AI makes mistakes** — that's okay. You can describe it differently and try again.
3. **AI learned from humans** — it's a very good guesser.

These ideas are woven into the flow of the app rather than taught as a lesson. The child experiences them directly — when their sprite looks nothing like what they pictured, they immediately understand both lessons without being told.

## How a session works

A facilitator creates a session in advance, setting the AI provider and whether the prompt text is shown to children (useful to adapt for reading ability). Children join on their own device or a shared tablet:

1. Enter their name
2. Pick a game type — only **Catcher** is available now; more are on the roadmap
3. Draw a character on paper and photograph it
4. Optionally draw a background scene
5. Answer a few structured questions about the character (what is it, how does it move, how does it feel)
6. Watch the AI generate a sprite pack — idle, moving, action, and celebrate poses
7. Play an instant preview of their game
8. Optionally assign sounds and peek at the game code
9. Publish to the session gallery so everyone can play each other's games

The moment a child gets their sprite back and it looks different from what they imagined is the moment the learning happens. Surprise is the pedagogy.

## Design principles

**Visual-first** — all interactions work without reading. Icons, large tap targets, and images carry the interface; text is supplementary. This makes it work for the full 6–12 age range.

**Games run standalone** — the game templates are plain HTML/CSS/JS with no server dependency. After the session, a child can take a zip of their game folder home and open it with `file://` in any browser.

**Pluggable AI** — the AI provider is set per session. A facilitator can run one session with OpenAI and another with a local model, or switch mid-project without touching code.

**Light moderation** — a word filter on free-text inputs, all prompts logged, and a live facilitator dashboard showing every child's current prompt in real time.

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
└── CLAUDE.md           # Full technical spec and design decisions
```

## Roadmap

- Jumper game type (spacebar controls)
- Memory card group game (collaborative, whole-class activity)
- Admin dashboard for facilitators (create sessions, live view of all children's prompts)
- Voice input for children who cannot read or type
- Children recording their own sound effects
- Gemini AI provider (OpenAI and local are fully implemented; Gemini is a stub)
- S3-compatible file storage for production scale
- Multi-provider AI comparison dashboard

---

For running and deploying the project, see [DEVELOPMENT.md](DEVELOPMENT.md).
