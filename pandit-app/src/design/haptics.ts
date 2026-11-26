/**
 * Thin, safe wrapper over expo-haptics. No-ops on web and swallows errors so a
 * missing haptic engine never breaks an interaction. Shared design system.
 */
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const enabled = Platform.OS === "ios" || Platform.OS === "android";

export const haptics = {
  /** Light tap — selection changes, toggles, chip picks. */
  select() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  /** Medium tap — primary button press. */
  tap() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Success — booking placed, status advanced, payment done. */
  success() {
    if (enabled)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Warning — validation issue, expiring offer. */
  warning() {
    if (enabled)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  /** Error — failed action. */
  error() {
    if (enabled)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
