const fs = require('fs');
const path = require('path');

const loadCommandModules = () => {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = [];

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
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const command = require(file);
    if (!command?.data || !command?.execute) {
      // eslint-disable-next-line no-console
      console.warn(`Skipping command at ${file} - missing data or execute export.`);
      continue;
    }
    commands.set(command.data.name, command);
  }

  return commands;
};

module.exports = {
  loadCommandModules,
};
