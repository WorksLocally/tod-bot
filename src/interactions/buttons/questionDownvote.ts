/**
 * Button handler for downvoting questions.
 *
 * @module src/interactions/buttons/questionDownvote
 */

import { MessageFlags, ButtonInteraction } from 'discord.js';
import { addOrUpdateRating } from '../../services/ratingService.js';
import { extractQuestionId, updateQuestionRating } from '../../utils/ratingUpdater.js';
import logger from '../../utils/logger.js';

export const customId = 'question_downvote';

/**
 * Handles downvote button interactions on question messages.
 *
 * @param interaction - Button interaction context.
 */
export const execute = async (
  interaction: ButtonInteraction
): Promise<void> => {
  try {
    const questionId = extractQuestionId(interaction);
    if (!questionId) {
      await interaction.reply({
        content: 'Unable to find question information.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userId = interaction.user.id;

    // Add or update the rating
    const action = addOrUpdateRating(questionId, userId, -1);

    // Update the embed and send response
    await updateQuestionRating(interaction, action, 'downvote');

    logger.info('User downvoted question', {
      questionId,
      userId,
      action,
    });
  } catch (error) {
    logger.error('Error handling downvote', {
      error,
      userId: interaction.user.id,
    });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing your vote.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
