/**
 * Local / self-hosted AI provider.
 *
 * Vision analysis:  any OpenAI-compatible chat endpoint (Ollama, llama.cpp,
 *                   LM Studio, Together.ai, …)
 * Image generation: choose ONE of:
 *   A) LOCAL_IMAGE_MODEL — same chat endpoint also supports /images/generations
 *      (e.g. Together.ai with FLUX, or a local server that wraps SD)
 *   B) LOCAL_SD_URL — Automatic1111 / AUTOMATIC1111-compatible REST API
 *      (e.g. http://localhost:7860)
 *   C) neither set → generates SVG placeholder sprites that are
 *      color-coded and pose-distinct; good enough for dev flow testing
 *
 * Relevant env vars (all optional, sensible defaults shown):
 *   LOCAL_BASE_URL      http://localhost:11434/v1   Ollama default
 *   LOCAL_API_KEY       ollama                      dummy key Ollama needs
 *   LOCAL_CHAT_MODEL    llama3.2-vision             vision-capable model
 *   LOCAL_IMAGE_MODEL                               set to use OAI images API
 *   LOCAL_SD_URL                                    set to use A1111 SD API
 */

import OpenAI from "openai";
import type { ServerAiProvider, SpriteBuffers, SpriteFile } from "./index.js";

// ── SVG sprite generator ──────────────────────────────────────────────────────
// Produces a simple but distinct cartoon character for each pose.
// Color is derived from the AI-generated description so the same character
// always gets the same color family across retries.

const COLOR_KEYWORDS: Array<[string, string, string]> = [
  // [keyword, fill, shadow]
  ["dragon",  "#E74C3C", "#C0392B"],
  ["robot",   "#5DADE2", "#2980B9"],
  ["monster", "#A569BD", "#8E44AD"],
  ["wizard",  "#7D3C98", "#6C3483"],
  ["hero",    "#2471A3", "#1A5276"],
  ["cat",     "#F0B27A", "#E67E22"],
  ["dog",     "#52BE80", "#27AE60"],
  ["bird",    "#F1948A", "#C0392B"],
  ["fish",    "#48C9B0", "#17A589"],
  ["star",    "#F4D03F", "#D4AC0D"],
];

function pickColor(desc: string): [string, string] {
  const lower = desc.toLowerCase();
  for (const [kw, fill, shadow] of COLOR_KEYWORDS) {
    if (lower.includes(kw)) return [fill, shadow];
  }
  // Consistent hash → hue so the same description always picks the same color
  let h = 5381;
  for (let i = 0; i < desc.length; i++) h = (Math.imul(h, 31) + desc.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return [`hsl(${hue},65%,55%)`, `hsl(${hue},65%,38%)`];
}

// Per-pose geometry: body-center Y, head-center Y, arm endpoints, leg endpoints, smile path
type Pose = { by: number; hy: number; al: number[]; ar: number[]; ll: number[]; lr: number[]; sm: string };
const POSES: Record<keyof SpriteBuffers, Pose> = {
  idle: {
    by: 128, hy: 72,
    al: [62, 122, 36, 148],  ar: [138, 122, 164, 148],
    ll: [86, 172, 74, 196],  lr: [114, 172, 126, 196],
    sm: "M 88,84 Q 100,96 112,84",
  },
  move: {
    by: 122, hy: 66,
    al: [60, 114, 30, 90],   ar: [140, 114, 168, 136],
    ll: [86, 166, 62, 192],  lr: [114, 166, 140, 190],
    sm: "M 88,78 Q 100,90 112,78",
  },
  action: {
    by: 115, hy: 59,
    al: [60, 107, 28, 76],   ar: [140, 107, 172, 76],
    ll: [86, 159, 60, 184],  lr: [114, 159, 140, 184],
    sm: "M 86,71 Q 100,86 114,71",
  },
  celebrate: {
    by: 125, hy: 69,
    al: [60, 116, 30, 76],   ar: [140, 116, 170, 76],
    ll: [86, 169, 72, 194],  lr: [114, 169, 128, 194],
    sm: "M 84,82 Q 100,102 116,82",
  },
};

function svgSprite(description: string, pose: keyof SpriteBuffers): SpriteFile {
  const [fill, dark] = pickColor(description);
  const p = POSES[pose];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="white"/>
  <line x1="${p.al[0]}" y1="${p.al[1]}" x2="${p.al[2]}" y2="${p.al[3]}" stroke="${dark}" stroke-width="9" stroke-linecap="round"/>
  <line x1="${p.ar[0]}" y1="${p.ar[1]}" x2="${p.ar[2]}" y2="${p.ar[3]}" stroke="${dark}" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="100" cy="${p.by}" rx="42" ry="50" fill="${fill}" stroke="${dark}" stroke-width="3"/>
  <circle cx="100" cy="${p.hy}" r="30" fill="${fill}" stroke="${dark}" stroke-width="3"/>
  <ellipse cx="89"  cy="${p.hy - 4}" rx="7" ry="8" fill="white"/>
  <ellipse cx="111" cy="${p.hy - 4}" rx="7" ry="8" fill="white"/>
  <circle cx="90"  cy="${p.hy - 3}" r="4" fill="#111"/>
  <circle cx="112" cy="${p.hy - 3}" r="4" fill="#111"/>
  <circle cx="91"  cy="${p.hy - 5}" r="1.5" fill="white"/>
  <circle cx="113" cy="${p.hy - 5}" r="1.5" fill="white"/>
  <path d="${p.sm}" stroke="${dark}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <line x1="${p.ll[0]}" y1="${p.ll[1]}" x2="${p.ll[2]}" y2="${p.ll[3]}" stroke="${dark}" stroke-width="12" stroke-linecap="round"/>
  <line x1="${p.lr[0]}" y1="${p.lr[1]}" x2="${p.lr[2]}" y2="${p.lr[3]}" stroke="${dark}" stroke-width="12" stroke-linecap="round"/>
</svg>`;
  return { data: Buffer.from(svg), ext: "svg" };
}

// ── Stable Diffusion via Automatic1111 REST API ───────────────────────────────

const SD_POSE_PROMPTS: Record<keyof SpriteBuffers, string> = {
  idle:      "standing still, relaxed, neutral pose, arms at sides",
  move:      "running, motion, dynamic, sideways",
  action:    "jumping, arms outstretched, action pose",
  celebrate: "celebrating, arms raised in victory, happy",
};

async function generateViaSD(characterDesc: string, pose: keyof SpriteBuffers): Promise<SpriteFile> {
  const sdUrl = process.env.LOCAL_SD_URL!.replace(/\/$/, "");
  const body  = {
    prompt: `game character sprite, ${characterDesc}, ${SD_POSE_PROMPTS[pose]}, simple 2d cartoon, white background, centered, no text, no watermark`,
    negative_prompt: "text, watermark, signature, complex background, realistic, photographic",
    width: 512, height: 512, steps: 20, cfg_scale: 7,
  };
  const res = await fetch(`${sdUrl}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Stable Diffusion API error ${res.status}: ${await res.text()}`);
  const json = await res.json() as { images?: string[] };
  if (!json.images?.[0]) throw new Error("Stable Diffusion returned no images");
  return { data: Buffer.from(json.images[0], "base64"), ext: "png" };
}

// ── Provider ──────────────────────────────────────────────────────────────────

const VISION_POSE_PROMPTS: Record<keyof SpriteBuffers, string> = {
  idle:      "standing still, relaxed, neutral upright pose",
  move:      "running or sliding sideways, dynamic movement",
  action:    "jumping or attacking, exciting action pose",
  celebrate: "cheering with arms raised, joyful celebration",
};

const provider: ServerAiProvider = {
  async generateSprites(description: string, drawingBase64: string): Promise<SpriteBuffers> {
    const baseURL    = process.env.LOCAL_BASE_URL   ?? "http://localhost:11434/v1";
    const apiKey     = process.env.LOCAL_API_KEY    ?? "ollama";
    const chatModel  = process.env.LOCAL_CHAT_MODEL ?? "llama3.2-vision";
    const imageModel = process.env.LOCAL_IMAGE_MODEL ?? "";
    const useSD      = !!process.env.LOCAL_SD_URL;
    const useImgApi  = !!imageModel;

    const client = new OpenAI({ baseURL, apiKey });

    // Step 1: vision analysis — describe the drawing with a local model
    let characterDesc = description;
    if (drawingBase64) {
      try {
        const res = await client.chat.completions.create({
          model: chatModel,
          max_tokens: 120,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: `A child drew this game character. Describe it in 2 sentences — colors, shape, key features. The child calls it: "${description}".` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${drawingBase64}` } },
            ],
          }],
        });
        characterDesc = res.choices[0]?.message?.content ?? description;
        console.log(`[local] Vision analysis (${chatModel}): ${characterDesc.slice(0, 80)}…`);
      } catch (err) {
        console.warn(`[local] Vision analysis failed (${chatModel}), using text description:`, (err as Error).message);
      }
    }

    // Step 2: image generation — pick the best available backend
    if (!useSD && !useImgApi) {
      console.log("[local] No image generation endpoint configured — using SVG sprites.");
    }

    const entries = await Promise.all(
      (Object.keys(VISION_POSE_PROMPTS) as (keyof SpriteBuffers)[]).map(async (pose) => {
        let sprite: SpriteFile;

        if (useSD) {
          sprite = await generateViaSD(characterDesc, pose);
        } else if (useImgApi) {
          const prompt =
            `Simple 2D game character sprite. ${characterDesc}. ` +
            `Pose: ${VISION_POSE_PROMPTS[pose]}. ` +
            `Childlike art, bold outlines, bright colors, white background, centered, no text.`;
          const resp = await client.images.generate({ model: imageModel, prompt, size: "1024x1024", n: 1 });
          const url  = resp.data?.[0]?.url;
          if (!url) throw new Error(`No image URL returned for pose: ${pose}`);
          const imgBuf = await fetch(url).then(r => r.arrayBuffer());
          sprite = { data: Buffer.from(imgBuf), ext: "png" };
        } else {
          sprite = svgSprite(characterDesc, pose);
        }

        return [pose, sprite] as const;
      })
    );

    return Object.fromEntries(entries) as unknown as SpriteBuffers;
  },
};

export default provider;
