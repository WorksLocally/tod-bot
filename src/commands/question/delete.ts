/**
 * Subcommand handler for deleting questions.
 *
 * @module src/commands/question/delete
 */

import { MessageFlags, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as questionService from '../../services/questionService.js';

/**
 * Handles the 'delete' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 */
export const executeDelete = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const questionId = interaction.options.getString('id', true).toUpperCase();

  const question = questionService.getQuestionById(questionId);
  if (!question) {
    await interaction.reply({
      content: `Question \`${questionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

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

  await interaction.reply({
    content: `Are you sure you want to delete this question?\n\n**[${question.type.toUpperCase()}]** ${displayText}\n**ID:** ${questionId}`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
};
