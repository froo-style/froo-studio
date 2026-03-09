const axios = require("axios");
const config = require("../config");
const log = require("../utils/logger");

/**
 * Call Anthropic Claude to generate factory notes and production guidance.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function callClaude(systemPrompt, userPrompt) {
  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    },
    {
      headers: {
        "x-api-key": config.anthropic.key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 60_000,
    }
  );

  return res.data.content?.[0]?.text || "";
}

/**
 * Generate factory notes from the collected sample data.
 */
async function generateFactoryNotes(sampleData) {
  const systemPrompt = `You are an expert apparel production assistant for a children's and women's clothing company. Generate clear, concise, factory-ready bullet-point notes for garment production. Be specific about construction details.`;

  const userPrompt = `Create factory-ready production notes for this garment:

Brand: ${sampleData.brand || "TBD"}
Category: ${sampleData.category || "TBD"}
Garment Type: ${sampleData.garmentType || "TBD"}
Sample Size: ${sampleData.sampleSize || "TBD"}
Neckline: ${sampleData.neckline || "TBD"}
Closure: ${sampleData.closure || "TBD"}
Waist Type: ${sampleData.waistType || "TBD"}
Fit: ${sampleData.fit || "TBD"}
Fabric Type: ${sampleData.fabricType || "TBD"}
Trims: ${sampleData.trims || "TBD"}

Designer Notes:
${sampleData.notes || "None provided"}

Additional Details:
${sampleData.additionalDetails || "None"}

Generate:
1. Factory Notes (bullet points)
2. Construction Notes (bullet points)
3. Fit Notes (bullet points)
4. Sewing Notes (bullet points)
5. Finishing Notes (bullet points)
6. Placement Notes (bullet points)`;

  return callClaude(systemPrompt, userPrompt);
}

/**
 * Suggest a fabric based on the garment description and type.
 */
async function suggestFabric(sampleData) {
  const systemPrompt = `You are a fabric sourcing expert for a clothing company. Suggest the most appropriate fabric for the described garment. Be specific about fabric composition, weight, and hand-feel.`;

  const userPrompt = `Suggest the best fabric for this garment:

Garment Type: ${sampleData.garmentType || "unknown"}
Category: ${sampleData.category || "unknown"}
Fit: ${sampleData.fit || "unknown"}
Fabric Type: ${sampleData.fabricType || "unknown"}
Designer Notes: ${sampleData.notes || "none"}

Provide:
1. Recommended fabric name and composition
2. Weight (GSM)
3. Hand-feel description
4. Why this fabric works for this garment`;

  return callClaude(systemPrompt, userPrompt);
}

/**
 * Analyze an image using Gemini Vision to extract design details.
 */
async function analyzeImageWithGemini(imageBase64, prompt) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${config.gemini.key}`,
    {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64,
              },
            },
          ],
        },
      ],
    },
    { timeout: 60_000 }
  );

  return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

module.exports = { callClaude, generateFactoryNotes, suggestFabric, analyzeImageWithGemini };
