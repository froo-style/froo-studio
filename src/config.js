require("dotenv").config();

module.exports = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },
  nanoBanana: {
    apiUrl: process.env.NANO_BANANA_API_URL || "https://api.nanobanana.com/v1",
    apiKey: process.env.NANO_BANANA_API_KEY,
  },
  gemini: {
    key: process.env.GEMINI_KEY,
  },
  anthropic: {
    key: process.env.ANTHROPIC_API_KEY,
  },
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    uploadDir: process.env.UPLOAD_DIR || "./uploads",
    newSamplesChannel: process.env.NEW_SAMPLES_CHANNEL || "new-samples",
  },

  // Garment domain constants carried over from existing FROO.studio data
  brands: ["Sweet Threads", "Froo", "Soiree", "Prairie"],
  categories: ["Baby", "Boys", "Girls", "Preteen", "Teen", "Women", "Men", "Toddler"],
  sampleSizes: {
    Baby: ["6M", "9M", "12M", "18M", "24M", "2Y", "3Y", "4Y"],
    Boys: ["2Y", "3Y", "4Y", "5Y", "6Y", "7Y", "8Y", "10Y"],
    Girls: ["2Y", "3Y", "4Y", "5Y", "6Y", "7Y", "8Y", "10Y"],
    Preteen: ["10", "12", "14", "16"],
    Teen: ["12", "14", "16", "18", "20"],
    Women: ["XS", "S", "M", "L", "XL"],
    Men: ["S", "M", "L", "XL", "XXL"],
    Toddler: ["2T", "3T", "4T", "5T"],
  },
  garmentTypes: [
    "dress", "skirt", "hoodie", "top", "pant", "short", "jacket",
    "romper", "jumpsuit", "blazer", "shirt", "coat", "vest", "bodysuit",
  ],
  necklineTypes: [
    "collar", "crew neck", "v-neck", "square neck", "scoop neck",
    "boat neck", "mock neck", "turtleneck", "peter pan collar", "henley",
  ],
  closureTypes: ["zip", "buttons", "snaps", "pull-on", "hook & eye", "velcro", "tie"],
  waistTypes: ["elastic", "flat waistband", "drawcord", "smocked", "paperbag", "rib"],
  trimTypes: [
    "lace", "embroidery", "buttons", "patches", "binding", "rib",
    "piping", "ruffle", "bow", "appliqué", "broderie anglaise",
  ],
  fitTypes: ["oversized", "slim", "boxy", "relaxed", "fitted", "regular"],
};
