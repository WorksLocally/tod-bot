/**
 * Button handlers for paginating through the question list.
 *
 * @module src/interactions/buttons/questionListPagination
 */

import { MessageFlags, ButtonInteraction, codeBlock } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import type { QuestionType } from '../../services/questionService.js';
import { chunkLines, formatQuestionText } from '../../commands/question/shared.js';
import { buildPaginationComponents } from '../../utils/paginationComponents.js';

/**
 * Matches button custom IDs for question list pagination.
 *
 * @param customId - Button custom ID to test.
 * @returns True if this handler should process the button.
 */
export const match = (customId: string): boolean => {
  return customId.startsWith('question_list_page:');
};

/**
 * Handles pagination button interactions for question lists.
 *
 * @param interaction - Button interaction context.
 */
export const execute = async (interaction: ButtonInteraction): Promise<void> => {
  // Parse the custom ID: question_list_page:type:pageIndex
  const parts = interaction.customId.split(':');
  if (parts.length !== 3) {
    await interaction.reply({
      content: 'Invalid pagination button.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const typeParam = parts[1];
  const pageIndex = parseInt(parts[2], 10);

  if (isNaN(pageIndex) || pageIndex < 0) {
    await interaction.reply({
      content: 'Invalid page number.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Fetch questions
  const type = typeParam === 'all' ? undefined : (typeParam as QuestionType);
  const questions = questionService.listQuestions(type);

  if (!questions.length) {
    await interaction.update({
      content: 'No questions found.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Build lines for all questions
  const lines: string[] = [];
  questions.forEach((q, idx) => {
    lines.push(`[${q.type.toUpperCase()}] ${formatQuestionText(q.text)}`);
    lines.push(`ID: ${q.question_id} | Position: ${q.position}`);
    if (idx < questions.length - 1) {
      lines.push(''); // Empty line for spacing between questions
    }
  });

  // Split into chunks/pages
  const chunks = chunkLines(lines);

  // Validate page index
  if (pageIndex >= chunks.length) {
    await interaction.reply({
      content: 'Page not found.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Build pagination components
  const components = buildPaginationComponents(pageIndex, chunks.length, typeParam);

  // Update the message with the requested page
  await interaction.update({
    content: codeBlock(chunks[pageIndex]),
    components,
    allowedMentions: { parse: [] },
  });
};
