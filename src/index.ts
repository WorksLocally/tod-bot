/**
 * Entry point for the Truth or Dare Discord bot. Initializes the Discord client,
 * loads commands and button handlers, and orchestrates interaction handling.
 *
 * @module src/index
 */

import { Client, Collection, GatewayIntentBits, Partials, Events, MessageFlags } from 'discord.js';
import cron from 'node-cron';
import config from './config/env.js';
import { loadCommandModules } from './handlers/commandLoader.js';
import type { CommandModule } from './handlers/commandLoader.js';
import { loadButtonHandlers } from './handlers/buttonLoader.js';
import type { ButtonHandler } from './handlers/buttonLoader.js';
import logger from './utils/logger.js';
import { handleRejectModalSubmit } from './interactions/modals/approvalRejectModal.js';
import { handleQuestionSubmitModal } from './interactions/modals/questionSubmitModal.js';
import { postQuestionOfTheDay } from './services/questionOfTheDayService.js';

// Extend the Client type to include our custom properties
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, CommandModule>;
    buttonHandlers: Map<string | ((customId: string) => boolean), ButtonHandler>;
  }
}

/**
 * Discord client instance responsible for interacting with the Discord API.
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

/**
 * Initializes the Discord client with commands and handlers.
 *
 * This is the main initialization function that sets up the bot:
 * 1. Loads all command modules from src/commands/
 * 2. Loads all button handlers from src/interactions/buttons/
 * 3. Registers commands and handlers on the client instance
 * 4. Sets up event listeners for ClientReady and InteractionCreate
 * 5. Logs in to Discord using the bot token
 * 6. Initializes the QOTD scheduler (if enabled)
 *
 * The function uses async/await to ensure proper sequencing of initialization steps.
 * If any step fails, the error is logged and the process exits with code 1.
 *
 * @throws {Error} If login fails or command/handler loading fails.
 */
const initializeClient = async (): Promise<void> => {
  /**
   * Collection of loaded slash command modules keyed by name.
   */
  const commands = await loadCommandModules();
  
  /**
   * Mapping of button custom IDs or predicates to handler modules.
   */
  const buttons = await loadButtonHandlers();

  /**
   * Registered command modules stored on the client for runtime lookup.
   */
  client.commands = new Collection();
  commands.forEach((command, name) => {
    client.commands.set(name, command);
  });

  /**
   * Registered button handlers stored on the client for runtime lookup.
   */
  client.buttonHandlers = buttons;

  /**
   * Logs a confirmation message when the bot successfully connects to Discord.
   */
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);

    // Initialize Question of The Day scheduler
    initializeQotdScheduler(readyClient);
  });

  /**
   * Routes incoming interactions to the relevant handlers.
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
      // Attempt direct match first (O(1) lookup), then evaluate predicate-based handlers
      let handler = client.buttonHandlers.get(interaction.customId);

      if (!handler) {
        // Only iterate through predicate handlers if direct match fails
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
      return;
    }

    if (interaction.isModalSubmit()) {
      // Handle modal submissions for rejection reason
      if (interaction.customId.startsWith('approval_reject_modal:')) {
        const submissionId = interaction.customId.split(':')[1];
        
        try {
          await handleRejectModalSubmit(interaction, client, submissionId);
        } catch (error) {
          logger.error('Error handling rejection modal', { error, submissionId });
          if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({
              content: 'There was an error while processing your rejection.',
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } else if (interaction.customId === 'question_submit_modal') {
        // Handle question submission modal
        try {
          await handleQuestionSubmitModal(interaction, client, config);
        } catch (error) {
          logger.error('Error handling question submit modal', { error });
          if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({
              content: 'There was an error while processing your submission.',
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } else {
        await interaction.reply({
          content: 'Unknown modal submission.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  });

  await client
    .login(config.token)
    .then(() => logger.info('Login successful, Discord client initialised.'))
    .catch((error) => {
      logger.error('Failed to login to Discord', { error });
      process.exitCode = 1;
    });
};

/**
 * Initializes the Question of The Day scheduler.
 *
 * Sets up a cron job that posts a truth question to the configured channel
 * daily at 6pm UTC (18:00). The scheduler only activates if:
 * - QOTD_ENABLED is set to 'true' in configuration
 * - QOTD_CHANNEL_ID is configured with a valid channel ID
 *
 * The scheduler uses node-cron for reliable scheduling across restarts.
 * Schedule expression: '0 18 * * *' (minute hour day month dayOfWeek)
 *
 * @param client - The Discord client instance used to post messages.
 *
 * @example
 * ```typescript
 * // Called automatically when bot connects to Discord
 * client.once(Events.ClientReady, (readyClient) => {
 *   initializeQotdScheduler(readyClient);
 * });
 * ```
 */
const initializeQotdScheduler = (client: Client): void => {
  if (!config.qotdEnabled) {
    logger.info('Question of The Day feature is disabled');
    return;
  }

  if (!config.qotdChannelId) {
    logger.warn('Question of The Day channel ID is not configured');
    return;
  }

  // Schedule QOTD to post at 6pm UTC daily (cron: '0 18 * * *')
  cron.schedule('0 18 * * *', async () => {
    logger.info('Running scheduled Question of The Day post');
    try {
      await postQuestionOfTheDay(client);
    } catch (error) {
      logger.error('Failed to post scheduled Question of The Day', { error });
    }
  }, {
    timezone: 'UTC'
  });

  logger.info('Question of The Day scheduler initialized (daily at 6pm UTC)');
};

// Start the bot
initializeClient().catch((error) => {
  logger.error('Failed to initialize client', { error });
  process.exitCode = 1;
});
