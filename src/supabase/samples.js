const { getClient } = require("./client");
const log = require("../utils/logger");

/**
 * Create a new sample record in Supabase.
 * @param {object} data
 * @returns {Promise<object>} the inserted record
 */
async function createSample(data) {
  const db = getClient();
  const row = {
    sample_number: data.sampleNumber,
    user_id: data.userId,
    notes: data.notes,
    inspiration_image_path: data.inspirationImagePath || null,
    status: "intake",
    created_at: new Date().toISOString(),
    slack_channel_id: data.channelId || null,
    slack_thread_ts: data.threadTs || null,
    brand: data.brand || null,
    category: data.category || null,
    garment_type: data.garmentType || null,
    sample_size: data.sampleSize || null,
  };

  const { data: inserted, error } = await db
    .from("samples")
    .insert(row)
    .select()
    .single();

  if (error) {
    log.error("Failed to create sample", { error: error.message });
    throw error;
  }

  log.info("Sample record created", { id: inserted.id, sampleNumber: data.sampleNumber });
  return inserted;
}

/**
 * Update an existing sample record.
 */
async function updateSample(sampleId, updates) {
  const db = getClient();
  const { data, error } = await db
    .from("samples")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", sampleId)
    .select()
    .single();

  if (error) {
    log.error("Failed to update sample", { sampleId, error: error.message });
    throw error;
  }
  return data;
}

/**
 * Get a sample by its sample number.
 */
async function getSampleByNumber(sampleNumber) {
  const db = getClient();
  const { data, error } = await db
    .from("samples")
    .select("*")
    .eq("sample_number", sampleNumber)
    .single();

  if (error && error.code !== "PGRST116") {
    log.error("Failed to fetch sample", { sampleNumber, error: error.message });
    throw error;
  }
  return data || null;
}

/**
 * Generate the next sample number by finding the max existing number.
 */
async function nextSampleNumber() {
  const db = getClient();
  const { data, error } = await db
    .from("samples")
    .select("sample_number")
    .order("sample_number", { ascending: false })
    .limit(1);

  if (error) {
    log.warn("Could not fetch max sample number, starting at 1001", { error: error.message });
    return "1001";
  }

  if (!data || data.length === 0) return "1001";

  const maxNum = parseInt(data[0].sample_number, 10);
  return isNaN(maxNum) ? "1001" : String(maxNum + 1);
}

module.exports = { createSample, updateSample, getSampleByNumber, nextSampleNumber };
