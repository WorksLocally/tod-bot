/**
 * Coordinates submission approval messaging, embed construction, and user notifications.
 *
 * @module src/services/approvalService
 */

import { EmbedBuilder, Client, User, Message, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import * as submissionService from './submissionService.js';
import type { SubmissionRecord, SubmissionStatus } from './submissionService.js';
import { findSimilarQuestions, type SimilarityMatch } from './similarityService.js';
import logger from '../utils/logger.js';
import { sanitizeText } from '../utils/sanitize.js';
import type { BotConfig } from '../config/env.js';

/**
 * Maps moderation states to display metadata used across embeds and reactions.
 */
const STATUS_META: Record<SubmissionStatus, { label: string; emoji: string; color: number }> = {
  pending: { label: 'Pending Review', emoji: '\u2753', color: 0x5865f2 },
  approved: { label: 'Approved', emoji: '\u2705', color: 0x2ecc71 },
  rejected: { label: 'Rejected', emoji: '\u274c', color: 0xe74c3c },
};

interface BuildSubmissionEmbedParams {
  submission: SubmissionRecord;
  statusOverride?: SubmissionStatus;
  approverId?: string;
  questionId?: string;
  user?: User;
  notes?: string;
  similarQuestions?: SimilarityMatch[];
}

/**
 * Builds an embed representing the current state of a submission.
 *
 * @param params - Embed construction options.
 * @returns Configured embed instance.
 */
const buildSubmissionEmbed = ({
  submission,
  statusOverride,
  approverId,
  questionId,
  user,
  notes,
  similarQuestions,
}: BuildSubmissionEmbedParams): EmbedBuilder => {
  const status = STATUS_META[statusOverride ?? submission.status] ?? STATUS_META.pending;
  
  // Pre-build all fields array for single addFields call (more efficient)
  const fields = [
    { name: 'Submission ID', value: submission.submission_id, inline: true },
    { name: 'Type', value: submission.type, inline: true },
    { name: 'Submitted By', value: `<@${submission.user_id}>`, inline: false },
    { name: 'Status', value: status.label, inline: true },
  ];

  if (questionId) {
    fields.push({ name: 'Question ID', value: questionId, inline: true });
  }

  if (approverId) {
    fields.push({ name: 'Reviewed By', value: `<@${approverId}>`, inline: true });
  }

  if (notes) {
    fields.push({ name: 'Notes', value: notes, inline: false });
  }

  // Add similar questions if found
  if (similarQuestions && similarQuestions.length > 0) {
    const similarityText = similarQuestions
      .map((match) => {
        const percentage = Math.round(match.similarityScore * 100);
        return `\`${match.questionId}\` (${percentage}%): ${match.text.substring(0, 100)}${match.text.length > 100 ? '...' : ''}`;
      })
      .join('\n');
    
    fields.push({ 
      name: '⚠️ Similar Questions Found', 
      value: similarityText, 
      inline: false 
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('Question Submission')
    .setColor(submission.type === 'truth' ? 0x2ecc71 : 0xe67e22)
    .setDescription(submission.text)
    .addFields(fields)
    .setTimestamp(new Date());

  if (user) {
    embed.setAuthor({
      name: user.tag ?? user.username ?? 'Submission',
      iconURL: user.displayAvatarURL?.() ?? undefined,
    });
  }

  return embed;
};

/**
 * Builds action row with approve and reject buttons for submission moderation.
 *
 * @param status - Current status of the submission.
 * @returns Action row with buttons, or empty array if submission is not pending.
 */
const buildApprovalButtons = (status: SubmissionStatus): ActionRowBuilder<ButtonBuilder>[] => {
  if (status !== 'pending') {
    return [];
  }

  const approveButton = new ButtonBuilder()
    .setCustomId('approval_approve')
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const rejectButton = new ButtonBuilder()
    .setCustomId('approval_reject')
    .setLabel('Reject')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);

  return [actionRow];
};

interface PostSubmissionForApprovalParams {
  client: Client;
  config: BotConfig;
  submission: SubmissionRecord;
  user: User;
}

/**
 * Sends a submission embed to the approval channel and records the resulting message reference.
 *
 * @param params - Invocation parameters.
 * @returns The posted approval message.
 */
export const postSubmissionForApproval = async ({
  client,
  config,
  submission,
  user,
}: PostSubmissionForApprovalParams): Promise<Message> => {
  try {
    const approvalChannel = await client.channels.fetch(config.approvalChannelId);
    if (!approvalChannel || !approvalChannel.isTextBased()) {
      throw new Error('Approval channel not found.');
    }

    // Check for similar questions
    const similarQuestions = findSimilarQuestions(
      submission.text,
      submission.type,
      0.7, // 70% similarity threshold
      3    // Show top 3 matches
    );

    const embed = buildSubmissionEmbed({ 
      submission, 
      statusOverride: 'pending', 
      user,
      similarQuestions: similarQuestions.length > 0 ? similarQuestions : undefined,
    });
    const components = buildApprovalButtons('pending');
    const message = await (approvalChannel as TextChannel).send({
      embeds: [embed],
      components,
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
      similarQuestionsFound: similarQuestions.length,
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

interface UpdateSubmissionMessageStatusParams {
  client: Client;
  submission: SubmissionRecord;
  status: SubmissionStatus;
  questionId?: string;
  approverId?: string;
  notes?: string;
}

/**
 * Updates the approval message embed and reactions to reflect a new submission status.
 *
 * @param params - Options for updating the approval message.
 * @returns Updated message or null when unavailable.
 */
export const updateSubmissionMessageStatus = async ({
  client,
  submission,
  status,
  questionId,
  approverId,
  notes,
}: UpdateSubmissionMessageStatusParams): Promise<Message | null> => {
  const metadata = STATUS_META[status];
  if (!metadata) {
    throw new Error(`Unsupported status: ${status}`);
  }

  if (!submission.approval_channel_id || !submission.approval_message_id) {
    return null;
  }

  try {
    const channel = await client.channels.fetch(submission.approval_channel_id);
    if (!channel || !channel.isTextBased()) {
      logger.warn('Approval channel not found while updating submission status', {
        submissionId: submission.submission_id,
        channelId: submission.approval_channel_id,
      });
      return null;
    }

    const message = await (channel as TextChannel).messages.fetch(submission.approval_message_id);
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

    const components = buildApprovalButtons(status);

    await message.edit({
      embeds: [embed],
      components,
      allowedMentions: { parse: [] },
    });

    // Optimize reaction updates: only modify if needed
    const reactions = message.reactions.cache;
    const currentReaction = reactions.find((r) => r.me);
    const targetEmoji = metadata.emoji;

    // Only update reactions if the current reaction differs from target
    if (!currentReaction || currentReaction.emoji.name !== targetEmoji) {
      // Remove old reactions in batch if possible
      if (currentReaction) {
        await currentReaction.users.remove(client.user!.id);
      }
      
      // Add new reaction only if not already present
      if (!reactions.get(targetEmoji)?.me) {
        await message.react(targetEmoji);
      }
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

interface NotifySubmitterParams {
  client: Client;
  userId: string;
  status: SubmissionStatus;
  questionId?: string;
  reason?: string;
}

/**
 * Attempts to DM the original submitter with the outcome of their submission.
 *
 * @param params - Notification data.
 */
export const notifySubmitter = async ({
  client,
  userId,
  status,
  questionId,
  reason,
}: NotifySubmitterParams): Promise<void> => {
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
