/**
 * Helper for loading command modules from disk and preparing them for registration
 * with the Discord client.
 *
 * @module src/handlers/commandLoader
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { SlashCommandBuilder } from 'discord.js';
import logger from '../utils/logger.js';
import { walkJsFiles } from '../utils/fileWalker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CommandModule {
  data: SlashCommandBuilder;
  execute: (...args: unknown[]) => Promise<void>;
}

/**
 * Recursively loads every command module and returns a map keyed by command name.
 *
 * @returns Map of command names to their module exports.
 */
export const loadCommandModules = async (): Promise<Map<string, CommandModule>> => {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = walkJsFiles(commandsPath);

  const commands = new Map<string, CommandModule>();
  for (const file of commandFiles) {
    const fileUrl = `file://${file}`;
    const command = await import(fileUrl) as { default?: CommandModule } & Partial<CommandModule>;
    const commandModule = command.default ?? command;
    
    if (!commandModule?.data || !commandModule?.execute) {
      logger.warn('Skipping command module missing data or execute export', { file });
      continue;
    }
    commands.set(commandModule.data.name, commandModule as CommandModule);
  }

  return commands;
};
