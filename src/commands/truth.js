const { SlashCommandBuilder } = require('discord.js');

const questionService = require('../services/questionService');
const { buildQuestionEmbed, buildQuestionComponents } = require('../utils/questionEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('truth')
    .setDescription('Get the next truth question.'),
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
    });
  },
};
