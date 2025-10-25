/**
 * Utilities for building embeds and components that present truth or dare questions.
 *
 * @module src/utils/questionEmbeds
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, User } from 'discord.js';

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

  const embed = new EmbedBuilder()
    .setTitle(`${typeMeta.label} Question`)
    .setDescription(question.text)
    .setColor(typeMeta.color)
    .setFooter({
      text: `ID: ${question.question_id}`,
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
 * Builds the action row containing Truth, Dare, and Submit Question buttons.
 * Components are cached after first creation for performance.
 *
 * @returns Action row with interactive buttons.
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
    .setStyle(ButtonStyle.Secondary);

  cachedQuestionComponents = [new ActionRowBuilder<ButtonBuilder>().addComponents(truthButton, dareButton, submitButton)];
  
  return cachedQuestionComponents;
};
