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
 *
 * This function performs the following operations:
 * 1. Validates that the user has privileged role permissions
 * 2. Extracts and validates the submission from the message embed
 * 3. Checks that the submission is still in pending status
 * 4. Displays a modal dialog for entering an optional rejection reason
 *
 * The actual rejection happens when the modal is submitted, handled by
 * the approvalRejectModal handler. This separation allows moderators to
 * provide context for why a submission was rejected.
 *
 * Security: Requires privileged role (Admin, Moderator, or Question Master).
 *
 * @param interaction - Button interaction context from the approval message.
 * @param _client - Discord client (unused, required by interface).
 * @param config - Bot configuration containing privileged role IDs.
 * @returns Promise that resolves when the modal is shown.
 *
 * @example
 * Moderator clicks "Reject" button on submission message
 * → Modal appears asking for optional rejection reason
 * → Moderator submits modal (handled by approvalRejectModal)
 * → Submission marked as rejected and submitter notified
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
