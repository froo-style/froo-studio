const { v4: uuidv4 } = require("uuid");
const log = require("../utils/logger");
const { postMessage, uploadImage } = require("../slack/channels");
const { createSampleChannel } = require("../slack/channels");
const { createTechPackCanvas } = require("../slack/canvas");
const { parseSampleMessage, extractKnownFields } = require("../slack/parser");
const { downloadAllImages } = require("../slack/images");
const { createSample, updateSample, nextSampleNumber } = require("../supabase/samples");
const { findSizeChart, findClosestSizeBlock, saveSizeChart, formatSizeChartTable } = require("../supabase/sizecharts");
const { generateAllVisuals } = require("../nanobanana/visuals");
const { generateFactoryNotes, suggestFabric, analyzeImageWithGemini } = require("../utils/ai");
const {
  createWorkflow,
  getWorkflow,
  updateWorkflowData,
  advanceStep,
  setStep,
} = require("./state");
const { askNextQuestion, isClarifyComplete } = require("./chatbot");
const fs = require("fs");

// ─────────────────────────────────────────────
// Step 1: Intake — triggered by new Slack message
// ─────────────────────────────────────────────
async function handleNewSample(message) {
  const parsed = parseSampleMessage(message);
  if (!parsed) {
    log.debug("Message does not qualify as a sample submission");
    return null;
  }

  log.info("New sample detected", {
    user: parsed.userId,
    sampleNumber: parsed.sampleNumber,
    imageCount: parsed.imageFiles.length,
  });

  // Generate sample number if not provided
  const sampleNumber = parsed.sampleNumber || await nextSampleNumber();
  const sampleId = `sample_${sampleNumber}_${uuidv4().slice(0, 8)}`;

  // Download inspiration images from Slack
  let localImagePaths = [];
  if (parsed.imageFiles.length > 0) {
    try {
      localImagePaths = await downloadAllImages(parsed.imageFiles, sampleId);
    } catch (err) {
      log.error("Failed to download images", { error: err.message });
    }
  }

  const inspirationImagePath = localImagePaths[0] || null;

  // Extract known fields from the notes
  const knownFields = extractKnownFields(parsed.notes);

  // Create the sample record in Supabase
  let dbRecord;
  try {
    dbRecord = await createSample({
      sampleNumber,
      userId: parsed.userId,
      notes: parsed.notes,
      inspirationImagePath,
      channelId: parsed.channelId,
      threadTs: parsed.threadTs,
      ...knownFields,
    });
  } catch (err) {
    log.error("Failed to create sample in DB", { error: err.message });
    // Continue with in-memory workflow even if DB fails
  }

  // Create the workflow
  const wf = createWorkflow(sampleId, {
    sampleNumber,
    userId: parsed.userId,
    notes: parsed.notes,
    inspirationImagePath,
    localImagePaths,
    channelId: parsed.channelId,
    threadTs: parsed.threadTs,
    dbRecordId: dbRecord?.id || null,
    ...knownFields,
  });

  // Acknowledge in Slack
  await postMessage(
    parsed.channelId,
    `New sample detected! Starting tech pack workflow for *SAMPLE-${sampleNumber}*.\n` +
    `I've captured your notes and ${localImagePaths.length} image(s).\n` +
    `I'll ask a few quick questions to fill in the details.`,
    parsed.threadTs
  );

  // Move to clarify step
  advanceStep(sampleId); // intake -> clarify

  // Start asking clarifying questions
  await askNextQuestion(sampleId);

  return { sampleId, sampleNumber };
}

// ─────────────────────────────────────────────
// Step 2: Continue clarifying (called after each answer)
// ─────────────────────────────────────────────
async function continueWorkflow(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  const { step } = wf;

  if (step === "clarify") {
    if (isClarifyComplete(sampleId)) {
      await postMessage(
        wf.data.channelId,
        "All details collected! Generating sketches and mockups now...",
        wf.data.threadTs
      );
      advanceStep(sampleId); // clarify -> visuals
      await runVisualsStep(sampleId);
    } else {
      await askNextQuestion(sampleId);
    }
    return;
  }

  if (step === "visuals") {
    await runVisualsStep(sampleId);
    return;
  }

  if (step === "fabric") {
    await runFabricStep(sampleId);
    return;
  }

  if (step === "sizechart") {
    await runSizeChartStep(sampleId);
    return;
  }

  if (step === "approval") {
    await sendApprovalRequest(sampleId);
    return;
  }

  if (step === "output") {
    await runOutputStep(sampleId);
    return;
  }
}

// ─────────────────────────────────────────────
// Step 3: Visuals (sketches, mockups, callouts)
// ─────────────────────────────────────────────
async function runVisualsStep(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  log.info("Running visuals step", { sampleId });

  try {
    const visuals = await generateAllVisuals({
      description: `${wf.data.garmentType || "garment"} — ${wf.data.notes}`,
      inspirationImagePath: wf.data.inspirationImagePath,
      sampleId,
    });

    updateWorkflowData(sampleId, {
      images: {
        inspiration: wf.data.inspirationImagePath,
        inspirationCleaned: visuals.inspirationCleaned || null,
        sketchFront: visuals.sketchFront,
        sketchBack: visuals.sketchBack,
        mockupFront: visuals.mockupFront,
        mockupBack: visuals.mockupBack,
      },
      detailCallouts: visuals.detailCallouts || [],
    });

    await postMessage(
      wf.data.channelId,
      "Sketches and mockups generated! Moving to fabric details...",
      wf.data.threadTs
    );
  } catch (err) {
    log.error("Visuals generation failed", { sampleId, error: err.message });
    await postMessage(
      wf.data.channelId,
      `Visual generation encountered an issue: ${err.message}. Continuing with fabric step...`,
      wf.data.threadTs
    );
  }

  advanceStep(sampleId); // visuals -> fabric
  await runFabricStep(sampleId);
}

// ─────────────────────────────────────────────
// Step 4: Fabric handling
// ─────────────────────────────────────────────
async function runFabricStep(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  log.info("Running fabric step", { sampleId });

  // If fabric info is already provided, skip to size chart
  if (wf.data.fabricDescription) {
    await postMessage(
      wf.data.channelId,
      `Using provided fabric: ${wf.data.fabricDescription}. Moving to size chart...`,
      wf.data.threadTs
    );
    advanceStep(sampleId); // fabric -> sizechart
    await runSizeChartStep(sampleId);
    return;
  }

  // Suggest a fabric using AI
  try {
    const suggestion = await suggestFabric(wf.data);
    updateWorkflowData(sampleId, { fabricSuggestion: suggestion });

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Fabric Suggestion:*\n${suggestion}\n\nHow would you like to proceed?`,
        },
      },
      {
        type: "actions",
        block_id: "fabric_action",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Accept Suggestion" },
            value: "accept_suggestion",
            action_id: "fabric_accept",
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Describe My Own" },
            value: "describe_own",
            action_id: "fabric_describe",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Upload Fabric Card" },
            value: "upload_card",
            action_id: "fabric_upload",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Source Similar" },
            value: "source_similar",
            action_id: "fabric_source",
          },
        ],
      },
    ];

    const { postBlocks } = require("../slack/channels");
    await postBlocks(wf.data.channelId, blocks, "Fabric suggestion", wf.data.threadTs);
  } catch (err) {
    log.error("Fabric suggestion failed", { sampleId, error: err.message });
    // Ask directly
    await postMessage(
      wf.data.channelId,
      "Please describe the fabric you'd like for this garment, or reply with 'skip' to continue.",
      wf.data.threadTs
    );
  }

  // Workflow will continue when user responds (via handleFabricAction)
}

/**
 * Handle the user's fabric decision.
 */
async function handleFabricAction(sampleId, action) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  if (action === "accept_suggestion") {
    updateWorkflowData(sampleId, {
      fabricDescription: wf.data.fabricSuggestion || "AI-suggested fabric",
    });
  }
  // For other actions (describe, upload, source), the user will reply in thread
  // and the chatbot handler will update fabricDescription

  advanceStep(sampleId); // fabric -> sizechart
  await runSizeChartStep(sampleId);
}

// ─────────────────────────────────────────────
// Step 5: Size chart
// ─────────────────────────────────────────────
async function runSizeChartStep(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  log.info("Running size chart step", { sampleId });

  const { garmentType, category, fabricType, sampleSize } = wf.data;

  // Try to find an existing size chart in Supabase
  let chart = null;
  try {
    chart = await findSizeChart(garmentType, category);
  } catch (err) {
    log.warn("Size chart lookup failed", { error: err.message });
  }

  if (chart) {
    log.info("Found existing size chart", { chartId: chart.id });
    const table = formatSizeChartTable(chart.chart_data);
    updateWorkflowData(sampleId, {
      sizeChart: {
        table,
        blockReference: chart.block_reference || chart.id,
        gradingNotes: chart.grading_notes || null,
      },
    });

    await postMessage(
      wf.data.channelId,
      `Found an existing size chart for ${garmentType} / ${category}. Attached to tech pack.`,
      wf.data.threadTs
    );
  } else {
    // Try to find closest size block
    let block = null;
    try {
      block = await findClosestSizeBlock(garmentType, fabricType);
    } catch (err) {
      log.warn("Size block lookup failed", { error: err.message });
    }

    if (block) {
      const table = formatSizeChartTable(block.chart_data || block);
      updateWorkflowData(sampleId, {
        sizeChart: {
          table,
          blockReference: block.code || block.id,
          gradingNotes: `Generated from size block ${block.code || block.id}`,
        },
      });

      await postMessage(
        wf.data.channelId,
        `Generated size chart from closest size block (${block.code || "base"}). Sample size: ${sampleSize || "TBD"}.`,
        wf.data.threadTs
      );
    } else {
      updateWorkflowData(sampleId, {
        sizeChart: {
          table: "_Size chart to be provided separately._",
          blockReference: null,
          gradingNotes: "No matching size block found — manual chart required.",
        },
      });

      await postMessage(
        wf.data.channelId,
        "No existing size chart found. You can provide one later. Continuing to approval...",
        wf.data.threadTs
      );
    }
  }

  // Generate factory notes with AI
  await generateAllNotes(sampleId);

  advanceStep(sampleId); // sizechart -> approval
  await sendApprovalRequest(sampleId);
}

// ─────────────────────────────────────────────
// Generate factory / production notes via AI
// ─────────────────────────────────────────────
async function generateAllNotes(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  try {
    const aiResult = await generateFactoryNotes(wf.data);

    // Parse AI result into sections
    const sections = parseAiNotes(aiResult);
    updateWorkflowData(sampleId, {
      factoryNotes: sections.factoryNotes || aiResult,
      constructionNotes: sections.constructionNotes || null,
      fitNotes: sections.fitNotes || null,
      sewingNotes: sections.sewingNotes || null,
      finishingNotes: sections.finishingNotes || null,
      placementNotes: sections.placementNotes || null,
      productionNotes: sections.productionNotes || aiResult,
    });
  } catch (err) {
    log.error("Factory notes generation failed", { sampleId, error: err.message });
  }
}

/**
 * Parse AI-generated notes into named sections.
 */
function parseAiNotes(text) {
  const sections = {};
  const sectionMap = {
    "factory notes": "factoryNotes",
    "construction notes": "constructionNotes",
    "fit notes": "fitNotes",
    "sewing notes": "sewingNotes",
    "finishing notes": "finishingNotes",
    "placement notes": "placementNotes",
    "production notes": "productionNotes",
  };

  let currentKey = "factoryNotes";
  const lines = text.split("\n");

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    let matched = false;
    for (const [label, key] of Object.entries(sectionMap)) {
      if (lower.includes(label)) {
        currentKey = key;
        matched = true;
        break;
      }
    }
    if (!matched) {
      sections[currentKey] = (sections[currentKey] || "") + line + "\n";
    }
  }

  // Trim all sections
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim();
  }

  return sections;
}

// ─────────────────────────────────────────────
// Step 6: Approval
// ─────────────────────────────────────────────
async function sendApprovalRequest(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  log.info("Sending approval request", { sampleId });

  const d = wf.data;
  const summary = [
    `*Tech Pack Summary — SAMPLE-${d.sampleNumber}*`,
    "",
    `*Brand:* ${d.brand || "—"}`,
    `*Category:* ${d.category || "—"}`,
    `*Garment Type:* ${d.garmentType || "—"}`,
    `*Sample Size:* ${d.sampleSize || "—"}`,
    `*Fit:* ${d.fit || "—"}`,
    `*Neckline:* ${d.neckline || "—"}`,
    `*Closure:* ${d.closure || "—"}`,
    `*Fabric:* ${d.fabricDescription || d.fabricType || "—"}`,
    "",
    `*Factory Notes:*\n${d.factoryNotes || "Pending"}`,
    "",
    `*Size Chart:*\n${d.sizeChart?.table || "Pending"}`,
    "",
    `*Sketches:* ${d.images?.sketchFront ? "Generated" : "Pending"}`,
    `*Mockups:* ${d.images?.mockupFront ? "Generated" : "Pending"}`,
    `*Detail Callouts:* ${d.detailCallouts?.length || 0} generated`,
  ].join("\n");

  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: summary },
    },
    { type: "divider" },
    {
      type: "actions",
      block_id: "approval_actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve & Create Canvas" },
          value: "approve",
          action_id: "techpack_approve",
          style: "primary",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Request Edits" },
          value: "edit",
          action_id: "techpack_edit",
        },
      ],
    },
  ];

  const { postBlocks } = require("../slack/channels");
  await postBlocks(d.channelId, blocks, "Tech pack approval", d.threadTs);
}

/**
 * Handle the approval decision.
 */
async function handleApproval(sampleId, decision) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  if (decision === "approve") {
    advanceStep(sampleId); // approval -> output
    await runOutputStep(sampleId);
  } else {
    // Request edits — ask user what to change
    await postMessage(
      wf.data.channelId,
      "What would you like to change? Reply in this thread with your edits.",
      wf.data.threadTs
    );
    // Workflow stays in approval step until user approves
  }
}

// ─────────────────────────────────────────────
// Step 7: Final output — create channel + canvas
// ─────────────────────────────────────────────
async function runOutputStep(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  const d = wf.data;
  log.info("Running output step", { sampleId, sampleNumber: d.sampleNumber });

  await postMessage(
    d.channelId,
    "Creating your tech pack channel and canvas now...",
    d.threadTs
  );

  // 1. Create new Slack channel
  let outputChannelId;
  try {
    outputChannelId = await createSampleChannel(d.sampleNumber);
    updateWorkflowData(sampleId, { outputChannelId });
  } catch (err) {
    log.error("Failed to create sample channel", { error: err.message });
    await postMessage(
      d.channelId,
      `Could not create channel: ${err.message}`,
      d.threadTs
    );
    return;
  }

  // 2. Upload images to the new channel
  try {
    if (d.images?.sketchFront) {
      await uploadImage(outputChannelId, d.images.sketchFront, "sketch_front.png", "Front Sketch");
    }
    if (d.images?.sketchBack) {
      await uploadImage(outputChannelId, d.images.sketchBack, "sketch_back.png", "Back Sketch");
    }
    if (d.images?.mockupFront) {
      await uploadImage(outputChannelId, d.images.mockupFront, "mockup_front.png", "Front Mockup");
    }
    if (d.images?.mockupBack) {
      await uploadImage(outputChannelId, d.images.mockupBack, "mockup_back.png", "Back Mockup");
    }
    if (d.images?.inspiration) {
      await uploadImage(outputChannelId, d.images.inspiration, "inspiration.jpg", "Inspiration Image");
    }
    if (d.images?.inspirationCleaned) {
      await uploadImage(outputChannelId, d.images.inspirationCleaned, "inspiration_cleaned.png", "Cleaned Inspiration");
    }
  } catch (err) {
    log.warn("Some image uploads failed", { error: err.message });
  }

  // 3. Create Slack Canvas with full tech pack
  try {
    const techPackData = {
      sampleNumber: d.sampleNumber,
      userId: d.userId,
      notes: d.notes,
      category: d.category,
      garmentType: d.garmentType,
      brand: d.brand,
      sampleSize: d.sampleSize,
      fit: d.fit,
      neckline: d.neckline,
      closure: d.closure,
      waistType: d.waistType,
      fabricType: d.fabricType,
      factoryNotes: d.factoryNotes,
      constructionNotes: d.constructionNotes,
      fitNotes: d.fitNotes,
      productionNotes: d.productionNotes,
      sewingNotes: d.sewingNotes,
      finishingNotes: d.finishingNotes,
      placementNotes: d.placementNotes,
      fabricDescription: d.fabricDescription,
      fabricSupplier: d.fabricSupplier,
      trims: d.trims ? d.trims.split(",").map((t) => t.trim()) : [],
      materialNotes: d.materialNotes,
      sizeChart: d.sizeChart,
      images: d.images || {},
      detailCallouts: (d.detailCallouts || []).map((c) => ({
        label: c.label,
        description: c.description || "",
        imageUrl: c.imagePath ? "(see uploaded image)" : "",
      })),
    };

    const canvasId = await createTechPackCanvas(outputChannelId, techPackData);
    updateWorkflowData(sampleId, { canvasId });
  } catch (err) {
    log.error("Failed to create canvas", { error: err.message });
    await postMessage(
      d.channelId,
      `Canvas creation encountered an issue: ${err.message}`,
      d.threadTs
    );
  }

  // 4. Post summary message in the new channel
  await postMessage(
    outputChannelId,
    `Tech pack created for *SAMPLE-${d.sampleNumber}*. Full details are in the channel canvas.`
  );

  // 5. Notify in original thread
  await postMessage(
    d.channelId,
    `Tech pack for *SAMPLE-${d.sampleNumber}* is ready! Check the <#${outputChannelId}> channel for the full canvas.`,
    d.threadTs
  );

  // Update Supabase record
  if (d.dbRecordId) {
    try {
      await updateSample(d.dbRecordId, {
        status: "complete",
        output_channel_id: outputChannelId,
      });
    } catch (err) {
      log.warn("Failed to update DB record", { error: err.message });
    }
  }

  // Mark workflow complete
  advanceStep(sampleId); // output -> complete
  log.info("Tech pack workflow complete", { sampleId, sampleNumber: d.sampleNumber });
}

module.exports = {
  handleNewSample,
  continueWorkflow,
  handleFabricAction,
  handleApproval,
  runVisualsStep,
  runFabricStep,
  runSizeChartStep,
  runOutputStep,
};
