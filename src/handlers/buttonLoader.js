const fs = require('fs');
const path = require('path');

const loadButtonHandlers = () => {
  const buttonsPath = path.join(__dirname, '..', 'interactions', 'buttons');
  const buttonFiles = [];

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
    // eslint-disable-next-line global-require, import/no-dynamic-require
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
      // eslint-disable-next-line no-console
      console.warn(`Skipping button handler at ${file} - missing identifier`);
    }
  }

  return handlers;
};

module.exports = {
  loadButtonHandlers,
};
