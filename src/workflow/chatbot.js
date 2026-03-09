const { postMessage, postBlocks } = require("../slack/channels");
const { getNextQuestion, getMissingQuestions } = require("./questions");
const {
  getWorkflow,
  updateWorkflowData,
  advanceStep,
  findWorkflowByThread,
} = require("./state");
const log = require("../utils/logger");

/**
 * Send the next clarifying question to the user in the Slack thread.
 * Returns true if a question was asked, false if all questions are answered.
 */
async function askNextQuestion(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return false;

  const question = getNextQuestion(wf.data);
  if (!question) {
    log.info("All clarifying questions answered", { sampleId });
    return false;
  }

  const { channelId, threadTs } = wf.data;

  if (question.options && question.options.length > 0) {
    // Send as buttons for easy selection
    const blocks = [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${question.question}*` },
      },
      {
        type: "actions",
        block_id: `q_${question.field}`,
        elements: question.options.slice(0, 25).map((opt) => ({
          type: "button",
          text: { type: "plain_text", text: String(opt).substring(0, 75) },
          value: String(opt),
          action_id: `answer_${question.field}_${String(opt).replace(/\s+/g, "_")}`,
        })),
      },
    ];

    await postBlocks(channelId, blocks, question.question, threadTs);
  } else {
    // Free text question
    await postMessage(
      channelId,
      `*${question.question}*\n_Reply in this thread with your answer._`,
      threadTs
    );
  }

  // Track which question we're waiting for
  wf.pendingQuestions = [question.field];
  log.info("Asked clarifying question", { sampleId, field: question.field });
  return true;
}

/**
 * Handle a button action response (user clicked a button answer).
 */
async function handleButtonAnswer(actionId, value, userId, channelId, threadTs) {
  // Parse the field from the action_id: answer_<field>_<value>
  const match = actionId.match(/^answer_(\w+)_/);
  if (!match) return null;

  const field = match[1];
  const wf = findWorkflowByThread(channelId, threadTs);
  if (!wf) {
    log.warn("No workflow found for button answer", { channelId, threadTs });
    return null;
  }

  // Update the workflow data
  updateWorkflowData(wf.sampleId, { [field]: value });
  log.info("Button answer received", { sampleId: wf.sampleId, field, value });

  // Acknowledge
  await postMessage(
    channelId,
    `Got it — *${field}*: ${value}`,
    threadTs
  );

  return wf;
}

/**
 * Handle a free-text thread reply as an answer to the pending question.
 */
async function handleThreadReply(text, userId, channelId, threadTs) {
  const wf = findWorkflowByThread(channelId, threadTs);
  if (!wf) return null;

  if (wf.pendingQuestions.length === 0) {
    log.debug("No pending questions for this thread reply");
    return null;
  }

  const field = wf.pendingQuestions[0];
  updateWorkflowData(wf.sampleId, { [field]: text.trim() });
  wf.pendingQuestions = [];

  log.info("Thread reply answer", { sampleId: wf.sampleId, field, value: text.trim() });

  await postMessage(channelId, `Got it — *${field}*: ${text.trim()}`, threadTs);

  return wf;
}

/**
 * Check if the clarifying step is complete (no more required questions).
 */
function isClarifyComplete(sampleId) {
  const wf = getWorkflow(sampleId);
  if (!wf) return false;
  const remaining = getMissingQuestions(wf.data);
  const requiredRemaining = remaining.filter((q) => q.required);
  return requiredRemaining.length === 0;
}

module.exports = {
  askNextQuestion,
  handleButtonAnswer,
  handleThreadReply,
  isClarifyComplete,
};
