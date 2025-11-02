/**
 * Button handler for upvoting questions.
 *
 * @module src/interactions/buttons/questionUpvote
 */

import { MessageFlags, ButtonInteraction } from 'discord.js';
import { addOrUpdateRating } from '../../services/ratingService.js';
import { extractQuestionId, updateQuestionRating, handleRatingUpdateError, handleRatingError } from '../../utils/ratingUpdater.js';

export const customId = 'question_upvote';

/**
 * Handles upvote button interactions on question messages.
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
    const action = addOrUpdateRating(questionId, userId, 1);

    // Update the embed and send response
    // If this fails, the rating is already recorded but the UI won't update immediately.
    // The next time the question is displayed, it will show the correct rating.
    try {
      await updateQuestionRating(interaction, action, 'upvote');
    } catch (updateError) {
      await handleRatingUpdateError(interaction, questionId, userId, action, updateError);
      return;
    }
  } catch (error) {
    await handleRatingError(interaction, error, interaction.user.id);
  }
};
