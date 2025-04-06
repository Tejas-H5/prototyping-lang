import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { imBeginMemoComputation, cn, deferClickEventToParent, imBeginDiv, imEnd, imEndMemo, imInit, imRef, setClass, setStyle, imBeginSpan, setAttributes } from './utils/im-dom-utils.ts';


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
            root.text(text);
        }
    } imEnd();

    return root;
}


export const NONE = 9999999;
export function imBeginAbsoluteLayout(flags: number = 0, top: number, left: number, bottom: number, right: number) {
    const root = imBeginLayout(flags | ABSOLUTE);

    if (imBeginMemoComputation()
        .val(top).val(left).val(bottom).val(right)
        .changed()
    ) {
        setStyle("top", top === NONE ? "" : top + "px");
        setStyle("left", left === NONE ? "" : left + "px");
        setStyle("bottom", bottom === NONE ? "" : bottom + "px");
        setStyle("right", right === NONE ? "" : right + "px");
    } imEndMemo();

    return root;
}

export function imBeginScrollContainer(flags: number = 0) {
    const root = imBeginLayout(flags);
    if (imInit()) {
        setClass(cn.overflowYAuto);
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
            style: `width: 5px; background-color: ${cssVars.fg};`
        });
    } imEnd();
}
