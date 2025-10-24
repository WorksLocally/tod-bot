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
 * @param maxDepth - Maximum depth to recurse. 0 means only scan the specified directory.
 * @returns Array of absolute paths to JavaScript files.
 */
export const walkJsFiles = (dir: string, maxDepth = Infinity): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && maxDepth > 0) {
      files.push(...walkJsFiles(entryPath, maxDepth - 1));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  }
  
  return files;
};
