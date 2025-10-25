/**
 * Button handler for confirming question deletion.
 *
 * @module src/interactions/buttons/questionDeleteConfirm
 */

import { ButtonInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';

/**
 * Matches button custom IDs for delete confirmation and cancellation.
 *
 * @param customId - Custom ID to check.
 * @returns True if this handler should process the interaction.
 */
export const match = (customId: string): boolean => {
  return customId.startsWith('question_delete_confirm:') || customId.startsWith('question_delete_cancel:');
};

/**
 * Handles delete confirmation and cancellation button interactions.
 *
 * @param interaction - Button interaction context.
 */
export const execute = async (
  interaction: ButtonInteraction
): Promise<void> => {
  const [action, ...rest] = interaction.customId.split(':');
  const questionId = rest.join(':'); // Handle question IDs that might contain colons

  if (!questionId) {
    await interaction.update({
      content: 'Invalid button interaction.',
      components: [],
    });
    return;
  }

  if (action === 'question_delete_cancel') {
    // User cancelled the deletion
    await interaction.update({
      content: `Deletion of question \`${questionId}\` was cancelled.`,
      components: [],
    });
    return;
  }

  if (action === 'question_delete_confirm') {
    // User confirmed the deletion
    const question = questionService.getQuestionById(questionId);
    if (!question) {
      await interaction.update({
        content: `Question \`${questionId}\` was not found.`,
        components: [],
      });
      return;
    }

    questionService.deleteQuestion(questionId);
    await interaction.update({
      content: `Question \`${questionId}\` has been deleted.`,
      components: [],
    });
    return;
  }

  // Should not reach here, but handle gracefully
  await interaction.update({
    content: 'Unknown action.',
    components: [],
  });
};
