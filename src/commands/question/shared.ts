/**
 * Shared utilities for question subcommand handlers.
 *
 * @module src/commands/question/shared
 */

import { EmbedBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { hasPrivilegedRole } from '../../utils/permissions.js';
import type { BotConfig } from '../../config/env.js';
import type { StoredQuestion } from '../../services/questionService.js';

/**
 * Verifies whether the invoking member has permission to run moderation commands.
 *
 * Checks if the user has any of the privileged roles (Admin, Moderator, Question Master)
 * or has the Administrator permission. If not authorized, sends an ephemeral error message.
 *
 * Security: This is the primary authorization check for all /question subcommands.
 *
 * @param interaction - Command interaction context containing member information.
 * @param config - Bot configuration with privilegedRoleIds array.
 * @returns Promise resolving to true if authorized, false if not (with error message sent).
 *
 * @example
 * ```typescript
 * if (!(await ensurePrivileged(interaction, config))) {
 *   return; // User was notified of insufficient permissions
 * }
 * // Continue with privileged operation
 * ```
 */
export const ensurePrivileged = async (
  interaction: ChatInputCommandInteraction,
  config: BotConfig
): Promise<boolean> => {
  if (hasPrivilegedRole(interaction.member as GuildMember | null, config.privilegedRoleIds)) {
    return true;
  }

  await interaction.reply({
    content: 'You do not have permission to manage questions.',
    flags: MessageFlags.Ephemeral,
  });
  return false;
};

/**
 * Builds an embed representing the details of a stored question.
 *
 * @param question - Question to render.
 * @returns Configured embed.
 */
export const buildQuestionDetailEmbed = (question: StoredQuestion): EmbedBuilder =>
  new EmbedBuilder()
    .setTitle(`${question.type === 'truth' ? 'Truth' : 'Dare'}`)
    .setDescription(question.text)
    .setColor(question.type === 'truth' ? 0x2ecc71 : 0xe67e22)
    .addFields(
      { name: 'Question ID', value: question.question_id, inline: true },
      { name: 'Position', value: question.position.toString(), inline: true },
    )
    .setTimestamp(new Date(question.updated_at ?? question.created_at ?? Date.now()));

/**
 * Shortens long question text for list display while retaining readability.
 *
 * @param value - Text to truncate.
 * @returns Possibly truncated text.
 */
export const formatQuestionText = (value: string): string => {
  if (value.length <= 140) {
    return value;
  }
  return `${value.slice(0, 137)}...`;
};

/**
 * Splits text lines into Discord-safe chunks while preserving line boundaries.
 *
 * @param lines - Array of lines to chunk.
 * @param chunkSize - Maximum chunk length.
 * @returns Chunked blocks ready for display.
 */
export const chunkLines = (lines: string[], chunkSize = 1800): string[] => {
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const appended = current.length ? `${current}\n${line}` : line;
    if (appended.length > chunkSize) {
      if (current.length) {
        chunks.push(current);
      }
      if (line.length > chunkSize) {
        const segments = line.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [line];
        chunks.push(...segments.slice(0, -1));
        current = segments.slice(-1)[0];
      } else {
        current = line;
      }
    } else {
      current = appended;
    }
  }

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
};
