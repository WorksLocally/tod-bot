/**
 * Button handlers that fetch the next truth or dare question when pressed.
 *
 * @module src/interactions/buttons/questionNext
 */

import { MessageFlags, ButtonInteraction, GuildMember } from 'discord.js';
import { getNextQuestion } from '../../services/questionService.js';
import type { QuestionType } from '../../services/questionService.js';
import { buildQuestionEmbed, buildQuestionComponents } from '../../utils/questionEmbeds.js';

/**
 * Maps button custom IDs to their associated question type.
 */
const ID_TO_TYPE: Record<string, QuestionType> = {
  question_truth_next: 'truth',
  question_dare_next: 'dare',
};

export const customIds: string[] = Object.keys(ID_TO_TYPE);

/**
 * Replies to button interactions with the next sequential question.
 *
 * This handler processes clicks on the "Truth" and "Dare" buttons that appear
 * below question embeds. It fetches the next question from the rotation queue
 * and displays it with a new set of interactive buttons.
 *
 * The button custom IDs are mapped to question types:
 * - question_truth_next → 'truth'
 * - question_dare_next → 'dare'
 *
 * Uses the same rotation system as the /truth and /dare slash commands.
 *
 * @param interaction - Button interaction context containing the clicked button ID.
 * @returns Promise that resolves when the next question is displayed.
 *
 * @example
 * User clicks "Truth" button on a question embed
 * → Next truth question is fetched from rotation queue
 * → New embed is shown with the question and interactive buttons
 */
export const execute = async (interaction: ButtonInteraction): Promise<void> => {
  const questionType = ID_TO_TYPE[interaction.customId];

  const question = getNextQuestion(questionType);
  if (!question) {
    await interaction.reply({
      content: `There are currently no ${questionType} questions available.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildQuestionEmbed({
    question,
    requestedBy: (interaction.member as GuildMember | null) ?? interaction.user,
  });

  await interaction.reply({
    embeds: [embed],
    components: buildQuestionComponents(),
    allowedMentions: { parse: [] },
  });
};
