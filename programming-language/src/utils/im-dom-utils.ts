// *IM* DOM-utils v0.1.0006 - @Tejas-H5
// A variation on DOM-utils with the immediate-mode API isntead of the normal one. I'm still deciding which one I will continue to use.
// Right now, this one seems better, but the other one has a 'proven' track record of actually working.
// But in a matter of hours/days, I was able to implement features in this framework that I wasn't able to for months/years in the other one...

//////////
// Assertion functions

/**
 * Asserts are used here to catch developer mistakes. 
 *
 * You might want to make this a No-op in production builds, for performance.
 * Apparently, it makes a pretty big difference - a lot of string comparisions like `assert(type === lastType)` seem to tank performance, 
 * but they seem to be optimized out when this thing just early-returns `true`.
 *
 * Every assertion in the library code (and not necessarily user code) should have a comment above it explaining why it's there, to make
 * debugging for users easier. This is also why I don't bother printing a different debug message per assertion -
 * you should be able to break on these in the debugger and see a more descriptive comment,
 * which can also be removed in production code.
 * Some asserts have DEV: in front of them. They exist to catch errors in the library code that I wrote, and not in user code that you wrote.
 */
export function assert(value: unknown): asserts value {
    if (!value) {
        throw new Error("Assertion failed");
    }
}

function userError(): never {
    throw new Error("User error");
}

function devError(): never {
    throw new Error("Dev error");
}


//////////
// initialize the 'framework'

export function newStyleElement(): HTMLStyleElement {
    return document.createElement("style") as HTMLStyleElement;
}

export function initializeDomUtils(stylesRoot?: HTMLElement) {
    // NOTE: right now, you probably dont want to use document.body as your styles root, if that is also your app root.
    if (!stylesRoot) {
        stylesRoot = document.head;
    }

    // collect every single style that was created till this point,
    // and append it as a style node.

    const sb = stylesStringBuilder;
    if (sb.length > 0) {
        const text = sb.join("");
        stylesStringBuilder.length = 0;

        const styleNode = newStyleElement();
        styleNode.setAttribute("type", "text/css");
        styleNode.textContent = "\n\n" + text + "\n\n";
        stylesRoot.append(styleNode);
    }
}

//////////
// Styling API - this actually needs to happen before the framework is initialized, so it's been moved to the top.

const stylesStringBuilder: string[] = [];
const allClassNames = new Set<string>();

/**
 * A util allowing components to register styles that they need to an inline stylesheet.
 * All styles in the entire bundle are string-built and appended in a `<style />` node as soon as
 * dom-utils is initialized. See {@link initializeDomUtils}
 *
 * The object approach allows us to add a prefix to all the class names we make.
 */
export function newCssBuilder(prefix: string = "") {
    const builder = stylesStringBuilder;
    return {
        /** Appends a CSS style to the builder. The prefix is not used. */
        s(string: string) {
            builder.push(string);
        },
        /** Returns `prefix + className`. Throws if it somehow clashes with an existing class someone else made. */
        newClassName(className: string) {
            let name = prefix + className;
            if (allClassNames.has(name)) {
                throw new Error("We've already made a class with this name: " + name + " - consider adding a prefix");
            }
            allClassNames.add(name);
            return name;
        },
        // makes a new class, it's variants, and returns the class name
        cn(className: string, styles: string[] | string): string {
            const name = this.newClassName(className);

            for (let style of styles) {
                const finalStyle = `.${name}${style}`;
                builder.push(finalStyle + "\n");
            }

            return name;
        },
    };
}


const sb = newCssBuilder("");

sb.s(`
.catastrophic---error > * { display: none !important; }
.catastrophic---error::before {
    content: var(--error-text);
    text-align: center;
}
.debug { border: 1px solid red; }
`);

const cnHoverParent = sb.newClassName("hoverParent");
const cnHoverTarget = sb.newClassName("hoverTarget");
const cnHoverTargetInverse = sb.newClassName("hoverTargetInverse");

sb.s(`
.${cnHoverParent} .${cnHoverTarget} { display: none !important; }
.${cnHoverParent} .${cnHoverTargetInverse} { display: inherit !important; }
.${cnHoverParent}:hover .${cnHoverTarget}  { display: inherit !important; }
.${cnHoverParent}:hover .${cnHoverTargetInverse}  { display: none !important; }
`);

// Here are some common classes that are used so often that I've just put them into dom-utils.
// Shared UI components also don't need to depend on app-specific styles if those styles just come with their UI framework.
export const cn = Object.freeze({
    allUnset: sb.cn("allUnset", [` { all: unset; }`]),

    row: sb.cn("row", [` { display: flex; flex-direction: row; }`]),
    col: sb.cn("col", [` { display: flex; flex-direction: column; }`]),
    flexWrap: sb.cn("flexWrap", [` { display: flex; flex-flow: wrap; }`]),

    /** The min-width and min-height here is the secret sauce. Now the flex containers won't keep overflowing lmao */
    flex1: sb.cn("flex1", [` { flex: 1; min-width: 0; min-height: 0; }`]),

    alignItemsCenter: sb.cn("alignItemsCenter", [` { align-items: center; }`]),
    justifyContentLeft: sb.cn("justifyContentLeft", [` { justify-content: left; }`]),
    justifyContentRight: sb.cn("justifyContentRight", [` { justify-content: right; }`]),
    justifyContentCenter: sb.cn("justifyContentCenter", [` { justify-content: center; }`]),
    justifyContentStart: sb.cn("justifyContentStart", [` { justify-content: start; }`]),
    justifyContentEnd: sb.cn("justifyContentEnd", [` { justify-content: end; }`]),
    alignItemsEnd: sb.cn("alignItemsEnd", [` { align-items: flex-end; }`]),
    alignItemsStart: sb.cn("alignItemsStart", [` { align-items: flex-start; }`]),
    alignItemsStretch: sb.cn("alignItemsStretch", [` { align-items: stretch; }`]),

    /** positioning */
    fixed: sb.cn("fixed", [` { position: fixed; }`]),
    sticky: sb.cn("sticky", [` { position: sticky; }`]),
    absolute: sb.cn("absolute", [` { position: absolute; }`]),
    relative: sb.cn("relative", [` { position: relative; }`]),
    absoluteFill: sb.cn("absoluteFill", [` { position: absolute; top: 0; right: 0; left: 0; bottom: 0; width: 100%; height: 100%; }`]),
    borderBox: sb.cn("borderBox", [` { box-sizing: border-box; }`]),

    /** displays */

    inlineBlock: sb.cn("inlineBlock", [` { display: inline-block; }`]),
    inline: sb.cn("inline", [` { display: inline; }`]),
    flex: sb.cn("flex", [` { display: flex; }`]),
    pointerEventsNone: sb.cn("pointerEventsNone", [` { pointer-events: none; }`]),
    pointerEventsAll: sb.cn("pointerEventsAll", [` { pointer-events: all; }`]),

    table: sb.cn("table", [` { display: table; }`]),
    tableRow: sb.cn("tableRow", [` { display: table-row; }`]),
    tableCell: sb.cn("tableCell", [` { display: table-cell; }`]),

    /** we have React.Fragment at home */
    contents: sb.cn("contents", [` { display: contents; }`]),

    /** text and text layouting */

    textAlignCenter: sb.cn("textAlignCenter", [` { text-align: center; }`]),
    textAlignRight: sb.cn("textAlignRight", [` { text-align: right; }`]),
    textAlignLeft: sb.cn("textAlignLeft", [` { text-align: left; }`]),
    pre: sb.cn("pre", [` { white-space: pre; }`]),
    preWrap: sb.cn("preWrap", [` { white-space: pre-wrap; }`]),
    noWrap: sb.cn("noWrap", [` { white-space: nowrap; }`]),
    handleLongWords: sb.cn("handleLongWords", [` { overflow-wrap: anywhere; word-break: normal; }`]),
    strikethrough: sb.cn("strikethrough", [` { text-decoration: line-through; text-decoration-color: currentColor; }`]),

    /** common spacings */

    w100: sb.cn("w100", [` { width: 100%; }`]),
    mw100: sb.cn("mw100", [` { max-width: 100%; }`]),
    h100: sb.cn("h100", [` { height: 100%; }`]),
    mh100: sb.cn("mh100", [` { max-height: 100%; }`]),
    
    wFitContent: sb.cn("wFitContent", [` { width: fit-content; }`]),
    hFitContent: sb.cn("hFitContent", [` { height: fit-content; }`]),

    /** overflow management */

    overflowXAuto: sb.cn("overflowXAuto", [` { overflow-x: auto; }`]),
    overflowYAuto: sb.cn("overflowYAuto", [` { overflow-y: auto; }`]),
    overflowAuto: sb.cn("overflowAuto", [` { overflow: auto; }`]),
    overflowHidden: sb.cn("overflowHidden", [` { overflow: hidden; }`]),

    /** hover utils */
    hoverParent: cnHoverParent,
    hoverTarget: cnHoverTarget,
    hoverTargetInverse: cnHoverTargetInverse,

    /** debug utils */
    debug1pxSolidRed: sb.cn("debug1pxSolidRed", [` { border: 1px solid red; }`]),
});

export function setCssVars(vars: Record<string, string | Color>, cssRoot?: HTMLElement) {
    if (!cssRoot) {
        cssRoot = document.querySelector(":root") as HTMLElement;
    }

    for (const k in vars) {
        setCssVar(cssRoot, k, vars[k]);
    }
}

export function setCssVar(cssRoot: HTMLElement, varName: string, value: string | Color) {
    const fullVarName = `--${varName}`;
    cssRoot.style.setProperty(fullVarName, "" + value);
}

export type Color = {
    r: number; g: number; b: number; a: number;
    toCssString(): string;
    toString(): string;
}

export function newColor(r: number, g: number, b: number, a: number): Color {
    return {
        r, g, b, a,
        toCssString() {
            const { r, g, b, a} = this;
            return `rgba(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)}, ${a})`;
        },
        toString() {
            return this.toCssString();
        },
    };
}

export function newColorFromHex(hex: string): Color {
    if (hex.startsWith("#")) {
        hex = hex.substring(1);
    }

    if (hex.length === 3 || hex.length === 4) {
        const r = hex[0];
        const g = hex[1];
        const b = hex[2];
        const a = hex[3] as string | undefined;

        return newColor(
            parseInt("0x" + r + r) / 255,
            parseInt("0x" + g + g) / 255,
            parseInt("0x" + b + b) / 255,
            a ? parseInt("0x" + a + a) / 255 : 1,
        );
    }

    if (hex.length === 6 || hex.length === 8) {
        const r = hex.substring(0, 2);
        const g = hex.substring(2, 4);
        const b = hex.substring(4, 6);
        const a = hex.substring(6);

        return newColor( 
            parseInt("0x" + r) / 255,
            parseInt("0x" + g) / 255,
            parseInt("0x" + b)/ 255,
            a ? parseInt("0x" + a) / 255 : 1,
        );
    }

    throw new Error("invalid hex: " + hex);
}

/**
 * Taken from https://gist.github.com/mjackson/5311256
 */
export function newColorFromHsv(h: number, s: number, v: number): Color {
    let r = 0, g = 0, b = 0;

    if (s === 0) {
        r = g = b = v; // achromatic
        return newColor(r, g, b, 1);
    }

    function hue2rgb(p: number, q: number, t: number) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }

    var q = v < 0.5 ? v * (1 + s) : v + s - v * s;
    var p = 2 * v - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);

    return newColor(r, g, b, 1);
}

function lerp(a: number, b: number, factor: number) {
    if (factor < 0) {
        return a;
    }

    if (factor > 1) {
        return b;
    }

    return a + (b - a) * factor;
}

/**
 * NOTE to self: try to use a CSS transition on the colour style before you reach for this!
 **/
export function lerpColor(c1: Color, c2: Color, factor: number, dst: Color) {
    dst.r = lerp(c1.r, c2.r, factor);
    dst.g = lerp(c1.g, c2.g, factor);
    dst.b = lerp(c1.b, c2.b, factor);
    dst.a = lerp(c1.a, c2.a, factor);
}

//////////
// Various seemingly random/arbitrary functions that actually end up being very useful

/** 
 * This jQuery code is taken from: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
 * This method is mainly used in gobal event handlers to early-return when a UI component isn't visble yet, so
 * it will also return false if the component hasn't been rendered for the first time. 
 */
export function isVisibleEl(el: HTMLElement) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

export function isEditingInput(el: HTMLElement): boolean {
    return document.activeElement === el;
}


/**
 * Sets an input's value while retaining it's selection
 */
export function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
    if (el.value === text) {
        // performance speedup
        return;
    }

    const { selectionStart, selectionEnd } = el;

    el.value = text;

    el.selectionStart = selectionStart;
    el.selectionEnd = selectionEnd;
}

export function isEditingTextSomewhereInDocument(): boolean {
    const type = document.activeElement?.nodeName?.toLowerCase();
    return type === "textarea" || type === "input";
}

/**
 * Scrolls {@link scrollParent} to bring scrollTo into view.
 * {@link scrollToRelativeOffset} specifies where to to scroll to. 0 = bring it to the top of the scroll container, 1 = bring it to the bottom
 */
export function scrollIntoView(
    scrollParent: HTMLElement,
    scrollTo: HTMLElement,
    scrollToRelativeOffset: number,
    scrollToItemOffset: number,
    horizontal = false,
) {
    if (horizontal) {
        // NOTE: this is a copy-paste from below

        const scrollOffset = scrollToRelativeOffset * scrollParent.offsetWidth;
        const elementWidthOffset = scrollToItemOffset * scrollTo.getBoundingClientRect().width;

        // offsetLeft is relative to the document, not the scroll parent. lmao
        const scrollToElOffsetLeft = scrollTo.offsetLeft - scrollParent.offsetLeft;

        scrollParent.scrollLeft = scrollToElOffsetLeft - scrollOffset + elementWidthOffset;

        return;
    }

    const scrollOffset = scrollToRelativeOffset * scrollParent.offsetHeight;
    const elementHeightOffset = scrollToItemOffset * scrollTo.getBoundingClientRect().height;

    // offsetTop is relative to the document, not the scroll parent. lmao
    const scrollToElOffsetTop = scrollTo.offsetTop - scrollParent.offsetTop;

    scrollParent.scrollTop = scrollToElOffsetTop - scrollOffset + elementHeightOffset;
}

//////////
// animation utils. The vast majority of apps will need animation, so I figured I'd just merge this into dom-utils itself

export type AnimateFunction = (dt: number) => boolean;

export type RealtimeAnimation = {
    isRunning: boolean;
    isInQueue: boolean;
    fn: AnimateFunction;
}

const queue: RealtimeAnimation[] = [];

const MAX_DT = 100;

let lastTime = 0;
function runAnimation(time: DOMHighResTimeStamp) {
    const dtMs = time - lastTime;
    lastTime = time;

    if (dtMs < MAX_DT) {
        for (let i = 0; i < queue.length; i++) {
            const handle = queue[i];

            handle.isRunning = handle.fn(dtMs / 1000);

            if (!handle.isRunning) {
                // O(1) fast-remove
                queue[i] = queue[queue.length - 1];
                queue.pop();
                handle.isInQueue = false;
                i--;
            }
        }
    }

    if (queue.length > 0) {
        requestAnimationFrame(runAnimation);
    }
}

export function newAnimation(fn: AnimateFunction): RealtimeAnimation {
    return { fn, isRunning: false, isInQueue: false };
}

/**
 * Adds an animation to the realtime animation queue that runs with `requestAnimationFrame`.
 * See {@link newAnimation}.
 */
export function startAnimation(animation: RealtimeAnimation) {
    if (animation.isInQueue) {
        return;
    }

    const restartQueue = queue.length === 0;

    queue.push(animation);
    animation.isInQueue = true;

    if (restartQueue) {
        requestAnimationFrame(runAnimation);
    }
}

export function getCurrentNumAnimations() {
    return queue.length;
}

///////// Immediate-mode array datastructure, for use with the immediate mode renderer

// An immediate-mode array datastructure is an array 
// that starts off being variable length, and then locks
// it's own size at some point during a 'frame boundary'.
// The idea is that by adding strict element count preconditions,
// An immediate mode renderer can be written that has better
// performance charactaristics by avoiding the need for a diffing algorithm.
// It's certainly easier to code on my end.

type ImmediateModeArray<T> = {
    items: T[];
    expectedLength: number;
    idx: number;
};

function newImArray<T>(): ImmediateModeArray<T> {
    return {
        items: [],
        expectedLength: -1,
        idx: -1,
    };
}

function imGetNext<T>(arr: ImmediateModeArray<T>): T | undefined {
    arr.idx++;

    if (arr.idx < arr.items.length) {
        return arr.items[arr.idx];
    }

    if (arr.idx === arr.items.length) {
        if (arr.expectedLength === -1) {
            return undefined;
        }

        // Once an immediate mode array has been finalized, every subsequent render must create the same number of things.
        // In this case, you've rendered too many things.
        assert(false);
    }

    // DEV: whenever imGetNext returns undefined, we should be pushing stuff to the array.
    assert(false);
}

function imPush<T>(arr: ImmediateModeArray<T>, value: T): T {
    // DEV: Pushing to an immediate mode array after it's been finalized is always a mistake
    assert(arr.expectedLength === -1);
    assert(arr.items.length === arr.idx);

    arr.items.push(value);

    return value;
}

function imLockSize(arr: ImmediateModeArray<unknown>) {
    if (arr.expectedLength === -1) {
        if (arr.idx !== -1) {
            arr.expectedLength = arr.items.length;
        }
    }
}

function imReset(arr: ImmediateModeArray<unknown>, idx: number = -1) {
    if (arr.expectedLength !== -1) {
        // Once an immediate mode array has been finalized, every subsequent render must create the same number of things.
        // In this case, you've rendered too few(?) things.
        assert(arr.expectedLength === arr.items.length);
    } 

    arr.idx = idx;
}

///////// Immediate-mode dom renderer. I've replaced the old render-groups approach with this thing. 
// It solves a lot of issues I've had with the old renderer, at the cost of being a bit more complicated,
// and requiring a bit more compute per-render. But the performance is fairly similar.
//
// This API prioritizes code aesthetics and colocation of logic, while 
// avoiding any 'diffing' logic, which will typically encourage bad UI code and
// terrible performance characteristics that are hard to move away from.
// It also assumes that creating new function callbacks in every render has a near-zero overhead. 

export type ValidElement = HTMLElement | SVGElement;
export type StyleObject<U extends ValidElement> = (U extends HTMLElement ? keyof HTMLElement["style"] : keyof SVGElement["style"]);

// Similar to React's useBlah hook pattern, but I've decided to not call it a 'hook' because that is a meaningless name.
const ITEM_UI_ROOT = 1;
const ITEM_LIST = 2;
const ITEM_STATE = 3;
export type UIChildRootItem = {
    t: typeof ITEM_UI_ROOT;
    v: UIRoot<ValidElement>;
};
export type ListRendererItem = {
    t: typeof ITEM_LIST;
    v: ListRenderer;
};
export type StateItem  = {
    t: typeof ITEM_STATE;
    v: unknown;
    supplier: () => unknown;
};

export type UIRootItem = UIChildRootItem | ListRendererItem | StateItem;

export type DomRoot<E extends ValidElement = ValidElement> = {
    root: E;
    currentIdx: number;
};

export function resetDomRoot(domRoot: DomRoot, idx = -1) {
    domRoot.currentIdx = idx;
}

export function appendToDomRoot(domRoot: DomRoot, child: ValidElement) {
    domRoot.currentIdx++;
    setChildAtEl(domRoot.root, domRoot.currentIdx, child);
}

export function setChildAtEl(root: Element, i: number, child: Element) {
    const children = root.children;

    if (i === children.length) {
        root.appendChild(child);
    } else if (children[i] !== child) {
        // TODO: compare insertBefore performance with replaceChild. I reckon insertBefore is faster in most cases
        root.insertBefore(child, children[i]);
    }
}

export type RerenderPoint =  {
    domRootIdx: number;
    itemsIdx: number;
}

export class UIRoot<E extends ValidElement = ValidElement> {
    readonly root: E;
    readonly domRoot: DomRoot<E>;
    // If there was no supplier, then this root is probably attached to the same DOM element as another UI root.
    readonly elementSupplier: (() => ValidElement) | null;

    readonly items = newImArray<UIRootItem>();
    lockImArray = false;
    
    openListRenderers = 0;
    hasRealChildren = false;
    manuallyHidden = false;
    ifStatementOpen = false;
    removed = true;
    began = false;

    // Users should call `newUiRoot` instead.
    constructor(domRoot: DomRoot<E>, elementFactory: (() => ValidElement) | null) {
        this.root = domRoot.root;
        this.domRoot = domRoot;
        this.elementSupplier = elementFactory;
    }

    isFirstRenderCall = true;
    get isFirstRender() {
        return this.isFirstRenderCall;
    }

    // TODO: think of how we can remove this, from user code at the very least.
    __begin(rp?: RerenderPoint) {
        resetDomRoot(this.domRoot, rp?.domRootIdx);

        imReset(this.items, rp?.itemsIdx);

        // NOTE: avoid any more asertions here - the component may error out, and
        // __end may not get called. No I'm not going to catch it with an exception stfu. We livin on the edge, bois.

        this.openListRenderers = 0;

        this.ifStatementOpen = false;

        this.removed = false;
        // we may be recovering from an error, so I'm not asserting !this.began here.
        this.began = true;
    }

    // Only lock the size if we reach the end without the component throwing errors. 
    __end() {
        assert(this.began);
        this.began = false;

        if (this.isFirstRenderCall) {
            imLockSize(this.items);
            this.isFirstRenderCall = false;
            return;
        }

        // DEV: If this is negative, I fkd up (I decremented this thing too many times) 
        // User: If this is positive, u fked up (You forgot to finalize an open list)
        assert(this.openListRenderers === 0);
    }

    setStyle<K extends (keyof E["style"])>(key: K, value: string) {
        // @ts-expect-error it sure can
        this.root.style[key] = value;
        return this;
    }
    readonly s = this.setStyle;

    // NOTE: the effect of this method will persist accross renders
    setClass(val: string, enabled: boolean = true) {
        if (enabled) {
            this.root.classList.add(val);
        } else {
            this.root.classList.remove(val);
        }
        return this;
    }
    readonly c = this.setClass;

    text(value: string) { 
        // don't overwrite the real children!
        assert(!this.hasRealChildren);

        if (this.root.textContent !== value) {
            this.root.textContent = value;
        }
    }

    setAttribute(attr: string, val: string | null) {
        return setAttribute(this.root, attr, val);
    }
    readonly a = this.setAttribute;

    // NOTE: If this is being called before we've rendered any components here, it should be ok.
    // if it's being called during a render, then that is typically an incorrect usage - the domRoot's index may or may not be incorrect now, because
    // we will have removed HTML elements out from underneath it. You'll need to ensure that this isn't happening in your use case.
    __removeAllDomElements() {
        this.removed = true;
        for (let i = 0; i < this.items.items.length; i++) {
            const item = this.items.items[i];
            if (item.t === ITEM_UI_ROOT) {
                item.v.domRoot.root.remove();
            } else if (item.t === ITEM_LIST) {
                // needs to be fully recursive. because even though our UI tree is like
                //
                // -list
                //   -list
                //     -list
                // 
                // They're still all rendering to the same DOM root!!!
                item.v.__removeAllDomElementsFromList();
            }
        }
    }
}

// TODO: keyed list renderer. It will be super useful, for type narrowing with switch statements.

export class ListRenderer {
    uiRoot: UIRoot;
    keys = new Map<string | number, { root: UIRoot, rendered: boolean }>();
    builders: UIRoot[] = [];
    builderIdx = 0;
    current: UIRoot | null = null;

    constructor(root: UIRoot) {
        this.uiRoot = root;
    }

    __begin() {
        this.builderIdx = 0;
        this.uiRoot.openListRenderers++;
        for (const v of this.keys.values()) {
            v.rendered = false;
        }
        this.current = null;
    }

    /** Use this for a keyed list renderer */
    get(key: string | number) {
        let result = this.keys.get(key);
        if (!result) {
            result = { 
                root: new UIRoot(this.uiRoot.domRoot, null),
                rendered: false
            };
            this.keys.set(key, result);
        } else {
            // Don't render the same list element twice in a single render pass, haiyaaaa

            assert(!result.rendered);
        }

        this.appendRootResult(result.root);
        result.rendered = true;
        this.current = result.root;

        return result.root;
    }

    getNext() {
        const idx = this.builderIdx;

        // DEV: whenever this.builderIdx === this.builders.length, we should append another builder to the list
        assert(idx <= this.builders.length);

        if (idx > 0) {
            const last = this.builders[idx - 1];
            if (!last.removed) {
                last.__end();
            }
        }

        let result;
        if (idx < this.builders.length) {
            result = this.builders[idx];
        } else {
            result = new UIRoot(this.uiRoot.domRoot, null);
            this.builders.push(result);
        }

        this.appendRootResult(result);
        this.current = result;
        this.builderIdx++;

        return result;
    }

    appendRootResult(result: UIRoot) {
        // Append new list elements to where we're currently appending
        const currentDomRootIdx = result.domRoot.currentIdx;
        result.__begin(undefined);
        result.domRoot.currentIdx = currentDomRootIdx;
    }

    end() {
        if (this.builderIdx > 0) {
            this.builders[this.builderIdx - 1].__end();
        }

        // DEV: don't decrement this more times than you increment it
        assert(this.uiRoot.openListRenderers > 0);
        this.uiRoot.openListRenderers--;

        // remove all the UI components that may have been added by other builders in the previous render.
        for (let i = this.builderIdx; i < this.builders.length; i++) {
            this.builders[i].__removeAllDomElements();
        }
        for (const v of this.keys.values()) {
            if (!v.rendered) {
                v.root.__removeAllDomElements();
            }
        }
        this.builders.length = this.builderIdx;
    }

    // kinda have to assume that it's valid to remove these elements.
    __removeAllDomElementsFromList() {
        for (let i = 0; i < this.builders.length; i++) {
            this.builders[i].__removeAllDomElements();
        }
        for (const v of this.keys.values()) {
            v.root.__removeAllDomElements();
        }
    }

}

export function newUiRoot<E extends ValidElement>(supplier: () => E): UIRoot<E> {
    const root = supplier();
    const result = new UIRoot<E>({ root, currentIdx: -1 }, supplier);
    return result;
}

type RenderFn<T extends ValidElement = ValidElement> = (r: UIRoot<T>) => void;
type RenderFnArgs<A extends unknown[], T extends ValidElement = ValidElement> = (r: UIRoot<T>, ...args: A) => void;

export function beginList(r: UIRoot): ListRenderer {
    let result = imGetNext(r.items);
    if (!result) {
        result = imPush(r.items, { t: ITEM_LIST, v: new ListRenderer(r) });
    }

    // The same hooks must be called in the same order every time
    if (result.t !== ITEM_LIST) {
        userError();
    }

    result.v.__begin();

    return result.v;
}

/**
 * Use lists to return an arbitrary amount of roots. 
 * The items may be keyed, or not keyed. 
 *
 * ```ts
 * // Non-keyed usage:
 *
 * imList(r, l => {
 *     for (let i = 0; i < n; i++) {
 *         const r = l.getNext();
 *         Component(r);
 *     }
 * });
 *
 * // Keyed usage:
 *
 * imList(r, l => {
 *     for (const user of users) {
 *         const r = l.get(user.id);
 *         UserProfileInfo(r, user);
 *     }
 * });
 *
 * ```
 *
 * You are under no obligation to key or not key the list - there is no best practice.
 * You should do what you believe is more fitting/performant/correct for your use-case.
 *
 * NOTE: You can also use imList like a switch statement:
 *
 * ```
 * imList(r, l => {
 *      const r = l.get(unionObject.type);
 *      switch(unionObject.type) {
 *          case "type1":
 *              RenderComponent1(r);
 *              break;
 *          case "type2":
 *              RenderComponent2(r);
 *              break;
 *          ...
 *      }
 * });
 * ```
 *
 * This is because each `root` can accept any arbitrary component on the first render,
 * and because you're keying the list on the type, you can be sure that subsequent renders
 * on the same root will always be with the same component.
 */
export function imList(r: UIRoot, listRenderFn: (l: ListRenderer) => void) {
    const list = beginList(r);
    listRenderFn(list);
    list.end();

    if (list.current === null) {
        r.ifStatementOpen = true;
    }
}


export function newRerenderPoint(): RerenderPoint {
    return { domRootIdx: 0, itemsIdx: 0,  };
}

const FROM_HERE = -1;
// const FROM_AFTER_HERE = 0;
// const FROM_ONE_AFTER_HERE = 1;
function imRerenderPoint(r: UIRoot, offset: number): RerenderPoint {
    const state = imState(r, newRerenderPoint);
    state.domRootIdx = r.domRoot.currentIdx;
    state.itemsIdx = r.items.idx + offset;
    return state;
}

///////// Common immediate mode UI helpers

function imStateInternal<T>(r: UIRoot, supplier: () => T, skipSupplierCheck: boolean): T {
    // Don't render new elements to this thing when you have a list renderer that is active!
    // render to that instead.
    assert(r.openListRenderers === 0);

    let result = imGetNext(r.items);
    if (!result) {
        result = imPush(r.items, { t: ITEM_STATE, v: supplier(), supplier });
    } else {
        if (result.t !== ITEM_STATE) {
            // The same hooks must be called in the same order every time
            userError();
        }

        if (!skipSupplierCheck && supplier !== result.supplier) {
            // The same hooks must be called in the same order every time.
            // If you have two hooks for the same kind of state but in a different order, this assertion won't catch that bug.
            // but I doubt you would ever be writing code like that...
            userError();
        }
    }

    return result.v as T;
}

/**
 * This method returns a stable reference to some state, allowing your component to maintain
 * state between rerenders. This only works because of the 'rules of immediate mode state' idea
 * this framework is built upon, which are basically the same as the 'rule of hooks' from React,
 * except it extends to all immediate mode state that we want to persist and reuse between rerenders, 
 * including ui components.
 *
 * This method expects that you pass in the same supplier every time.
 * This catches out-of-order hook rendering bugs, so it's better to use this where possible. 
 *
 * Sometimes, it is just way easier to do the state inline:
 * ```
 *      const s = getState(r, () => { ... some state } );
 * ```
 *
 * In which case, you'll need to use {@link imStateInline} instead. But try not to!
 */
export function imState<T>(r: UIRoot, supplier: () => T): T {
    return imStateInternal(r, supplier, false);
}

/**
 * Lets you do your suppliers inline, like `const s = imStateInline(() => ({ blah }));`.
 *
 * WARNING: using this method won't allow you to catch out-of-order im-state-rendering bugs at runtime, 
 * leading to potential data corruption. 
 *
 */
export function imStateInline<T>(r: UIRoot, supplier: () => T): T {
    return imStateInternal(r, supplier, true);
}

export function el<E extends ValidElement = ValidElement>(r: UIRoot, elementSupplier: () => E, next?: RenderFn<E>): UIRoot<E> {
    // Don't render new elements to this thing when you have a list renderer that is active!
    // render to that instead.
    assert(r.openListRenderers === 0);

    let result = imGetNext(r.items);
    if (!result) {
        const uiRoot = newUiRoot(elementSupplier);
        result = imPush(r.items, { t: ITEM_UI_ROOT, v: uiRoot });
    }

    if (result.t !== ITEM_UI_ROOT) {
        // The same hooks must be called in the same order every time
        userError();
    }

    // The same hooks must be called in the same order every time.
    // string comparisons end up being quite expensive in the end, so we're storing
    // a reference to the function that created the dom element and comparing those instead.
    assert(result.v.elementSupplier === elementSupplier);

    r.hasRealChildren = true;
    appendToDomRoot(r.domRoot, result.v.domRoot.root);

    result.v.__begin();

    // The lambda API only exists because we can't shadow a variable with an expresion that uses itself.
    // i.e if we could do something like this:
    //
    // ```
    // const r = div(r);
    // r.begin(); {
    //      r = div(r);
    // }
    // r.end();
    //
    // Then I would.
    // ```

    next?.(result.v as UIRoot<E>);

    result.v.__end();

    return result.v as UIRoot<E>;
} 


/** 
 * Any name and string is fine, but I've hardcoded a few for autocomplete. 
 * A common bug is to type 'styles' instead of 'style' and wonder why the layout isn't working, for example.
 */
type Attrs = Record<string, string | string[] | undefined> & {
    style?: string | Record<keyof HTMLElement["style"], string | null>;
    class?: string[];
};

function setAttribute(e: ValidElement, attr: string, val: string | null) {
    if (val !== null) {
        e.setAttribute(attr, val);
    } else {
        e.removeAttribute(attr);
    }
}

export function createSvgElement<E extends SVGElement>(type: string): E {
    const xmlNamespace = "http://www.w3.org/2000/svg";
    const svgEl = document.createElementNS(xmlNamespace, type) as E;
    if (type === "svg" || type === "SVG") {
        // Took this from https://stackoverflow.com/questions/8215021/create-svg-tag-with-javascript
        // Not sure if actually needed
        svgEl.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
        svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    return svgEl;
}

export function newDomElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    attrs?: Attrs,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    for (const attr in attrs) {
        let val = attrs[attr];
        if (val === undefined) {
            continue;
        }

        if (Array.isArray(val)) {
            // I would have liked for this to only happen to the `class` attribute, but I 
            // couldn't figure out the correct typescript type. AI was no help either btw.
            // Also add a space, so that we can call `setAttrs` on the same component multiple times without breaking the class defs
            val = val.join(" ") + " ";
        }

        setAttribute(element, attr, val);
    }
    return element;
}

export function newDiv() {
    return newDomElement("div");
}

export function newSpan() {
    return newDomElement("span");
}

export function div(r: UIRoot, next?: RenderFn<HTMLDivElement>): UIRoot<HTMLDivElement> {
    return el<HTMLDivElement>(r, newDiv, next);
}


export function span(r: UIRoot, next?: RenderFn<HTMLSpanElement>): UIRoot<HTMLSpanElement> {
    return el<HTMLSpanElement>(r, newSpan, next);
}


type Falsy = "" | 0 | null | undefined | false;
/**
 * You'll need to use this, as well as {@link imElse} and {@link imElseIf} for (most) conditional rendering,
 * so that you're rendering the same amount of im-state entries to a UIRoot at a time.
 * It's just implemented with an imList under the hood, but that might change in the future.
 *
 * This component also does smoe basic type narrowing.
 *
 * For switch-like behaviour, you may be able to use a {@link imList} directly - check it's documentation for more info.
 *
 * You can also use it after {@link imList} - it will render stuff when the list rendered zero things.
 *
 * Examples:
 *
 * ```ts
 *
 * // basic usage:
 * imIf(condition1, r, r => { ... });
 * imElseIf(condition2, r => { ... });
 * imElse(r, r => { ... });
 *
 * // type narrowing
 * imIf(valueOrNull, r, (r, value) => { ... });
 * 
 * // lists
 * imList(...)
 * imElse(r, r => { // this part runs when imList rendered 0 items 
 * });
 *
 * ```
 */
export function imIf<V>(val: V | Falsy, r: UIRoot, next: (r: UIRoot, typeNarrowedVal: V) => void) {
    r.ifStatementOpen = true;
    imElseIf(val, r, next);
}

/**
 * See {@link imIf}
 */
export function imElse(r: UIRoot, next: (r: UIRoot, typeNarrowedVal: true) => void) {
    imElseIf(true, r, next);
}

/**
 * See {@link imIf}
 */
export function imElseIf<V>(val: V | Falsy, rIn: UIRoot, next: (r: UIRoot, typeNarrowedVal: V) => void) {
    imList(rIn, l => {
        const domRootIdx = rIn.domRoot.currentIdx;
        const r = l.getNext();

        if (rIn.ifStatementOpen && val) {
            rIn.ifStatementOpen = false;
            next(r, val);
        } else {
            l.__removeAllDomElementsFromList();
            rIn.domRoot.currentIdx = domRootIdx;
        }
    });
}

function canAnimate(r: UIRoot) {
    return !r.removed && !r.manuallyHidden;
}

// Old documentation for the hook:
//
// The `rerender` method resets `r`'s current immediate mode state index to 1 before the call to `rerenderFn`, and the invokes
// the render method you passed in. It relies on the fact that every render method will always generate the same number of immediate
// mode state entries each time, so we can reliably just reset some indicies to what they were before we called them, and then 
// simply call them again:
//
// ```
// function App(r: UIRoot) {
//      const rerender = rerenderFn(r, () => App(r));
// }
//
// ```
//
// It won't work if you don't call things in the right order. Here's an example that will fail:
//
// ```
// function IWillThrowAnError(r: UIRoot) {
//      const state = getState(newAppState); 
//      const rerender = renderFn(r, () => IWillThrowAnError(r));
// }
// ```
//
// This is because when we generate `rerender`, getState will have bumped the immedate mode index up by 1, so 
// the index we store will be one higher than what was correct if we wanted to call IWillThrowAnError(r) on the root again.

/**
 * Wrap any component tree you want to the abilit to 'rerender' in this method.
 *
 * Due to the way this framework is implemented, I haven't been able to just give you a rerender method on 
 * every UIRoot, unfortunately. There's a big block comment above this JSDoc that explains it, if you 
 * care to navigate here and read it...
 */
export function imRerenderable(r: UIRoot, fn: (r: UIRoot, rerender: () => void) => void) {
    const rerenderPoint = imRerenderPoint(r, FROM_HERE);
    fn(r, () => {
        r.__begin(rerenderPoint);
        imRerenderable(r, fn)
    });
}

function newRealtimeState(): {
    dt: number;
    animation: RealtimeAnimation | null;
} { 
    return { 
        dt: 0, 
        animation: null,
    };
}

export function realtime(r: UIRoot, fn: RenderFnArgs<[number]>) {
    imRerenderable(r, (r, rerender) => {
        const state = imState(r, newRealtimeState);
        if (!state.animation) {
            state.animation = newAnimation((dt) => {
                if (!canAnimate(r)) {
                    return false;
                } 

                state.dt = dt;
                rerender();
                return true;
            });
        }

        fn(r, state.dt);

        startAnimation(state.animation);
    });
}

function newIntermittentState() : {
    t: number; ms: number; animation: RealtimeAnimation | null;
} { 
    return { t: 0, ms: 0 , animation: null };
}

export function intermittent(r: UIRoot, fn: RenderFn, ms: number) {
    imRerenderable(r, (r, rerender) => {
        const state = imState(r, newIntermittentState);
        state.ms = ms;
        if (!state.animation) {
            state.animation = newAnimation((dt) => {
                if (!canAnimate(r)) {
                    return false;
                } 

                state.t += dt;
                if (state.t > state.ms) {
                    rerender();
                    state.t = 0;
                }

                return true;
            });
        }

        fn(r);

        startAnimation(state.animation);
    });
}


export function imErrorBoundary(
    rIn: UIRoot,
    renderFnNormal: RenderFn,
    renderFnError: RenderFnArgs<[any, () => void]>,
) {
    imRerenderable(rIn, (rIn, rerender) => {
        const l = beginList(rIn);

        const recover = () => {
            l.__removeAllDomElementsFromList();
            rerender();
        }

        try {
            renderFnNormal(l.getNext());
        } catch (error) {
            const r = l.current;
            if (r) {
                r.__removeAllDomElements();

                // need to reset the dom root, since we've just removed elements underneath it
                resetDomRoot(r.domRoot);
            }

            renderFnError(l.getNext(), error, recover);
        } finally {
            l.end();
        }
    });
}

type Ref<T> = { val: T | null; }
function newRef<T>(): Ref<T> {
    return { val: null };
}

// NOTE: Prefer using this for transient UI state rather than actual program state, 
// and prefer `imState` for actual program state that you're storing locally, so that
// your refactorings willl be easier. 
export function imRef<T>(r: UIRoot): Ref<T> {
    return imState(r, newRef as (typeof newRef<T>));
}


class Memoizer{
    items = newImArray<[unknown]>();

    // If a Memo is supposed to keep our realtime animation loop from firing repeatedly,
    // but we've done `if(imMemo(r).val(r))` by mistake, the bug will be some expensive thing firing
    // very repeatedly. However, if the mistake was `if(!imMemo(r).val(r))`, then nothing will happen.
    // This is why I am using `isSame` here instead of `changed`, so that the mis-use will be less costly.
    isSame = true;

    begin() {
        if (this.items.expectedLength !== -1) {
            imLockSize(this.items);
        }

        imReset(this.items);
        this.isSame = true;
    }

    keys(obj: Record<string, unknown>) {
        for (const k in obj) {
            this.val(obj[k]);
        }
        return this;
    }

    val(val: unknown) {
        let existing = imGetNext(this.items);
        if (!existing) {
            existing = imPush(this.items, [val]);
        }
        if (val !== existing[0]) {
            this.isSame = false;
        }
        existing[0] = val;
        return this;
    }
}

function newMemoizer() {
    return new Memoizer();
}

export function imMemo(r: UIRoot) {
    const val = imState(r, newMemoizer);
    val.begin();
    return val;
}

/**
 * Seems like simply doing r.root.onwhatever = () => { blah } destroys performance,
 * so this  method exists now...
 */
export function imOn<K extends keyof HTMLElementEventMap>(
    r: UIRoot,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
) {
    const handlerRef = imRef<((ev: HTMLElementEventMap[K]) => any)>(r);
    if (handlerRef.val === null) {
        handlerRef.val = listener;
        r.root.addEventListener(type, (e) => {
            assert(!!handlerRef.val);

            // @ts-expect-error I don't have the typescript skill to explain to typescript why this is actually fine.
            handlerRef.val!(e);
        }, options);
    } else {
        handlerRef.val = listener;
    }
}
