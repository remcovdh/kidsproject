import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import type {
  ServerAiProvider, SpriteBuffers, SpriteFile,
  SpriteGenerationResult, SpriteGenerationChoice,
  BackgroundGenerationResult, BackgroundGenerationChoice,
} from "./index.js";

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

const SHEET_LAYOUT_INSTRUCTIONS =
  `a 2x2 grid of exactly 4 equal invisible regions, each ${PANEL_W}x${PANEL_H}, filling the ` +
  `ENTIRE image (top-left, top-right, bottom-left, bottom-right). ` +
  `IMPORTANT — do NOT draw any dividing lines, borders, frames, panel outlines, or gutters ` +
  `anywhere in the image — the grid is an invisible layout guide only, the final image must ` +
  `look like plain artwork with nothing separating the regions. ` +
  `In each of the 4 regions, draw the character FULL BODY from head to feet, entirely inside ` +
  `that region with a clear margin of empty space on every side — the head, hands, and feet ` +
  `must NOT touch or cross the edge of the region. Nothing may be cropped or cut off. `;

function poseRegions(): string {
  return (
    `TOP-LEFT region: ${POSE_PROMPTS.idle}. ` +
    `TOP-RIGHT region: ${POSE_PROMPTS.move}. ` +
    `BOTTOM-LEFT region: ${POSE_PROMPTS.moveLeft}. ` +
    `BOTTOM-RIGHT region: ${POSE_PROMPTS.celebrate}. `
  );
}

// Crop a generated/edited 2x2 sheet buffer into the 4 separate pose files.
async function cropSheet(sheetBuffer: Buffer): Promise<Array<readonly [SheetPose, SpriteFile]>> {
  return Promise.all(SHEET_LAYOUT.map(async ({ pose, col, row }) => {
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
}

function buildSprites(poseEntries: Array<readonly [SheetPose, SpriteFile]>, collectible: SpriteFile, sheet: SpriteFile): SpriteBuffers {
  return { ...Object.fromEntries(poseEntries), collectible, sheet } as unknown as SpriteBuffers;
}

const provider: ServerAiProvider = {
  async generateSprites(description: string, drawingBase64: string, styleMode?: "shape" | "copy", artStyle?: string): Promise<SpriteGenerationChoice> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Analyze the drawing — focus varies by mode. This feeds the TEXT-only variant, which
    // never sees the actual photo, only this derived description.
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

    // Two candidate sheets, generated two different ways, run in parallel alongside the
    // collectible (which has no pose/fidelity requirement, so it's shared by both candidates
    // rather than generated twice):
    //  - TEXT: pure text-to-image from the vision-derived description above. Never sees the
    //    actual photo, so likeness depends entirely on how well that description captures it.
    //  - IMAGE: image-to-image — the actual photo is passed to the model directly as a
    //    reference (via images.edit), which should track the drawing's real shape/colors more
    //    closely than a text description can, at the cost of less predictable pose compliance.
    // The child picks whichever result they actually prefer; see routes/ai.ts's /sprites/choose.
    const textSheetPrompt =
      `2D video game character sprite sheet, ${SHEET_LAYOUT_INSTRUCTIONS}` +
      `CHARACTER (keep IDENTICAL across all 4 regions — same shape, colors, face, and design): ${characterSheet}. ` +
      `STYLE: ${styleInstruction} ` +
      poseRegions() +
      `Transparent background, no text, no watermark, no numbers or labels, PNG.`;

    const imageSheetPrompt =
      `Using the attached photo of a child's drawing as direct visual reference, create a 2D ` +
      `video game character sprite sheet of that exact character — keep it clearly recognizable ` +
      `as the same character shown in the photo (same shape, colors, and distinctive features). ` +
      SHEET_LAYOUT_INSTRUCTIONS +
      `The child calls this character: "${description}". ` +
      `STYLE: ${styleInstruction} ` +
      poseRegions() +
      `Transparent background, no text, no watermark, no numbers or labels, PNG.`;

    const [textSheetBuffer, imageSheetBuffer, collectibleFile] = await Promise.all([
      (async () => {
        const response = await client.images.generate({
          model: "gpt-image-1", prompt: textSheetPrompt,
          size: "1024x1536", quality: "high", background: "transparent", n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned for text-based sprite sheet");
        return Buffer.from(b64, "base64");
      })(),

      (async () => {
        const response = await client.images.edit({
          model: "gpt-image-1", prompt: imageSheetPrompt,
          image: await toFile(Buffer.from(drawingBase64, "base64"), "drawing.jpg", { type: "image/jpeg" }),
          size: "1024x1536", quality: "high", background: "transparent", n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned for image-to-image sprite sheet");
        return Buffer.from(b64, "base64");
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

    const [textPoseEntries, imagePoseEntries] = await Promise.all([
      cropSheet(textSheetBuffer),
      cropSheet(imageSheetBuffer),
    ]);

    const textResult: SpriteGenerationResult = {
      sprites: buildSprites(textPoseEntries, collectibleFile, { data: textSheetBuffer, ext: "png" }),
      prompt: textSheetPrompt,
    };
    const imageResult: SpriteGenerationResult = {
      sprites: buildSprites(imagePoseEntries, collectibleFile, { data: imageSheetBuffer, ext: "png" }),
      prompt: imageSheetPrompt,
    };

    return { text: textResult, image: imageResult };
  },

  async generateBackground(description: string, imageBase64: string, styleMode: "shape" | "copy", artStyle?: string): Promise<BackgroundGenerationChoice> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Vision analysis of the teacher-captured world photo — feeds the TEXT-only variant.
    const visionPrompt = styleMode === "copy"
      ? `A child drew this and photographed it to use as their video game's background/world. Write a short SCENE SHEET: describe the exact colors, shapes, and layout so an illustrator could recreate it identically — including the rough childlike style and coloring.${description ? ` The child also described it as: "${description}".` : ""}`
      : `A child drew this and photographed it to use as their video game's background/world. Describe the SCENE and LAYOUT only: setting, key shapes/elements, composition (e.g. sky/ground split). Do NOT mention colors or art style — focus on what's depicted so an illustrator could recreate the scene.${description ? ` The child also described it as: "${description}".` : ""}`;

    let sceneDescription = description || "a colorful game world";
    try {
      const analysis = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 150,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: visionPrompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
          ],
        }],
      });
      sceneDescription = analysis.choices[0]?.message?.content ?? sceneDescription;
    } catch (err) {
      console.warn("GPT-4o Vision analysis for background failed:", err);
    }

    const styleInstruction = styleMode === "copy"
      ? "Preserve the EXACT childlike art style, rough hand-drawn quality, and original colors from the drawing. Do not clean up or professionalize the look — keep it looking like the child's own style."
      : `Render as a clean ${artStyle ?? "cartoon"} game background. Use the scene's layout and distinctive features from the drawing, but apply a fresh ${artStyle ?? "cartoon"} art style with bold outlines and bright colors. Do NOT copy the drawing's coloring or rough style.`;

    // The child's chosen theme (e.g. "Ocean") must be stated directly here, not just handed to
    // the vision-analysis step as a hint — if the photo itself doesn't read as that theme, the
    // vision description can end up not mentioning it at all, silently dropping the child's
    // actual choice from the final image prompt.
    const themeClause = description
      ? `WORLD THEME (this must clearly come through in the final image, even if the photo below doesn't obviously show it): ${description}. `
      : "";

    // TEXT: pure text-to-image from the vision-derived scene description — never sees the
    // actual photo. IMAGE: image-to-image — the photo is passed to the model directly and
    // edited/restyled in place, which should track the original composition more closely.
    const textPrompt =
      `A tall portrait-orientation background for a children's video game (taller than wide, like a phone screen). ` +
      themeClause +
      `SCENE DETAILS from the child's own drawing/photo: ${sceneDescription}. ` +
      `STYLE: ${styleInstruction} ` +
      `Sky fills the top, ground or scenery at the bottom. No characters, no text, just the scenery.`;

    const imagePrompt =
      `Using the attached photo as the starting point, transform it into a tall portrait-orientation ` +
      `background for a children's video game (taller than wide, like a phone screen). Keep the same ` +
      `overall scene and composition as the photo — this should read as a stylized version of the same ` +
      `place, not a different one. ` +
      themeClause +
      `STYLE: ${styleInstruction} ` +
      `Sky fills the top, ground or scenery at the bottom. No characters, no text, just the scenery.`;

    const [textResponse, imageResponse] = await Promise.all([
      client.images.generate({
        model: "gpt-image-1", prompt: textPrompt, size: "1024x1536", quality: "medium", n: 1,
      }),
      client.images.edit({
        model: "gpt-image-1", prompt: imagePrompt,
        image: await toFile(Buffer.from(imageBase64, "base64"), "world.jpg", { type: "image/jpeg" }),
        size: "1024x1536", quality: "medium", n: 1,
      }),
    ]);

    const textB64 = textResponse.data?.[0]?.b64_json;
    if (!textB64) throw new Error("No image data returned for text-based background");
    const imageB64 = imageResponse.data?.[0]?.b64_json;
    if (!imageB64) throw new Error("No image data returned for image-to-image background");

    return {
      text:  { file: { data: Buffer.from(textB64, "base64"),  ext: "png" }, prompt: textPrompt },
      image: { file: { data: Buffer.from(imageB64, "base64"), ext: "png" }, prompt: imagePrompt },
    };
  },
};

export default provider;
