const axios = require("axios");
const fs = require("fs");
const config = require("../config");
const log = require("../utils/logger");
const storage = require("../utils/storage");

/**
 * Nano Banana runs on Gemini's image generation API.
 * All sketch, mockup, background removal, and callout generation
 * is powered by Gemini multimodal with the same API key.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Use gemini-2.0-flash-exp for image generation (supports responseModalities IMAGE)
const MODEL = "gemini-2.0-flash-exp";
// Fallback API key in case env var is not set
const API_KEY = config.gemini.key || "AIzaSyDqShQju3JB8EJcZN4Gux7w2iPjZTri41Y";

/**
 * Call Gemini with a text prompt and optional reference image.
 * Returns the generated image as a Buffer, or the text description
 * if image generation isn't available (falls back gracefully).
 */
async function callGemini(prompt, imagePath) {
  const parts = [{ text: prompt }];

  if (imagePath && fs.existsSync(imagePath)) {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString("base64");
    const ext = imagePath.split(".").pop().toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    parts.push({
      inline_data: { mime_type: mime, data: base64 },
    });
  }

  const res = await axios.post(
    `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    },
    { timeout: 120_000 }
  );

  const candidate = res.data.candidates?.[0]?.content?.parts || [];

  // Look for an image part first
  const imagePart = candidate.find((p) => p.inline_data);
  if (imagePart) {
    return {
      type: "image",
      buffer: Buffer.from(imagePart.inline_data.data, "base64"),
      mimeType: imagePart.inline_data.mime_type,
    };
  }

  // Fall back to text
  const textPart = candidate.find((p) => p.text);
  return {
    type: "text",
    text: textPart?.text || "",
  };
}

/**
 * Generate a technical sketch (front or back view).
 */
async function generateSketch({ description, view, inspirationImagePath, sampleId }) {
  log.info("Generating sketch via Gemini (Nano Banana)", { view });

  const prompt = `Generate a black and white technical flat sketch for apparel production, ${view} view. Clean line drawing on white background, no shading, no color. Garment: ${description}`;

  const result = await callGemini(prompt, inspirationImagePath);

  if (result.type === "image") {
    const ext = result.mimeType === "image/png" ? ".png" : ".jpg";
    const filePath = storage.saveFile(result.buffer, `sketch_${view}${ext}`, sampleId);
    log.info("Sketch generated", { view, filePath });
    return filePath;
  }

  // If only text returned, save a placeholder note
  log.warn("Sketch returned text instead of image", { view, text: result.text?.substring(0, 100) });
  const placeholder = Buffer.from(`Sketch ${view}: ${result.text}`);
  const filePath = storage.saveFile(placeholder, `sketch_${view}.txt`, sampleId);
  return filePath;
}

/**
 * Generate a 3D mockup (front or back view).
 */
async function generateMockup({ description, view, inspirationImagePath, sampleId }) {
  log.info("Generating 3D mockup via Gemini (Nano Banana)", { view });

  const prompt = `Generate a realistic 3D garment mockup, ${view} view. Photorealistic fabric rendering on a mannequin or flat lay. Garment: ${description}`;

  const result = await callGemini(prompt, inspirationImagePath);

  if (result.type === "image") {
    const ext = result.mimeType === "image/png" ? ".png" : ".jpg";
    const filePath = storage.saveFile(result.buffer, `mockup_${view}${ext}`, sampleId);
    log.info("Mockup generated", { view, filePath });
    return filePath;
  }

  log.warn("Mockup returned text instead of image", { view });
  const placeholder = Buffer.from(`Mockup ${view}: ${result.text}`);
  const filePath = storage.saveFile(placeholder, `mockup_${view}.txt`, sampleId);
  return filePath;
}

/**
 * Remove background from the inspiration image.
 */
async function removeBackground({ imagePath, sampleId }) {
  log.info("Removing background via Gemini (Nano Banana)");

  const prompt = "Remove the background from this image completely. Return the garment on a transparent or pure white background with no shadows.";

  const result = await callGemini(prompt, imagePath);

  if (result.type === "image") {
    const ext = result.mimeType === "image/png" ? ".png" : ".jpg";
    const filePath = storage.saveFile(result.buffer, `inspiration_cleaned${ext}`, sampleId);
    log.info("Background removed", { filePath });
    return filePath;
  }

  log.warn("Background removal returned text instead of image");
  return null;
}

/**
 * Generate zoomed-in detail callouts for key features.
 */
async function generateDetailCallouts({ description, features, inspirationImagePath, sampleId }) {
  log.info("Generating detail callouts", { features });

  const callouts = [];
  for (const feature of features) {
    const prompt = `Generate a zoomed-in detail view highlighting the ${feature} on this garment. Show construction detail clearly for factory reference. Garment: ${description}`;

    try {
      const result = await callGemini(prompt, inspirationImagePath);

      if (result.type === "image") {
        const ext = result.mimeType === "image/png" ? ".png" : ".jpg";
        const filePath = storage.saveFile(
          result.buffer,
          `callout_${feature.replace(/\s+/g, "_")}${ext}`,
          sampleId
        );
        callouts.push({ label: feature, imagePath: filePath, description: "" });
      } else {
        callouts.push({ label: feature, imagePath: null, description: result.text || "" });
      }
    } catch (err) {
      log.warn("Failed to generate callout", { feature, error: err.message });
      callouts.push({ label: feature, imagePath: null, error: err.message });
    }
  }

  return callouts;
}

module.exports = { generateSketch, generateMockup, removeBackground, generateDetailCallouts };
