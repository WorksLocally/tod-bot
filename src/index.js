const { Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');

const config = require('./config/env');
const { loadCommandModules } = require('./handlers/commandLoader');
const { loadButtonHandlers } = require('./handlers/buttonLoader');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

const commands = loadCommandModules();
const buttons = loadButtonHandlers();

client.commands = new Collection();
commands.forEach((command, name) => {
  client.commands.set(name, command);
});

client.buttonHandlers = buttons;

client.once(Events.ClientReady, (readyClient) => {
  // eslint-disable-next-line no-console
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: 'Command not found. Please try again later.',
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction, client, config);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error executing command ${interaction.commandName}`, error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'There was an error while executing this command.',
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command.',
          ephemeral: true,
        });
      }
    }
    return;
  }

  if (interaction.isButton()) {
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
        ephemeral: true,
      });
      return;
    }

    try {
      await handler.execute(interaction, client, config);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error handling button ${interaction.customId}`, error);
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: 'There was an error while processing this interaction.',
          ephemeral: true,
        });
      }
    }
  }
});

client.login(config.token);
