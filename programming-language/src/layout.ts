import { cnApp, cssVars } from './styling.ts';
import { cn, newCssBuilder } from './utils/cn.ts';
import { deferClickEventToParent, imBeginDiv, imEnd, imInit, imRef, setClass, setStyle, imBeginSpan, setAttributes, imBeginEl, imMemo, setInnerText, imMemoArray } from './utils/im-dom-utils.ts';


// NOTE: you only get 32 of these. use them wisely.
// (while JS numbers are 64 bit, bit ops are all 32 bits)
export const ROW = 1 << 1;
export const COL = 1 << 2;
export const FLEX = 1 << 3;
export const GAP = 1 << 4;
export const PRE = 1 << 6;
export const ALIGN_CENTER = 1 << 7;
export const JUSTIFY_CENTER = 1 << 8;
export const W100 = 1 << 9;
export const H100 = 1 << 10;

export const CODE = 1 << 5;
export const BOLD = 1 << 11;
export const ITALIC = 1 << 12;
export const H1 = 1 << 13;
export const H2 = 1 << 14;
export const H3 = 1 << 15;
export const RELATIVE = 1 << 16;
export const ABSOLUTE = 1 << 17;
export const FIXED = 1 << 18;

export const OPAQUE = 1 << 19;
export const TRANSLUCENT = 1 << 20;
export const PREWRAP = 1 << 21;

export const TRANSPARENT = 1 << 22;
export const ALIGN_STRETCH = 1 << 23;
export const NORMAL = 1 << 24;
export const PADDED = 1 << 25;


export function imBeginLayout(flags: number = 0) {
    const lastFlags = imRef();
    const root = imBeginDiv(); {
        if (lastFlags.val !== flags) {
            lastFlags.val = flags;
            setStyleFlags(flags);
        }
    };

    // NOTE: this is a possibility for a simple API to allow more higher-level layout primitives.
    // instructs the corresponding end() to pop more than 1 node.
    // setEndPopCount(2);

    return root;
}

export const SPACE_PX = 1;
export const SPACE_EM = 2;

export function imBeginSpace(width: number, height: number, type = SPACE_PX, flags = 0) {
    const valRef = imRef<{ width: number; height: number; type: number; }>();
    if (valRef.val === null) {
        valRef.val = { width: 0, height: 0, type: 0, };
    }
    const val = valRef.val;

    imBeginLayout(flags); {
        if (val.width !== width || val.type !== type) {
            val.width = width;
            val.type = val.type;
            setStyle("width", isNaN(width) ? "" : width + (type === SPACE_EM ? "em" : "px"));
        }

        if (val.height !== height || val.type !== type) {
            val.height = height;
            val.type = val.type;
            setStyle("height", isNaN(height) ? "" : height + (type === SPACE_EM ? "em" : "px"));
        }
    } // user specified end
}

export function setStyleFlags(flags: number) {
    const transparent = (flags & TRANSPARENT);

    setClass(cn.row, (flags & ROW));
    setClass(cn.col, (flags & COL));
    setClass(cn.flex1, (flags & FLEX));
    setClass(cnApp.gap5, (flags & GAP));
    setClass(cnApp.code, (flags & CODE));
    setClass(cnApp.bg2, !transparent && (flags & CODE));
    setClass(cnApp.normal, (flags & NORMAL));
    setClass(cn.pre, (flags & PRE));
    setClass(cn.preWrap, (flags & PREWRAP));
    setClass(cn.alignItemsCenter, (flags & ALIGN_CENTER));
    setClass(cn.alignItemsStretch, (flags & ALIGN_STRETCH));
    setClass(cn.justifyContentCenter, (flags & JUSTIFY_CENTER));
    setClass(cn.h100, (flags & H100));
    setClass(cn.w100, (flags & W100));
    setClass(cnApp.bold, (flags & BOLD));
    setClass(cnApp.italic, (flags & ITALIC));
    setClass(cnApp.h1, (flags & H1));
    setClass(cnApp.h2, (flags & H2));
    setClass(cnApp.h3, (flags & H3));
    setClass(cn.absolute, (flags & ABSOLUTE));
    setClass(cn.relative, (flags & RELATIVE));
    const fixed = (flags & FIXED);
    setClass(cn.fixed, fixed);
    setStyle("top", fixed ? "0" : "");
    setStyle("left", fixed ? "0" : "");
    setStyle("bottom", fixed ? "0" : "");
    setStyle("right", fixed ? "0" : "");
    setClass(cnApp.bg, (flags & OPAQUE));
    setClass(cnApp.translucent, (flags & TRANSLUCENT));
    setClass(cnApp.padded, (flags & PADDED));
}

export function imTextSpan(text: string, flags: number = 0) {
    const lastFlags = imRef();
    // Don't set the text every render. that way, we may modify it in the inspector.
    // may also be faster, idc
    const lastText = imRef();
    const root = imBeginSpan(); {
        if (lastFlags.val !== flags) {
            lastFlags.val = flags;
            setStyleFlags(flags);
        }

        deferClickEventToParent();

        if (lastText.val !== text) {
            lastText.val = text;
            setInnerText(text);
        }
    } imEnd();

    return root;
}


export const NONE = 9999999;
export function imBeginAbsoluteLayout(flags: number = 0, top: number, left: number, bottom: number, right: number) {
    const root = imBeginLayout(flags | ABSOLUTE);

    if (imMemoArray(top, bottom, left, right)) {
        setStyle("top", top === NONE ? "" : top + "px");
        setStyle("left", left === NONE ? "" : left + "px");
        setStyle("bottom", bottom === NONE ? "" : bottom + "px");
        setStyle("right", right === NONE ? "" : right + "px");
    } 

    return root;
}

export function imBeginScrollContainer(flags: number = 0, noScroll: boolean = false) {
    const root = imBeginLayout(flags);

    const lastNoScroll = imRef();
    if (lastNoScroll.val !== noScroll) {
        lastNoScroll.val = noScroll;
        if (noScroll) {
            setStyle("overflow", "hidden");
            setClass(cn.overflowYAuto, false);
        } else {
            setClass(cn.overflowYAuto, true);
        }
    }
    return root;
}

export function imBeginAspectRatio(w: number, h: number, flags: number = 0) {
    const lastAr = imRef();
    const root = imBeginLayout(flags); {
        if (imInit()) {
            setStyle("width", "auto");
            setStyle("height", "auto");
        }

        const ar = w / h;
        if (lastAr.val !== ar) {
            lastAr.val = ar;
            setStyle("aspectRatio", w + " / " + h);
        }
    };

    return root;
}

export function imVerticalBar() {
    imBeginDiv(); {
        imInit() && setAttributes({
            style: `width: 5px; background-color: ${cssVars.fg}; margin: 0px 5px;`
        });
    } imEnd();
}


const cssb = newCssBuilder();

const cnButton = cssb.cn("button", [
    ` { user-select: none; cursor: pointer; border: 2px solid ${cssVars.fg}; border: 2px solid currentColor; border-radius: 8px; 
    padding: 2px 10px; box-sizing: border-box; }`,
    `:hover { background-color: ${cssVars.bg2} }`,
    `:active { background-color: ${cssVars.mg} }`,

    `.${cnApp.inverted}:hover { background-color: ${cssVars.fg2} }`,
]);


export function imBeginButton(toggled: boolean = false) {
    const root = imBeginLayout(ROW | ALIGN_CENTER | JUSTIFY_CENTER); {
        if (imInit()) {
            setClass(cnButton);
        }

        setClass(cnApp.inverted, toggled);
    };

    return root;
}


export function newH3() {
    return document.createElement("h3");
}

// Don't forget to call end()
export function imBeginCodeBlock(indent: number) {
    const root = imBeginLayout(CODE); {
        setStyle("paddingLeft", (4 * indent) + "ch");
    }

    return root;
}


export function imBeginHeading() {
    const root = imBeginEl(newH3); {
        if (imInit()) {
            setStyle("padding", "10px 0");
        }
    }
    return root;
}

export function setInset(amount: string) {
    if (amount) {
        setClass(cn.borderBox);
        setStyle("padding", amount);
    } else {
        setClass(cn.borderBox, false);
        setStyle("padding", "");
    }
}

