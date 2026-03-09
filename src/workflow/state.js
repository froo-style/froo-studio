const log = require("../utils/logger");

/**
 * In-memory workflow state store.
 * Maps sampleId -> workflow state object.
 *
 * In production, this would be backed by a database.
 * For now, we store active workflows in memory and persist
 * final results to Supabase.
 */
const workflows = new Map();

/** Workflow step names in order. */
const STEPS = [
  "intake",
  "clarify",
  "visuals",
  "fabric",
  "sizechart",
  "approval",
  "output",
  "complete",
];

/**
 * Create a new workflow state for a sample.
 */
function createWorkflow(sampleId, initialData) {
  const state = {
    sampleId,
    step: "intake",
    data: {
      sampleNumber: null,
      userId: null,
      notes: "",
      inspirationImagePath: null,
      localImagePaths: [],
      brand: null,
      category: null,
      garmentType: null,
      sampleSize: null,
      neckline: null,
      closure: null,
      waistType: null,
      trims: null,
      fit: null,
      fabricType: null,
      fabricDescription: null,
      fabricSupplier: null,
      additionalDetails: null,
      factoryNotes: null,
      constructionNotes: null,
      fitNotes: null,
      productionNotes: null,
      sewingNotes: null,
      finishingNotes: null,
      placementNotes: null,
      materialNotes: null,
      sizeChart: null,
      images: {},
      detailCallouts: [],
      channelId: null,
      threadTs: null,
      outputChannelId: null,
      canvasId: null,
      ...initialData,
    },
    pendingQuestions: [],
    answeredFields: new Set(Object.keys(initialData).filter((k) => initialData[k])),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  workflows.set(sampleId, state);
  log.info("Workflow created", { sampleId, step: state.step });
  return state;
}

/**
 * Get a workflow by sampleId.
 */
function getWorkflow(sampleId) {
  return workflows.get(sampleId) || null;
}

/**
 * Find a workflow by the Slack thread timestamp (for matching replies).
 */
function findWorkflowByThread(channelId, threadTs) {
  for (const [, wf] of workflows) {
    if (wf.data.channelId === channelId && wf.data.threadTs === threadTs) {
      return wf;
    }
  }
  return null;
}

/**
 * Update workflow data fields.
 */
function updateWorkflowData(sampleId, updates) {
  const wf = workflows.get(sampleId);
  if (!wf) return null;
  Object.assign(wf.data, updates);
  wf.updatedAt = new Date().toISOString();
  for (const key of Object.keys(updates)) {
    if (updates[key] != null) wf.answeredFields.add(key);
  }
  return wf;
}

/**
 * Advance workflow to the next step.
 */
function advanceStep(sampleId) {
  const wf = workflows.get(sampleId);
  if (!wf) return null;
  const idx = STEPS.indexOf(wf.step);
  if (idx < STEPS.length - 1) {
    wf.step = STEPS[idx + 1];
    wf.updatedAt = new Date().toISOString();
    log.info("Workflow advanced", { sampleId, step: wf.step });
  }
  return wf;
}

/**
 * Set workflow to a specific step.
 */
function setStep(sampleId, step) {
  const wf = workflows.get(sampleId);
  if (!wf) return null;
  wf.step = step;
  wf.updatedAt = new Date().toISOString();
  return wf;
}

/**
 * Remove a completed workflow from memory.
 */
function removeWorkflow(sampleId) {
  workflows.delete(sampleId);
}

module.exports = {
  STEPS,
  createWorkflow,
  getWorkflow,
  findWorkflowByThread,
  updateWorkflowData,
  advanceStep,
  setStep,
  removeWorkflow,
};
