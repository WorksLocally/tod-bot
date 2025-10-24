/**
 * Slash command implementation for serving the next dare question.
 *
 * @module src/commands/dare
 */

const { SlashCommandBuilder } = require('discord.js');

const questionService = require('../services/questionService');
const { buildQuestionEmbed, buildQuestionComponents } = require('../utils/questionEmbeds');

module.exports = {
  /** @type {SlashCommandBuilder} */
  data: new SlashCommandBuilder()
    .setName('dare')
    .setDescription('Get the next dare question.'),
  /**
   * Handles execution of the `/dare` command by replying with the next dare prompt.
   *
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaction payload from Discord.
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const question = questionService.getNextQuestion('dare');

    if (!question) {
      await interaction.reply({
        content: 'There are no dare questions available yet.',
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
