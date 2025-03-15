// *IM* DOM-utils v0.1.007 - @Tejas-H5
// A variation on DOM-utils with the immediate-mode API isntead of the normal one. I'm still deciding which one I will continue to use.
// Right now, this one seems better, but the other one has a 'proven' track record of actually working.
// But in a matter of hours/days, I was able to implement features in this framework that I wasn't able to for months/years in the other one...

//////////
// Assertion functions

/**
 * Assertions are used to catch bugs.
 * Making this a no-op will sometimes improve performance. But I am not sure you want to do that just yet. 
 * Wait for me to add a comprehensive suite of tests for this framework before you do that.
 *
 * Every assertion should have a comment above it explaining why it's there, to make
 * debugging for users easier. It also means the final minimized code without comments doesn't have
 * a bunch of long error strings in there increasing it's size, and that
 * you only need to put a breakpoint here to respond to the vast majority of failures.
 */
export function assert(value: unknown): asserts value {
    if (!value) {
        throw new Error("Assertion failed");
    }
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
    userSelectNone: sb.cn("userSelectNone", [` { user-select: none; }`]),

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

/**
 * This class builds an immediate-mode tree, and stores immediate mode state for a component.
 * See {@link ImmediateModeArray} to learn what 'immediate mode state' is. 
 *
 * Once a UIRoot is created, it has no specific shape. However, once a function has completed
 * rendering to it, it will call __end() on this root, and cause it to lock it's
 * shape. From that point onwards, it is assumed (and heavily asserted) that every subsequent rerender to a particular
 * root happens with the same function as the first render.
 *
 * This allows state and DOM-nodes to be created just once, while allowing other code and computations to remain local to 
 * the place that is actually using it. 
 *
 * However, it means that you can't do basic things like this:
 *
 * ```ts
 * function Component(val: number) {
 *      if (number > 10) {
 *          Component1();
 *      } else {
 *          Component2();
 *      }
 * }
 * ```
 *
 * Because more likely than not, Component1 and Component2 will have completly different state and dom elements.
 * You'll need to use a different UI root to render different types of components.
 *
 * There are a couple solutions to this.
 * See the docuemntation for {@link imIf}, {@link imSwitch}, {@link beginList} for more info.
 */
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

    /** Used by the {@link init} to run just once per element */
    init = false;

    // TODO: think of how we can remove this, from user code at the very least.
    __begin(rp?: RerenderPoint) {
        resetDomRoot(this.domRoot, rp?.domRootIdx);

        imReset(this.items, rp?.itemsIdx);

        push(this);

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

        const val = pop();

        // You may have forgotten to call end();
        assert(val === this);

        if (this.items.expectedLength === -1) {
            imLockSize(this.items);
            return;
        }

        // DEV: If this is negative, I fkd up (I decremented this thing too many times) 
        // User: If this is positive, u fked up (You forgot to finalize an open list)
        assert(this.openListRenderers === 0);
    }

    setStyle<K extends (keyof E["style"])>(key: K, value: string) {
        this.assertNotDerived();

        // @ts-expect-error it sure can
        this.root.style[key] = value;
        return this;
    }
    readonly s = this.setStyle;

    // NOTE: the effect of this method will persist accross renders
    setClass(val: string, enabled: boolean = true) {
        this.assertNotDerived();

        if (enabled) {
            this.root.classList.add(val);
        } else {
            this.root.classList.remove(val);
        }
        return this;
    }
    readonly c = this.setClass;

    text(value: string) { 
        setChildAtEl
        // don't overwrite the real children!
        assert(!this.hasRealChildren);

        this.assertNotDerived();

        if (this.root.childNodes.length === 0) {
            this.root.appendChild(document.createTextNode(value));
        } else {
            const textNode = this.root.childNodes[0];
            textNode.nodeValue = value;
        }
    }

    setAttribute(attr: string, val: string | null) {
        this.assertNotDerived();
        return setAttribute(this.root, attr, val);
    }
    readonly a = this.setAttribute;

    assertNotDerived() {
        // When elementSupplier is null, this is because the root is not the 'owner' of a particular DOM element - 
        // rather, we got it from a ListRenderer somehow - setting attributes on these roots is usually a mistake
        assert(this.elementSupplier !== null);
    }

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

type ValidKey = string | number | Function | object;

export class ListRenderer {
    uiRoot: UIRoot;
    keys = new Map<ValidKey, { root: UIRoot, rendered: boolean }>();
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
        push(this);
    }

    /** Use this for a keyed list renderer */
    __getForKey(key: ValidKey) {
        let result = this.keys.get(key);
        if (!result) {
            result = { 
                root: new UIRoot(this.uiRoot.domRoot, null),
                rendered: false
            };
            this.keys.set(key, result);
        } else {
            // Don't render same list element twice in single render pass, haiyaaaa
            assert(!result.rendered);
        }

        result.rendered = true;

        return result;
    }

    // This method automatically calls end() on the last root
    root(key?: ValidKey) {
        const r = getCurrentStackItemInternal();

        // you also need to call end() after grabbing a root. 
        assert(r === this);

        let result;
        if (key) {
            result = this.__getForKey(key).root;
        } else {
            const idx = this.builderIdx;

            // DEV: whenever this.builderIdx === this.builders.length, we should append another builder to the list
            assert(idx <= this.builders.length);

            if (idx < this.builders.length) {
                result = this.builders[idx];
            } else {
                result = new UIRoot(this.uiRoot.domRoot, null);
                this.builders.push(result);
            }

            this.builderIdx++;
        }

        // Append new list elements to where we're currently appending
        const currentDomRootIdx = result.domRoot.currentIdx;
        result.__begin(undefined);
        result.domRoot.currentIdx = currentDomRootIdx;

        this.current = result;

        return result;
    }

    __end() {
        // DEV: don't decrement this more times than you increment it
        assert(this.uiRoot.openListRenderers > 0);
        this.uiRoot.openListRenderers--;

        const val = pop();

        // You may have forgotten to call end();
        assert(val === this);

        // remove all the UI components that may have been added by other builders in the previous render.
        for (let i = this.builderIdx; i < this.builders.length; i++) {
            this.builders[i].__removeAllDomElements();
        }
        this.builders.length = this.builderIdx;
        for (const v of this.keys.values()) {
            if (!v.rendered) {
                v.root.__removeAllDomElements();
            }
        }
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

export type RenderFn<T extends ValidElement = ValidElement> = (r: UIRoot<T>) => void;
export type RenderFnArgs<A extends unknown[], T extends ValidElement = ValidElement> = (r: UIRoot<T>, ...args: A) => void;

/**
 * Allows you to render a variable number of UI roots at a particular point in your component.
 * UI Roots that aren't rendered in subsequent renders get removed from the dom when you `end()` a list.
 *
 * See {@link nextRoot} for more info.
 *
 *
 * Normal usage:
 * ```ts
 * imList();
 * for (let i = 0; i < n; i++) {
 *      nextRoot(); {
 *          RenderComponent();
 *      } end();
 * }
 * end();
 * ```
 *
 * Keyed:
 *
 * ```ts
 * imList();
 * for (const item of items) {
 *      nextRoot(item.id); {
 *          RenderComponent();
 *      } end();
 * }
 * end();
 * ```
 */
export function beginList(isConditional = false): ListRenderer {
    const r = getCurrentRootInternal();

    let result = imGetNext(r.items);
    if (!result) {
        result = imPush(r.items, { t: ITEM_LIST, v: new ListRenderer(r) });
    }

    if (result.t !== ITEM_LIST) {
        // The same hooks must be called in the same order every time
        assert(false);
    }

    result.v.__begin();

    if (!isConditional && result.v.current === null) {
        // by default, open an if-statement for an `else` if we rendered zero items.
        r.ifStatementOpen = true;
    }

    return result.v as ListRenderer;
}

/**
 * Read {@link beginList}'s doc first for context and examples.
 *
 * You can optionally specify a {@link key}.
 * If no key is present, the same UIRoot that was rendered for the nth call of  nextRoot() will be re-used.
 * If a key is present, the same UIRoot that was rendered for that particular key will be re-used. Make sure
 *      to not reuse the same key twice.
 *
 * See the {@link UIRoot} docs for more info on what a 'UIRoot' even is, and how to effectively (re)-use them.
 */
export function nextRoot(key?: ValidKey) {
    const l = getCurrentListRendererInternal();
    return l.root(key);
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

export function newRerenderPoint(): RerenderPoint {
    return { domRootIdx: 0, itemsIdx: 0,  };
}

const FROM_HERE = -1;
// const FROM_AFTER_HERE = 0;
// const FROM_ONE_AFTER_HERE = 1;
function imRerenderPoint(r: UIRoot, offset: number): RerenderPoint {
    const state = imState(newRerenderPoint);
    state.domRootIdx = r.domRoot.currentIdx;
    state.itemsIdx = r.items.idx + offset;
    return state;
}

///////// Common immediate mode UI helpers

function imStateInternal<T>(supplier: () => T, skipSupplierCheck: boolean): T {
    const r = getCurrentRootInternal();
    // Don't render new elements to this thing when you have a list renderer that is active!
    // render to that instead.
    assert(r.openListRenderers === 0);

    let result = imGetNext(r.items);
    if (!result) {
        result = imPush(r.items, { t: ITEM_STATE, v: supplier(), supplier });
    } else {
        if (result.t !== ITEM_STATE) {
            // The same hooks must be called in the same order every time
            assert(false);
        }

        if (!skipSupplierCheck && supplier !== result.supplier) {
            // The same hooks must be called in the same order every time.
            // If you have two hooks for state generated by the same supplier, but they were called out of order for some reason, 
            // this assertion won't catch that bug. I am assuming you won't write code like that...
            assert(false);
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
export function imState<T>(supplier: () => T): T {
    return imStateInternal(supplier, false);
}

/**
 * Lets you do your suppliers inline, like `const s = imStateInline(() => ({ blah }));`.
 *
 * WARNING: using this method won't allow you to catch out-of-order im-state-rendering bugs at runtime, 
 * leading to potential data corruption. 
 *
 */
export function imStateInline<T>(supplier: () => T): T {
    return imStateInternal(supplier, true);
}

let appRoot: UIRoot = newUiRoot(() => document.body);
const currentStack: (UIRoot | ListRenderer)[] = [];
export function setUiRoot(r: UIRoot) {
    assert(currentStack.length <= 1);
    appRoot = r;
    currentStack[0] = appRoot;
}

// You probably don't want to use this, if you can help it
export function getCurrentStackItemInternal() {
    return currentStack[currentStack.length - 1];
}

// You probably don't want to use this, if you can help it
export function getCurrentRootInternal(): UIRoot {
    const val = getCurrentStackItemInternal();
    assert(val instanceof UIRoot);
    return val;
}

// You probably don't want to use this, if you can help it
export function getCurrentListRendererInternal(): ListRenderer {
    const val = getCurrentStackItemInternal();
    assert(val instanceof ListRenderer);
    return val;
}

function push(r: UIRoot | ListRenderer) {
    currentStack.push(r);
}
function pop() {
    return currentStack.pop();
}

export function startRendering(r: UIRoot = appRoot, rp?: RerenderPoint) {
    currentStack.length = 0;
    r.__begin(rp);
}

export function el<E extends ValidElement = ValidElement>(elementSupplier: () => E): UIRoot<E> {
    const r = getCurrentRootInternal();

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
        assert(false);
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

    return result.v as UIRoot<E>;
} 

export function end() {
    const val = currentStack[currentStack.length - 1];
    val.__end();
}

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

/** 
 * Any name and string is fine, but I've hardcoded a few for autocomplete. 
 * A common bug is to type 'styles' instead of 'style' and wonder why the layout isn't working, for example.
 */
type Attrs = Record<string, string | string[] | undefined> & {
    style?: string | Record<keyof HTMLElement["style"], string | null>;
    class?: string[];
};

function setAttributesInternal(element: ValidElement, attrs: Attrs) {
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
}

export function newDomElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    attrs?: Attrs,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    if (attrs) {
        setAttributesInternal(element, attrs);
    }
    return element;
}

export function newDiv() {
    return newDomElement("div");
}

export function newSpan() {
    return newDomElement("span");
}

export function div(): UIRoot<HTMLDivElement> {
    return el<HTMLDivElement>(newDiv);
}

// The name `text` is far too common in user code, so textNode it is
export function textNode(str: string) {
    const r = getCurrentRootInternal();
    r.text(str);
}

/** 
 * Text spans can be reliably inserted between other DOM elements
 */
export function textSpan(text: string, fn?: () => void) {
    const result = span(); {
        textNode(text);
        fn?.();
    } end();
    return result;
}


export function span(): UIRoot<HTMLSpanElement> {
    return el<HTMLSpanElement>(newSpan);
}


/// NOTE: This doesn't include "" or 0, mainly to avoid various 'why isn't my thing showing up' bugs
type ActualFalseyValues = null | undefined | false;

/**
 *
 * See {@link UIRoot}'s docs to understand why this exists.
 *
 * If you have any ideas on how to use a callbackless API here that is also easy to use and 
 * allows us to just use a basic if-statements (they are cool because they do type narrowing and other
 * typescript stuff), then let me know. 
 *
 * Typical usage:
 * ```ts
 * imIf( *** , () => {
 *      Component1();
 * })
 * imElseIf( ***, () => {
 *      Component2();
 * })
 * imElse(() => {
 *      Component3();
 * })
 * ```
 *
 * With lists:
 * ```ts
 * imList() {
 *      for (const item of items) { ... }
 * } end();
 * imElse(() => {
 *      // else after a list is allowed to run when an imList rendered zero items.
 *      div(); { text("Zero results.") } end();
 * })
 * ```
 *
 * Type narrowing:
 * ```ts
 * imIf(valOrUndefined, (val) => {
 *      Component(val);  // NOTE: most of the time, we want to render the number 0. so imIf only type-narrows T | null | undefined | false to T.
 * })
 * ```
 */
export function imIf<V>(val: V | ActualFalseyValues, next: (typeNarrowedVal: V) => void) {
    const r = getCurrentRootInternal();
    r.ifStatementOpen = true;
    imElseIf(val, next);
}

/**
 * See {@link imIf}
 */
export function imElse(next: () => void) {
    imElseIf(true, next);
}

/**
 * See {@link imIf}
 */
export function imElseIf<V>(val: V | ActualFalseyValues, next: (typeNarrowedVal: V) => void) {
    const rIn = getCurrentRootInternal();
    beginList(true); {
        if (rIn.ifStatementOpen && (val || val === 0 || val === "")) {
            rIn.ifStatementOpen = false;
            nextRoot(); {
                next(val);
            }
            end();
        }
    }
    end();
}

/**
 * ```ts
 * imSwitch(result.type, () => {
 *      switch(result.type) {
 *          case types.A: return AResultComponent(result);
 *          case types.B: return BResultComponent(result);
 *          case types.C: return CResultComponent(result);
 *      }
 * })
 * ```
 */
export function imSwitch(key: string | number, switchFn: () => void) {
    beginList(); nextRoot(key);
    switchFn();
    end(); end();
};

function canAnimate(r: UIRoot) {
    return !r.removed && !r.manuallyHidden;
}

/**
 * Wrap any component tree you want to the ability to 'rerender' with this method.
 *
 * Rerendering a component involves resetting immediate mode indices to just before this 
 * thing was first rendered, and then calling the function you passed in.
 */
export function imRerenderable(fn: (rerender: () => void) => void) {
    const r = getCurrentRootInternal();
    const rerenderPoint = imRerenderPoint(r, FROM_HERE);
    fn(() => {
        startRendering(r, rerenderPoint);

        const stackSize = getComponentStackSize();

        imRerenderable(fn)

        // You (or I) forgot a call to end() somewhere.
        assert(stackSize === getComponentStackSize());
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

export function realtime(fn: (dt: number) => void) {
    imRerenderable((rerender) => {
        const r = getCurrentRootInternal();

        const state = imState(newRealtimeState);
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

        fn(state.dt);

        startAnimation(state.animation);
    });
}

function newIntermittentState() : {
    t: number; ms: number; animation: RealtimeAnimation | null;
} { 
    return { t: 0, ms: 0 , animation: null };
}

export function intermittent(fn: RenderFn, ms: number) {
    imRerenderable((rerender) => {
        const r = getCurrentRootInternal();
        const state = imState(newIntermittentState);
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


// NOTE: currently, if a component rerenders itself deep underneath the error boundary, it
// can't throw back up to the error boundary. We will have to start remembering the callstack above it
// to allow for this, so the callbacks abstraction actually makes sense, for now.

/**
 * ```ts
 * // Button component is not included
 * imTryCatch({
 *      tryFn: () => { div(); { div(); { throw new Error("bruh") } end(); } end(); }
 *      catchFn: (err, recover) => { Button("there was an error viewing the content. click here to try again", recover); }
 * })
 * ```
 */
export function imTryCatch({ 
    tryFn, catchFn 
} : {
    tryFn: () => void,
    catchFn: (error: any, recover: () => void) => void,
}) {
    imRerenderable((rerender) => {
        const l = beginList();

        try {
            nextRoot(); {
                tryFn();
            }
            end();
        } catch (error) {
            // need to wind the stack back to the current list component
            const idx = currentStack.lastIndexOf(l);
            assert(idx !== -1);
            currentStack.length = idx + 1;

            const r = l.current;
            if (r) {
                r.__removeAllDomElements();

                // need to reset the dom root, since we've just removed elements underneath it
                resetDomRoot(r.domRoot);
            }

            const recover = () => {
                l.__removeAllDomElementsFromList();
                rerender();
            }

            nextRoot(); {
                catchFn(error, recover);
            };
            end();
        } finally {
            end();
        }
    });
}

export type Ref<T> = { val: T | null; }
function newRef<T>(): Ref<T> {
    return { val: null };
}

/**
 * Set the state later in the function:
 * ```ts
 * const ref = imRef<HTMLDivElement>();
 *
 * ref.current = div().root; {
 *      text("The div: " + ref.val);
 * } end();
 * ```
 */
export function imRef<T>(): Ref<T> {
    return imState(newRef as (typeof newRef<T>));
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
            this.isSame = false;
        } else if (val !== existing[0]) {
            this.isSame = false;
        }
        existing[0] = val;
        return this;
    }
}

function newMemoizer() {
    return new Memoizer();
}

export function imMemo() {
    const val = imState(newMemoizer);
    val.begin();
    return val;
}

/**
 * Seems like simply doing r.root.onwhatever = () => { blah } destroys performance,
 * so this  method exists now...
 *
 * TODO: verify if we actually need to remove event handlers or not. I haven't
 * ran into any issues by not doing this.
 */
export function imOn<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
) {
    const r = getCurrentRootInternal();
    const handlerRef = imRef<((ev: HTMLElementEventMap[K]) => any)>();
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

/**
 * This allows you to check if a component is missing calls to end().
 * It's mainly for debugging - you probably don't need to leave it in.
 *
 * ``` ts
 * function Component() {
 *      const stackSize = getComponentStackSize(Component);
 *
 *      ...
 *
 *      assert(getComponentStackSize() === stackSize);
 * }
 * ```
 */
export function getComponentStackSize() {
    return currentStack.length;
}

export function init(): boolean {
    const r = getCurrentRootInternal();
    if (!r.init) {
        r.init = true;
        return true;
    }
    return false;
}

/**
 * ```ts
 * function Component() {
 *      div(); {
 *          init() && setAttributes({ 
 *              class: [cn.row, cn.alignItemsCenter, cn.justifyContentCenter],
 *              anythingReally: "some value"
 *          });
 *      } end();
 * }
 * ```
 */
export function setAttributes(attrs: Attrs, r = getCurrentRootInternal()) {
    // When elementSupplier is null, this is because the root is not the 'owner' of a particular DOM element - 
    // rather, we got it from a ListRenderer somehow - setting attributes on these roots is usually a mistake
    assert(r.elementSupplier !== null);

    setAttributesInternal(r.root, attrs);
}

export function setAttr<T extends keyof Attrs>(k: T, v: string | null) {
    const r = getCurrentRootInternal();
    r.setAttribute(k, v);
}

export function setStyle<K extends (keyof ValidElement["style"])>(key: K, value: string) {
    const r = getCurrentRootInternal();
    r.setStyle(key, value);
}

export function setClass(val: string, enabled: boolean = true) {
    // NOTE: the effect of this method will persist accross renders
    const r = getCurrentRootInternal();
    r.setClass(val, enabled);
}


