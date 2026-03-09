const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

let supabase;

function getClient() {
  if (supabase) return supabase;
  supabase = createClient(config.supabase.url, config.supabase.key);
  return supabase;
}

module.exports = { getClient };
