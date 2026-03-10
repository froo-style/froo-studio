const log = require("../utils/logger");

/**
 * Determine whether a Slack message qualifies as a new sample submission.
 * Returns parsed sample data or null if the message does not qualify.
 */
function parseSampleMessage(message) {
  if (!message || message.subtype === "bot_message" || message.bot_id) {
    return null; // ignore bot messages
  }

  const text = (message.text || "").trim();
  const files = message.files || [];

  // Must have some text (sample notes) and at least one image attachment
  const imageFiles = files.filter(
    (f) => f.mimetype && f.mimetype.startsWith("image/")
  );

  if (!text && imageFiles.length === 0) {
    return null; // not a sample submission
  }

  // Try to extract a sample number from text — patterns like SAMPLE-1024, #1024, Sample 1024
  const sampleNumMatch = text.match(
    /(?:SAMPLE|sample|Sample|#)\s*[-:]?\s*(\d{3,6})/
  );

  return {
    sampleNumber: sampleNumMatch ? sampleNumMatch[1] : null,
    userId: message.user,
    notes: text,
    imageFiles,
    allFiles: files,
    timestamp: message.ts,
    channelId: message.channel || null,
    threadTs: message.thread_ts || message.ts,
  };
}

/**
 * Extract fields the user may have already provided in their notes so
 * we can skip those questions in the chatbot flow.
 */
function extractKnownFields(notes) {
  const lower = notes.toLowerCase();
  const known = {};

  // Brand detection
  const brands = ["sweet threads", "froo", "soiree", "prairie"];
  for (const b of brands) {
    if (lower.includes(b)) {
      known.brand = b.replace(/\b\w/g, (c) => c.toUpperCase());
      break;
    }
  }

  // Category detection
  const categories = {
    baby: "Baby", toddler: "Toddler", boy: "Boys", boys: "Boys",
    girl: "Girls", girls: "Girls", preteen: "Preteen", teen: "Teen",
    women: "Women", men: "Men",
  };
  for (const [kw, val] of Object.entries(categories)) {
    if (lower.includes(kw)) { known.category = val; break; }
  }

  // Garment type detection
  const garments = [
    "dress", "skirt", "hoodie", "top", "pant", "short", "jacket",
    "romper", "jumpsuit", "blazer", "shirt", "coat", "vest", "bodysuit",
  ];
  for (const g of garments) {
    if (lower.includes(g)) { known.garmentType = g; break; }
  }

  // Fabric type
  if (lower.includes("knit")) known.fabricType = "knit";
  else if (lower.includes("woven")) known.fabricType = "woven";

  // Fit
  const fits = ["oversized", "slim", "boxy", "relaxed", "fitted", "regular"];
  for (const f of fits) {
    if (lower.includes(f)) { known.fit = f; break; }
  }

  // Neckline
  const necklines = [
    "collar", "crew neck", "v-neck", "square neck", "scoop neck",
    "boat neck", "mock neck", "turtleneck", "peter pan collar", "henley",
  ];
  for (const n of necklines) {
    if (lower.includes(n)) { known.neckline = n; break; }
  }

  // Closure
  const closures = ["zip", "buttons", "snaps", "pull-on", "hook & eye", "velcro", "tie"];
  for (const c of closures) {
    if (lower.includes(c)) { known.closure = c; break; }
  }

  // Waist
  const waists = ["elastic", "flat waistband", "drawcord", "smocked", "paperbag", "rib waist"];
  for (const w of waists) {
    if (lower.includes(w)) { known.waistType = w; break; }
  }

  // Sample size detection — scan for common size references (Bug #6)
  if (!known.sampleSize) {
    const ageSize = notes.match(/\b(\d{1,2})\s*[Yy]\b/);
    if (ageSize) {
      known.sampleSize = `${ageSize[1]}Y`;
    }
    if (!known.sampleSize) {
      const toddlerSize = notes.match(/\b(\d)[Tt]\b/);
      if (toddlerSize) known.sampleSize = `${toddlerSize[1]}T`;
    }
    if (!known.sampleSize) {
      const monthSize = notes.match(/\b(\d{1,2})\s*[Mm]\b/);
      if (monthSize) known.sampleSize = `${monthSize[1]}M`;
    }
    if (!known.sampleSize) {
      const adultSize = notes.match(/\b(XXL|XL|XS|[SML])\b/);
      if (adultSize) known.sampleSize = adultSize[1].toUpperCase();
    }
    if (!known.sampleSize) {
      const numericSize = notes.match(/\bsize\s*(\d{1,2})\b/i);
      if (numericSize) known.sampleSize = numericSize[1];
    }
  }

  log.debug("Extracted known fields from notes", { known });
  return known;
}

/**
 * Detect which uploaded images are likely fabric cards vs inspiration images.
 * Returns { inspirationImages, fabricCardImages } arrays of file objects.
 */
function classifyUploadedImages(imageFiles) {
  const fabricCardImages = [];
  const inspirationImages = [];

  for (const f of imageFiles) {
    const name = (f.name || f.title || "").toLowerCase();
    const isFabricCard =
      name.includes("fabric") ||
      name.includes("swatch") ||
      name.includes("card") ||
      name.includes("composition") ||
      name.includes("material") ||
      name.includes("textile");

    if (isFabricCard) {
      fabricCardImages.push(f);
    } else {
      inspirationImages.push(f);
    }
  }

  return { inspirationImages, fabricCardImages };
}

module.exports = { parseSampleMessage, extractKnownFields, classifyUploadedImages };
