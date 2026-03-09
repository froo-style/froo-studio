const { getClient } = require("./client");
const log = require("../utils/logger");

/**
 * Look up an existing size chart by garment type and category.
 * Returns the chart data or null if not found.
 */
async function findSizeChart(garmentType, category) {
  const db = getClient();
  const { data, error } = await db
    .from("size_charts")
    .select("*")
    .ilike("garment_type", `%${garmentType}%`)
    .ilike("category", `%${category}%`)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    log.error("Size chart lookup failed", { garmentType, category, error: error.message });
    throw error;
  }
  return data || null;
}

/**
 * Get the closest size block for generating a new size chart.
 */
async function findClosestSizeBlock(garmentType, fabricType) {
  const db = getClient();
  const { data, error } = await db
    .from("size_blocks")
    .select("*")
    .ilike("garment_type", `%${garmentType}%`)
    .limit(5);

  if (error) {
    log.error("Size block lookup failed", { error: error.message });
    throw error;
  }

  if (!data || data.length === 0) return null;

  // Prefer blocks matching the fabric type
  if (fabricType) {
    const match = data.find(
      (b) => b.fabric_type && b.fabric_type.toLowerCase() === fabricType.toLowerCase()
    );
    if (match) return match;
  }

  return data[0]; // fallback to first match
}

/**
 * Save a newly generated size chart.
 */
async function saveSizeChart(chart) {
  const db = getClient();
  const { data, error } = await db
    .from("size_charts")
    .insert({
      sample_id: chart.sampleId,
      garment_type: chart.garmentType,
      category: chart.category,
      fabric_type: chart.fabricType || null,
      sample_size: chart.sampleSize,
      chart_data: chart.chartData,
      block_reference: chart.blockReference || null,
      grading_notes: chart.gradingNotes || null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    log.error("Failed to save size chart", { error: error.message });
    throw error;
  }
  log.info("Size chart saved", { id: data.id });
  return data;
}

/**
 * Format a size chart object as a markdown table for the Canvas.
 */
function formatSizeChartTable(chartData) {
  if (!chartData || !chartData.measurements) {
    return "_No measurement data._";
  }

  const sizes = chartData.sizes || [];
  const measurements = chartData.measurements || [];

  if (sizes.length === 0) return "_No sizes defined._";

  // Header row
  let table = `| Measurement | ${sizes.join(" | ")} |\n`;
  table += `| --- | ${sizes.map(() => "---").join(" | ")} |\n`;

  for (const m of measurements) {
    const values = sizes.map((s) => m.values?.[s] ?? "—");
    table += `| ${m.name} | ${values.join(" | ")} |\n`;
  }

  return table;
}

module.exports = { findSizeChart, findClosestSizeBlock, saveSizeChart, formatSizeChartTable };
