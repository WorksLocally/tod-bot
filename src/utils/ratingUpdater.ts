/**
 * Utility for updating question embeds with rating information.
 *
 * @module src/utils/ratingUpdater
 */

import { ButtonInteraction, MessageFlags } from 'discord.js';
import { getRatingCounts } from '../services/ratingService.js';

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
  // Extract question ID from the embed footer
  const embed = interaction.message.embeds[0];
  if (!embed || !embed.footer?.text) {
    throw new Error('Unable to find question information.');
  }

  // Parse question ID from footer text (format: "ID: <question_id> | Rating: ...")
  const footerText = embed.footer.text;
  const idMatch = footerText.match(/ID:\s*([^\s|]+)/);
  if (!idMatch) {
    throw new Error('Unable to find question ID.');
  }

  const questionId = idMatch[1];

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
