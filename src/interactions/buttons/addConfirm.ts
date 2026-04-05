/**
 * Button handler for confirming direct question add after similarity warning.
 *
 * @module src/interactions/buttons/addConfirm
 */

import { ButtonInteraction } from 'discord.js';
import { addQuestion } from '../../services/questionService.js';
import { retrievePendingSubmission } from '../../utils/pendingSubmissionCache.js';
import { buildQuestionDetailEmbed } from '../../commands/question/shared.js';
import logger from '../../utils/logger.js';

/**
 * Matches custom IDs starting with 'add_confirm:'.
 */
export const match = (customId: string): boolean => customId.startsWith('add_confirm:');

/**
 * Handles the add confirmation button click after similarity warning.
 *
 * @param interaction - Button interaction from the similarity warning message.
 */
export const execute = async (
  interaction: ButtonInteraction
): Promise<void> => {
  const parts = interaction.customId.split(':');

  if (parts.length !== 2) {
    await interaction.update({
      content: 'Invalid data. Please try adding the question again using `/question add`.',
      embeds: [],
      components: [],
    });
    return;
  }

  const pendingId = parts[1];

  if (!/^[A-Z0-9]{8}$/.test(pendingId)) {
    await interaction.update({
      content: 'Invalid data. Please try adding the question again using `/question add`.',
      embeds: [],
      components: [],
    });
    return;
  }

  const pendingData = retrievePendingSubmission(pendingId);

  if (!pendingData) {
    await interaction.update({
      content: 'This confirmation has expired. Please add the question again using `/question add`.',
      embeds: [],
      components: [],
    });
    return;
  }

  if (pendingData.userId !== interaction.user.id) {
    await interaction.update({
      content: 'You can only confirm your own additions.',
      embeds: [],
      components: [],
    });
    return;
  }

  try {
    const question = addQuestion({
      type: pendingData.type,
      text: pendingData.text,
      createdBy: pendingData.userId,
    });

    logger.info('Question added via confirm button', {
      questionId: question.question_id,
      type: question.type,
      userId: interaction.user.id,
    });

    await interaction.update({
      content: `New question added with ID: \`${question.question_id}\``,
      embeds: [buildQuestionDetailEmbed(question)],
      components: [],
    });
  } catch (error) {
    logger.error('Failed to add question from confirm button', {
      error,
      userId: interaction.user.id,
      type: pendingData.type,
    });
    await interaction.update({
      content: 'Failed to add question. Please try again later.',
      embeds: [],
      components: [],
    });
  }
};
