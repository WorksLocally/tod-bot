/**
 * Slash command implementation enabling users to submit questions for moderation.
 *
 * @module src/commands/submit
 */

const { SlashCommandBuilder } = require('discord.js');

const submissionService = require('../services/submissionService');
const { postSubmissionForApproval } = require('../services/approvalService');
const logger = require('../utils/logger');
const { sanitizeText } = require('../utils/sanitize');

module.exports = {
  /** @type {SlashCommandBuilder} */
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit a truth or dare question for approval.')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('The type of question.')
        .setRequired(true)
        .addChoices(
          { name: 'Truth', value: 'truth' },
          { name: 'Dare', value: 'dare' },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('The question you would like to submit.')
        .setRequired(true)
        .setMaxLength(4000),
    ),
  /**
   * Processes `/submit` requests by storing the question and notifying moderators.
   *
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaction payload from Discord.
   * @param {import('discord.js').Client} client - Discord client used to post approval messages.
   * @param {import('../config/env').BotConfig} config - Application configuration.
   * @returns {Promise<void>}
   */
  async execute(interaction, client, config) {
    const questionType = interaction.options.getString('type', true);
    const rawText = interaction.options.getString('text', true);
    const sanitized = sanitizeText(rawText, { maxLength: 4000 });

    if (!sanitized.length) {
      await interaction.reply({
        content: 'Please provide a valid question to submit.',
        ephemeral: true,
      });
      return;
    }

    let submission;
    try {
      submission = submissionService.createSubmission({
        type: questionType,
        text: sanitized,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        approvalChannelId: config.approvalChannelId,
      });
    } catch (error) {
      logger.error('Failed to store submission', {
        error,
        userId: interaction.user.id,
        type: questionType,
      });
      await interaction.reply({
        content:
          'We were unable to process your submission. Please try again later or contact a moderator.',
        ephemeral: true,
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
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Unable to post submission to approval channel', {
        error,
        submissionId: submission.submission_id,
        userId: interaction.user.id,
      });
      await interaction.reply({
        content:
          'Your submission was saved but we were unable to post it to the approval channel. Please alert a moderator.',
        ephemeral: true,
      });
    }
  },
};
