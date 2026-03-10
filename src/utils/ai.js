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
  const systemPrompt = `You are an expert apparel production assistant for a children's and women's clothing company. Generate clear, concise, factory-ready bullet-point notes for garment production. Be specific about construction details.

IMPORTANT: You must strictly separate garment/style/construction notes from fabric notes.
- Garment notes cover: silhouette, construction, seams, closures, hems, trims, finishes, placement
- Fabric notes cover: composition, weight (GSM), width, article number, hand-feel, care instructions, fabric-specific details

Never mix fabric information into the garment sections, and never mix construction details into the fabric section.`;

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
Fabric Description: ${sampleData.fabricDescription || "TBD"}
Trims: ${sampleData.trims || "TBD"}

Designer Notes:
${sampleData.notes || "None provided"}

Additional Details:
${sampleData.additionalDetails || "None"}

Image Analysis:
${sampleData.imageAnalysis || "No image analysis available"}

Generate the following sections with clear headers:

## Factory Notes
(General factory instructions — bullet points about the garment style and silhouette)

## Construction Notes
(Seams, stitching, lining, interfacing — bullet points)

## Fit Notes
(Fit guidance — bullet points)

## Sewing Notes
(Sewing instructions — bullet points)

## Finishing Notes
(Finishing, pressing, QC — bullet points)

## Placement Notes
(Print, embroidery, trim placement — bullet points)

## Fabric Notes
(Fabric composition, weight, width, article number, hand-feel, care — bullet points. This section goes on a separate page.)

## Production Notes
(Overall production summary — bullet points)`;

  return callClaude(systemPrompt, userPrompt);
}

/**
 * Analyze an inspiration image with Gemini Vision and generate professional factory notes.
 */
async function analyzeAndGenerateNotes(imagePath, userNotes, sampleData) {
  const fs = require("fs");
  if (!imagePath || !fs.existsSync(imagePath)) {
    return null;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");

  const analysisPrompt = `You are a senior garment technician analysing an inspiration image for factory tech pack production.

Analyse this garment image in detail and generate comprehensive factory-ready notes.

The designer provided these notes: "${userNotes || "No notes provided"}"

Garment details:
- Type: ${sampleData.garmentType || "unknown"}
- Category: ${sampleData.category || "unknown"}
- Brand: ${sampleData.brand || "unknown"}

Generate detailed bullet-point notes covering ALL of the following:

## GARMENT NOTES (for Page 1 — Design Overview)
- Silhouette and overall style description
- Construction details (seams, lining, interfacing)
- Closures (zip, buttons, poppers, elastic, etc.)
- Neckline, collar, sleeve details
- Hem finish
- Trims and embellishments
- Any special details visible (embroidery, lace, smocking, pleats, piping, etc.)
- Fit and proportion notes

## FABRIC NOTES (for Page 2 — Fabric Section)
- Recommended fabric type and weight (GSM)
- Fabric composition recommendation
- Fabric hand-feel and drape
- Any fabric-specific construction considerations

Be thorough and professional. These notes go directly to the factory.`;

  try {
    const analysis = await analyzeImageWithGemini(imageBase64, analysisPrompt);
    return analysis;
  } catch (err) {
    log.warn("Image analysis failed", { error: err.message });
    return null;
  }
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

module.exports = { callClaude, generateFactoryNotes, suggestFabric, analyzeImageWithGemini, analyzeAndGenerateNotes };
