/**
 * Slash command suite for managing truth and dare questions plus submission moderation.
 * Routes to subcommand handlers for better code organization.
 *
 * @module src/commands/question
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from 'discord.js';
import type { BotConfig } from '../config/env.js';
import { ensurePrivileged } from './question/shared.js';
import { executeAdd } from './question/add.js';
import { executeDelete } from './question/delete.js';
import { executeEdit } from './question/edit.js';
import { executeList } from './question/list.js';
import { executeView } from './question/view.js';

export const data = new SlashCommandBuilder()
  .setName('question')
  .setDescription('Manage truth or dare questions.')
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Add a new question.')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('The type of question.')
          .setRequired(false)
          .addChoices(
            { name: 'Truth', value: 'truth' },
            { name: 'Dare', value: 'dare' },
          ),
      )
      .addStringOption((option) =>
        option
          .setName('text')
          .setDescription('Question text.')
          .setRequired(false)
          .setMaxLength(4000),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('Delete a question by ID.')
      .addStringOption((option) =>
        option.setName('id').setDescription('Question ID.').setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('edit')
      .setDescription('Edit a question by ID.')
      .addStringOption((option) =>
        option.setName('id').setDescription('Question ID.').setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('text')
          .setDescription('Updated question text.')
          .setRequired(true)
          .setMaxLength(4000),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List all questions.')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Filter by type.')
          .setRequired(false)
          .addChoices(
            { name: 'Truth', value: 'truth' },
            { name: 'Dare', value: 'dare' },
          ),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('view')
      .setDescription('View a single question.')
      .addStringOption((option) =>
        option.setName('id').setDescription('Question ID.').setRequired(true),
      ),
  );

/**
 * Handles all `/question` subcommands for moderators, including approvals and maintenance.
 *
 * This is the main router for all question management operations. It performs:
 * 1. Permission validation (requires privileged role or administrator)
 * 2. Subcommand routing to specialized handlers
 *
 * Available subcommands:
 * - add: Add a new question directly without approval
 * - delete: Remove a question by ID (requires confirmation)
 * - edit: Update question text
 * - list: View all questions with pagination
 * - view: View detailed information about a specific question
 *
 * Security: All subcommands require privileged role access (Admin, Moderator, or Question Master).
 *
 * @param interaction - Chat input command interaction context.
 * @param _client - Discord client (unused, but required by command interface).
 * @param config - Bot configuration containing privileged role IDs.
 * @returns Promise that resolves when the subcommand handler completes.
 *
 * @example
 * Moderator executes: /question add type:truth text:"What is your dream job?"
 * Bot validates permissions and routes to executeAdd handler
 */
export const execute = async (
  interaction: ChatInputCommandInteraction,
  _client: Client,
  config: BotConfig
): Promise<void> => {
  if (!(await ensurePrivileged(interaction, config))) {
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'add':
      await executeAdd(interaction);
      break;
    case 'delete':
      await executeDelete(interaction);
      break;
    case 'edit':
      await executeEdit(interaction);
      break;
    case 'list':
      await executeList(interaction);
      break;
    case 'view':
      await executeView(interaction);
      break;
    default:
      await interaction.reply({
        content: 'Unknown subcommand.',
        flags: MessageFlags.Ephemeral,
      });
  }
};
