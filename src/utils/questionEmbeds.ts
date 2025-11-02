/**
 * Utilities for building embeds and components that present truth or dare questions.
 *
 * @module src/utils/questionEmbeds
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, User } from 'discord.js';
import { getRatingCounts } from '../services/ratingService.js';

const TYPE_LABELS = {
  truth: { label: 'Truth', color: 0x2ecc71 },
  dare: { label: 'Dare', color: 0xe67e22 },
} as const;

type QuestionType = 'truth' | 'dare';

interface Question {
  question_id: string;
  text: string;
  type: QuestionType;
}

// Cache the question component buttons - they never change
let cachedQuestionComponents: ActionRowBuilder<ButtonBuilder>[] | null = null;

// Cache the rating buttons separately - they also never change
let cachedRatingButtons: ActionRowBuilder<ButtonBuilder> | null = null;

/**
 * Determines a human-friendly display name for a guild member or user.
 * Prioritizes displayName/nickname, then globalName, username, and tag.
 *
 * @param entity - The requesting entity.
 * @returns Preferred display name or null when unavailable.
 */
const resolveDisplayName = (entity: GuildMember | User | undefined): string | null => {
  if (!entity) {
    return null;
  }

  // Check displayName first (works for both GuildMember and User)
  const displayName = entity.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  // For GuildMember, check nickname
  if ('nickname' in entity && entity.nickname) {
    const nickname = entity.nickname.trim();
    if (nickname) {
      return nickname;
    }
  }

  // Get user object for remaining checks
  const user = entity instanceof GuildMember ? entity.user : entity;
  
  // Try globalName, username, then tag in order
  return user.globalName?.trim() || user.username?.trim() || user.tag?.trim() || null;
};

interface BuildQuestionEmbedOptions {
  question: Question;
  requestedBy?: GuildMember | User;
}

/**
 * Creates the embed describing the current question.
 *
 * @param options - Options used to build the embed.
 * @returns Configured embed instance.
 */
export const buildQuestionEmbed = ({ question, requestedBy }: BuildQuestionEmbedOptions): EmbedBuilder => {
  const typeMeta = TYPE_LABELS[question.type] ?? TYPE_LABELS.truth;
  const ratings = getRatingCounts(question.question_id);
  const netRating = ratings.upvotes - ratings.downvotes;
  const ratingText = netRating > 0 ? `+${netRating}` : `${netRating}`;

  const embed = new EmbedBuilder()
    .setTitle(typeMeta.label)
    .setDescription(question.text)
    .setColor(typeMeta.color)
    .setFooter({
      text: `ID: ${question.question_id} | Rating: ${ratingText} (↑${ratings.upvotes} ↓${ratings.downvotes})`,
    })
    .setTimestamp(new Date());

  if (requestedBy) {
    const displayName = resolveDisplayName(requestedBy);
    if (displayName) {
      embed.setAuthor({
        name: `Requested by ${displayName}`,
        iconURL: requestedBy.displayAvatarURL?.() ?? undefined,
      });
    }
  }

  return embed;
};

/**
 * Builds the action row containing rating buttons (upvote and downvote).
 * Components are cached after first creation for performance.
 *
 * @returns Action row with rating buttons.
 */
const buildRatingButtons = (): ActionRowBuilder<ButtonBuilder> => {
  // Return cached buttons if available
  if (cachedRatingButtons) {
    return cachedRatingButtons;
  }

  // Build buttons only once
  const upvoteButton = new ButtonBuilder()
    .setCustomId('question_upvote')
    .setLabel('Upvote')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⬆️');

  const downvoteButton = new ButtonBuilder()
    .setCustomId('question_downvote')
    .setLabel('Downvote')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⬇️');

  cachedRatingButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(upvoteButton, downvoteButton);
  
  return cachedRatingButtons;
};

/**
 * Builds the action rows containing Truth, Dare, Submit Question, and rating buttons.
 * Components are cached after first creation for performance.
 *
 * @returns Action rows with interactive buttons.
 */
export const buildQuestionComponents = (): ActionRowBuilder<ButtonBuilder>[] => {
  // Return cached components if available
  if (cachedQuestionComponents) {
    return cachedQuestionComponents;
  }

  // Build components only once
  const truthButton = new ButtonBuilder()
    .setCustomId('question_truth_next')
    .setLabel('Truth')
    .setStyle(ButtonStyle.Primary);

  const dareButton = new ButtonBuilder()
    .setCustomId('question_dare_next')
    .setLabel('Dare')
    .setStyle(ButtonStyle.Danger);

  const submitButton = new ButtonBuilder()
    .setCustomId('question_submit')
    .setLabel('Submit Question')
    .setStyle(ButtonStyle.Success);

  const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(truthButton, dareButton, submitButton);
  const ratingRow = buildRatingButtons();

  cachedQuestionComponents = [navigationRow, ratingRow];
  
  return cachedQuestionComponents;
};
