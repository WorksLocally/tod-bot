/**
 * Button handler for downvoting questions.
 *
 * @module src/interactions/buttons/questionDownvote
 */

import { MessageFlags, ButtonInteraction } from 'discord.js';
import { addOrUpdateRating } from '../../services/ratingService.js';
import { extractQuestionId, updateQuestionRating, VOTE_RECORDED_MESSAGE } from '../../utils/ratingUpdater.js';
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
    // If this fails, the rating is already recorded but the UI won't update immediately.
    // The next time the question is displayed, it will show the correct rating.
    try {
      await updateQuestionRating(interaction, action, 'downvote');
    } catch (updateError) {
      logger.warn('Failed to update embed after rating change, but rating was saved', {
        questionId,
        userId,
        action,
        error: updateError,
      });
      
      // Still notify the user that their vote was recorded
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: VOTE_RECORDED_MESSAGE,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: VOTE_RECORDED_MESSAGE,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

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
