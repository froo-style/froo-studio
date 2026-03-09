-- FROO Tech Pack Generator — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- Samples table: stores each sample submission
CREATE TABLE IF NOT EXISTS samples (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_number TEXT NOT NULL UNIQUE,
  user_id       TEXT,                          -- Slack user ID
  notes         TEXT,
  inspiration_image_path TEXT,
  status        TEXT DEFAULT 'intake',         -- intake, clarify, visuals, fabric, sizechart, approval, output, complete
  brand         TEXT,
  category      TEXT,
  garment_type  TEXT,
  sample_size   TEXT,
  neckline      TEXT,
  closure       TEXT,
  waist_type    TEXT,
  fit           TEXT,
  fabric_type   TEXT,
  fabric_description TEXT,
  fabric_supplier TEXT,
  trims         TEXT,
  additional_details TEXT,
  factory_notes TEXT,
  construction_notes TEXT,
  fit_notes     TEXT,
  production_notes TEXT,
  sewing_notes  TEXT,
  finishing_notes TEXT,
  placement_notes TEXT,
  slack_channel_id TEXT,
  slack_thread_ts TEXT,
  output_channel_id TEXT,
  canvas_id     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Size charts table: reusable size charts by garment type / category
CREATE TABLE IF NOT EXISTS size_charts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id       UUID REFERENCES samples(id),
  garment_type    TEXT NOT NULL,
  category        TEXT NOT NULL,
  fabric_type     TEXT,
  sample_size     TEXT,
  chart_data      JSONB,            -- { sizes: [...], measurements: [{ name, values: { size: val } }] }
  block_reference TEXT,
  grading_notes   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Size blocks table: base measurement blocks for generating new charts
CREATE TABLE IF NOT EXISTS size_blocks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  name          TEXT,
  garment_type  TEXT,
  fabric_type   TEXT,
  category      TEXT,
  sizes         TEXT,               -- e.g. "3Y-22"
  chart_data    JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_samples_number ON samples(sample_number);
CREATE INDEX IF NOT EXISTS idx_sizecharts_type ON size_charts(garment_type, category);
CREATE INDEX IF NOT EXISTS idx_sizeblocks_type ON size_blocks(garment_type);

-- Enable Row Level Security (optional — adjust policies to your needs)
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_blocks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON samples FOR ALL USING (true);
CREATE POLICY "Service role full access" ON size_charts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON size_blocks FOR ALL USING (true);
