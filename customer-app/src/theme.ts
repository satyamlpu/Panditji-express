/**
 * Legacy theme shim → maps the old flat `colors` names onto the new design-system
 * palette so any not-yet-migrated import keeps compiling and stays on-brand.
 * New code should import semantic tokens from `./design` (useTheme/useColors).
 */
import { palette, lightColors, radius as dsRadius, elevation, space as dsSpace } from "./design/tokens";

export const colors = {
  bg: lightColors.bg,
  surface: lightColors.surface,
  surface2: lightColors.surfaceAlt,
  ink: lightColors.ink,
  muted: lightColors.inkSecondary,
  line: lightColors.border,
  forest: palette.emerald,
  forestDark: palette.emeraldDeep,
  carrot: palette.gold,
  tomato: palette.error,
  sunshine: palette.gold,
  cream: palette.goldTint,
  kiwi: palette.emerald500,
  gold: palette.gold,
  maroon: palette.emeraldDeep,
  white: palette.white,
  addBg: palette.emeraldTint,
  addBorder: palette.emerald,
  addText: palette.emerald,
  tintSaffron: palette.goldTint,
  tintBlue: lightColors.infoTint,
  tintRose: lightColors.errorTint,
  tintGreen: palette.emeraldTint,
  online: lightColors.success,
  onlineBg: lightColors.successTint,
  offlineBg: lightColors.surfaceAlt,
};

export const space = dsSpace;
export const radius = dsRadius;
export const shadow = elevation.e1;
