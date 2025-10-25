/**
 * Utility for building pagination button components.
 *
 * @module src/utils/paginationComponents
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Builds pagination buttons (Previous/Next) for navigating through pages.
 *
 * @param currentPage - Current page index (0-based).
 * @param totalPages - Total number of pages available.
 * @param typeParam - Question type parameter ('all', 'truth', or 'dare').
 * @returns Array of action rows with pagination buttons.
 */
export const buildPaginationComponents = (
  currentPage: number,
  totalPages: number,
  typeParam: string
): ActionRowBuilder<ButtonBuilder>[] => {
  const previousButton = new ButtonBuilder()
    .setCustomId(`question_list_page:${typeParam}:${currentPage - 1}`)
    .setLabel('◀ Previous')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId(`question_list_page:${typeParam}:${currentPage + 1}`)
    .setLabel('Next ▶')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage >= totalPages - 1);

  const pageInfoButton = new ButtonBuilder()
    .setCustomId(`question_list_page_info:${currentPage}`)
    .setLabel(`Page ${currentPage + 1}/${totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    previousButton,
    pageInfoButton,
    nextButton
  );

  return [row];
};
