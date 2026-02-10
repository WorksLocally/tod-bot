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
 * Loads command modules from the top level of the commands directory and returns a map keyed by command name.
 * Subdirectories are not scanned to avoid loading helper modules.
 *
 * @returns Map of command names to their module exports.
 */
export const loadCommandModules = async (): Promise<Map<string, CommandModule>> => {
  const commandsPath = path.join(__dirname, '..', 'commands');
  console.log(`[DEBUG] Loading commands from: ${commandsPath}`); // Debug log
  const commandFiles = walkJsFiles(commandsPath, 0);
  console.log(`[DEBUG] Found command files: ${JSON.stringify(commandFiles)}`); // Debug log

  const commands = new Map<string, CommandModule>();
  for (const file of commandFiles) {
    const fileUrl = `file://${file}`;
    try {
      console.log(`[DEBUG] Importing command: ${file}`); // Debug log
      const command = await import(fileUrl) as { default?: CommandModule } & Partial<CommandModule>;
      const commandModule = command.default ?? command;

      if (!commandModule?.data || !commandModule?.execute) {
        console.warn(`[DEBUG] Skipping command module missing data or execute export: ${file}`); // Debug log
        logger.warn('Skipping command module missing data or execute export', { file });
        continue;
      }
      commands.set(commandModule.data.name, commandModule as CommandModule);
      console.log(`[DEBUG] Loaded command: ${commandModule.data.name}`); // Debug log
    } catch (error) {
      console.error(`[DEBUG] Failed to load command ${file}:`, error); // Debug log
      logger.error(`Failed to load command ${file}`, { error });
    }
  }

  return commands;
};
