// *IM* DOM-utils v0.1.007 - @Tejas-H5
// A variation on DOM-utils with the immediate-mode API isntead of the normal one. I'm still deciding which one I will continue to use.
// Right now, this one seems better, but the other one has a 'proven' track record of actually working.
// But in a matter of hours/days, I was able to implement features in this framework that I wasn't able to for months/years in the other one...

import { CssColor, newColorFromHexOrUndefined } from "./colour";

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

export function setCssVars(vars: Record<string, string | CssColor>, cssRoot?: HTMLElement) {
    if (!cssRoot) {
        cssRoot = document.querySelector(":root") as HTMLElement;
    }

    for (const k in vars) {
        setCssVar(cssRoot, k, vars[k]);
    }
}

export function setCssVar(cssRoot: HTMLElement, varName: string, value: string | CssColor) {
    const fullVarName = `--${varName}`;
    cssRoot.style.setProperty(fullVarName, "" + value);
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


///////// 
// Immediate-mode array datastructure, for use with the immediate mode renderer

/**
 * An immediate-mode array datastructure is an array 
 * that starts off being variable length, and then locks
 * it's own size at some point during a 'frame boundary'.
 *
 * This allows subsequent 'rerenders' to assume that the exact same things
 * are being rerendered in the same position. This sounded similar to 
 * 'hooks' from React, so I may have accidentally called them 'hooks' 
 * in some places in this codebase, when I meant to say 'immediate mode state'. 
 *
 * Unlike React, every DOM node is also rendered as immediate-mode state.
 * There is also one key difference - immediate mode arrays support not being rendered to.
 * This means that if you decide to render nothing at all to an immediate mode array, it will not complain
 * about you not rendering enough things. 
 *
 * The class {@link UIRoot} actually checks for this case, and detatches any DOM elements it rendered in 
 * the previous render pass. 
 */
type ImmediateModeArray<T> = {
    items: T[];
    idx: number;
    init: number;
};

function newImArray<T>(): ImmediateModeArray<T> {
    return {
        items: [],
        idx: -1,
        init: 0,
    };
}

function imGetCurrent<T>(arr: ImmediateModeArray<T>): T | undefined {
    if (arr.idx >= arr.items.length) {
        return undefined;
    }
    return arr.items[arr.idx];
}

function imReset(arr: ImmediateModeArray<unknown>) {
    // Once an immediate mode array has been finalized, every subsequent render must create the same number of things.
    // In this case, you've rendered too few things.
    assert(arr.idx === -1 || arr.idx === arr.items.length - 1);

    arr.idx = -1;
}

///////// 
// Immediate-mode dom renderer. I've replaced the old render-groups approach with this thing. 
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
export type UIChildRootItem<E extends ValidElement> = {
    t: typeof ITEM_UI_ROOT;
    v: UIRoot<E>;
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

export type UIRootItem = UIChildRootItem<any> | ListRendererItem | StateItem;

export type DomAppender<E extends ValidElement = ValidElement> = {
    root: E;
    domElements: ValidElement[];
    idx: number;
};

export function resetDomAppender(domAppender: DomAppender, idx = -1) {
    domAppender.idx = idx;
}

export function appendToDomRoot(domAppender: DomAppender, child: ValidElement) {
    domAppender.idx++;
    setChildAtEl(domAppender.root, domAppender.idx, child);
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
    domAppenderIdx: number;
    itemsIdx: number;
}

/**
 * This class builds an immediate-mode tree, and stores immediate mode state for a component.
 * See {@link ImmediateModeArray} to learn what 'immediate mode state' is. 
 *
 * Once the immediatem 
 *
 * ```
 *  - [state]
 *  - [state]
 *  - [dom node ui root]
 *      ...
 *  - [dom node ui root]
 *      ...
 *  - [dom node ui root]
 *      ...
 *  - [list renderer]
 *      - [list renderer ui root]
 *          ...
 *      - [list renderer ui root]
 *          ...
 * ```
 *
 * Once a UIRoot is created, it has no specific shape. However, once a function has completed
 * rendering to it, it will call __end() on this root, and cause it to lock it's
 * shape. From that point onwards, it is assumed (and heavily asserted) that every subsequent rerender to a particular
 * root will create the exact same number of state, dom node, and list renderer entries, or zero entries if 
 * we want to detatch it's DOM elements.
 *
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
 * This can be achieved by treating conditional rendering as a special case of list rendering:
 *
 * ```
 *
 * function Component(val: number) {
 *      beginList();
 *      if (nextRoot() && number > 10) {
 *          Component1();
 *      } else {
 *          nextRoot();
 *          Component2();
 *      } endList();
 * }
 * ```
 *
 * See the docs for {@link imBeginList} for more info.
 */
export class UIRoot<E extends ValidElement = ValidElement> {
    readonly root: E;
    readonly domAppender: DomAppender<E>;
    // If there was no supplier, then this root is attached to the same DOM element as another UI root that does have a supplier.
    readonly elementSupplier: (() => ValidElement) | null;

    readonly destructors: (() => void)[] = [];

    readonly items = newImArray<UIRootItem>();
    lockImArray = false;
    
    openListRenderers = 0;
    hasRealChildren = false;
    manuallyHidden = false;
    ifStatementOpen = false;

    // Probably not needed, now that we're just rerendering the app in an animation frame.
    removed = true;
    destroyed = false;

    began = false;

    // Users should call `newUiRoot` instead.
    constructor(domAppender: DomAppender<E>, elementFactory: (() => ValidElement) | null) {
        this.root = domAppender.root;
        this.domAppender = domAppender;
        this.elementSupplier = elementFactory;
    }

    /**
     * NOTE: if the component errors out before __end is called,
     * this won't be updated to false. Hence, don't use this for real idempotency, use an imRef 
     * that you check for null and set just once manually.
     */
    isInInitPhase = true;

    // TODO: think of how we can remove this, from user code at the very least.
    __begin() {
        resetDomAppender(this.domAppender);

        imReset(this.items);

        pushRoot(this);

        // NOTE: avoid any more asertions here - the component may error out, and
        // __end may not get called. No I'm not going to catch it with an exception stfu. We livin on the edge, bois.

        this.openListRenderers = 0;

        this.ifStatementOpen = false;

        this.removed = false;
        // we may be recovering from an error, so I'm not asserting !this.began here.
        this.began = true;
    }

    // Only lock the size if we reach the end without the component throwing errors. 
    __end(detatchElementsWhenNothingRendered = true) {
        assert(this.began);
        this.began = false;

        popRoot();

        this.isInInitPhase = false;

        this.items.init = 1;

        // DEV: If this is negative, I fkd up (I decremented this thing too many times) 
        // User: If this is positive, u fked up (You forgot to finalize an open list)
        assert(this.openListRenderers === 0);

        if (detatchElementsWhenNothingRendered) {
            if (this.items.idx === -1) {
                // we rendered nothing to this root, so we should just remove it.
                // however, we may render to it again on a subsequent render.
                this.__removeAllDomElements(false);
            }
        }
    }

    setStyle<K extends (keyof E["style"])>(key: K, value: string) {
        this.assertNotDerived();

        // @ts-expect-error it sure can
        this.root.style[key] = value;
        return this;
    }
    readonly s = this.setStyle;

    // NOTE: the effect of this method will persist accross renders
    setClass(val: string, enabled: boolean | number = true) {
        this.assertNotDerived();

        const has = this.root.classList.contains(val);
        if (has === !!enabled) {
            return;
        }

        if (enabled) {
            this.root.classList.add(val);
        } else {
            this.root.classList.remove(val);
        }
        return this;
    }
    readonly c = this.setClass;

    lastText = "";
    text(value: string) { 
        // don't overwrite the real children!
        assert(!this.hasRealChildren);

        this.assertNotDerived();

        if (this.root.childNodes.length === 0) {
            this.root.appendChild(document.createTextNode(value));
        } else {
            if (this.lastText !== value) {
                this.lastText = value;
                const textNode = this.root.childNodes[0];
                textNode.nodeValue = value;
            }
        }
    }

    setAttribute(attr: string, val: string | null) {
        this.assertNotDerived();
        return setAttribute(this.root, attr, val);
    }
    readonly a = this.setAttribute;

    assertNotDerived() {
        // When elementSupplier is null, this is because the root is not the 'owner' of a particular DOM element - 
        // rather, we got it from a ListRenderer somehow - setting attributes on these React.fragment type roots is always a mistake
        assert(this.elementSupplier !== null);
    }

    __onRemove(destroy: boolean) {
        this.removed = true;
        for (let i = 0; i < this.items.items.length; i++) {
            const item = this.items.items[i];
            if (item.t === ITEM_UI_ROOT) {
                item.v.__onRemove(destroy);
            } else if (item.t === ITEM_LIST) {
                item.v.__onRemove(destroy);
            }
        }

        if (destroy) {
            // Don't call this twice.
            assert(!this.destroyed);

            this.destroyed = true;
            for (const d of this.destructors) {
                try {
                    d();
                } catch (e) {
                    console.log("A destructor threw an exception: ", e);
                }
            }
        }
    }

    // NOTE: If this is being called before we've rendered any components here, it should be ok.
    // if it's being called during a render, then that is typically an incorrect usage - the domAppender's index may or may not be incorrect now, because
    // we will have removed HTML elements out from underneath it. You'll need to ensure that this isn't happening in your use case.
    __removeAllDomElements(destroy: boolean) {
        for (let i = 0; i < this.items.items.length; i++) {
            const item = this.items.items[i];
            if (item.t === ITEM_UI_ROOT) {
                item.v.domAppender.root.remove();
                item.v.__onRemove(destroy);
            } else if (item.t === ITEM_LIST) {
                // needs to be fully recursive. because even though our UI tree is like
                //
                // -list
                //   -list
                //     -list
                // 
                // They're still all rendering to the same DOM root!!!
                item.v.__removeAllDomElementsFromList(destroy);
            }
        }
    }

    addDestructor(destructor: () => void) {
        this.destructors.push(destructor);
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
        pushList(this);
    }

    /** Use this for a keyed list renderer */
    __getForKey(key: ValidKey) {
        let result = this.keys.get(key);
        if (!result) {
            result = { 
                root: new UIRoot(this.uiRoot.domAppender, null),
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
        const l = getCurrentListRendererInternal();

        // You may have forgotten to call end() on some component before this one
        assert(l === this);

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
                result = new UIRoot(this.uiRoot.domAppender, null);
                this.builders.push(result);
            }

            this.builderIdx++;
        }

        // Append new list elements to where we're currently appending
        const currentDomRootIdx = result.domAppender.idx;
        result.__begin();
        result.domAppender.idx = currentDomRootIdx;

        this.current = result;

        return result;
    }

    __end() {
        // DEV: don't decrement this more times than you increment it
        assert(this.uiRoot.openListRenderers > 0);
        this.uiRoot.openListRenderers--;

        popList();

        // remove all the UI components that may have been added by other builders in the previous render.
        for (let i = this.builderIdx; i < this.builders.length; i++) {
            this.builders[i].__removeAllDomElements(true);
        }
        this.builders.length = this.builderIdx;
        for (const [k, v] of this.keys) {
            if (!v.rendered) {
                v.root.__removeAllDomElements(true);
                this.keys.delete(k);
            }
        }
    }

    __onRemove(destroy: boolean) {
        for (let i = 0; i < this.builders.length; i++) {
            this.builders[i].__onRemove(destroy);
        }
        for (const v of this.keys.values()) {
            v.root.__onRemove(destroy);
        }
    }

    // kinda have to assume that it's valid to remove these elements.
    __removeAllDomElementsFromList(destroy: boolean) {
        for (let i = 0; i < this.builders.length; i++) {
            this.builders[i].__removeAllDomElements(destroy);
        }
        for (const v of this.keys.values()) {
            v.root.__removeAllDomElements(destroy);
        }
    }

}

export function newUiRoot<E extends ValidElement>(supplier: () => E): UIRoot<E> {
    const root = supplier();
    const result = new UIRoot<E>({ root, idx: -1, domElements: []  }, supplier);
    return result;
}

export type RenderFn<T extends ValidElement = ValidElement> = (r: UIRoot<T>) => void;
export type RenderFnArgs<A extends unknown[], T extends ValidElement = ValidElement> = (r: UIRoot<T>, ...args: A) => void;

/**
 * Allows you to render a variable number of UI roots at a particular point in your component.
 * UI Roots that aren't rendered in subsequent renders get removed from the dom when you `end()` a list.
 *
 * See {@link nextListRoot} for more info.
 * See the {@link UIRoot} docs for more info on what a 'UIRoot' even is, what it's limitations are, and how to effectively (re)-use them.
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
export function imBeginList(): ListRenderer {
    // Don't access immediate mode state when immediate mode is disabled
    assert(!imDisabled);

    const r = getCurrentRoot();

    let result: ListRenderer | undefined; 
    const items = r.items;
    const idx = ++items.idx;
    if (idx < items.items.length) {
        const box = items.items[idx];

        // The same hooks must be called in the same order every time
        assert(box.t === ITEM_LIST);

        result = box.v;
    } else {
        result = new ListRenderer(r);
        const box: ListRendererItem = { t: ITEM_LIST, v: result };
        items.items.push(box);
    }

    result.__begin();

    return result;
}

/**
 * Read {@link imBeginList}'s doc first for context and examples.
 *
 * You can optionally specify a {@link key}.
 * If no key is present, the same UIRoot that was rendered for the nth call of  nextRoot() will be re-used.
 * If a key is present, the same UIRoot that was rendered for that particular key will be re-used. Make sure
 *      to not reuse the same key twice.
 *
 * There is no virtue in always specifying a key. Only do it when actually necessary.
 *
 * See the {@link UIRoot} docs for more info on what a 'UIRoot' even is, what it's limitations are, and how to effectively (re)-use them.
 */
export function nextListRoot(key?: ValidKey) {
    if (currentRoot) {
        imEnd();
    }
    
    const l = getCurrentListRendererInternal();

    return l.root(key);
}


///////// 
// Common immediate mode UI helpers

function imStateInternal<T>(supplier: () => T, skipSupplierCheck: boolean): T {
    // Don't access immediate mode state when immediate mode is disabled
    assert(!imDisabled);

    const r = getCurrentRoot();

    let result: T;
    const items = r.items;
    const idx = ++items.idx;
    if (idx < items.items.length) {
        const box = items.items[idx];
        assert(box.t === ITEM_STATE);

        if (!skipSupplierCheck) {
            // The same hooks must be called in the same order every time.
            // If you have two hooks for state generated by the same supplier, but they were called out of order for some reason, 
            // this assertion won't catch that bug. I am assuming you won't write code like that...
            assert(supplier === box.supplier);
        }

        result = box.v as T;
    } else {
        // supplier can call getCurrentRoot() internally, and even add destructors.
        // But it shouldn't be doing immediate mode shenanigans.
        disableIm();
        result = supplier();
        enableIm();

        const box: StateItem = { t: ITEM_STATE, v: result, supplier };
        items.items.push(box);
    }

    return result;
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

export function imComponent<T>(supplier: () => T): T {
    const size = getComponentStackSize();

    const c = imStateInternal(supplier, false);

    // You've forgotten to end something inside your component, for sure.
    assert(size === getComponentStackSize());

    return c;
}

/**
 * Lets you do your suppliers inline, like `const s = imStateInline(() => ({ blah }));`.
 *
 * WARNING: using this method won't allow you to catch out-of-order im-state-rendering bugs at runtime, 
 * leading to potential data corruption. 
 *
 */
export function imStateInline<T>(supplier: () => T) : T {
    return imStateInternal(supplier, true);
}

let appRoot: UIRoot = newUiRoot(() => document.body);
const currentStack: (UIRoot | ListRenderer)[] = [];

// Only one of these is defined at a time.
let currentRoot: UIRoot | undefined;
let currentListRenderer: ListRenderer | undefined;


/**
 * Allows you to get the current root without having a reference to it.
 * Mainly for use when you don't care what the type of the root is.
 */
export function getCurrentRoot(): UIRoot {
    /** 
     * Can't call this method without opening a new UI root. Common mistakes include: 
     *  - using end() instead of endList() to end lists
     *  - calling beginList() and then rendering a component without wrapping it in nextRoot like `nextRoot(); { ...component code... } end();`
     */
    assert(currentRoot);

    return currentRoot as UIRoot;
}

// You probably don't want to use this, if you can help it
export function getCurrentListRendererInternal(): ListRenderer {
    /** Can't call this method without opening a new list renderer (see {@link imBeginList}) */
    assert(currentListRenderer)

    return currentListRenderer;
}

function pushList(l: ListRenderer) {
    currentStack.push(l);
    currentRoot = undefined;
    currentListRenderer = l;
}

/**
 * Use this with {@link popRoot} to create higher level abstractions.
 *
 * ``` ts
 *
 *
 * function beginHigherLevelThing() {
 *     let userRenderPoint: UIRoot;
 *
 *     beginLayout(); {
 *          ...
 *          userRenderPoint = userRowbeginLayout(); {
 *              
 *          } popRoot(); // Rather than calling end(), we're calling popRoot().
 *          ...
 *     } end();
 *     
 *     pushRoot(userRenderPoint);
 *     // the user may render whatever they want, and then call end() here. 
 *     // 
 * }
 *
 * If you want multiple mount points, you could push multiple things that they have to end() here, but 
 * this should ideally be documented in the method name, like 
 *
 * ```
 * beginHeaderAndSectionAndContent(); {
 *      // header
 * } end(); {
 *      // section
 * } end(); {
 *      // content
 * }
 * ```
 *
 * ```
 *
 */
export function pushRoot(r: UIRoot) {
    currentStack.push(r);
    currentRoot = r;
    currentListRenderer = undefined;
}


/**
 * see {@link pushRoot} for more info
 */
export function popRoot() {
    getCurrentRoot();
    pop();
}

function popList() {
    getCurrentListRendererInternal();
    pop();
}

function pop() {
    currentStack.pop();
    if (currentStack.length === 0) {
        currentRoot = undefined;
        currentListRenderer = undefined;
    } else {
        const val = currentStack[currentStack.length - 1];
        if (val instanceof ListRenderer) {
            currentListRenderer = val;
            currentRoot = undefined;
        } else {
            currentListRenderer = undefined;
            currentRoot = val;
        }
    }
}


export function startRendering(r: UIRoot = appRoot) {
    currentStack.length = 0;
    currentMemoizerStack.length = 0;
    enableIm();
    r.__begin();
}

export function imBeginEl<E extends ValidElement = ValidElement>(elementSupplier: () => E): UIRoot<E> {
    // Don't access immediate mode state when immediate mode is disabled
    assert(!imDisabled);

    const r = getCurrentRoot();

    let result: UIChildRootItem<E> | undefined;
    let items = r.items;
    const idx = ++items.idx;
    if (idx < items.items.length) {
        result = items.items[idx] as UIChildRootItem<E>;

        // The same hooks must be called in the same order every time.
        assert(result.t === ITEM_UI_ROOT);
        // string comparisons end up being quite expensive, so we're storing
        // a reference to the function that created the dom element and comparing those instead.
        assert(result.v.elementSupplier === elementSupplier);
    } else {
        const uiRoot = newUiRoot(elementSupplier);
        result = { t: ITEM_UI_ROOT, v: uiRoot };
        items.items.push(result);
    }

    r.hasRealChildren = true;
    appendToDomRoot(r.domAppender, result.v.domAppender.root);

    result.v.__begin();

    return result.v as UIRoot<E>;
} 

// This is now called `imEnd`, because it is better to not squat on the variable name "end"
export function imEnd(detatchElements = true) {
    const val = getCurrentRoot();
    val.__end(detatchElements);
}

export function imEndList(isConditional=false, detatchElements = true) {
    if (currentRoot) {
        imEnd(detatchElements);
    }

    const l = getCurrentListRendererInternal();
    l.__end();

    const r = getCurrentRoot();

    if (!isConditional) {
        // by default, open an if-statement for an `else` if we rendered zero items.
        r.ifStatementOpen = l.current === null;
    }
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

export function imBeginDiv(): UIRoot<HTMLDivElement> {
    return imBeginEl<HTMLDivElement>(newDiv);
}

export function setInnerText(str: string) {
    const r = getCurrentRoot();
    r.text(str);
}

export function imBeginSpan(): UIRoot<HTMLSpanElement> {
    return imBeginEl<HTMLSpanElement>(newSpan);
}


export function abortListAndRewindUiStack(l: ListRenderer) {
    // need to wind the stack back to the current list component
    const idx = currentStack.lastIndexOf(l);
    assert(idx !== -1);
    currentStack.length = idx + 1;
    currentRoot = undefined;
    currentListRenderer = l;

    const r = l.current;
    if (r) {
        r.__removeAllDomElements(false);

        // need to reset the dom root, since we've just removed elements underneath it
        resetDomAppender(r.domAppender);
    }
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

/**
 * For when imRef isn't quite right
 * ```ts
 * const canvas = el(newCanvas); {
 *      let ctx = imVal<CanvasRenderingContext2D>();
 *      if (!ctx) {
 *          ctx = imSetVal(canvas.getContext("2d"));
 *      }
 *
 *      // ctx is defined
 * } end();
 * ```
 *
 * Also, imSetVal can be called inside of a beginMemo() and endMemo() block. 
 */
export function imVal<T>(initialValue: T) {
    const ref = imRef<T>();
    if (ref.val === null) {
        ref.val = initialValue;
    }

    return ref.val;
}
export function imSetVal<T>(t: T): T {
    const root = getCurrentRoot();

    let prevDisabled = imDisabled;
    imDisabled = false;
    let val = imGetCurrent(root.items);
    imDisabled = prevDisabled;

    assert(val?.t === ITEM_STATE);
    assert(val.supplier === newRef);
    (val.v as Ref<T>).val = t;
    return t;
}


let imDisabled = false; 
export function disableIm() {
    imDisabled = true;
}

export function enableIm() {
    imDisabled = false;
}

class Memoizer {
    im: boolean;
    items = newImArray<unknown>();
    __changed = false;
    __invoked = true;

    resumePoint: RerenderPoint = { 
        domAppenderIdx: -1,
        itemsIdx: -1,
    };

    constructor(im: boolean) {
        this.im = im;
    }

    begin() {
        /**
         * You should be querying changed() on this memoizer. Otherwise, there is a high change that you're
         * using it wrong:
         * ```ts
         * if (imMemo().val(v)) { ... } // always true no matter what
         * ```
         * ```ts
         * if (imMemo().val(v).changed()) { ... } // finally, some correct usage
         * ```
         */
        assert(this.__invoked);


        imReset(this.items);
        this.__changed = false
        this.__invoked = false;
    }

    objectVals(obj: Record<string, unknown>) {
        for (const k in obj) {
            this.val(obj[k]);
        }
        return this;
    }

    val(val: unknown) {
        const items = this.items;
        const idx = ++items.idx;
        if (idx < items.items.length) {
            const existing = items.items[idx]
            if (existing !== val) {
                this.__changed = true;
                items.items[idx] = val;
            }
        } else {
            items.items.push(val);
            this.__changed = true;
        }

        return this;
    }

    changed(): boolean {
        this.__invoked = true;

        // immediate mode state must be rendered unconditionally
        if (this.im) {
            imBeginList();
            nextListRoot();
        } else {
            disableIm();
        }

        return this.__changed;
    }
}


let currentMemo: Memoizer | undefined;
let currentMemoizerStack: Memoizer[] = [];

export function getCurrentMemoizer(): Memoizer {
    // You probably didn't call beginMemo().changed() yet, or you forgot to close out one of the other things
    assert(currentMemo);

    return currentMemo;
}


/**
 * Use memoizers to gate expensive computations.
 * This memoizer will also disable immedate mode, unlike
 * {@link imBeginMemo}, so that you don't accidentally 
 * include immediate mode components in there (but sometimes 
 *  you do want those !)
 *
 * // TODO: consider just removing this, now that 
 * // beginMemo and endMemo actually work with immediate mode components.
 *
 * ```ts
 * if (beginMemo()
 *      .val(top).val(left).val(bottom).val(right)
 *      .objectVals(state)
 *      .changed()
 *  ) {
 *      ... // do your code.
 *  } endMemo();
 *
 * ```
 *
 * , and force you to re-enable it with endMemo() at the end.
 * This is because memoized logic tends to grow quite long, and becomes prone to conditional 
 * and out-of-order imState bugs. 
 */
export function imBeginMemoComputation() {
    return beginMemoInternal(newMemoizerNormal);
}

function beginMemoInternal(supplier: () => Memoizer) {
    const val = imState(supplier);
    val.begin();

    currentMemoizerStack.push(val);
    currentMemo = val;

    return val;
}

function newMemoizerNormal() {
    return new Memoizer(false);
}

/**
 * Similar to {@link imBeginMemoComputation}, but allows immediate mode state.
 * Useful to avoid rendering a large number of components over and over again. 
 *
 * Do note that things inside are no longer updating at 60 fps, so only use if absolutely 
 * necessary.
 *
 * ```ts
 * if (beginMemoIm().val(bigData).changed()) {   
 *      // render the data.
 *  } endMemo();
 * ```
 */
export function imBeginMemo() {
    return beginMemoInternal(newMemoizerImmediateMode);
}

function newMemoizerImmediateMode() {
    return new Memoizer(true);
}

function saveRenderPoint(dst: RerenderPoint, src: UIRoot) {
    const domIdx = src.domAppender.idx;
    const idx = src.items.idx;
    dst.itemsIdx = idx;
    dst.domAppenderIdx = domIdx;
}

function loadRenderPoint(src: RerenderPoint, dst: UIRoot) {
    const domIdx = src.domAppenderIdx;
    const idx = src.itemsIdx;
    dst.items.idx = idx;
    dst.domAppender.idx = domIdx;
}

export function endMemo() {
    const val = getCurrentMemoizer();

    if (val.im) {
        const root = getCurrentRoot();

        if (val.__changed) {
            // we would have actually rendered something this time.
            // because of list renderers, the dom index may be different every time, so we have to save it every time
            saveRenderPoint(val.resumePoint, root);
        } else if (root.items.idx === -1) {
            // we rendered nothing. we'll need to fix the indices in the dom appender, and the immediate mode state array
            loadRenderPoint(val.resumePoint, root);
        }

        imEnd(false);
        imEndList(false, false);
    } else {
        enableIm();
    }

    currentMemoizerStack.pop();

    // Supposedly, it is faster in JavaScript to never index past the bounds of an array, funnily enough.
    if (currentMemoizerStack.length === 0) {
        currentMemo = undefined;
    } else {
        currentMemo = currentMemoizerStack[currentMemoizerStack.length - 1];
    }
}


/**
 * Seems like simply doing r.root.onwhatever = () => { blah } destroys performance,
 * so this  method exists now...
 *
 * NOTE: the arguments must never change. Rather than writing code to handle dynamic arguments
 * I will just force you to make it constant. This will simplify both of our code.
 * There is no assert to catch this mistake though, because string comparison asserts tend to be very slow, I've found
 */
export function imOn<K extends keyof HTMLElementEventMap>(type: K): HTMLElementEventMap[K] | null {
    const eventRef = imRef<HTMLElementEventMap[K]>();

    if (imInit()) {
        const r = getCurrentRoot();

        const handler = (e: HTMLElementEventMap[K]) => {
            eventRef.val = e;
            doRender();
        }
        r.root.addEventListener(
            type, 
            // @ts-expect-error this thing is fine, actually.
            handler
        );

        r.addDestructor(() => {
            r.root.removeEventListener(
                type,
                // @ts-expect-error this thing is fine, actually.
                handler
            );
        });
    }

    const ev = eventRef.val;
    eventRef.val = null;

    return ev;
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

/**
 * Returns true the first time it's called for a particular UIRoot, and false every other time.
 */
export function imInit(): boolean {
    const val = imRef<boolean>();
    if (!val.val) {
        val.val = true;

        return true;
    }


    return false;
}

/**
 * ```ts
 * function Component() {
 *      div(); {
 *          // can optionally put it behind 'init' if you don't want to allocate objects every render.
 *          init() && setAttributes({ 
 *              class: [cn.row, cn.alignItemsCenter, cn.justifyContentCenter],
 *              anythingReally: "some value"
 *          });
 *      } end();
 * }
 * ```
 * @deprecated
 */
export function setAttributes(attrs: Attrs, r = getCurrentRoot()) {
    // When elementSupplier is null, this is because the root is not the 'owner' of a particular DOM element - 
    // rather, we got it from a ListRenderer somehow - setting attributes on these roots is usually a mistake
    assert(r.elementSupplier !== null);

    setAttributesInternal(r.root, attrs);
}

export function addClasses(classes: string[]) {
    const r = getCurrentRoot();
    for (let i = 0; i < classes.length; i++) {
        r.c(classes[i]);
    }
}

export function setAttr<T extends keyof Attrs>(k: T, v: string | null) {
    const r = getCurrentRoot();
    r.setAttribute(k, v);
}

export function setStyle<K extends (keyof ValidElement["style"])>(key: K, value: string) {
    const r = getCurrentRoot();
    r.setStyle(key, value);
}

export function setClass(val: string, enabled: boolean | number = true) {
    // NOTE: the effect of this method will persist accross renders
    const r = getCurrentRoot();
    r.setClass(val, enabled);
}

///////// 
// Realtime proper immediate-mode events API, with events.
//
// I wasn't able to find a good clean solution to the problem
// of adding and removing events locally, so I'm attempting to
// go down a second road of rerendering the entire app at 60fps.
//
// It would be interesting to see how far this approach scales.

export type KeyPressEvent = {
    key: string;
    code: string;
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
};

const MAX_VALID_DELTATIME_SECONDS = 0.500;
let dtSeconds = 0;
let lastTime = 0;

export function deltaTimeSeconds(): number {
    return dtSeconds;
}

let doRender = () => {};

export function initializeDomRootAnimiationLoop(renderFn: () => void, renderRoot?: UIRoot) {
    doRender = () => {
        startRendering(renderRoot);
        renderFn();

        // If this throws, then you've forgotten to pop some elements off the stack.
        // inspect currentStack in the debugger for more info
        assert(currentStack.length === 1);
    }

    const animation = (t: number) => {
        dtSeconds = (t - lastTime) / 1000;
        lastTime = t;

        if (dtSeconds < MAX_VALID_DELTATIME_SECONDS) {
            doRender();
        }

        requestAnimationFrame(animation);
    };
    
    requestAnimationFrame(animation);
}

// NOTE: might be obsolete. or better on the user side.
const keys = {
    shiftsDown: 0,
    ctrlsDown: 0,
    escPressed: false,
}

export type MouseState = {
    lastX: number;
    lastY: number;

    leftMouseButton: boolean;
    middleMouseButton: boolean;
    rightMouseButton: boolean;

    dX: number;
    dY: number;
    X: number;
    Y: number;

    /**
     * NOTE: if you want to use this, you'll have to prevent scroll event propagation.
     * See {@link imPreventScrollEventPropagation}
     */
    scrollY: number;

    clickedElement: object | null;
    lastClickedElement: object | null;
    hoverElement: object | null;
};

const mouse: MouseState = {
    lastX: 0,
    lastY: 0,

    leftMouseButton: false,
    middleMouseButton: false,
    rightMouseButton: false,

    dX: 0,
    dY: 0,
    X: 0,
    Y: 0,

    /**
     * NOTE: if you want to use this, you'll have to prevent scroll event propagation.
     * See {@link imPreventScrollEventPropagation}
     */
    scrollY: 0,

    clickedElement: null,
    lastClickedElement: null,
    hoverElement: null,
};



export function getMouse() {
    return mouse;
}

export function getKeys() {
    return keys;
}


// I cant fking believe this shit works, lol
export function elementWasClicked() {
    const mouse = getMouse();
    const r = getCurrentRoot();
    if (r.root === mouse.clickedElement) {
        return mouse.leftMouseButton;
    }
    return  false;
}

export function elementWasLastClicked() {
    const r = getCurrentRoot();
    return r.root === mouse.lastClickedElement;
}

export function elementWasHovered() {
    const r = getCurrentRoot();
    return r.root === mouse.hoverElement;
}

export function getHoveredElement() {
    return mouse.hoverElement;
}

export function deferClickEventToParent() {
    const r = getCurrentRoot();
    const el = r.root;
    const parent = el.parentNode;

    if (mouse.clickedElement === el) {
        mouse.clickedElement = parent;
    }
    if (mouse.lastClickedElement === el) {
        mouse.lastClickedElement = parent;
    }
    if (mouse.hoverElement === el) {
        mouse.hoverElement = parent;
    }
}

function setClickedElement(el: object | null) {
    mouse.clickedElement = el;
    mouse.lastClickedElement = el;
}

export function initializeImEvents() {
    document.addEventListener("mousedown", (e) => {
        setClickedElement(e.target);

        if (e.button === 0) {
            mouse.leftMouseButton = true;
        } else if (e.button === 1) {
            mouse.middleMouseButton = true;
        } else if (e.button === 2) {
            mouse.rightMouseButton = true;
        }
    });
    document.addEventListener("mousemove", (e) => {
        mouse.lastX = mouse.X;
        mouse.lastY = mouse.Y;
        mouse.X = e.pageX;
        mouse.Y = e.pageY;
        mouse.dX = mouse.X - mouse.lastX;
        mouse.dY = mouse.Y - mouse.lastY;
        mouse.hoverElement = e.target;

    });
    document.addEventListener("mouseenter", (e) => {
        mouse.hoverElement = e.target;
    });
    document.addEventListener("mouseup", (e) => {
        if (e.button === 0) {
            mouse.leftMouseButton = false;
        } else if (e.button === 1) {
            mouse.middleMouseButton = false;
        } else if (e.button === 2) {
            mouse.rightMouseButton = false;
        }
    });
    document.addEventListener("wheel", (e) => {
        mouse.scrollY += e.deltaY;
        mouse.hoverElement = e.target;
        e.preventDefault();
    });
    document.addEventListener("keydown", (e) => {
        if (e.repeat) {
            return;
        }

        if (e.key === "Shift") {
            keys.shiftsDown++;
        }
        if (e.key === "Control") {
            keys.ctrlsDown++;
        }

        if (e.key === "Escape") {
            keys.escPressed = true;
        }
    });
    document.addEventListener("keyup", (e) => {
        if (e.key === "Shift" && keys.shiftsDown > 0) {
            keys.shiftsDown--;
        }
        if (e.key === "Control" && keys.ctrlsDown > 0) {
            keys.ctrlsDown--;
        }
    });
    document.addEventListener("blur", (e) => {
        mouse.leftMouseButton = false;
        mouse.middleMouseButton = false;
        mouse.rightMouseButton = false;
        mouse.lastClickedElement = null;
        mouse.clickedElement = null;
        mouse.scrollY = 0;
        keys.shiftsDown = 0;
        keys.ctrlsDown = 0;
    });
}

export function isShiftPressed() {
    return keys.shiftsDown > 0;
}

export function isCtrlPressed() {
    return keys.ctrlsDown > 0;
}


function newPreventScrollEventPropagationState() {
    return { isBlocking: true };
}

export function imPreventScrollEventPropagation() {
    const state = imState(newPreventScrollEventPropagationState);

    if (imInit()) {
        const r = getCurrentRoot();
        r.root.addEventListener("wheel", e => {
            if (state.isBlocking) {
                e.preventDefault();
            }
        });
    }

    return state;
}

export function beginFrame() {
    // No-op, more for consistency and code aesthetics.
}

export function endFrame() {
    mouse.clickedElement = null;
    mouse.lastX = mouse.X;
    mouse.lastY = mouse.Y;
    mouse.dX = 0;
    mouse.dY = 0;
    mouse.scrollY = 0;

    keys.escPressed = false;
}

class ImmediateModeStringBuilder {
    sb: string[] = [];
    changed = false;
    cached: string = "";
    
    s(str: string) {
        this.sb.push(str);
    }

    toString() {
        if (this.changed) {
            this.changed = false;
            this.cached = this.sb.join("");
        }
        return this.cached;
    }

    clear() {
        this.changed = true;
        this.sb.length = 0;
    }
};

function newImmmediateModeStringBuilder() {
    return new ImmediateModeStringBuilder();
}

export function imSb() {
    return imState(newImmmediateModeStringBuilder);
}

let numResizeObservers = 0;

export type SizeState = {
    width: number;
    height: number;
}

function newImGetSizeState(): {
    rect: SizeState;
    observer: ResizeObserver;
    resized: boolean;
} {
    const r = getCurrentRoot();

    const self = {
        rect: { width: 0, height: 0, },
        resized: false,
        observer: new ResizeObserver((entries) => {
            for (const entry of entries) {
                // NOTE: resize-observer cannot track the top, right, left, bottom of a rect. Sad.
                
                self.rect.width = entry.contentRect.width;
                self.rect.height = entry.contentRect.height;
                break;
            }

            doRender();
        })
    };

    self.observer.observe(r.root);
    numResizeObservers++;
    console.log(numResizeObservers);
    r.addDestructor(() => {
        numResizeObservers--;
        self.observer.disconnect()
        console.log(numResizeObservers);
    });

    return self;
}

export function imTrackSize() {
    return imState(newImGetSizeState);
}
