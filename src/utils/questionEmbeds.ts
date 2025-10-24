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

/**
 * Determines a human-friendly display name for a guild member or user.
 *
 * @param entity - The requesting entity.
 * @returns Preferred display name or null when unavailable.
 */
const resolveDisplayName = (entity: GuildMember | User | undefined): string | null => {
  if (!entity) {
    return null;
  }

  if (typeof entity.displayName === 'string' && entity.displayName.trim().length) {
    return entity.displayName;
  }

  if ('nickname' in entity && typeof entity.nickname === 'string' && entity.nickname.trim().length) {
    return entity.nickname;
  }

  // Prefer displayName/nickname, then globalName/username/tag from either GuildMember or User.
  // For GuildMember, user property may be more up-to-date; fallback order is intentional.
  const user = entity instanceof GuildMember ? entity.user : entity;
  
  if (typeof user.globalName === 'string' && user.globalName.trim().length) {
    return user.globalName;
  }

  if (typeof user.username === 'string' && user.username.trim().length) {
    return user.username;
  }

  if (typeof user.tag === 'string' && user.tag.trim().length) {
    return user.tag;
  }

  return null;
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
 * Builds the action row containing Truth and Dare buttons.
 *
 * @returns Action row with interactive buttons.
 */
export const buildQuestionComponents = (): ActionRowBuilder<ButtonBuilder>[] => {
  const truthButton = new ButtonBuilder()
    .setCustomId('question_truth_next')
    .setLabel('Truth')
    .setStyle(ButtonStyle.Primary);

  const dareButton = new ButtonBuilder()
    .setCustomId('question_dare_next')
    .setLabel('Dare')
    .setStyle(ButtonStyle.Danger);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(truthButton, dareButton)];
};
