const questionService = require('../../services/questionService');
const { buildQuestionEmbed, buildQuestionComponents } = require('../../utils/questionEmbeds');

const ID_TO_TYPE = {
  question_truth_next: 'truth',
  question_dare_next: 'dare',
};

module.exports = {
  customIds: Object.keys(ID_TO_TYPE),
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
    });
  },
};
