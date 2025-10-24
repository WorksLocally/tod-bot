/**
 * Loads environment configuration for the bot, combining dotenv and dotenvx sources
 * and exposing validated configuration values for downstream modules.
 *
 * @module src/config/env
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dotenvxConfig: ((options: { path: string }) => void) | undefined;
try {
  const dotenvx = await import('dotenvx');
  dotenvxConfig = dotenvx.config;
} catch {
  // dotenvx is optional at runtime; ignore if not installed yet.
}

// Resolve .env path relative to project root (two directories up from this file)
const projectRoot = path.resolve(__dirname, '..', '..');
dotenvConfig({ path: path.join(projectRoot, '.env') });
if (typeof dotenvxConfig === 'function') {
  dotenvxConfig({ path: path.join(projectRoot, '.env') });
}

/**
 * Resolves a required environment variable or throws if it is undefined.
 *
 * @param key - Environment variable name to resolve.
 * @returns The resolved environment variable value.
 * @throws If the environment variable is missing or empty.
 */
const resolveRequired = (key: string): string => {
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
 */
export interface BotConfig {
  token: string;
  clientId: string;
  guildId: string;
  approvalChannelId: string;
  databasePath: string;
  privilegedRoleIds: string[];
}

const config: BotConfig = {
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

export default config;
