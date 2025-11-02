/**
 * Utility for updating question embeds with rating information.
 *
 * @module src/utils/ratingUpdater
 */

import { ButtonInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { getRatingCounts } from '../services/ratingService.js';
import logger from './logger.js';

/**
 * Error message shown when vote is recorded but display update fails.
 */
export const VOTE_RECORDED_MESSAGE = 'Your vote has been recorded, but the display could not be updated. The correct rating will show when the question is displayed again.';

/**
 * Updates the question embed footer with new rating information.
 *
 * @param interaction - The button interaction.
 * @param action - The action performed ('added', 'removed', or 'updated').
 * @param ratingType - The type of rating ('upvote' or 'downvote').
 * @returns Promise that resolves when the update is complete.
 */
export const updateQuestionRating = async (
  interaction: ButtonInteraction,
  action: 'added' | 'removed' | 'updated',
  ratingType: 'upvote' | 'downvote'
): Promise<void> => {
  // Extract question ID using the shared function
  const questionId = extractQuestionId(interaction);
  if (!questionId) {
    throw new Error('Unable to find question ID.');
  }

  const embed = interaction.message.embeds[0];
  if (!embed || !embed.footer?.text) {
    throw new Error('Unable to find question information.');
  }
  const footerText = embed.footer.text;

  // Get updated counts (with error handling)
  let ratings: { upvotes: number; downvotes: number };
  try {
    ratings = getRatingCounts(questionId);
  } catch {
    // If we can't get counts, use defaults
    ratings = { upvotes: 0, downvotes: 0 };
  }

  const netRating = ratings.upvotes - ratings.downvotes;
  const ratingText = netRating > 0 ? `+${netRating}` : `${netRating}`;

  let responseMessage: string;
  const ratingLabel = ratingType === 'upvote' ? 'Upvote' : 'Downvote';
  
  if (action === 'removed') {
    responseMessage = `${ratingLabel} removed. Current rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`;
  } else if (action === 'updated') {
    responseMessage = `Changed to ${ratingType}. Current rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`;
  } else {
    responseMessage = `${ratingLabel}d! Current rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`;
  }

  // Update the embed footer with new rating using Discord.js EmbedBuilder
  const updatedEmbed = EmbedBuilder.from(embed);
  const newFooterText = footerText.replace(/Rating:.*$/, `Rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`);
  updatedEmbed.setFooter({ text: newFooterText });

  await interaction.update({
    embeds: [updatedEmbed],
  });

  await interaction.followUp({
    content: responseMessage,
    flags: MessageFlags.Ephemeral,
  });
};

/**
 * Extracts the question ID from an interaction's embed.
 *
 * @param interaction - The button interaction.
 * @returns The question ID or null if not found.
 */
export const extractQuestionId = (interaction: ButtonInteraction): string | null => {
  const embed = interaction.message.embeds[0];
  if (!embed || !embed.footer?.text) {
    return null;
  }

  const footerText = embed.footer.text;
  const idMatch = footerText.match(/ID:\s*([^\s|]+)/);
  return idMatch ? idMatch[1] : null;
};

/**
 * Handles error recovery when rating update fails but rating was already saved.
 * Sends appropriate message to user based on interaction state.
 *
 * @param interaction - The button interaction.
 * @param questionId - The question ID.
 * @param userId - The user ID.
 * @param action - The action performed ('added', 'removed', or 'updated').
 * @param error - The error that occurred.
 */
export const handleRatingUpdateError = async (
  interaction: ButtonInteraction,
  questionId: string,
  userId: string,
  action: 'added' | 'removed' | 'updated',
  error: unknown
): Promise<void> => {
  logger.warn('Failed to update embed after rating change, but rating was saved', {
    questionId,
    userId,
    action,
    error,
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
};

/**
 * Handles final error when something goes wrong during rating process.
 * Sends error message to user if interaction hasn't been replied to.
 *
 * @param interaction - The button interaction.
 * @param error - The error that occurred.
 * @param userId - The user ID.
 */
export const handleRatingError = async (
  interaction: ButtonInteraction,
  error: unknown,
  userId: string
): Promise<void> => {
  logger.error('Error handling rating', {
    error,
    userId,
  });

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: 'An error occurred while processing your vote.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
