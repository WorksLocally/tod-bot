/**
 * Slash command implementation for serving the next truth question.
 *
 * @module src/commands/truth
 */

const { SlashCommandBuilder } = require('discord.js');

const questionService = require('../services/questionService');
const { buildQuestionEmbed, buildQuestionComponents } = require('../utils/questionEmbeds');

module.exports = {
  /** @type {SlashCommandBuilder} */
  data: new SlashCommandBuilder()
    .setName('truth')
    .setDescription('Get the next truth question.'),
  /**
   * Handles execution of the `/truth` command by replying with the next truth prompt.
   *
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaction payload from Discord.
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const question = questionService.getNextQuestion('truth');

    if (!question) {
      await interaction.reply({
        content: 'There are no truth questions available yet.',
        ephemeral: true,
      });
      return;
    }

    const embed = buildQuestionEmbed({
      question,
      requestedBy: interaction.member ?? interaction.user,
    });

    await interaction.reply({
      embeds: [embed],
      components: buildQuestionComponents(),
      allowedMentions: { parse: [] },
    });
  },
};
