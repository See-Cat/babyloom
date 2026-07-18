export const AVATAR_COLORS = [
  'pink',
  'blue',
  'yellow',
  'mint',
  'peach',
  'teal',
  'purple',
  'green'
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function isAvatarColor(value: string | null | undefined): value is AvatarColor {
  return AVATAR_COLORS.some((color) => color === value);
}
