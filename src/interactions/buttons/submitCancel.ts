/**
 * Button handler for canceling question submission after similarity warning.
 *
 * @module src/interactions/buttons/submitCancel
 */

import { ButtonInteraction } from 'discord.js';

export const customId = 'submit_cancel';

/**
 * Handles the submission cancellation button click.
 *
 * @param interaction - Button interaction context.
 */
export const execute = async (
  interaction: ButtonInteraction
): Promise<void> => {
  await interaction.update({
    content: '❌ Submission cancelled. You can use `/submit` again if you want to submit a different question.',
    embeds: [],
    components: [],
  });
};
