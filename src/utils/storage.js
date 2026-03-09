const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const log = require("./logger");

const uploadDir = path.resolve(config.app.uploadDir);

/** Ensure upload directory exists. */
function ensureDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    log.info("Created upload directory", { path: uploadDir });
  }
}

/**
 * Save a buffer to disk and return the local file path.
 * @param {Buffer} buffer - file content
 * @param {string} originalName - original filename (used for extension)
 * @param {string} [subdir] - optional subdirectory under uploads/
 * @returns {string} absolute path to saved file
 */
function saveFile(buffer, originalName, subdir = "") {
  ensureDir();
  const ext = path.extname(originalName) || ".jpg";
  const dir = subdir ? path.join(uploadDir, subdir) : uploadDir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  log.info("File saved", { filePath, size: buffer.length });
  return filePath;
}

/**
 * Read a file from disk.
 * @param {string} filePath
 * @returns {Buffer}
 */
function readFile(filePath) {
  return fs.readFileSync(filePath);
}

module.exports = { saveFile, readFile, ensureDir, uploadDir };
