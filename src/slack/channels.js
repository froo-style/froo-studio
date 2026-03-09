const { web } = require("./client");
const log = require("../utils/logger");

/**
 * Create a new Slack channel named after the sample number.
 * Returns the channel ID.
 * @param {string} sampleNumber
 * @returns {Promise<string>} channelId
 */
async function createSampleChannel(sampleNumber) {
  const name = `sample-${sampleNumber}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  log.info("Creating Slack channel", { name });

  try {
    const result = await web().conversations.create({ name, is_private: false });
    log.info("Channel created", { channelId: result.channel.id, name });
    return result.channel.id;
  } catch (err) {
    // If the channel already exists, find and return it
    if (err.data?.error === "name_taken") {
      log.warn("Channel already exists, looking it up", { name });
      const list = await web().conversations.list({ types: "public_channel", limit: 1000 });
      const existing = list.channels.find((c) => c.name === name);
      if (existing) return existing.id;
    }
    throw err;
  }
}

/**
 * Post a simple text message to a channel.
 */
async function postMessage(channelId, text, threadTs = undefined) {
  const result = await web().chat.postMessage({
    channel: channelId,
    text,
    thread_ts: threadTs,
  });
  return result.ts;
}

/**
 * Post a Block Kit message to a channel.
 */
async function postBlocks(channelId, blocks, text = "", threadTs = undefined) {
  const result = await web().chat.postMessage({
    channel: channelId,
    text,
    blocks,
    thread_ts: threadTs,
  });
  return result.ts;
}

/**
 * Upload an image to a Slack channel.
 */
async function uploadImage(channelId, filePath, filename, title) {
  const fs = require("fs");
  const result = await web().files.uploadV2({
    channel_id: channelId,
    file: fs.createReadStream(filePath),
    filename,
    title: title || filename,
  });
  return result;
}

module.exports = { createSampleChannel, postMessage, postBlocks, uploadImage };
