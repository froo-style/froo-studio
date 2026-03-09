const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const config = require("../config");
const log = require("../utils/logger");
const storage = require("../utils/storage");

const api = axios.create({
  baseURL: config.nanoBanana.apiUrl,
  headers: { Authorization: `Bearer ${config.nanoBanana.apiKey}` },
  timeout: 120_000, // image generation can take time
});

/**
 * Generate a technical sketch (front or back view).
 * @param {object} opts
 * @param {string} opts.description - garment description / factory notes
 * @param {string} opts.view - "front" or "back"
 * @param {string} [opts.inspirationImagePath] - local path to inspiration image
 * @param {string} opts.sampleId - for file storage
 * @returns {Promise<string>} local path to generated sketch
 */
async function generateSketch({ description, view, inspirationImagePath, sampleId }) {
  log.info("Generating sketch via Nano Banana", { view });

  const form = new FormData();
  form.append("prompt", `Technical flat sketch, ${view} view: ${description}`);
  form.append("type", "technical_sketch");
  form.append("view", view);

  if (inspirationImagePath && fs.existsSync(inspirationImagePath)) {
    form.append("reference_image", fs.createReadStream(inspirationImagePath));
  }

  const res = await api.post("/generate/sketch", form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
  });

  const filePath = storage.saveFile(
    Buffer.from(res.data),
    `sketch_${view}.png`,
    sampleId
  );
  log.info("Sketch generated", { view, filePath });
  return filePath;
}

/**
 * Generate a 3D mockup (front or back view).
 */
async function generateMockup({ description, view, inspirationImagePath, sampleId }) {
  log.info("Generating 3D mockup via Nano Banana", { view });

  const form = new FormData();
  form.append("prompt", `3D garment mockup, ${view} view: ${description}`);
  form.append("type", "3d_mockup");
  form.append("view", view);

  if (inspirationImagePath && fs.existsSync(inspirationImagePath)) {
    form.append("reference_image", fs.createReadStream(inspirationImagePath));
  }

  const res = await api.post("/generate/mockup", form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
  });

  const filePath = storage.saveFile(
    Buffer.from(res.data),
    `mockup_${view}.png`,
    sampleId
  );
  log.info("Mockup generated", { view, filePath });
  return filePath;
}

/**
 * Remove background from the inspiration image.
 */
async function removeBackground({ imagePath, sampleId }) {
  log.info("Removing background via Nano Banana");

  const form = new FormData();
  form.append("image", fs.createReadStream(imagePath));

  const res = await api.post("/tools/remove-background", form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
  });

  const filePath = storage.saveFile(
    Buffer.from(res.data),
    "inspiration_cleaned.png",
    sampleId
  );
  log.info("Background removed", { filePath });
  return filePath;
}

/**
 * Generate zoomed-in detail callouts for key features.
 * @param {object} opts
 * @param {string} opts.description
 * @param {string[]} opts.features - list of features to highlight
 * @param {string} [opts.inspirationImagePath]
 * @param {string} opts.sampleId
 * @returns {Promise<Array<{label: string, imagePath: string}>>}
 */
async function generateDetailCallouts({ description, features, inspirationImagePath, sampleId }) {
  log.info("Generating detail callouts", { features });

  const callouts = [];
  for (const feature of features) {
    const form = new FormData();
    form.append("prompt", `Zoomed detail callout of ${feature}: ${description}`);
    form.append("type", "detail_callout");
    form.append("feature", feature);

    if (inspirationImagePath && fs.existsSync(inspirationImagePath)) {
      form.append("reference_image", fs.createReadStream(inspirationImagePath));
    }

    try {
      const res = await api.post("/generate/callout", form, {
        headers: form.getHeaders(),
        responseType: "arraybuffer",
      });

      const filePath = storage.saveFile(
        Buffer.from(res.data),
        `callout_${feature.replace(/\s+/g, "_")}.png`,
        sampleId
      );

      callouts.push({ label: feature, imagePath: filePath });
    } catch (err) {
      log.warn("Failed to generate callout", { feature, error: err.message });
      callouts.push({ label: feature, imagePath: null, error: err.message });
    }
  }

  return callouts;
}

module.exports = { generateSketch, generateMockup, removeBackground, generateDetailCallouts };
