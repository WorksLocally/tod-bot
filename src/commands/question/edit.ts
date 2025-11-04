/**
 * Subcommand handler for editing questions.
 *
 * @module src/commands/question/edit
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import { buildQuestionDetailEmbed } from './shared.js';

/**
 * Handles the 'edit' subcommand for /question.
 *
 * Updates the text of an existing question while preserving its ID, type, and position.
 * The updated_at timestamp is automatically updated to reflect the modification.
 *
 * @param interaction - Command interaction context with question ID and new text.
 * @returns Promise that resolves when the question is updated and reply is sent.
 * @throws Will reply with error message if question not found or update fails.
 *
 * @example
 * Moderator executes: /question edit id:8A3F2D1C text:"Updated question text"
 * Bot responds with: "Question 8A3F2D1C has been updated" (with embed showing new details)
 */
export const executeEdit = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const questionId = interaction.options.getString('id', true).toUpperCase();
  const newText = interaction.options.getString('text', true).trim();

  const question = questionService.getQuestionById(questionId);
  if (!question) {
    await interaction.reply({
      content: `Question \`${questionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    questionService.editQuestion({ questionId, text: newText });
  } catch (error) {
    await interaction.reply({
      content: `Unable to update question: ${(error as Error).message}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const updated = questionService.getQuestionById(questionId);

  await interaction.reply({
    content: `Question \`${questionId}\` has been updated.`,
    embeds: [buildQuestionDetailEmbed(updated!)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
};
