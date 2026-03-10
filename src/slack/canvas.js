const { web } = require("./client");
const log = require("../utils/logger");

/**
 * Create a Slack Canvas in the given channel and write the tech pack content.
 *
 * @param {string} channelId
 * @param {object} techPack — the fully assembled tech pack object
 * @returns {Promise<string>} canvasId
 */
async function createTechPackCanvas(channelId, techPack) {
  log.info("Creating Slack Canvas", { channelId, sample: techPack.sampleNumber });

  const markdown = buildCanvasMarkdown(techPack);

  // Create the canvas
  const createResult = await web().canvases.create({
    title: `Tech Pack — SAMPLE-${techPack.sampleNumber}`,
    document_content: { type: "markdown", markdown },
  });

  const canvasId = createResult.canvas_id;
  log.info("Canvas created", { canvasId });

  // Set the canvas as the channel canvas
  await web().conversations.canvases.create({
    channel_id: channelId,
    document_content: { type: "markdown", markdown },
  });

  log.info("Canvas set as channel canvas", { channelId, canvasId });
  return canvasId;
}

/**
 * Build the full tech pack markdown for the Slack Canvas.
 * Bug #2: Fabric notes separated to Page 2 only
 * Bug #4: Images embedded with Slack URLs
 */
function buildCanvasMarkdown(tp) {
  const sections = [];
  const urls = tp.imageUrls || {};

  // Header
  sections.push(`# Tech Pack — SAMPLE-${tp.sampleNumber}`);
  sections.push(`**Generated:** ${new Date().toISOString().split("T")[0]}`);
  sections.push("");

  // ── PAGE 1: Design Overview ──
  sections.push("---");
  sections.push("## 1. Design Overview");
  sections.push("");
  sections.push(`**Sample Number:** ${tp.sampleNumber}`);
  sections.push(`**Submitted By:** <@${tp.userId}>`);
  sections.push(`**Style Description:** ${tp.notes || "—"}`);
  sections.push(`**Category:** ${tp.category || "—"}`);
  sections.push(`**Garment Type:** ${tp.garmentType || "—"}`);
  sections.push(`**Brand:** ${tp.brand || "—"}`);
  sections.push(`**Sample Size:** ${tp.sampleSize || "—"}`);
  sections.push(`**Fit:** ${tp.fit || "—"}`);
  sections.push(`**Neckline:** ${tp.neckline || "—"}`);
  sections.push(`**Closure:** ${tp.closure || "—"}`);
  sections.push(`**Waist Type:** ${tp.waistType || "—"}`);
  sections.push(`**Fabric Type:** ${tp.fabricType || "—"}`);
  sections.push("");

  // Bug #4: Embed inspiration image in canvas
  if (urls.inspiration) {
    sections.push("### Inspiration Image");
    sections.push(`![Inspiration Image](${urls.inspiration})`);
    sections.push("");
  }

  // Factory notes — style/construction only (Bug #2: no fabric info here)
  if (tp.factoryNotes) {
    sections.push("### Factory Notes");
    sections.push(tp.factoryNotes);
    sections.push("");
  }

  // Construction notes
  if (tp.constructionNotes) {
    sections.push("### Construction Notes");
    sections.push(tp.constructionNotes);
    sections.push("");
  }

  // Fit notes
  if (tp.fitNotes) {
    sections.push("### Fit Notes");
    sections.push(tp.fitNotes);
    sections.push("");
  }

  // Bug #4: Embed sketches and mockups in canvas
  if (urls.sketchFront || urls.sketchBack || urls.mockupFront || urls.mockupBack) {
    sections.push("### Visuals");
    if (urls.sketchFront) sections.push(`**Front Sketch:**\n![Front Sketch](${urls.sketchFront})`);
    if (urls.sketchBack) sections.push(`**Back Sketch:**\n![Back Sketch](${urls.sketchBack})`);
    if (urls.mockupFront) sections.push(`**Front Mockup:**\n![Front Mockup](${urls.mockupFront})`);
    if (urls.mockupBack) sections.push(`**Back Mockup:**\n![Back Mockup](${urls.mockupBack})`);
    if (urls.inspirationCleaned) sections.push(`**Cleaned Inspiration:**\n![Cleaned](${urls.inspirationCleaned})`);
    sections.push("");
  } else if (tp.images) {
    sections.push("### Visuals");
    if (tp.images.sketchFront) sections.push(`- **Front Sketch:** (see uploaded file)`);
    if (tp.images.sketchBack) sections.push(`- **Back Sketch:** (see uploaded file)`);
    if (tp.images.mockupFront) sections.push(`- **Front Mockup:** (see uploaded file)`);
    if (tp.images.mockupBack) sections.push(`- **Back Mockup:** (see uploaded file)`);
    if (tp.images.inspiration) sections.push(`- **Inspiration Image:** (see uploaded file)`);
    if (tp.images.inspirationCleaned) sections.push(`- **Cleaned Inspiration:** (see uploaded file)`);
    sections.push("");
  }

  // ── PAGE 2: Fabrics and Trims ──
  sections.push("---");
  sections.push("## 2. Fabrics and Trims");
  sections.push("");

  // Bug #4: Embed fabric card image
  if (urls.fabricCard) {
    sections.push("### Fabric Card");
    sections.push(`![Fabric Card](${urls.fabricCard})`);
    sections.push("");
  }

  if (tp.fabricDescription) {
    sections.push(`**Fabric Description:** ${tp.fabricDescription}`);
  }
  if (tp.fabricSupplier) {
    sections.push(`**Supplier:** ${tp.fabricSupplier}`);
  }

  // Bug #2: Fabric notes go ONLY on Page 2
  if (tp.fabricNotes) {
    sections.push("");
    sections.push("### Fabric Notes");
    sections.push(tp.fabricNotes);
  }

  if (tp.trims && tp.trims.length > 0) {
    sections.push("");
    sections.push("### Trims");
    for (const trim of tp.trims) {
      sections.push(`- ${trim}`);
    }
  }
  if (tp.materialNotes) {
    sections.push("");
    sections.push(`**Material Notes:** ${tp.materialNotes}`);
  }
  sections.push("");

  // ── PAGE 3: Size Chart ──
  sections.push("---");
  sections.push("## 3. Size Chart");
  sections.push("");
  if (tp.sizeChart) {
    if (tp.sizeChart.blockReference) {
      sections.push(`**Block Reference:** ${tp.sizeChart.blockReference}`);
    }
    sections.push(`**Sample Size:** ${tp.sampleSize || "—"}`);
    sections.push("");
    if (tp.sizeChart.table) {
      sections.push(tp.sizeChart.table);
    }
    if (tp.sizeChart.gradingNotes) {
      sections.push("");
      sections.push(`**Grading Notes:** ${tp.sizeChart.gradingNotes}`);
    }
  } else {
    sections.push("_No size chart data available._");
  }
  sections.push("");

  // ── PAGE 4: Detail Callouts ──
  sections.push("---");
  sections.push("## 4. Detail Callouts");
  sections.push("");
  if (tp.detailCallouts && tp.detailCallouts.length > 0) {
    for (const callout of tp.detailCallouts) {
      if (callout.imageUrl && callout.imageUrl.startsWith("http")) {
        sections.push(`### ${callout.label}`);
        sections.push(`![${callout.label}](${callout.imageUrl})`);
        if (callout.description) sections.push(callout.description);
        sections.push("");
      } else {
        sections.push(`- **${callout.label}:** ${callout.description || ""} ${callout.imageUrl || ""}`);
      }
    }
  } else {
    sections.push("_No detail callouts generated._");
  }
  sections.push("");

  // ── PAGE 5: Production Notes ──
  sections.push("---");
  sections.push("## 5. Production Notes");
  sections.push("");
  if (tp.productionNotes) {
    sections.push(tp.productionNotes);
  }
  if (tp.sewingNotes) {
    sections.push("");
    sections.push("### Sewing Notes");
    sections.push(tp.sewingNotes);
  }
  if (tp.finishingNotes) {
    sections.push("");
    sections.push("### Finishing Notes");
    sections.push(tp.finishingNotes);
  }
  if (tp.placementNotes) {
    sections.push("");
    sections.push("### Placement Notes");
    sections.push(tp.placementNotes);
  }
  sections.push("");

  return sections.join("\n");
}

module.exports = { createTechPackCanvas, buildCanvasMarkdown };
