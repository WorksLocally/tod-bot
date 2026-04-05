/**
 * Button handler for canceling direct question add after similarity warning.
 *
 * @module src/interactions/buttons/addCancel
 */

import { ButtonInteraction } from 'discord.js';

export const customId = 'add_cancel';

/**
 * Handles the add cancellation button click.
 *
 * @param interaction - Button interaction context.
 */
export const execute = async (
  interaction: ButtonInteraction
): Promise<void> => {
  await interaction.update({
    content: 'Question add cancelled.',
    embeds: [],
    components: [],
  });
};
