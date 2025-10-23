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

module.exports = config;
