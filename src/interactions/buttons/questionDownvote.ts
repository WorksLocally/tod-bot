/**
 * Button handler for downvoting questions.
 *
 * @module src/interactions/buttons/questionDownvote
 */

import { MessageFlags, ButtonInteraction } from 'discord.js';
import { addOrUpdateRating, getRatingCounts } from '../../services/ratingService.js';
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
    // Extract question ID from the embed footer
    const embed = interaction.message.embeds[0];
    if (!embed || !embed.footer?.text) {
      await interaction.reply({
        content: 'Unable to find question information.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Parse question ID from footer text (format: "ID: <question_id> | Rating: ...")
    const footerText = embed.footer.text;
    const idMatch = footerText.match(/ID:\s*(\S+)/);
    if (!idMatch) {
      await interaction.reply({
        content: 'Unable to find question ID.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const questionId = idMatch[1];
    const userId = interaction.user.id;

    // Add or update the rating
    const action = addOrUpdateRating(questionId, userId, -1);

    // Get updated counts
    const ratings = getRatingCounts(questionId);
    const netRating = ratings.upvotes - ratings.downvotes;
    const ratingText = netRating > 0 ? `+${netRating}` : `${netRating}`;

    let responseMessage: string;
    if (action === 'removed') {
      responseMessage = `Downvote removed. Current rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`;
    } else if (action === 'updated') {
      responseMessage = `Changed to downvote. Current rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`;
    } else {
      responseMessage = `Downvoted! Current rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`;
    }

    // Update the embed footer with new rating
    const updatedEmbed = { ...embed.data };
    if (updatedEmbed.footer) {
      updatedEmbed.footer.text = footerText.replace(/Rating:.*$/, `Rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`);
    }

    await interaction.update({
      embeds: [updatedEmbed],
    });

    await interaction.followUp({
      content: responseMessage,
      flags: MessageFlags.Ephemeral,
    });

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

    await interaction.reply({
      content: 'An error occurred while processing your vote.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
