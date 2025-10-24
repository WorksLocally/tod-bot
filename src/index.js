/**
 * Entry point for the Truth or Dare Discord bot. Initializes the Discord client,
 * loads commands and button handlers, and orchestrates interaction handling.
 *
 * @module src/index
 */

const { Client, Collection, GatewayIntentBits, Partials, Events, MessageFlags } = require('discord.js');

const config = require('./config/env');
const { loadCommandModules } = require('./handlers/commandLoader');
const { loadButtonHandlers } = require('./handlers/buttonLoader');
const logger = require('./utils/logger');

/**
 * Discord client instance responsible for interacting with the Discord API.
 *
 * @type {Client}
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

/**
 * Collection of loaded slash command modules keyed by name.
 *
 * @type {Map<string, { data: import('discord.js').SlashCommandBuilder, execute: Function }>}
 */
const commands = loadCommandModules();
/**
 * Mapping of button custom IDs or predicates to handler modules.
 *
 * @type {Map<string | Function, { execute: Function }>}
 */
const buttons = loadButtonHandlers();

/**
 * Registered command modules stored on the client for runtime lookup.
 *
 * @type {Collection<string, { data: import('discord.js').SlashCommandBuilder, execute: Function }>}
 */
client.commands = new Collection();
commands.forEach((command, name) => {
  client.commands.set(name, command);
});

/**
 * Registered button handlers stored on the client for runtime lookup.
 *
 * @type {Map<string | Function, { execute: Function }>}
 */
client.buttonHandlers = buttons;

/**
 * Logs a confirmation message when the bot successfully connects to Discord.
 *
 * @param {Client<true>} readyClient - The ready client instance.
 * @returns {void}
 */
client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag}`);
});

/**
 * Routes incoming interactions to the relevant handlers.
 *
 * @param {import('discord.js').Interaction} interaction - The interaction payload from Discord.
 * @returns {Promise<void>}
 */
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: 'Command not found. Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await command.execute(interaction, client, config);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}`, { error });
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'There was an error while executing this command.',
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    return;
  }

  if (interaction.isButton()) {
    // Attempt direct match before evaluating predicate-based handlers.
    const directHandler = client.buttonHandlers.get(interaction.customId);
    let handler = directHandler;

    if (!handler) {
      for (const [key, value] of client.buttonHandlers.entries()) {
        if (typeof key === 'function' && key(interaction.customId)) {
          handler = value;
          break;
        }
      }
    }

    if (!handler) {
      await interaction.reply({
        content: 'Button is not active.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await handler.execute(interaction, client, config);
    } catch (error) {
      logger.error(`Error handling button ${interaction.customId}`, { error });
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: 'There was an error while processing this interaction.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }
});

client
  .login(config.token)
  .then(() => logger.info('Login successful, Discord client initialised.'))
  .catch((error) => {
    logger.error('Failed to login to Discord', { error });
    process.exitCode = 1;
  });
