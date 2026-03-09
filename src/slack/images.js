const axios = require("axios");
const config = require("../config");
const storage = require("../utils/storage");
const log = require("../utils/logger");

/**
 * Download an image from Slack (private URL) and save it locally.
 * @param {object} slackFile — a file object from message.files[]
 * @param {string} sampleId — used as subdirectory name
 * @returns {Promise<string>} local file path
 */
async function downloadSlackImage(slackFile, sampleId) {
  const url = slackFile.url_private_download || slackFile.url_private;
  if (!url) {
    throw new Error(`No download URL for Slack file ${slackFile.id}`);
  }

  log.info("Downloading Slack image", { fileId: slackFile.id, name: slackFile.name });

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { Authorization: `Bearer ${config.slack.botToken}` },
    timeout: 30_000,
  });

  const buffer = Buffer.from(response.data);
  const localPath = storage.saveFile(buffer, slackFile.name || "image.jpg", sampleId);
  log.info("Slack image saved locally", { localPath });
  return localPath;
}

/**
 * Download all image files from a parsed sample message.
 * @param {object[]} imageFiles — array of Slack file objects
 * @param {string} sampleId
 * @returns {Promise<string[]>} array of local file paths
 */
async function downloadAllImages(imageFiles, sampleId) {
  const paths = [];
  for (const file of imageFiles) {
    const p = await downloadSlackImage(file, sampleId);
    paths.push(p);
  }
  return paths;
}

module.exports = { downloadSlackImage, downloadAllImages };
