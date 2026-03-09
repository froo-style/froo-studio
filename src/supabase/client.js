const { createClient } = require("@supabase/supabase-js");
const config = require("../config");
const log = require("../utils/logger");

let supabase;

function getClient() {
  if (supabase) return supabase;
  const url = config.supabase.url;
  const key = config.supabase.key;
  if (!url || !key) {
    log.warn("Supabase credentials not configured — DB operations will fail gracefully");
    // Return a stub that throws on any table operation
    supabase = { from: () => { throw new Error("Supabase not configured"); } };
    return supabase;
  }
  supabase = createClient(url, key);
  return supabase;
}

module.exports = { getClient };
