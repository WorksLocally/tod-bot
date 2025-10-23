const { SlashCommandBuilder } = require('discord.js');

const questionService = require('../services/questionService');
const { buildQuestionEmbed, buildQuestionComponents } = require('../utils/questionEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dare')
    .setDescription('Get the next dare question.'),
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
    });
  },
};
