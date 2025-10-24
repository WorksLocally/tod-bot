/**
 * Discovers and aggregates button interaction handlers from the interactions directory.
 *
 * @module src/handlers/buttonLoader
 */

import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { walkJsFiles } from '../utils/fileWalker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ButtonHandler {
  execute: (...args: unknown[]) => Promise<void>;
  customId?: string;
  customIds?: string[];
  match?: (customId: string) => boolean;
}

/**
 * Recursively reads button handler modules and indexes them by identifier.
 *
 * @returns Map that associates button IDs or matchers with handlers.
 */
export const loadButtonHandlers = async (): Promise<Map<string | ((customId: string) => boolean), ButtonHandler>> => {
  const buttonsPath = path.join(__dirname, '..', 'interactions', 'buttons');
  const buttonFiles = walkJsFiles(buttonsPath);

  const handlers = new Map<string | ((customId: string) => boolean), ButtonHandler>();
  for (const file of buttonFiles) {
    const fileUrl = `file://${file}`;
    const handlerModule = await import(fileUrl) as { default?: ButtonHandler } & Partial<ButtonHandler>;
    const handler = handlerModule.default ?? handlerModule as ButtonHandler;
    
    if (!handler || !handler.execute) {
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
