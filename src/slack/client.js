const { App } = require("@slack/bolt");
const config = require("../config");
const log = require("../utils/logger");

let app;

/**
 * Initialize and return the Slack Bolt app (singleton).
 */
function getApp() {
  if (app) return app;
  app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    signingSecret: config.slack.signingSecret,
    socketMode: true,
  });
  log.info("Slack Bolt app initialized (socket mode)");
  return app;
}

/** Convenience shortcut for the WebClient. */
function web() {
  return getApp().client;
}

module.exports = { getApp, web };
