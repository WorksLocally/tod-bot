/**
 * CLI utility for registering slash commands with a guild during development.
 *
 * Usage: npm run deploy:commands (recommended)
 *        or: npx tsx scripts/deploy-commands.ts (after npm install)
 *
 * Note: Do not run with 'node scripts/deploy-commands.ts' directly.
 *       Node.js cannot execute TypeScript files without a transpiler.
 *       Either use 'npm run deploy:commands' or build first with 'npm run build'
 *       and then run 'node dist/scripts/deploy-commands.js'
 *
 * @module scripts/deploy-commands
 */

import { REST, Routes } from 'discord.js';
import config from '../src/config/env.js';
import { loadCommandModules } from '../src/handlers/commandLoader.js';

/**
 * Registers application commands for the configured guild.
 */
const register = async (): Promise<void> => {
  try {
    const commandModules = await loadCommandModules();
    const commands = Array.from(commandModules.values()).map((command) =>
      command.data.toJSON(),
    );

    const rest = new REST({ version: '10' }).setToken(config.token);

    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });
     
    console.log(`Successfully registered ${commands.length} application commands.`);
  } catch (error) {
     
    console.error('Failed to register application commands', error);
    process.exitCode = 1;
  }
};

register();
