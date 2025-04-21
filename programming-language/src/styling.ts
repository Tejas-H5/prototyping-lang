import { newCssBuilder, setCssVars } from "src/utils/cn";
import { newColor, newColorFromHex } from "src/utils/colour";

const mainTheme = Object.freeze({
    bg: newColorFromHex("#FFF"),
    bg2: newColorFromHex("#CCC"),
    mg: newColorFromHex("#888"),
    fg2: newColorFromHex("#333"),
    fg: newColorFromHex("#000"),
    playback: newColorFromHex("#00F"),
    error: newColorFromHex("#F00"),
    translucent: newColor(0, 0, 0, 0.5),

    mediumText: "4rem",
    normalText: "1.5rem",
    smallText: "1rem",
});

export type Theme = typeof mainTheme;

export const cssVars: Record<keyof Theme, string> = {
    bg: "var(--bg)",
    bg2: "var(--bg2)",
    mg: "var(--mg)",
    fg2: "var(--fg2)",
    fg: "var(--fg)",
    translucent: "var(--translucent)",
    playback: "var(--playback)",
    error: "var(--error)",
    mediumText: "var(--mediumText)",
    normalText: "var(--normalText)",
    smallText: "var(--smallText)",
} as const;


const cssb = newCssBuilder();

const normalStyle = `
    font-family: Arial;
    font-size: ${cssVars.normalText};
    color: ${cssVars.fg};
    background: ${cssVars.bg};
    font-size: 1em;
`;

cssb.s(`
body {
${normalStyle}
}

h4, h3, h2, h1 {
    margin: 0;
}

    `);

export const cnApp = {
    b: cssb.cn("b", [` { font-weight: bold; } `]),

    normal: cssb.cn("normal", [` {
${normalStyle}
}`]),

    mediumFont: cssb.cn("mediumFont", [` { font-size: ${cssVars.mediumText}; }`]),
    normalFont: cssb.cn("normalFont", [` { font-size: ${cssVars.normalText}; }`]),
    smallFont: cssb.cn("smallFont", [` { font-size: ${cssVars.smallText}; }`]),

    padded: cssb.cn("padded", [` { padding: 5px }`]),

    defocusedText: cssb.cn("defocusedText", [` { color: ${cssVars.mg}; }`]),
    bgFocus: cssb.cn("bgFocus", [` { background-color: ${cssVars.bg2}; }`]),
    inverted: cssb.cn("inverted", [` { color: ${cssVars.bg} ; background: ${cssVars.fg}; }`]),

    border1Solid: cssb.cn("border1Solid", [`{ border: 1px solid ${cssVars.fg}; }`]),

    gap5: cssb.cn("gap5", [` { gap: 5px; }`]),

    code: cssb.cn("code", [` { font-family: Source Code Pro, monospace; }`]),
    bg2: cssb.cn("bg2", [` { background-color: ${cssVars.bg2}; }`]),
    bg: cssb.cn("bg", [` { background-color: ${cssVars.bg}; }`]),
    translucent: cssb.cn("translucent", [` { background-color: ${cssVars.translucent}; }`]),

    bold: cssb.cn("bold", [` { font-weight: bold; }`]),
    italic: cssb.cn("italic", [` { font-style: italic; }`]),

    h1: cssb.cn("h1", [` { font-size: 3em; }`]),
    h2: cssb.cn("h2", [` { font-size: 2em; }`]),
    h3: cssb.cn("h3", [` { font-size: 1.25em; }`]),
};

setCssVars(mainTheme);

let currentTheme: Theme = mainTheme;

export function getCurrentTheme(): Readonly<Theme> {
    return currentTheme;
}

// Eventually, we may have more themes!
export function updateTheme() {
    currentTheme = mainTheme
    setCssVars(currentTheme);
}
