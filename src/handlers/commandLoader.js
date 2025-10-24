/**
 * Helper for loading command modules from disk and preparing them for registration
 * with the Discord client.
 *
 * @module src/handlers/commandLoader
 */

const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');

/**
 * Recursively loads every command module and returns a map keyed by command name.
 *
 * @returns {Map<string, { data: import('discord.js').SlashCommandBuilder, execute: Function }>}
 *   Map of command names to their module exports.
 */
const loadCommandModules = () => {
  const commandsPath = path.join(__dirname, '..', 'commands');
  /** @type {string[]} */
  const commandFiles = [];

  /**
   * Descends into subdirectories collecting JavaScript command modules.
   *
   * @param {string} dir - Directory to scan.
   * @returns {void}
   */
  const walk = (dir) => {
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

  const commands = new Map();
  for (const file of commandFiles) {
     
    const command = require(file);
    if (!command?.data || !command?.execute) {
      logger.warn('Skipping command module missing data or execute export', { file });
      continue;
    }
    commands.set(command.data.name, command);
  }

  return commands;
};

module.exports = {
  loadCommandModules,
};
