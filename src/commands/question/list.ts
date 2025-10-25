/**
 * Subcommand handler for listing questions.
 *
 * @module src/commands/question/list
 */

import { MessageFlags, ChatInputCommandInteraction, codeBlock } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import type { QuestionType } from '../../services/questionService.js';
import { chunkLines } from './shared.js';

/**
 * Handles the 'list' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 */
export const executeList = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const type = interaction.options.getString('type') as QuestionType | null;
  const questions = questionService.listQuestions(type ?? undefined);

  if (!questions.length) {
    await interaction.reply({
      content: 'No questions found.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  /**
   * Shortens long question text for list display while retaining readability.
   *
   * @param value - Text to truncate.
   * @returns Possibly truncated text.
   */
  const formatText = (value: string): string => {
    if (value.length <= 140) {
      return value;
    }
    return `${value.slice(0, 137)}...`;
  };

  const lines: string[] = [];
  questions.forEach((q, idx) => {
    lines.push(`[${q.type.toUpperCase()}] ${formatText(q.text)}`);
    lines.push(`ID: ${q.question_id} | Position: ${q.position}`);
    if (idx < questions.length - 1) {
      lines.push(''); // Empty line for spacing between questions
    }
  });

  const chunks = chunkLines(lines);
  await interaction.reply({
    content: codeBlock(chunks[0]),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });

  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({
      content: codeBlock(chunk),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
};
