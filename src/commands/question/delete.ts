/**
 * Subcommand handler for deleting questions.
 *
 * @module src/commands/question/delete
 */

import { MessageFlags, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import logger from '../../utils/logger.js';

/**
 * Handles the 'delete' subcommand for /question.
 *
 * Displays a confirmation dialog before deleting a question to prevent accidental deletions.
 * The confirmation includes the question text (truncated to 100 chars) and ID.
 *
 * Note: The actual deletion happens when the user clicks the "Confirm Delete" button,
 * which is handled by the questionDeleteConfirm button handler.
 *
 * @param interaction - Command interaction context with question ID option.
 * @returns Promise that resolves when confirmation message is sent.
 *
 * @example
 * Moderator executes: /question delete id:8A3F2D1C
 * Bot shows confirmation dialog with "Confirm Delete" and "Cancel" buttons
 */
export const executeDelete = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const questionId = interaction.options.getString('id', true).toUpperCase();

  logger.debug('Delete subcommand invoked', {
    questionId,
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  const question = questionService.getQuestionById(questionId);
  if (!question) {
    logger.warn('Attempted to delete non-existent question', {
      questionId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.reply({
      content: `Question \`${questionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  logger.info('Question delete confirmation displayed', {
    questionId,
    type: question.type,
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  // Create confirmation buttons
  const confirmButton = new ButtonBuilder()
    .setCustomId(`question_delete_confirm:${questionId}`)
    .setLabel('Confirm Delete')
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`question_delete_cancel:${questionId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(confirmButton, cancelButton);

  // Truncate question text for display (max 100 chars, truncate at 97 + ellipsis)
  const MAX_DISPLAY_LENGTH = 100;
  const TRUNCATE_LENGTH = 97;
  const displayText = question.text.length > MAX_DISPLAY_LENGTH
    ? `${question.text.slice(0, TRUNCATE_LENGTH)}...`
    : question.text;

  try {
    await interaction.reply({
      content: `Are you sure you want to delete this question?\n\n**[${question.type.toUpperCase()}]** ${displayText}\n**ID:** ${questionId}`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    logger.debug('Delete confirmation message sent successfully', {
      questionId,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error('Failed to send delete confirmation message', {
      error,
      questionId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    throw error;
  }
};
