/**
 * Utility functions for formatting similarity warning messages.
 *
 * @module src/utils/similarityWarning
 */

import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { SimilarityMatch } from '../services/similarityService.js';

/**
 * Maximum length for preview text in similarity match display.
 */
const SIMILARITY_PREVIEW_LENGTH = 150;

/**
 * Formats similar questions into a display string.
 *
 * @param matches - Array of similar questions to format.
 * @returns Formatted string with question IDs, similarity percentages, and text previews.
 */
export const formatSimilarQuestions = (matches: SimilarityMatch[]): string => {
  return matches
    .map((match) => {
      const percentage = Math.round(match.similarityScore * 100);
      const preview = match.text.length > SIMILARITY_PREVIEW_LENGTH
        ? `${match.text.substring(0, SIMILARITY_PREVIEW_LENGTH)}...`
        : match.text;
      return `**${match.questionId}** (${percentage}% similar):\n> ${preview}`;
    })
    .join('\n\n');
};

/**
 * Builds an embed showing similar questions to the user.
 *
 * @param similarityText - Formatted string of similar questions.
 * @param userQuestion - The user's submitted question text.
 * @returns Discord embed for similarity warning.
 */
export const buildSimilarityWarningEmbed = (
  similarityText: string,
  userQuestion: string
): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle('⚠️ Similar Questions Found')
    .setDescription(
      'We found existing questions similar to yours:\n\n' +
      similarityText +
      '\n\n**Do you still want to submit your question?**'
    )
    .setColor(0xffa500) // Orange color for warning
    .addFields({
      name: 'Your Question',
      value: userQuestion.length > 200 ? `${userQuestion.substring(0, 200)}...` : userQuestion,
      inline: false,
    })
    .setFooter({ text: 'Similar questions help avoid duplicates in our database.' });
};

/**
 * Builds action buttons for similarity warning.
 *
 * @param pendingId - The ID of the pending submission.
 * @returns Action row with Submit Anyway and Cancel buttons.
 */
export const buildSimilarityWarningButtons = (
  pendingId: string
): ActionRowBuilder<ButtonBuilder> => {
  const submitButton = new ButtonBuilder()
    .setCustomId(`submit_confirm:${pendingId}`)
    .setLabel('Submit Anyway')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId('submit_cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(submitButton, cancelButton);
};
