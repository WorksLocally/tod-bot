/**
 * Button handler for rejecting submissions via approval message buttons.
 * Opens a modal dialog to collect an optional rejection reason.
 *
 * @module src/interactions/buttons/approvalReject
 */

import { MessageFlags, ButtonInteraction, Client, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import * as submissionService from '../../services/submissionService.js';
import type { BotConfig } from '../../config/env.js';
import { hasPrivilegedRole } from '../../utils/permissions.js';

export const customId = 'approval_reject';

/**
 * Handles rejection button interactions on submission messages.
 * Shows a modal for entering an optional rejection reason.
 *
 * @param interaction - Button interaction context.
 * @param _client - Discord client used for messaging (unused in button handler).
 * @param config - Application configuration.
 */
export const execute = async (
  interaction: ButtonInteraction,
  _client: Client,
  config: BotConfig
): Promise<void> => {
  // Check permissions
  const member = interaction.member as GuildMember | null;
  if (!hasPrivilegedRole(member, config.privilegedRoleIds)) {
    await interaction.reply({
      content: 'You do not have permission to reject submissions.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Extract submission ID from the message embed
  const embed = interaction.message.embeds[0];
  if (!embed) {
    await interaction.reply({
      content: 'Unable to find submission information.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const submissionIdField = embed.fields.find((f) => f.name === 'Submission ID');
  if (!submissionIdField) {
    await interaction.reply({
      content: 'Unable to find submission ID.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const submissionId = submissionIdField.value.trim().toUpperCase();
  const submission = submissionService.getSubmissionById(submissionId);

  if (!submission) {
    await interaction.reply({
      content: `Submission \`${submissionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (submission.status !== 'pending') {
    await interaction.reply({
      content: `Submission \`${submissionId}\` has already been processed.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create and show the modal for rejection reason
  const modal = new ModalBuilder()
    .setCustomId(`approval_reject_modal:${submissionId}`)
    .setTitle('Reject Submission');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Rejection Reason (Optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter a reason to share with the submitter...')
    .setRequired(false)
    .setMaxLength(1000);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
};
