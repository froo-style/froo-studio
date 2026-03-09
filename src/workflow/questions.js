const config = require("../config");

/**
 * Define all possible clarifying questions and which workflow fields they fill.
 * Each question knows when to skip (if the field is already answered).
 */
const QUESTION_DEFS = [
  {
    field: "brand",
    question: "What brand is this sample for?",
    options: config.brands,
    required: true,
  },
  {
    field: "category",
    question: "What category?",
    options: config.categories,
    required: true,
  },
  {
    field: "garmentType",
    question: "What type of garment is this?",
    options: config.garmentTypes,
    required: true,
  },
  {
    field: "sampleSize",
    question: "What is the sample size?",
    options: null, // dynamic based on category
    required: true,
    dynamicOptions: (data) => config.sampleSizes[data.category] || [],
  },
  {
    field: "neckline",
    question: "What neckline type?",
    options: config.necklineTypes,
    required: false,
    relevantFor: ["dress", "top", "hoodie", "shirt", "blazer", "bodysuit", "romper", "jumpsuit"],
  },
  {
    field: "closure",
    question: "What closure type?",
    options: config.closureTypes,
    required: false,
  },
  {
    field: "waistType",
    question: "What waist type?",
    options: config.waistTypes,
    required: false,
    relevantFor: ["pant", "short", "skirt", "dress", "romper", "jumpsuit"],
  },
  {
    field: "fit",
    question: "What fit?",
    options: config.fitTypes,
    required: false,
  },
  {
    field: "fabricType",
    question: "Is this garment knit or woven?",
    options: ["knit", "woven"],
    required: true,
  },
  {
    field: "trims",
    question: "Any trims? (e.g., lace, embroidery, buttons, binding, rib)",
    options: null, // free text
    required: false,
  },
  {
    field: "additionalDetails",
    question: "Any additional construction details for the factory?",
    options: null, // free text
    required: false,
  },
];

/**
 * Determine which questions still need to be asked given the current workflow data.
 * Filters out already-answered fields and irrelevant questions.
 *
 * @param {object} data — current workflow data
 * @returns {Array<object>} list of questions to ask next
 */
function getMissingQuestions(data) {
  const missing = [];

  for (const q of QUESTION_DEFS) {
    // Skip if already answered
    if (data[q.field] != null && data[q.field] !== "") continue;

    // Skip if this question is only relevant for certain garment types and
    // the current garment type doesn't match
    if (q.relevantFor && data.garmentType) {
      if (!q.relevantFor.includes(data.garmentType.toLowerCase())) continue;
    }

    // For dynamic options, compute them
    const opts = q.dynamicOptions ? q.dynamicOptions(data) : q.options;

    missing.push({
      ...q,
      options: opts,
    });
  }

  return missing;
}

/**
 * Get only the next question to ask (one at a time for chatbot flow).
 */
function getNextQuestion(data) {
  const missing = getMissingQuestions(data);
  // Prioritize required questions first
  const required = missing.filter((q) => q.required);
  return required[0] || missing[0] || null;
}

module.exports = { QUESTION_DEFS, getMissingQuestions, getNextQuestion };
