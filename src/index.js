/**
 * FROO.studio — Slack-Based Tech Pack Generator
 *
 * Monitors #new-samples for new sample submissions, builds factory-ready
 * tech packs, and delivers them as Slack Canvas documents.
 */

const config = require("./config");
const log = require("./utils/logger");
const { getApp } = require("./slack/client");
const { parseSampleMessage } = require("./slack/parser");
const { findWorkflowByThread, getWorkflow } = require("./workflow/state");
const {
  handleNewSample,
  continueWorkflow,
  handleFabricAction,
  handleApproval,
  handleSizeChartAction,
  handleSizeChartUpload,
} = require("./workflow/pipeline");
const { handleButtonAnswer, handleThreadReply } = require("./workflow/chatbot");
const { ensureDir } = require("./utils/storage");

async function main() {
  log.info("Starting FROO Tech Pack Generator");
  ensureDir();

  const app = getApp();

  // ───────────────────────────────────────────
  // 1. Watch #new-samples for new messages
  // ───────────────────────────────────────────
  app.message(async ({ message, say }) => {
    try {
      log.info("Message event received", {
        channel: message.channel,
        user: message.user,
        subtype: message.subtype,
        hasText: !!message.text,
        hasFiles: !!(message.files && message.files.length),
        fileCount: (message.files || []).length,
        threadTs: message.thread_ts,
        ts: message.ts,
        bot_id: message.bot_id,
      });

      // Skip bot messages
      if (message.subtype === "bot_message" || message.bot_id) {
        log.debug("Skipping bot message");
        return;
      }

      // Only process messages in the new-samples channel
      const channelInfo = await app.client.conversations.info({
        channel: message.channel,
      });

      log.info("Channel info", { channelName: channelInfo.channel.name, expected: config.app.newSamplesChannel });

      if (channelInfo.channel.name !== config.app.newSamplesChannel) {
        // Check if this is a thread reply in an active workflow
        if (message.thread_ts && message.thread_ts !== message.ts) {
          await handleWorkflowReply(message);
        }
        return;
      }

      // Skip thread replies in #new-samples (handled separately)
      if (message.thread_ts && message.thread_ts !== message.ts) {
        await handleWorkflowReply(message);
        return;
      }

      // This is a new top-level message in #new-samples
      log.info("Processing as new sample submission");
      const parsed = parseSampleMessage(message);
      log.info("Parse result", { parsed: !!parsed, sampleNumber: parsed?.sampleNumber, imageCount: parsed?.imageFiles?.length });
      if (parsed) {
        message.channel = message.channel; // ensure channel is set
        await handleNewSample(message);
      } else {
        log.warn("Message did not qualify as sample submission", { text: message.text?.substring(0, 100) });
      }
    } catch (err) {
      log.error("Error handling message", { error: err.message, stack: err.stack });
    }
  });

  // ───────────────────────────────────────────
  // 2. Handle button interactions (clarifying Qs, fabric, approval)
  // ───────────────────────────────────────────
  app.action(/^answer_/, async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id || body.container?.channel_id;
      const threadTs = body.message?.thread_ts || body.message?.ts;

      const wf = await handleButtonAnswer(
        action.action_id,
        action.value,
        body.user.id,
        channelId,
        threadTs
      );

      if (wf) {
        await continueWorkflow(wf.sampleId);
      }
    } catch (err) {
      log.error("Error handling button action", { error: err.message });
    }
  });

  // Fabric action buttons
  app.action("fabric_accept", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const wf = findWorkflowByThread(channelId, threadTs);
      if (wf) {
        await handleFabricAction(wf.sampleId, "accept_suggestion");
      }
    } catch (err) {
      log.error("Error handling fabric accept", { error: err.message });
    }
  });

  app.action("fabric_describe", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const { postMessage } = require("./slack/channels");
      await postMessage(
        channelId,
        "Please describe the fabric you'd like in this thread.",
        threadTs
      );
    } catch (err) {
      log.error("Error handling fabric describe", { error: err.message });
    }
  });

  app.action("fabric_upload", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const { postMessage } = require("./slack/channels");
      await postMessage(
        channelId,
        "Please upload a fabric card or fabric inspiration image in this thread.",
        threadTs
      );
    } catch (err) {
      log.error("Error handling fabric upload", { error: err.message });
    }
  });

  app.action("fabric_source", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const wf = findWorkflowByThread(channelId, threadTs);
      if (wf) {
        const { updateWorkflowData } = require("./workflow/state");
        updateWorkflowData(wf.sampleId, {
          fabricDescription: "To be sourced — similar to inspiration image",
        });
        await handleFabricAction(wf.sampleId, "source_similar");
      }
    } catch (err) {
      log.error("Error handling fabric source", { error: err.message });
    }
  });

  // ───────────────────────────────────────────
  // 3. Size chart action buttons (Bug #3)
  // ───────────────────────────────────────────
  app.action("sizechart_repeat", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const wf = findWorkflowByThread(channelId, threadTs);
      if (wf) {
        await handleSizeChartAction(wf.sampleId, "repeat");
      }
    } catch (err) {
      log.error("Error handling sizechart repeat", { error: err.message });
    }
  });

  app.action("sizechart_new", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const wf = findWorkflowByThread(channelId, threadTs);
      if (wf) {
        await handleSizeChartAction(wf.sampleId, "new_body");
      }
    } catch (err) {
      log.error("Error handling sizechart new body", { error: err.message });
    }
  });

  app.action("sizechart_upload", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const wf = findWorkflowByThread(channelId, threadTs);
      if (wf) {
        await handleSizeChartAction(wf.sampleId, "upload");
      }
    } catch (err) {
      log.error("Error handling sizechart upload", { error: err.message });
    }
  });

  // Approval action buttons
  app.action("techpack_approve", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const wf = findWorkflowByThread(channelId, threadTs);
      if (wf) {
        await handleApproval(wf.sampleId, "approve");
      }
    } catch (err) {
      log.error("Error handling approval", { error: err.message });
    }
  });

  app.action("techpack_edit", async ({ action, body, ack }) => {
    await ack();
    try {
      const channelId = body.channel?.id;
      const threadTs = body.message?.thread_ts;
      const wf = findWorkflowByThread(channelId, threadTs);
      if (wf) {
        await handleApproval(wf.sampleId, "edit");
      }
    } catch (err) {
      log.error("Error handling edit request", { error: err.message });
    }
  });

  // ───────────────────────────────────────────
  // Start the app
  // ───────────────────────────────────────────
  await app.start(config.app.port);
  log.info(`FROO Tech Pack Generator running on port ${config.app.port}`);
  log.info(`Watching Slack channel: #${config.app.newSamplesChannel}`);
}

/**
 * Handle thread replies that may be answers to workflow questions.
 */
async function handleWorkflowReply(message) {
  if (!message.thread_ts || message.bot_id || message.subtype === "bot_message") {
    return;
  }

  const channelId = message.channel;
  const threadTs = message.thread_ts;
  const text = (message.text || "").trim();

  const wf = findWorkflowByThread(channelId, threadTs);
  if (!wf) return;

  // If we're in the fabric step and user sends text, treat as fabric description
  if (wf.step === "fabric" && text) {
    const { updateWorkflowData } = require("./workflow/state");
    updateWorkflowData(wf.sampleId, { fabricDescription: text });
    const { postMessage } = require("./slack/channels");
    await postMessage(channelId, `Fabric noted: ${text}`, threadTs);
    await handleFabricAction(wf.sampleId, "describe");
    return;
  }

  // If we're in the sizechart step and user sends text/file, treat as size chart upload
  if (wf.step === "sizechart" && text) {
    await handleSizeChartUpload(wf.sampleId, text);
    return;
  }

  // If we're in the approval step and user sends edits
  if (wf.step === "approval" && text) {
    const { postMessage } = require("./slack/channels");
    const { updateWorkflowData } = require("./workflow/state");
    updateWorkflowData(wf.sampleId, { additionalDetails: text });
    await postMessage(channelId, "Edits noted. Regenerating notes...", threadTs);
    await continueWorkflow(wf.sampleId);
    return;
  }

  // Otherwise treat as a clarifying question answer
  const updated = await handleThreadReply(text, message.user, channelId, threadTs);
  if (updated) {
    await continueWorkflow(updated.sampleId);
  }
}

// Boot
main().catch((err) => {
  log.error("Fatal startup error", { error: err.message, stack: err.stack });
  process.exit(1);
});
