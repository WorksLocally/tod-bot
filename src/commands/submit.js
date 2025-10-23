const { SlashCommandBuilder } = require('discord.js');

const submissionService = require('../services/submissionService');
const { postSubmissionForApproval } = require('../services/approvalService');

module.exports = {
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
  async execute(interaction, client, config) {
    const questionType = interaction.options.getString('type', true);
    const rawText = interaction.options.getString('text', true);
    const text = rawText.trim();

    if (!text.length) {
      await interaction.reply({
        content: 'Please provide a question to submit.',
        ephemeral: true,
      });
      return;
    }

    const submission = submissionService.createSubmission({
      type: questionType,
      text,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      approvalChannelId: config.approvalChannelId,
    });

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
      // eslint-disable-next-line no-console
      console.error('Unable to post submission to approval channel', error);
      await interaction.reply({
        content:
          'Your submission was saved but we were unable to post it to the approval channel. Please alert a moderator.',
        ephemeral: true,
      });
    }
  },
};
