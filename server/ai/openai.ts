import OpenAI from "openai";
import sharp from "sharp";
import type { ServerAiProvider, SpriteBuffers, SpriteFile } from "./index.js";

type SheetPose = "idle" | "move" | "moveLeft" | "celebrate";

const POSE_PROMPTS: Record<SheetPose, string> = {
  idle:      "standing still, relaxed, neutral upright pose, arms at sides",
  move:      "running, dynamic mid-stride running motion, clearly facing and moving toward the RIGHT side of the image",
  moveLeft:  "running, dynamic mid-stride running motion, clearly facing and moving toward the LEFT side of the image — a mirror image of a rightward run, not the same pose reused",
  celebrate: "cheering with both arms raised in victory, mouth open in a big smile",
};

// 2x2 grid layout — quadrant (col, row) for each pose, using the FULL image height per
// panel (not just a top strip) so there's enough vertical room for a full-body pose.
const SHEET_LAYOUT: Array<{ pose: SheetPose; col: 0 | 1; row: 0 | 1 }> = [
  { pose: "idle",      col: 0, row: 0 },
  { pose: "move",      col: 1, row: 0 },
  { pose: "moveLeft",  col: 0, row: 1 },
  { pose: "celebrate", col: 1, row: 1 },
];
const PANEL_W = 512;
const PANEL_H = 768;
// Crop a few px inside each panel's nominal boundary — defensive against any stray
// edge/border pixels landing right at the boundary line.
const CROP_INSET = 6;

const provider: ServerAiProvider = {
  async generateSprites(description: string, drawingBase64: string, styleMode?: "shape" | "copy", artStyle?: string): Promise<SpriteBuffers> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Analyze the drawing — focus varies by mode
    let characterSheet = description;
    if (drawingBase64) {
      const visionPrompt = styleMode === "copy"
        ? `A child drew this game character. Write a short CHARACTER SHEET: list the exact colors, body shape, face features, and any distinctive details (wings, hat, tail, etc.). Be specific so an illustrator could recreate it identically — including the rough childlike style and coloring. The child calls it: "${description}".`
        : `A child drew this game character. Describe its SHAPE and STRUCTURE only: body proportions, silhouette, number of limbs, and distinctive physical features (wings, hat, tail, ears, horns, etc.). Do NOT mention colors or art style — focus purely on shape so an illustrator could recreate the form. The child calls it: "${description}".`;
      try {
        const analysis = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${drawingBase64}`, detail: "low" } },
            ],
          }],
        });
        characterSheet = analysis.choices[0]?.message?.content ?? description;
      } catch (err) {
        console.warn("GPT-4o Vision analysis failed, using text description:", err);
      }
    }

    const styleInstruction = styleMode === "copy"
      ? "Preserve the EXACT childlike art style, rough hand-drawn quality, and original colors from the drawing. Do not clean up or professionalize the look — keep it looking like the child's own style."
      : `Render as a clean ${artStyle ?? "cartoon"} game sprite. Use the character's SHAPE and distinctive features from the drawing, but apply a fresh ${artStyle ?? "cartoon"} art style with bold outlines and bright colors. Do NOT copy the drawing's coloring or rough style.`;

    // Generate all 4 character poses as ONE sprite-sheet image (instead of independent calls)
    // so they stay visually consistent with each other — same colors, shape, proportions —
    // then crop the sheet into separate sprite files. Both left- and right-running poses are
    // generated explicitly (not mirrored client-side) since a text prompt asking for a single
    // "facing right" running pose isn't a reliable enough constraint for gpt-image-1 to honor
    // consistently, and a wrong-direction sprite is very noticeable in gameplay. The collectible
    // has no pose-consistency requirement, so it stays a separate call, run in parallel.
    const sheetPrompt =
      `2D video game character sprite sheet, a 2x2 grid of exactly 4 equal invisible regions, ` +
      `each ${PANEL_W}x${PANEL_H}, filling the ENTIRE image (top-left, top-right, bottom-left, ` +
      `bottom-right). ` +
      `IMPORTANT — do NOT draw any dividing lines, borders, frames, panel outlines, or gutters ` +
      `anywhere in the image — the grid is an invisible layout guide only, the final image must ` +
      `look like plain artwork with nothing separating the regions. ` +
      `In each of the 4 regions, draw the character FULL BODY from head to feet, entirely inside ` +
      `that region with a clear margin of empty space on every side — the head, hands, and feet ` +
      `must NOT touch or cross the edge of the region. Nothing may be cropped or cut off. ` +
      `CHARACTER (keep IDENTICAL across all 4 regions — same shape, colors, face, and design): ${characterSheet}. ` +
      `STYLE: ${styleInstruction} ` +
      `TOP-LEFT region: ${POSE_PROMPTS.idle}. ` +
      `TOP-RIGHT region: ${POSE_PROMPTS.move}. ` +
      `BOTTOM-LEFT region: ${POSE_PROMPTS.moveLeft}. ` +
      `BOTTOM-RIGHT region: ${POSE_PROMPTS.celebrate}. ` +
      `Transparent background, no text, no watermark, no numbers or labels, PNG.`;

    const [sheetResult, collectibleFile] = await Promise.all([
      (async () => {
        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt: sheetPrompt,
          size: "1024x1536",
          quality: "high",
          background: "transparent",
          n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned for sprite sheet");
        const sheetBuffer = Buffer.from(b64, "base64");

        const poseEntries = await Promise.all(SHEET_LAYOUT.map(async ({ pose, col, row }) => {
          const cropped = await sharp(sheetBuffer)
            .extract({
              left: col * PANEL_W + CROP_INSET,
              top: row * PANEL_H + CROP_INSET,
              width: PANEL_W - CROP_INSET * 2,
              height: PANEL_H - CROP_INSET * 2,
            })
            .png()
            .toBuffer();
          return [pose, { data: cropped, ext: "png" }] as const;
        }));

        // Keep the raw, uncropped sheet alongside the cropped poses (saved as sheet.png by the
        // generic save loop in routes/ai.ts) so generation problems — bad crops, panel bleed,
        // stray borders — can be diagnosed by comparing it against the final cropped sprites.
        return { poseEntries, sheet: { data: sheetBuffer, ext: "png" as const } };
      })(),

      (async (): Promise<SpriteFile> => {
        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt:
            `A single small collectible item for a children's video game. ` +
            `It should be something that thematically matches this character: ${characterSheet}. ` +
            `Examples: a glowing gem, a golden star, a treat, a magical orb. ` +
            `Simple 2D, bright cheerful colors, transparent background, centered, no text, PNG.`,
          size: "1024x1024",
          quality: "medium",
          background: "transparent",
          n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned for collectible");
        return { data: Buffer.from(b64, "base64"), ext: "png" };
      })(),
    ]);

    return {
      ...Object.fromEntries(sheetResult.poseEntries),
      collectible: collectibleFile,
      sheet: sheetResult.sheet,
    } as unknown as SpriteBuffers;
  },

  async generateBackground(description: string, imageBase64?: string, styleDescription?: string): Promise<SpriteFile> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let sceneDescription = description;

    if (imageBase64) {
      try {
        const analysis = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 120,
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `A child drew this and wants to use it as inspiration for a video game background. Describe the scene in 1-2 sentences for an illustrator — focus on setting, mood, and colors.${description ? ` The child also described it as: "${description}".` : ""}`,
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
              },
            ],
          }],
        });
        sceneDescription = analysis.choices[0]?.message?.content ?? description;
      } catch (err) {
        console.warn("GPT-4o Vision analysis for background failed:", err);
      }
    }

    const styleClause = styleDescription
      ? ` Art style should match this character: ${styleDescription}.`
      : "";

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt:
        `A tall portrait-orientation background for a children's video game (taller than wide, like a phone screen). Scene: ${sceneDescription}.${styleClause} ` +
        `Sky fills the top half, ground or scenery at the bottom. Colorful, cheerful, childlike art style. ` +
        `No characters, no text, just the scenery. Flat 2D illustration style, vibrant colors, bold shapes.`,
      size: "1024x1536",
      quality: "medium",
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned for background");
    return { data: Buffer.from(b64, "base64"), ext: "png" };
  },
};

export default provider;
