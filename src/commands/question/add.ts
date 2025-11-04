/**
 * Subcommand handler for adding questions.
 *
 * @module src/commands/question/add
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import { buildQuestionDetailEmbed } from './shared.js';

/**
 * Handles the 'add' subcommand for /question.
 *
 * Allows moderators to directly add questions without going through the approval process.
 * Questions are added to the end of the rotation queue and assigned a unique 8-character ID.
 *
 * Requirements:
 * - Both type and text parameters must be provided
 * - Text must not be empty after trimming
 *
 * The added question is immediately available in the rotation queue for /truth or /dare commands.
 *
 * @param interaction - Command interaction context with type and text options.
 * @returns Promise that resolves when the question is added and reply is sent.
 *
 * @example
 * Moderator executes: /question add type:truth text:"What is your biggest accomplishment?"
 * Bot responds with: "New question added with ID: 8A3F2D1C" (with embed showing details)
 */
export const executeAdd = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const type = interaction.options.getString('type');
  const text = interaction.options.getString('text');

  if (!type || !text) {
    await interaction.reply({
      content: 'Please provide both `type` and `text` to add a new question directly.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const trimmed = text.trim();
  if (!trimmed.length) {
    await interaction.reply({
      content: 'Question text cannot be empty.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const question = questionService.addQuestion({
    type,
    text: trimmed,
    createdBy: interaction.user.id,
  });

  await interaction.reply({
    content: `New question added with ID: \`${question.question_id}\``,
    embeds: [buildQuestionDetailEmbed(question)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
};
