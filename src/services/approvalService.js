const { EmbedBuilder } = require('discord.js');

const submissionService = require('./submissionService');

const STATUS_META = {
  pending: { label: 'Pending Review', emoji: '\u2753', color: 0x5865f2 },
  approved: { label: 'Approved', emoji: '\u2705', color: 0x2ecc71 },
  rejected: { label: 'Rejected', emoji: '\u274c', color: 0xe74c3c },
};

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

const postSubmissionForApproval = async ({ client, config, submission, user }) => {
  const approvalChannel = await client.channels.fetch(config.approvalChannelId);
  if (!approvalChannel) {
    throw new Error('Approval channel not found.');
  }

  const embed = buildSubmissionEmbed({ submission, statusOverride: 'pending', user });
  const message = await approvalChannel.send({ embeds: [embed] });
  await message.react(STATUS_META.pending.emoji);

  submissionService.setApprovalMessage({
    submissionId: submission.submission_id,
    messageId: message.id,
    channelId: approvalChannel.id,
  });

  return message;
};

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

  let channel;
  try {
    channel = await client.channels.fetch(submission.approval_channel_id);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to fetch approval channel for submission', error);
    return null;
  }
  if (!channel) {
    return null;
  }

  let message;
  try {
    message = await channel.messages.fetch(submission.approval_message_id);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to fetch approval message for submission', error);
    return null;
  }

  const embed = buildSubmissionEmbed({
    submission,
    statusOverride: status,
    approverId,
    questionId,
    notes,
  });

  await message.edit({ embeds: [embed] });

  try {
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to update reactions on approval message', error);
  }

  return message;
};

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
      content += `\nReason: ${reason}`;
    }

    await user.send(content);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Unable to notify user ${userId} about submission status`, error);
  }
};

module.exports = {
  postSubmissionForApproval,
  updateSubmissionMessageStatus,
  notifySubmitter,
};
