/**
 * Slash command suite for managing truth and dare questions plus submission moderation.
 *
 * @module src/commands/question
 */

const { SlashCommandBuilder, EmbedBuilder, codeBlock, MessageFlags } = require('discord.js');

const questionService = require('../services/questionService');
const submissionService = require('../services/submissionService');
const {
  updateSubmissionMessageStatus,
  notifySubmitter,
} = require('../services/approvalService');
const { hasPrivilegedRole } = require('../utils/permissions');

/**
 * Splits text lines into Discord-safe chunks while preserving line boundaries.
 *
 * @param {string[]} lines - Array of lines to chunk.
 * @param {number} [chunkSize=1800] - Maximum chunk length.
 * @returns {string[]} - Chunked blocks ready for display.
 */
const chunkLines = (lines, chunkSize = 1800) => {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const appended = current.length ? `${current}\n${line}` : line;
    if (appended.length > chunkSize) {
      if (current.length) {
        chunks.push(current);
      }
      if (line.length > chunkSize) {
        const segments = line.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [line];
        chunks.push(...segments.slice(0, -1));
        current = segments.slice(-1)[0];
      } else {
        current = line;
      }
    } else {
      current = appended;
    }
  }

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
};

/**
 * Verifies whether the invoking member has permission to run moderation commands.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Command interaction context.
 * @param {import('../config/env').BotConfig} config - Application configuration.
 * @returns {Promise<boolean>} - Resolves true when the member is privileged; otherwise false.
 */
const ensurePrivileged = async (interaction, config) => {
  if (hasPrivilegedRole(interaction.member, config.privilegedRoleIds)) {
    return true;
  }

  await interaction.reply({
    content: 'You do not have permission to manage questions.',
    flags: MessageFlags.Ephemeral,
  });
  return false;
};

/**
 * Builds an embed representing the details of a stored question.
 *
 * @param {import('../services/questionService').StoredQuestion} question - Question to render.
 * @returns {EmbedBuilder} - Configured embed.
 */
const buildQuestionDetailEmbed = (question) =>
  new EmbedBuilder()
    .setTitle(`${question.type === 'truth' ? 'Truth' : 'Dare'} Question`)
    .setDescription(question.text)
    .setColor(question.type === 'truth' ? 0x2ecc71 : 0xe67e22)
    .addFields(
      { name: 'Question ID', value: question.question_id, inline: true },
      { name: 'Position', value: question.position.toString(), inline: true },
    )
    .setTimestamp(new Date(question.updated_at ?? question.created_at ?? Date.now()));

module.exports = {
  /** @type {SlashCommandBuilder} */
  data: new SlashCommandBuilder()
    .setName('question')
    .setDescription('Manage truth or dare questions.')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a new question or approve a submission.')
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
        )
        .addStringOption((option) =>
          option
            .setName('submission-id')
            .setDescription('Approve a pending submission by ID.')
            .setRequired(false),
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reject')
        .setDescription('Reject a pending submission.')
        .addStringOption((option) =>
          option
            .setName('submission-id')
            .setDescription('Submission ID to reject.')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Optional reason shared with the submitter.')
            .setRequired(false)
            .setMaxLength(1000),
        ),
    ),
  /**
   * Handles all `/question` subcommands for moderators, including approvals and maintenance.
   *
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaction context.
   * @param {import('discord.js').Client} client - Discord client used for messaging.
   * @param {import('../config/env').BotConfig} config - Application configuration containing privileged roles.
   * @returns {Promise<void>}
   */
  async execute(interaction, client, config) {
    if (!(await ensurePrivileged(interaction, config))) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const submissionIdInput = interaction.options.getString('submission-id');
      const submissionId = submissionIdInput ? submissionIdInput.toUpperCase() : null;
      const providedType = interaction.options.getString('type');
      const providedText = interaction.options.getString('text');

      let questionType = providedType;
      let questionText = providedText?.trim();
      let submission = null;

      if (submissionId) {
        submission = submissionService.getSubmissionById(submissionId);
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

        questionType = submission.type;
        questionText = submission.text;
      }

      if (!questionType || !questionText) {
        await interaction.reply({
          content:
            'Please provide a question type and text, or reference a pending submission.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let question;
      try {
        question = questionService.addQuestion({
          type: questionType,
          text: questionText,
          createdBy: interaction.user.id,
        });
      } catch (error) {
        await interaction.reply({
          content: `Unable to add question: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (submission) {
        submissionService.updateSubmissionStatus({
          submissionId,
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
      }

      await interaction.reply({
        content: `Question added with ID \`${question.question_id}\` (${question.type}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'delete') {
      const questionId = interaction.options.getString('id', true).toUpperCase();
      const question = questionService.getQuestionById(questionId);
      if (!question) {
        await interaction.reply({
          content: `Question \`${questionId}\` was not found.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      questionService.deleteQuestion(questionId);
      await interaction.reply({
        content: `Question \`${questionId}\` has been deleted.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'edit') {
      const questionId = interaction.options.getString('id', true).toUpperCase();
      const newText = interaction.options.getString('text', true).trim();

      const question = questionService.getQuestionById(questionId);
      if (!question) {
        await interaction.reply({
          content: `Question \`${questionId}\` was not found.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        questionService.editQuestion({ questionId, text: newText });
      } catch (error) {
        await interaction.reply({
          content: `Unable to update question: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const updated = questionService.getQuestionById(questionId);

      await interaction.reply({
        content: `Question \`${questionId}\` has been updated.`,
        embeds: [buildQuestionDetailEmbed(updated)],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === 'list') {
      const type = interaction.options.getString('type');
      const questions = questionService.listQuestions(type ?? undefined);

      if (!questions.length) {
        await interaction.reply({
          content: 'No questions found.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      /**
       * Shortens long question text for list display while retaining readability.
       *
       * @param {string} value - Text to truncate.
       * @returns {string} - Possibly truncated text.
       */
      const formatText = (value) => {
        if (value.length <= 140) {
          return value;
        }
        return `${value.slice(0, 137)}...`;
      };

      const lines = questions.map(
        (q) =>
          `[${q.type.toUpperCase()}] ${q.question_id} (pos ${q.position}) - ${formatText(q.text)}`,
      );

      const chunks = chunkLines(lines);
      await interaction.reply({
        content: codeBlock(chunks[0]),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });

      for (const chunk of chunks.slice(1)) {
        // eslint-disable-next-line no-await-in-loop
        await interaction.followUp({
          content: codeBlock(chunk),
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        });
      }
      return;
    }

    if (subcommand === 'view') {
      const questionId = interaction.options.getString('id', true).toUpperCase();
      const question = questionService.getQuestionById(questionId);

      if (!question) {
        await interaction.reply({
          content: `Question \`${questionId}\` was not found.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        embeds: [buildQuestionDetailEmbed(question)],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === 'reject') {
      const submissionId = interaction.options.getString('submission-id', true).toUpperCase();
      const reason = interaction.options.getString('reason')?.trim();

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
          content: `Submission \`${submissionId}\` was already processed.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      submissionService.updateSubmissionStatus({
        submissionId,
        status: 'rejected',
        resolverId: interaction.user.id,
      });
      submission.status = 'rejected';
      submission.resolver_id = interaction.user.id;

      await updateSubmissionMessageStatus({
        client,
        submission,
        status: 'rejected',
        approverId: interaction.user.id,
        notes: reason || undefined,
      });

      await notifySubmitter({
        client,
        userId: submission.user_id,
        status: 'rejected',
        reason,
      });

      await interaction.reply({
        content: `Submission \`${submissionId}\` was rejected.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
