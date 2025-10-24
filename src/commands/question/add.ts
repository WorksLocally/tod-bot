/**
 * Subcommand handler for adding questions or approving submissions.
 *
 * @module src/commands/question/add
 */

import { MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import * as submissionService from '../../services/submissionService.js';
import { updateSubmissionMessageStatus, notifySubmitter } from '../../services/approvalService.js';
import { buildQuestionDetailEmbed } from './shared.js';

/**
 * Handles the 'add' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 * @param client - Discord client used for messaging.
 */
export const executeAdd = async (
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> => {
  const submissionId = interaction.options.getString('submission-id');

  if (submissionId !== null) {
    const normalized = submissionId.trim().toUpperCase();
    const submission = submissionService.getSubmissionById(normalized);

    if (!submission) {
      await interaction.reply({
        content: `Submission \`${normalized}\` was not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (submission.status !== 'pending') {
      await interaction.reply({
        content: `Submission \`${normalized}\` has already been processed.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const question = questionService.addQuestion({
      type: submission.type,
      text: submission.text,
      createdBy: submission.user_id,
    });

    submissionService.updateSubmissionStatus({
      submissionId: normalized,
      status: 'approved',
      resolverId: interaction.user.id,
    });
    submission.status = 'approved';
    submission.resolver_id = interaction.user.id;

    await updateSubmissionMessageStatus({
      client,
      submission,
      status: 'approved',
      questionId: question.question_id,
      approverId: interaction.user.id,
    });

    await notifySubmitter({
      client,
      userId: submission.user_id,
      status: 'approved',
      questionId: question.question_id,
    });

    await interaction.reply({
      content: `Submission \`${normalized}\` approved. New question ID: \`${question.question_id}\``,
      embeds: [buildQuestionDetailEmbed(question)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  const type = interaction.options.getString('type');
  const text = interaction.options.getString('text');

  if (!type || !text) {
    await interaction.reply({
      content: 'Please provide both `type` and `text` to add a new question directly.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const trimmed = text.trim();
  if (!trimmed.length) {
    await interaction.reply({
      content: 'Question text cannot be empty.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const question = questionService.addQuestion({
    type,
    text: trimmed,
    createdBy: interaction.user.id,
  });

  await interaction.reply({
    content: `New question added with ID: \`${question.question_id}\``,
    embeds: [buildQuestionDetailEmbed(question)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
};
