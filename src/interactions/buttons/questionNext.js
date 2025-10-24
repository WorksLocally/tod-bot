/**
 * Button handlers that fetch the next truth or dare question when pressed.
 *
 * @module src/interactions/buttons/questionNext
 */

const questionService = require('../../services/questionService');
const { buildQuestionEmbed, buildQuestionComponents } = require('../../utils/questionEmbeds');

/**
 * Maps button custom IDs to their associated question type.
 *
 * @type {Record<string, 'truth' | 'dare'>}
 */
const ID_TO_TYPE = {
  question_truth_next: 'truth',
  question_dare_next: 'dare',
};

module.exports = {
  /** @type {string[]} */
  customIds: Object.keys(ID_TO_TYPE),
  /**
   * Replies to button interactions with the next sequential question.
   *
   * @param {import('discord.js').ButtonInteraction} interaction - Button interaction context.
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const questionType = ID_TO_TYPE[interaction.customId];

    const question = questionService.getNextQuestion(questionType);
    if (!question) {
      await interaction.reply({
        content: `There are currently no ${questionType} questions available.`,
        ephemeral: true,
      });
      return;
    }

    const embed = buildQuestionEmbed({
      question,
      requestedBy: interaction.member ?? interaction.user,
    });

    await interaction.update({
      embeds: [embed],
      components: buildQuestionComponents(),
      allowedMentions: { parse: [] },
    });
  },
};
