/**
 * Loads environment configuration for the bot, combining dotenv and dotenvx sources
 * and exposing validated configuration values for downstream modules.
 *
 * @module src/config/env
 */

import fs from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';

/**
 * Note: dotenvx support was intentionally removed during the TypeScript migration.
 * 
 * The project previously attempted to use dotenvx for advanced environment variable
 * management alongside dotenv. However, dotenvx does not have TypeScript type definitions
 * and posed compatibility challenges with ES modules.
 * 
 * The bot now relies solely on dotenv, which provides sufficient functionality for
 * loading environment variables from .env files. If you require advanced features
 * previously provided by dotenvx (such as encryption or multi-environment support),
 * you may need to implement them separately or use alternative solutions.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(moduleDir, '../../.env'),
  path.resolve(moduleDir, '../../../.env'),
];

const envPath = candidateEnvPaths.find((candidate) => fs.existsSync(candidate));

if (envPath) {
  dotenvConfig({ path: envPath });
} else {
  dotenvConfig();
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
