/**
 * Discovers and aggregates button interaction handlers from the interactions directory.
 *
 * @module src/handlers/buttonLoader
 */

const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');

/**
 * Recursively reads button handler modules and indexes them by identifier.
 *
 * @returns {Map<string | Function, { execute: Function }>} - Map that associates button IDs or matchers with handlers.
 */
const loadButtonHandlers = () => {
  const buttonsPath = path.join(__dirname, '..', 'interactions', 'buttons');
  /** @type {string[]} */
  const buttonFiles = [];

  /**
   * Recursively collects JavaScript files from the provided directory.
   *
   * @param {string} dir - Directory to scan for handlers.
   * @returns {void}
   */
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        buttonFiles.push(entryPath);
      }
    }
  };

  if (fs.existsSync(buttonsPath)) {
    walk(buttonsPath);
  }

  const handlers = new Map();
  for (const file of buttonFiles) {
     
    const handler = require(file);
    if (!handler) {
      continue;
    }

    if (handler.customId) {
      handlers.set(handler.customId, handler);
    } else if (Array.isArray(handler.customIds)) {
      handler.customIds.forEach((id) => handlers.set(id, handler));
    } else if (typeof handler.match === 'function') {
      handlers.set(handler.match, handler);
    } else {
      logger.warn('Skipping button handler missing identifier', { file });
    }
  }

  return handlers;
};

module.exports = {
  loadButtonHandlers,
};
