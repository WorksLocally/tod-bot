/**
 * Button handler that opens a modal for submitting a new question.
 *
 * @module src/interactions/buttons/questionSubmit
 */

import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export const customId = 'question_submit';

/**
 * Displays a modal for users to submit a new truth or dare question.
 *
 * @param interaction - Button interaction context.
 */
export const execute = async (interaction: ButtonInteraction): Promise<void> => {
  const modal = new ModalBuilder()
    .setCustomId('question_submit_modal')
    .setTitle('Submit a Question');

  const typeInput = new TextInputBuilder()
    .setCustomId('type')
    .setLabel('Question Type (truth or dare)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('truth or dare')
    .setRequired(true)
    .setMaxLength(5)
    .setMinLength(4);

  const textInput = new TextInputBuilder()
    .setCustomId('text')
    .setLabel('Your Question')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter your truth or dare question here...')
    .setRequired(true)
    .setMaxLength(4000);

  const typeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput);
  const textRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);

  modal.addComponents(typeRow, textRow);

  await interaction.showModal(modal);
};
