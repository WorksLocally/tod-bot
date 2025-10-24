/**
 * Utility for recursively discovering JavaScript files in a directory tree.
 *
 * @module src/utils/fileWalker
 */

import fs from 'fs';
import path from 'path';

/**
 * Recursively walks a directory and collects all JavaScript file paths.
 * 
 * @param dir - Directory to scan.
 * @returns Array of absolute paths to JavaScript files.
 */
export const walkJsFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  }
  
  return files;
};
