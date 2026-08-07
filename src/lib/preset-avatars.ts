/**
 * 30 preset cartoon avatars powered by DiceBear (stable, free, diverse).
 * Shared by profile photo, admin settings, and roleplay role avatar pickers.
 */
export const PRESET_AVATARS: string[] = Array.from(
  { length: 30 },
  (_, i) =>
    `https://api.dicebear.com/9.x/avataaars/png?seed=eklan${
      i + 1
    }&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&size=128`,
);
