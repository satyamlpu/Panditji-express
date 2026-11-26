/**
 * BottomSheet — native modal sheet with a scrim, slide-up animation, drag handle
 * and safe-area padding. Reduced-motion aware. Shared design system.
 */
import { useEffect, useMemo, type ReactNode } from "react";
import { Animated, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, motion, radius, spacing } from "../tokens";
import { useColors, useReducedMotion } from "../theme";
import { Txt } from "./primitives";

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useMemo(() => new Animated.Value(60), []);
  const fade = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: reduced ? 0 : motion.base, useNativeDriver: true }),
        Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 2 }),
      ]).start();
    } else {
      fade.setValue(0);
      y.setValue(60);
    }
  }, [visible, fade, y, reduced]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={{ ...StyleSheetAbsolute, backgroundColor: colors.scrim, opacity: fade }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            transform: [{ translateY: y }],
            ...elevation.e3,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.borderStrong,
              marginBottom: spacing.lg,
            }}
          />
          {title ? (
            <Txt variant="h2" style={{ marginBottom: spacing.lg }}>
              {title}
            </Txt>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsolute = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
