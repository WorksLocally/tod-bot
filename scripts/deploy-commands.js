/**
 * CLI utility for registering slash commands with a guild during development.
 *
 * @module scripts/deploy-commands
 */

const { REST, Routes } = require('discord.js');

const config = require('../src/config/env');
const { loadCommandModules } = require('../src/handlers/commandLoader');

/**
 * Serialized slash command definitions ready for the REST API.
 *
 * @type {import('discord.js').RESTPostAPIChatInputApplicationCommandsJSONBody[]}
 */
const commands = Array.from(loadCommandModules().values()).map((command) =>
  command.data.toJSON(),
);

const rest = new REST({ version: '10' }).setToken(config.token);

/**
 * Registers application commands for the configured guild.
 *
 * @returns {Promise<void>}
 */
const register = async () => {
  try {
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
