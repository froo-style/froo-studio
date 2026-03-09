const nb = require("./client");
const log = require("../utils/logger");

/**
 * Detail keywords to scan for in the sample notes / description.
 */
const DETAIL_KEYWORDS = [
  "embroidery", "lace", "button", "smocking", "pleat", "bow",
  "ruffle", "collar", "cuff", "pocket", "zipper", "piping",
  "trim", "print", "broderie", "appliqué", "rib", "binding",
  "patch", "snap", "drawcord", "tie",
];

/**
 * Detect which design features are mentioned in the description
 * so we know what detail callouts to generate.
 */
function detectFeatures(description) {
  const lower = (description || "").toLowerCase();
  return DETAIL_KEYWORDS.filter((kw) => lower.includes(kw));
}

/**
 * Run the full visual generation pipeline (Step 3 of the workflow).
 *
 * Generates:
 *  - technical sketch front
 *  - technical sketch back
 *  - 3D mockup front
 *  - 3D mockup back
 *  - cleaned inspiration image (background removed)
 *  - detail callouts for detected features
 *
 * @param {object} opts
 * @param {string} opts.description
 * @param {string} opts.inspirationImagePath
 * @param {string} opts.sampleId
 * @returns {Promise<object>} generated image paths
 */
async function generateAllVisuals({ description, inspirationImagePath, sampleId }) {
  log.info("Starting full visual generation pipeline", { sampleId });

  const results = {};

  // Generate sketches and mockups in parallel where possible
  const [sketchFront, sketchBack, mockupFront, mockupBack] = await Promise.all([
    nb.generateSketch({ description, view: "front", inspirationImagePath, sampleId }),
    nb.generateSketch({ description, view: "back", inspirationImagePath, sampleId }),
    nb.generateMockup({ description, view: "front", inspirationImagePath, sampleId }),
    nb.generateMockup({ description, view: "back", inspirationImagePath, sampleId }),
  ]);

  results.sketchFront = sketchFront;
  results.sketchBack = sketchBack;
  results.mockupFront = mockupFront;
  results.mockupBack = mockupBack;

  // Remove background from inspiration image
  if (inspirationImagePath) {
    try {
      results.inspirationCleaned = await nb.removeBackground({
        imagePath: inspirationImagePath,
        sampleId,
      });
    } catch (err) {
      log.warn("Background removal failed", { error: err.message });
    }
  }

  // Generate detail callouts for detected features
  const features = detectFeatures(description);
  if (features.length > 0) {
    results.detailCallouts = await nb.generateDetailCallouts({
      description,
      features,
      inspirationImagePath,
      sampleId,
    });
  } else {
    results.detailCallouts = [];
  }

  log.info("Visual generation pipeline complete", {
    sampleId,
    sketchCount: 2,
    mockupCount: 2,
    calloutCount: results.detailCallouts.length,
  });

  return results;
}

module.exports = { generateAllVisuals, detectFeatures, DETAIL_KEYWORDS };
