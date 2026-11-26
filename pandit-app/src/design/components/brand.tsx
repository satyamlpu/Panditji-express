/**
 * BrandLogo — the real Pandit Ji Express diya mark (maroon lamp + ivory "प" +
 * gold flame), as vector paths from frontend/public/logo-icon.svg. Designed to
 * sit on a light/ivory surface. Use `badge` for a ready-made ivory rounded badge
 * (e.g. on the crimson hero). Shared design system.
 */
import { View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { palette } from "../tokens";

// Paths extracted from the official logo-icon.svg (viewBox 0 0 1080 1080).
const LAMP = "M644.12,874.52l-211.11-.02c-30.22,0-58.59-1.51-88.01-5.89-75.97-11.33-111.04-48.38-121.29-123.98-4.45-32.8-5.79-64.38-5.82-97.86l-.19-205.88c-.03-30.32.98-58.71,3.56-88.54,6.42-74.37,32.31-124.23,109.22-138.87,31.63-6.02,62.31-8.35,95-8.33l229.97.1c33.85.01,65.78,2.39,98.47,9.17,55.57,11.53,87.3,44.34,98.88,99.73,6.39,30.56,9.02,60.42,9.08,92.2l.46,246.39c.06,31.44-1.67,60.84-5.59,91.54-10.47,82.03-52.1,117.14-132.82,126.05-26.62,2.94-51.64,4.21-79.78,4.21Z";
const FLAME = "M546.89,377.24c1.74,33.1-19.17,66.06-50.69,75.86-21.17-17.25-29.76-47.91-23.93-74.84,5.39-24.92,22.05-46.28,48.69-57.02,15.86,14.1,24.71,32.84,25.93,56.01Z";
const BASE = "M584.19,749.8l-.23-116.93c-26.45,21.57-58.43,29.44-91.48,25.03-43.27-5.77-79.39-34-98.42-73.02-9.72-19.65-14.63-40.27-13.18-61.88l16.7-40.97,313.78.03-16.61,42.87-57.85.13-.03,224.46-52.69.27Z";
const CUT = "M562.28,584.23c-27.89,31.52-73.02,32.69-102.83,4.14-17.15-16.42-25.74-39.18-25.6-63.4l150.2.06c-.97,21.66-7.07,42.6-21.76,59.2Z";

export function BrandLogo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1080 1080">
      <Path d={LAMP} fill={palette.crimson700} />
      <Path d={FLAME} fill={palette.gold} />
      <Path d={BASE} fill="#F8F2E5" />
      <Path d={CUT} fill={palette.crimson} />
    </Svg>
  );
}

/**
 * The app-icon logo framed for display on a crimson hero: the maroon diya square
 * scaled to fill, clipped to a squircle with a gold hairline. (The source SVG has
 * transparent padding around the square, so we over-scale and clip to fill.)
 */
export function BrandBadge({ size = 96, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.26,
          backgroundColor: "#FBF5EA",
          borderWidth: 1.5,
          borderColor: palette.gold,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <BrandLogo size={size * 1.62} />
    </View>
  );
}
