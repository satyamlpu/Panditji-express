// Pandit Ji Express brand palette (mirrors the web app), tuned for a
// quick-commerce ("Blinkit"-style) layout: yellow splash, deep-green header,
// clean white product cards on a soft neutral page.
export const colors = {
  bg: "#f4f2ec", // soft page background so white cards pop
  surface: "#ffffff",
  surface2: "#faf4e6",
  ink: "#1a2e22",
  muted: "#6b7a70",
  line: "#e9e3d4",
  forest: "#18542a", // header + primary actions
  forestDark: "#123f20",
  carrot: "#f96015",
  tomato: "#d52518",
  sunshine: "#ffc926", // splash + highlights
  cream: "#f3e8cc",
  kiwi: "#9abc05",
  gold: "#b8860b",
  maroon: "#701f3d",
  white: "#ffffff",

  // Blinkit-style "Add" button
  addBg: "#eaf4ec",
  addBorder: "#18542a",
  addText: "#18542a",
  // tints for category / glyph tiles
  tintSaffron: "#fff2d6",
  tintBlue: "#e9f1ff",
  tintRose: "#fdeaf0",
  tintGreen: "#e9f4ec",
};

export const space = (n: number) => n * 4;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

// Reusable soft card shadow (works on web + native).
export const shadow = {
  shadowColor: "#2a2a1e",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
