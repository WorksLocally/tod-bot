/**
 * Loads environment configuration for the bot, combining dotenv and dotenvx sources
 * and exposing validated configuration values for downstream modules.
 *
 * @module src/config/env
 */

const path = require('path');

const { config: dotenvConfig } = require('dotenv');
let dotenvxConfig;
try {
  ({ config: dotenvxConfig } = require('dotenvx'));
} catch (error) {
  // dotenvx is optional at runtime; ignore if not installed yet.
}

dotenvConfig();
if (typeof dotenvxConfig === 'function') {
  dotenvxConfig();
}

/**
 * Resolves a required environment variable or throws if it is undefined.
 *
 * @param {string} key - Environment variable name to resolve.
 * @returns {string} - The resolved environment variable value.
 * @throws {Error} If the environment variable is missing or empty.
 */
const resolveRequired = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || '';
const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID || '';
const QUESTION_MASTER_ROLE_ID = process.env.QUESTION_MASTER_ROLE_ID || '';

/**
 * Runtime configuration for the bot sourced from environment variables.
 *
 * @typedef {Object} BotConfig
 * @property {string} token - Discord bot token used for authentication.
 * @property {string} clientId - Discord application client ID.
 * @property {string} guildId - Default guild ID used for command registration.
 * @property {string} approvalChannelId - Channel ID where submissions are reviewed.
 * @property {string} databasePath - Absolute path to the SQLite database file.
 * @property {string[]} privilegedRoleIds - Role IDs that may manage questions.
 */

/** @type {BotConfig} */
const config = {
  token: resolveRequired('DISCORD_TOKEN'),
  clientId: resolveRequired('CLIENT_ID'),
  guildId: resolveRequired('GUILD_ID'),
  approvalChannelId: resolveRequired('APPROVAL_CHANNEL_ID'),
  databasePath: process.env.DATABASE_PATH
    ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
    : path.join(process.cwd(), 'data', 'todbot.db'),
  privilegedRoleIds: [ADMIN_ROLE_ID, MODERATOR_ROLE_ID, QUESTION_MASTER_ROLE_ID].filter(
    (value) => Boolean(value && value.trim())
  ),
};

/** @type {BotConfig} */
module.exports = config;
