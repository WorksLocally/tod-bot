/**
 * Button handlers that fetch the next truth or dare question when pressed.
 *
 * @module src/interactions/buttons/questionNext
 */

import { MessageFlags, ButtonInteraction } from 'discord.js';
import { getNextQuestion } from '../../services/questionService.js';
import type { QuestionType } from '../../services/questionService.js';
import { buildQuestionEmbed, buildQuestionComponents } from '../../utils/questionEmbeds.js';

/**
 * Maps button custom IDs to their associated question type.
 */
const ID_TO_TYPE: Record<string, QuestionType> = {
  question_truth_next: 'truth',
  question_dare_next: 'dare',
};

export const customIds: string[] = Object.keys(ID_TO_TYPE);

/**
 * Replies to button interactions with the next sequential question.
 *
 * @param interaction - Button interaction context.
 */
export const execute = async (interaction: ButtonInteraction): Promise<void> => {
  const questionType = ID_TO_TYPE[interaction.customId];

  const question = getNextQuestion(questionType);
  if (!question) {
    await interaction.reply({
      content: `There are currently no ${questionType} questions available.`,
      flags: MessageFlags.Ephemeral,
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
};
