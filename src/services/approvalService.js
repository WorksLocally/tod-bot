/**
 * Coordinates submission approval messaging, embed construction, and user notifications.
 *
 * @module src/services/approvalService
 */

const { EmbedBuilder } = require('discord.js');

const submissionService = require('./submissionService');
const logger = require('../utils/logger');
const { sanitizeText } = require('../utils/sanitize');

/**
 * Maps moderation states to display metadata used across embeds and reactions.
 *
 * @type {Record<'pending' | 'approved' | 'rejected', { label: string, emoji: string, color: number }>}
 */
const STATUS_META = {
  pending: { label: 'Pending Review', emoji: '\u2753', color: 0x5865f2 },
  approved: { label: 'Approved', emoji: '\u2705', color: 0x2ecc71 },
  rejected: { label: 'Rejected', emoji: '\u274c', color: 0xe74c3c },
};

/**
 * Builds an embed representing the current state of a submission.
 *
 * @param {Object} params - Embed construction options.
 * @param {import('./submissionService').SubmissionRecord} params.submission - Submission to render.
 * @param {'pending' | 'approved' | 'rejected'} [params.statusOverride] - Alternate status to display.
 * @param {string} [params.approverId] - Moderator who processed the submission.
 * @param {string} [params.questionId] - Question ID assigned after approval.
 * @param {import('discord.js').User} [params.user] - User whose metadata should be shown as author.
 * @param {string} [params.notes] - Optional moderation notes to include.
 * @returns {EmbedBuilder} - Configured embed instance.
 */
const buildSubmissionEmbed = ({
  submission,
  statusOverride,
  approverId,
  questionId,
  user,
  notes,
}) => {
  const status = STATUS_META[statusOverride ?? submission.status] ?? STATUS_META.pending;
  const embed = new EmbedBuilder()
    .setTitle('Question Submission')
    .setColor(submission.type === 'truth' ? 0x2ecc71 : 0xe67e22)
    .setDescription(submission.text)
    .addFields(
      { name: 'Submission ID', value: submission.submission_id, inline: true },
      { name: 'Type', value: submission.type, inline: true },
      {
        name: 'Submitted By',
        value: `<@${submission.user_id}>`,
        inline: false,
      },
      {
        name: 'Status',
        value: status.label,
        inline: true,
      },
    );

  if (questionId) {
    embed.addFields({
      name: 'Question ID',
      value: questionId,
      inline: true,
    });
  }

  if (user) {
    embed.setAuthor({
      name: user.tag ?? user.username ?? 'Submission',
      iconURL: user.displayAvatarURL?.() ?? undefined,
    });
  }

  if (approverId) {
    embed.addFields({
      name: 'Reviewed By',
      value: `<@${approverId}>`,
      inline: true,
    });
  }

  if (notes) {
    embed.addFields({
      name: 'Notes',
      value: notes,
      inline: false,
    });
  }

  embed.setTimestamp(new Date());

  return embed;
};

/**
 * Sends a submission embed to the approval channel and records the resulting message reference.
 *
 * @param {{ client: import('discord.js').Client, config: import('../config/env').BotConfig, submission: import('./submissionService').SubmissionRecord, user: import('discord.js').User }} params -
 *   Invocation parameters.
 * @returns {Promise<import('discord.js').Message>} - The posted approval message.
 */
const postSubmissionForApproval = async ({ client, config, submission, user }) => {
  try {
    const approvalChannel = await client.channels.fetch(config.approvalChannelId);
    if (!approvalChannel) {
      throw new Error('Approval channel not found.');
    }

    const embed = buildSubmissionEmbed({ submission, statusOverride: 'pending', user });
    const message = await approvalChannel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
    await message.react(STATUS_META.pending.emoji);

    submissionService.setApprovalMessage({
      submissionId: submission.submission_id,
      messageId: message.id,
      channelId: approvalChannel.id,
    });

    logger.info('Posted submission for approval', {
      submissionId: submission.submission_id,
      channelId: config.approvalChannelId,
    });

    return message;
  } catch (error) {
    logger.error('Failed to post submission for approval', {
      error,
      submissionId: submission.submission_id,
      channelId: config.approvalChannelId,
    });
    throw error;
  }
};

/**
 * Updates the approval message embed and reactions to reflect a new submission status.
 *
 * @param {Object} params - Options for updating the approval message.
 * @param {import('discord.js').Client} params.client - Discord client used to fetch channels/messages.
 * @param {import('./submissionService').SubmissionRecord} params.submission - Submission with stored metadata.
 * @param {'pending' | 'approved' | 'rejected'} params.status - New moderation status.
 * @param {string} [params.questionId] - Assigned question ID, when approved.
 * @param {string} [params.approverId] - Moderator who processed the change.
 * @param {string} [params.notes] - Optional moderation notes to append.
 * @returns {Promise<import('discord.js').Message | null>} - Updated message or null when unavailable.
 */
const updateSubmissionMessageStatus = async ({
  client,
  submission,
  status,
  questionId,
  approverId,
  notes,
}) => {
  const metadata = STATUS_META[status];
  if (!metadata) {
    throw new Error(`Unsupported status: ${status}`);
  }

  if (!submission.approval_channel_id || !submission.approval_message_id) {
    return null;
  }

  try {
    const channel = await client.channels.fetch(submission.approval_channel_id);
    if (!channel) {
      logger.warn('Approval channel not found while updating submission status', {
        submissionId: submission.submission_id,
        channelId: submission.approval_channel_id,
      });
      return null;
    }

    const message = await channel.messages.fetch(submission.approval_message_id);
    if (!message) {
      logger.warn('Approval message not found while updating submission status', {
        submissionId: submission.submission_id,
        messageId: submission.approval_message_id,
      });
      return null;
    }

    const sanitizedNotes =
      typeof notes === 'string' && notes.length
        ? sanitizeText(notes, { maxLength: 1000 })
        : undefined;

    const embed = buildSubmissionEmbed({
      submission,
      statusOverride: status,
      approverId,
      questionId,
      notes: sanitizedNotes,
    });

    await message.edit({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });

    const reactions = message.reactions.cache;
    for (const reaction of reactions.values()) {
      if (reaction.me && reaction.emoji.name !== metadata.emoji) {
        // Remove previous bot reactions representing status.
        // eslint-disable-next-line no-await-in-loop
        await reaction.users.remove(client.user.id);
      }
    }

    if (!reactions.get(metadata.emoji)?.me) {
      await message.react(metadata.emoji);
    }

    logger.info('Updated submission status message', {
      submissionId: submission.submission_id,
      status,
      messageId: message.id,
    });

    return message;
  } catch (error) {
    logger.error('Unable to update approval message for submission', {
      error,
      submissionId: submission.submission_id,
      channelId: submission.approval_channel_id,
      messageId: submission.approval_message_id,
    });
    return null;
  }
};

/**
 * Attempts to DM the original submitter with the outcome of their submission.
 *
 * @param {{ client: import('discord.js').Client, userId: string, status: 'pending' | 'approved' | 'rejected', questionId?: string, reason?: string }} params -
 *   Notification data.
 * @returns {Promise<void>}
 */
const notifySubmitter = async ({ client, userId, status, questionId, reason }) => {
  try {
    const user = await client.users.fetch(userId);
    if (!user) {
      return;
    }

    const statusMeta = STATUS_META[status] ?? STATUS_META.pending;
    let content = `Your question submission has been marked as **${statusMeta.label}**.`;
    if (status === 'approved' && questionId) {
      content += ` It is now available under question ID \`${questionId}\`.`;
    }

    if (status === 'rejected' && reason) {
      const sanitizedReason = sanitizeText(reason, { maxLength: 1000 });
      if (sanitizedReason.length) {
        content += `\nReason: ${sanitizedReason}`;
      }
    }

    await user.send(content);
  } catch (error) {
    logger.warn('Unable to notify user about submission status', {
      error,
      userId,
      status,
      questionId,
    });
  }
};

module.exports = {
  postSubmissionForApproval,
  updateSubmissionMessageStatus,
  notifySubmitter,
};
