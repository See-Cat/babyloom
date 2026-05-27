const MILESTONE_TINTS = ['pink', 'blue', 'yellow', 'mint', 'peach', 'purple', 'green'] as const;

export type MilestoneTint = (typeof MILESTONE_TINTS)[number];

export function pickMilestoneTint(name: string): MilestoneTint {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return MILESTONE_TINTS[Math.abs(hash) % MILESTONE_TINTS.length];
}

export function milestoneTagStyle(name: string): { backgroundColor: string; color: string } {
  const tint = pickMilestoneTint(name);
  return {
    backgroundColor: `color-mix(in oklab, var(--color-avatar-${tint}) 22%, transparent)`,
    color: `color-mix(in oklab, var(--color-avatar-${tint}) 70%, var(--color-fg-strong))`
  };
}
