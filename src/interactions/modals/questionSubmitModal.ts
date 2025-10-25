/**
 * Modal handler for processing question submissions from the submit button.
 *
 * @module src/interactions/modals/questionSubmitModal
 */

import { MessageFlags, ModalSubmitInteraction, Client, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { createSubmission } from '../../services/submissionService.js';
import { postSubmissionForApproval } from '../../services/approvalService.js';
import { findSimilarQuestions } from '../../services/similarityService.js';
import logger from '../../utils/logger.js';
import { sanitizeText } from '../../utils/sanitize.js';
import type { BotConfig } from '../../config/env.js';
import type { QuestionType } from '../../services/questionService.js';

/**
 * Maximum length for preview text in similarity match display.
 */
const SIMILARITY_PREVIEW_LENGTH = 150;

/**
 * Handles the submission of the question submit modal.
 *
 * @param interaction - Modal submit interaction context.
 * @param client - Discord client used for messaging.
 * @param config - Application configuration.
 */
export const handleQuestionSubmitModal = async (
  interaction: ModalSubmitInteraction,
  client: Client,
  config: BotConfig
): Promise<void> => {
  const rawType = interaction.fields.getTextInputValue('type').trim().toLowerCase();
  const rawText = interaction.fields.getTextInputValue('text');

  // Validate question type
  if (rawType !== 'truth' && rawType !== 'dare') {
    await interaction.reply({
      content: 'Invalid question type. Please enter either "truth" or "dare".',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const questionType = rawType as QuestionType;
  const sanitized = sanitizeText(rawText, { maxLength: 4000 });

  if (!sanitized.length) {
    await interaction.reply({
      content: 'Please provide a valid question to submit.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check for similar questions before submission
  const similarQuestions = findSimilarQuestions(
    sanitized,
    questionType,
    0.7, // 70% similarity threshold
    5    // Show top 5 matches
  );

  // If similar questions are found, show them to the user and ask for confirmation
  if (similarQuestions.length > 0) {
    const similarityText = similarQuestions
      .map((match) => {
        const percentage = Math.round(match.similarityScore * 100);
        const preview = match.text.length > SIMILARITY_PREVIEW_LENGTH
          ? `${match.text.substring(0, SIMILARITY_PREVIEW_LENGTH)}...`
          : match.text;
        return `**${match.questionId}** (${percentage}% similar):\n> ${preview}`;
      })
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Similar Questions Found')
      .setDescription(
        'We found existing questions similar to yours:\n\n' +
        similarityText +
        '\n\n**Do you still want to submit your question?**'
      )
      .setColor(0xffa500) // Orange color for warning
      .addFields({
        name: 'Your Question',
        value: sanitized.length > 200 ? `${sanitized.substring(0, 200)}...` : sanitized,
        inline: false,
      })
      .setFooter({ text: 'Similar questions help avoid duplicates in our database.' });

    const submitButton = new ButtonBuilder()
      .setCustomId(`submit_confirm:${questionType}:${Buffer.from(sanitized).toString('base64')}`)
      .setLabel('Submit Anyway')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');

    const cancelButton = new ButtonBuilder()
      .setCustomId('submit_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌');

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(submitButton, cancelButton);

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // No similar questions found, proceed with submission directly
  let submission;
  try {
    submission = createSubmission({
      type: questionType,
      text: sanitized,
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      approvalChannelId: config.approvalChannelId,
    });
  } catch (error) {
    logger.error('Failed to store submission from modal', {
      error,
      userId: interaction.user.id,
      type: questionType,
    });
    await interaction.reply({
      content:
        'We were unable to process your submission. Please try again later or contact a moderator.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await postSubmissionForApproval({
      client,
      config,
      submission,
      user: interaction.user,
    });

    await interaction.reply({
      content:
        'Your question has been submitted for approval. You will be notified once it has been reviewed.',
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error('Unable to post submission to approval channel from modal', {
      error,
      submissionId: submission.submission_id,
      userId: interaction.user.id,
    });
    await interaction.reply({
      content:
        'Your submission was saved but we were unable to post it to the approval channel. Please alert a moderator.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
