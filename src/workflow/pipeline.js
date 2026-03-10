const { v4: uuidv4 } = require("uuid");
const log = require("../utils/logger");
const { postMessage, uploadImage } = require("../slack/channels");
const { createSampleChannel } = require("../slack/channels");
const { createTechPackCanvas } = require("../slack/canvas");
const { parseSampleMessage, extractKnownFields, classifyUploadedImages } = require("../slack/parser");
const { downloadAllImages } = require("../slack/images");
const { createSample, updateSample, nextSampleNumber } = require("../supabase/samples");
const { findSizeChart, findClosestSizeBlock, saveSizeChart, formatSizeChartTable } = require("../supabase/sizecharts");
const { generateAllVisuals } = require("../nanobanana/visuals");
const { generateFactoryNotes, suggestFabric, analyzeAndGenerateNotes } = require("../utils/ai");
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
  let sampleNumber = parsed.sampleNumber;
  if (!sampleNumber) {
    try {
      sampleNumber = await nextSampleNumber();
    } catch (err) {
      log.warn("Failed to fetch next sample number from DB, using timestamp fallback", { error: err.message });
      sampleNumber = String(Date.now()).slice(-6);
    }
  }
  const sampleId = `sample_${sampleNumber}_${uuidv4().slice(0, 8)}`;

  // Download all images from Slack
  let localImagePaths = [];
  if (parsed.imageFiles.length > 0) {
    try {
      localImagePaths = await downloadAllImages(parsed.imageFiles, sampleId);
    } catch (err) {
      log.error("Failed to download images", { error: err.message });
    }
  }

  // Bug #1: Classify uploaded images — detect fabric cards vs inspiration images
  const { inspirationImages, fabricCardImages } = classifyUploadedImages(parsed.imageFiles);
  const inspirationImagePath = localImagePaths[0] || null;

  // If a fabric card was detected among uploads, store its path
  let fabricCardImagePath = null;
  if (fabricCardImages.length > 0 && localImagePaths.length > 1) {
    // Fabric card is likely the second (or later) image if first is inspiration
    fabricCardImagePath = localImagePaths[localImagePaths.length - 1];
  }

  // Extract known fields from the notes (includes Bug #6: sample size detection)
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
  }

  // Create the workflow
  const wf = createWorkflow(sampleId, {
    sampleNumber,
    userId: parsed.userId,
    notes: parsed.notes,
    inspirationImagePath,
    fabricCardImagePath,
    localImagePaths,
    channelId: parsed.channelId,
    threadTs: parsed.threadTs,
    dbRecordId: dbRecord?.id || null,
    ...knownFields,
  });

  // Acknowledge in Slack
  let ackMsg = `New sample detected! Starting tech pack workflow for *SAMPLE-${sampleNumber}*.\n` +
    `I've captured your notes and ${localImagePaths.length} image(s).\n`;

  if (fabricCardImagePath) {
    ackMsg += `I detected a fabric card image — it will be used in the fabric section.\n`;
  }
  if (knownFields.sampleSize) {
    ackMsg += `Detected sample size from notes: *${knownFields.sampleSize}*\n`;
  }
  ackMsg += `I'll ask a few quick questions to fill in the details.`;

  await postMessage(parsed.channelId, ackMsg, parsed.threadTs);

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
        "All details collected! Analysing your inspiration image and generating visuals...",
        wf.data.threadTs
      );

      // Bug #7: Auto-generate factory notes from image before visuals
      await runImageAnalysis(sampleId);

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
// Bug #7: Analyse inspiration image and auto-generate notes
// ─────────────────────────────────────────────
async function runImageAnalysis(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  const { inspirationImagePath, notes } = wf.data;

  if (!inspirationImagePath || !fs.existsSync(inspirationImagePath)) {
    log.info("No inspiration image for analysis", { sampleId });
    return;
  }

  try {
    await postMessage(
      wf.data.channelId,
      "Analysing your inspiration image for design details...",
      wf.data.threadTs
    );

    const analysis = await analyzeAndGenerateNotes(inspirationImagePath, notes, wf.data);

    if (analysis) {
      // Parse the analysis into garment notes and fabric notes
      const { garmentNotes, fabricNotes } = parseImageAnalysis(analysis);

      updateWorkflowData(sampleId, {
        imageAnalysis: analysis,
        imageGarmentNotes: garmentNotes,
        imageFabricNotes: fabricNotes,
      });

      // Show the generated notes for user review
      const reviewMsg = [
        "*Auto-Generated Notes from Image Analysis:*",
        "",
        "*Garment/Construction Notes (Page 1):*",
        garmentNotes || "_None detected_",
        "",
        "*Fabric Notes (Page 2):*",
        fabricNotes || "_None detected_",
        "",
        "_These notes will be included in your tech pack. Reply in this thread if you want to edit them, or they'll be used as-is._",
      ].join("\n");

      await postMessage(wf.data.channelId, reviewMsg, wf.data.threadTs);
    }
  } catch (err) {
    log.warn("Image analysis step failed, continuing", { sampleId, error: err.message });
  }
}

/**
 * Parse image analysis text into separate garment and fabric note sections.
 */
function parseImageAnalysis(text) {
  let garmentNotes = "";
  let fabricNotes = "";
  let currentSection = "garment";

  for (const line of text.split("\n")) {
    const lower = line.toLowerCase().trim();
    if (lower.includes("fabric notes") || lower.includes("fabric section")) {
      currentSection = "fabric";
      continue;
    }
    if (lower.includes("garment notes") || lower.includes("design overview") || lower.includes("construction notes")) {
      currentSection = "garment";
      continue;
    }
    if (lower.startsWith("##")) continue;

    if (currentSection === "fabric") {
      fabricNotes += line + "\n";
    } else {
      garmentNotes += line + "\n";
    }
  }

  return {
    garmentNotes: garmentNotes.trim(),
    fabricNotes: fabricNotes.trim(),
  };
}

// ─────────────────────────────────────────────
// Step 3: Visuals (sketches, mockups, callouts)
// Bug #5: Gemini API now has key fallback in config
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
        fabricCard: wf.data.fabricCardImagePath || null,
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

    // Still store images object with whatever we have
    updateWorkflowData(sampleId, {
      images: {
        inspiration: wf.data.inspirationImagePath,
        fabricCard: wf.data.fabricCardImagePath || null,
      },
    });
  }

  advanceStep(sampleId); // visuals -> fabric
  await runFabricStep(sampleId);
}

// ─────────────────────────────────────────────
// Step 4: Fabric handling
// Bug #1: Detect fabric card from Step 1 uploads
// ─────────────────────────────────────────────
async function runFabricStep(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  log.info("Running fabric step", { sampleId });

  // Bug #1: If a fabric card was uploaded in Step 1, use it automatically
  if (wf.data.fabricCardImagePath && fs.existsSync(wf.data.fabricCardImagePath)) {
    await postMessage(
      wf.data.channelId,
      "I detected a fabric card uploaded with your sample. Using it for the fabric section.",
      wf.data.threadTs
    );

    // Upload the fabric card to show the user
    try {
      await uploadImage(
        wf.data.channelId,
        wf.data.fabricCardImagePath,
        "fabric_card.jpg",
        "Detected Fabric Card"
      );
    } catch (err) {
      log.warn("Failed to re-upload fabric card preview", { error: err.message });
    }

    if (!wf.data.fabricDescription) {
      updateWorkflowData(sampleId, {
        fabricDescription: "See attached fabric card",
      });
    }

    advanceStep(sampleId); // fabric -> sizechart
    await runSizeChartStep(sampleId);
    return;
  }

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
    await postMessage(
      wf.data.channelId,
      "Please describe the fabric you'd like for this garment, or reply with 'skip' to continue.",
      wf.data.threadTs
    );
  }
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

  advanceStep(sampleId); // fabric -> sizechart
  await runSizeChartStep(sampleId);
}

// ─────────────────────────────────────────────
// Step 5: Size chart
// Bug #3: Now asks interactive questions instead of silently proceeding
// ─────────────────────────────────────────────
async function runSizeChartStep(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  log.info("Running size chart step", { sampleId });

  const { garmentType } = wf.data;

  // Bug #3: Ask the user how they want to handle the size chart
  const { postBlocks } = require("../slack/channels");

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Size Chart* — How would you like to handle the size chart for this ${garmentType || "garment"}?`,
      },
    },
    {
      type: "actions",
      block_id: "sizechart_action",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Repeat Body (use existing)" },
          value: "repeat",
          action_id: "sizechart_repeat",
          style: "primary",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "New Body (find closest block)" },
          value: "new_body",
          action_id: "sizechart_new",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Upload New Chart" },
          value: "upload",
          action_id: "sizechart_upload",
        },
      ],
    },
  ];

  await postBlocks(wf.data.channelId, blocks, "Size chart selection", wf.data.threadTs);
  // Workflow waits for user action via handleSizeChartAction
}

/**
 * Handle size chart action from user button click.
 */
async function handleSizeChartAction(sampleId, action) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  const { garmentType, category, fabricType, sampleSize } = wf.data;

  if (action === "repeat") {
    // Try to find existing size chart by garment type + category from Supabase
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
        `Found existing size chart for ${garmentType} / ${category}. Attached to tech pack.`,
        wf.data.threadTs
      );
    } else {
      await postMessage(
        wf.data.channelId,
        `No existing size chart found for ${garmentType} / ${category}. Searching for closest block instead...`,
        wf.data.threadTs
      );
      await findAndApplyClosestBlock(sampleId);
    }
  } else if (action === "new_body") {
    await findAndApplyClosestBlock(sampleId);
  } else if (action === "upload") {
    await postMessage(
      wf.data.channelId,
      "Please upload your size chart file in this thread. I'll attach it to the tech pack.",
      wf.data.threadTs
    );
    // Workflow will continue when user uploads file via handleSizeChartUpload
    return; // Don't advance yet
  }

  // Generate factory notes with AI
  await generateAllNotes(sampleId);

  advanceStep(sampleId); // sizechart -> approval
  await sendApprovalRequest(sampleId);
}

/**
 * Find and apply the closest size block for a new body.
 */
async function findAndApplyClosestBlock(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  const { garmentType, fabricType, sampleSize } = wf.data;

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
      "No existing size block found. Size chart will be marked as pending.",
      wf.data.threadTs
    );
  }
}

/**
 * Handle size chart file upload in thread.
 */
async function handleSizeChartUpload(sampleId, text) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  updateWorkflowData(sampleId, {
    sizeChart: {
      table: text || "_Uploaded size chart — see attached file._",
      blockReference: "uploaded",
      gradingNotes: "User-uploaded size chart",
    },
  });

  await postMessage(
    wf.data.channelId,
    "Size chart uploaded and attached to tech pack.",
    wf.data.threadTs
  );

  // Generate factory notes with AI
  await generateAllNotes(sampleId);

  advanceStep(sampleId); // sizechart -> approval
  await sendApprovalRequest(sampleId);
}

// ─────────────────────────────────────────────
// Generate factory / production notes via AI
// Bug #2: Separate garment vs fabric notes
// ─────────────────────────────────────────────
async function generateAllNotes(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return;

  try {
    const aiResult = await generateFactoryNotes(wf.data);

    // Parse AI result into sections, including fabric notes separation
    const sections = parseAiNotes(aiResult);
    updateWorkflowData(sampleId, {
      factoryNotes: sections.factoryNotes || aiResult,
      constructionNotes: sections.constructionNotes || null,
      fitNotes: sections.fitNotes || null,
      sewingNotes: sections.sewingNotes || null,
      finishingNotes: sections.finishingNotes || null,
      placementNotes: sections.placementNotes || null,
      fabricNotes: sections.fabricNotes || wf.data.imageFabricNotes || null,
      productionNotes: sections.productionNotes || aiResult,
    });
  } catch (err) {
    log.error("Factory notes generation failed", { sampleId, error: err.message });
  }
}

/**
 * Parse AI-generated notes into named sections.
 * Bug #2: Now separates fabric notes into their own section for Page 2.
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
    "fabric notes": "fabricNotes",
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
    `*Factory Notes (Page 1):*\n${d.factoryNotes || "Pending"}`,
    "",
    d.fabricNotes ? `*Fabric Notes (Page 2):*\n${d.fabricNotes}` : "",
    "",
    `*Size Chart:*\n${d.sizeChart?.table || "Pending"}`,
    "",
    `*Sketches:* ${d.images?.sketchFront ? "Generated" : "Pending"}`,
    `*Mockups:* ${d.images?.mockupFront ? "Generated" : "Pending"}`,
    `*Detail Callouts:* ${d.detailCallouts?.length || 0} generated`,
    `*Fabric Card:* ${d.images?.fabricCard ? "Attached" : "None"}`,
    `*Inspiration Image:* ${d.images?.inspiration ? "Attached" : "None"}`,
  ].filter(Boolean).join("\n");

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
    await postMessage(
      wf.data.channelId,
      "What would you like to change? Reply in this thread with your edits.",
      wf.data.threadTs
    );
  }
}

// ─────────────────────────────────────────────
// Step 7: Final output — create channel + canvas
// Bug #4: Embed images in canvas with Slack URLs
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

  // 2. Upload images to the new channel and collect Slack file URLs
  const uploadedImageUrls = {};

  async function uploadAndTrack(key, filePath, filename, title) {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
      const result = await uploadImage(outputChannelId, filePath, filename, title);
      // Try to extract the Slack file permalink from the upload result
      if (result?.file?.permalink) {
        uploadedImageUrls[key] = result.file.permalink;
      } else if (result?.files?.[0]?.permalink) {
        uploadedImageUrls[key] = result.files[0].permalink;
      }
    } catch (err) {
      log.warn(`Failed to upload ${key}`, { error: err.message });
    }
  }

  // Bug #4: Upload ALL images including inspiration and fabric card
  await uploadAndTrack("sketchFront", d.images?.sketchFront, "sketch_front.png", "Front Sketch");
  await uploadAndTrack("sketchBack", d.images?.sketchBack, "sketch_back.png", "Back Sketch");
  await uploadAndTrack("mockupFront", d.images?.mockupFront, "mockup_front.png", "Front Mockup");
  await uploadAndTrack("mockupBack", d.images?.mockupBack, "mockup_back.png", "Back Mockup");
  await uploadAndTrack("inspiration", d.images?.inspiration, "inspiration.jpg", "Inspiration Image");
  await uploadAndTrack("inspirationCleaned", d.images?.inspirationCleaned, "inspiration_cleaned.png", "Cleaned Inspiration");
  await uploadAndTrack("fabricCard", d.images?.fabricCard, "fabric_card.jpg", "Fabric Card");

  // Upload detail callout images
  if (d.detailCallouts && d.detailCallouts.length > 0) {
    for (let i = 0; i < d.detailCallouts.length; i++) {
      const c = d.detailCallouts[i];
      if (c.imagePath) {
        await uploadAndTrack(
          `callout_${i}`,
          c.imagePath,
          `callout_${c.label.replace(/\s+/g, "_")}.png`,
          `Detail: ${c.label}`
        );
      }
    }
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
      // Bug #2: Separated notes
      factoryNotes: d.factoryNotes,
      constructionNotes: d.constructionNotes,
      fitNotes: d.fitNotes,
      productionNotes: d.productionNotes,
      sewingNotes: d.sewingNotes,
      finishingNotes: d.finishingNotes,
      placementNotes: d.placementNotes,
      fabricNotes: d.fabricNotes,
      fabricDescription: d.fabricDescription,
      fabricSupplier: d.fabricSupplier,
      trims: d.trims ? d.trims.split(",").map((t) => t.trim()) : [],
      materialNotes: d.materialNotes,
      sizeChart: d.sizeChart,
      // Bug #4: Include Slack image URLs for canvas embedding
      images: d.images || {},
      imageUrls: uploadedImageUrls,
      detailCallouts: (d.detailCallouts || []).map((c, i) => ({
        label: c.label,
        description: c.description || "",
        imageUrl: uploadedImageUrls[`callout_${i}`] || (c.imagePath ? "(see uploaded image)" : ""),
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
  handleSizeChartAction,
  handleSizeChartUpload,
  runVisualsStep,
  runFabricStep,
  runSizeChartStep,
  runOutputStep,
};
