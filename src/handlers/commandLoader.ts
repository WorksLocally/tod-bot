/**
 * Helper for loading command modules from disk and preparing them for registration
 * with the Discord client.
 *
 * @module src/handlers/commandLoader
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SlashCommandBuilder } from 'discord.js';
import logger from '../utils/logger.js';

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
  const commandFiles: string[] = [];

  /**
   * Descends into subdirectories collecting TypeScript command modules.
   *
   * @param dir - Directory to scan.
   */
  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        commandFiles.push(entryPath);
      }
    }
  };

  if (fs.existsSync(commandsPath)) {
    walk(commandsPath);
  }

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
