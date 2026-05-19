/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-bright": "#353944",
        "inverse-primary": "#0060ac",
        "on-secondary": "#490080",
        "background": "#0f131d",
        "primary-fixed": "#d4e3ff",
        "on-surface": "#dfe2f1",
        "outline-variant": "#414751",
        "tertiary": "#ffb690",
        "surface": "#0f131d",
        "error": "#ffb4ab",
        "on-tertiary": "#552100",
        "inverse-on-surface": "#2c303b",
        "surface-dim": "#0f131d",
        "surface-container-low": "#171b26",
        "primary": "#a4c9ff",
        "on-tertiary-container": "#622700",
        "on-background": "#dfe2f1",
        "on-secondary-container": "#d6a9ff",
        "primary-fixed-dim": "#a4c9ff",
        "surface-container-high": "#262a35",
        "inverse-surface": "#dfe2f1",
        "outline": "#8b919d",
        "on-tertiary-fixed": "#341100",
        "on-secondary-fixed-variant": "#6900b3",
        "surface-container-lowest": "#0a0e18",
        "surface-container": "#1c1f2a",
        "on-secondary-fixed": "#2c0051",
        "surface-tint": "#a4c9ff",
        "secondary": "#ddb7ff",
        "on-error-container": "#ffdad6",
        "on-primary-fixed": "#001c39",
        "error-container": "#93000a",
        "on-primary-fixed-variant": "#004883",
        "tertiary-fixed": "#ffdbca",
        "tertiary-container": "#ff7e2d",
        "on-surface-variant": "#c1c7d3",
        "on-primary-container": "#003a6b",
        "tertiary-fixed-dim": "#ffb690",
        "on-error": "#690005",
        "on-tertiary-fixed-variant": "#783200",
        "surface-container-highest": "#313540",
        "secondary-container": "#6f00be",
        "on-primary": "#00315d",
        "surface-variant": "#313540",
        "secondary-fixed-dim": "#ddb7ff",
        "secondary-fixed": "#f0dbff",
        "primary-container": "#60a5fa",
        "status-answered": "#4ade80",
        "status-review": "#d6a9ff",
        "status-unanswered": "#8b919d"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        unit: "4px",
        "stack-gap-md": "16px",
        "grid-margin": "16px",
        "stack-gap-lg": "24px",
        "stack-gap-sm": "8px",
        "container-padding": "20px"
      },
      fontFamily: {
        "title-md": ["Inter"],
        "body-sm": ["Inter"],
        "headline-lg-mobile": ["Hanken Grotesk"],
        "body-lg": ["Inter"],
        "label-caps": ["JetBrains Mono"],
        "headline-lg": ["Hanken Grotesk"],
        "display-lg": ["Hanken Grotesk"]
      },
      fontSize: {
        "title-md": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "label-caps": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }]
      }
    }
  }
};
