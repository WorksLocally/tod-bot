/**
 * Button handler for rejecting submissions via approval message buttons.
 * Opens a modal dialog to collect an optional rejection reason.
 *
 * @module src/interactions/buttons/approvalReject
 */

import { MessageFlags, ButtonInteraction, Client, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import type { BotConfig } from '../../config/env.js';
import { hasPrivilegedRole } from '../../utils/permissions.js';
import { validateSubmissionFromInteraction } from '../submissionValidation.js';

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

  // Validate submission
  const { submissionId, error } = await validateSubmissionFromInteraction(interaction);
  if (error || !submissionId) {
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
