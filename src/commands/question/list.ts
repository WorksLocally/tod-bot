/**
 * Subcommand handler for listing questions.
 *
 * @module src/commands/question/list
 */

import { MessageFlags, ChatInputCommandInteraction, codeBlock } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import type { QuestionType } from '../../services/questionService.js';
import { chunkLines, formatQuestionText } from './shared.js';
import { buildPaginationComponents } from '../../utils/paginationComponents.js';
import logger from '../../utils/logger.js';

/**
 * Handles the 'list' subcommand for /question.
 *
 * Displays all questions (or filtered by type) in a paginated format.
 * Each page shows up to ~1800 characters of questions to fit within Discord's limits.
 *
 * Features:
 * - Optional type filtering (truth, dare, or all)
 * - Pagination with Previous/Next buttons for multiple pages
 * - Shows question text, ID, and position for each question
 * - Code block formatting for better readability
 *
 * @param interaction - Command interaction context with optional type filter.
 * @returns Promise that resolves when the list is displayed.
 *
 * @example
 * Moderator executes: /question list type:truth
 * Bot displays first page of truth questions with pagination buttons if needed
 */
export const executeList = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const type = interaction.options.getString('type') as QuestionType | null;

  logger.debug('List subcommand invoked', {
    type: type ?? 'all',
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  const questions = questionService.listQuestions(type ?? undefined);

  if (!questions.length) {
    logger.info('No questions found for list request', {
      type: type ?? 'all',
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.reply({
      content: 'No questions found.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  logger.info('Questions list retrieved', {
    type: type ?? 'all',
    questionCount: questions.length,
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  const lines: string[] = [];
  questions.forEach((q, idx) => {
    lines.push(`[${q.type.toUpperCase()}] ${formatQuestionText(q.text)}`);
    lines.push(`ID: ${q.question_id} | Position: ${q.position}`);
    if (idx < questions.length - 1) {
      lines.push(''); // Empty line for spacing between questions
    }
  });

  const chunks = chunkLines(lines);
  // Determine type parameter for pagination buttons
  const typeParam = type ?? 'all';

  // Build pagination components only if there's more than one page
  const components = chunks.length > 1
    ? buildPaginationComponents(0, chunks.length, typeParam)
    : [];

  logger.debug('Question list pagination prepared', {
    type: type ?? 'all',
    totalQuestions: questions.length,
    pageCount: chunks.length,
    userId: interaction.user.id,
  });

  try {
    await interaction.reply({
      content: codeBlock(chunks[0]),
      components,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });

    logger.debug('Question list sent successfully', {
      type: type ?? 'all',
      pageCount: chunks.length,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error('Failed to send question list', {
      error,
      type: type ?? 'all',
      questionCount: questions.length,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    throw error;
  }
};
