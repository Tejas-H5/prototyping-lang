// *IM* DOM-utils v0.1.0011 - @Tejas-H5
// A variation on DOM-utils with the immediate-mode API isntead of the normal one. I'm still deciding which one I will continue to use.
// Right now, this one seems better, but the other one has a 'proven' track record of actually working.
// But in a matter of hours/days, I was able to implement features in this framework that I wasn't able to for months/years in the other one...
//
// Conventions:
// - All immediate mode methods should start with 'im', like imIf, imList, imDiv, imLayout, etc. etc.
//      I found imBegin() to be too verbose, as things like imBeginList and imBeginIf were being typed A LOT.
//      If we don't need to use Begin for methods that open a scope, then there needs to be some other way to delineate this.
//      Or does there?
//
// - If this method opens up a scope that must be ended in a specific way, this must be stated in the documentation, 
//      either with words, or via an example. 
//      Ideally, if the opening method was imComponent, and we can't just end it with {@link imEnd},
//      there should be a closing method called imEndComponent.

import { hotAssert } from "./assert";

///////
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


// Flags are kinda based. vastly reduces the need for boolean flags, and API is also nicer looking.
export const HORIZONTAL = 1 << 1;
export const VERTICAL = 1 << 2;
export const START = 1 << 3;
export const END = 1 << 4;

/**
 * Scrolls {@link scrollParent} to bring scrollTo into view.
 * {@link scrollToRelativeOffset} specifies where to to scroll to. 0 = bring it to the top of the scroll container, 1 = bring it to the bottom
 */
export function scrollIntoViewVH(
    scrollParent: HTMLElement,
    scrollTo: HTMLElement,
    verticalOffset: number | null = null,
    horizontalOffset: number | null = null,
) {
    if (horizontalOffset !== null) {
        const scrollOffset = horizontalOffset * scrollParent.offsetWidth;
        const elementWidthOffset = horizontalOffset * scrollTo.getBoundingClientRect().width;

        // offsetLeft is relative to the document, not the scroll parent. lmao
        const scrollToElOffsetLeft = scrollTo.offsetLeft - scrollParent.offsetLeft;

        scrollParent.scrollLeft = scrollToElOffsetLeft - scrollOffset + elementWidthOffset;
    }

    if (verticalOffset !== null) {
        // NOTE: just a copy pate from above
        
        const scrollOffset = verticalOffset * scrollParent.offsetHeight;
        const elementHeightOffset = verticalOffset * scrollTo.getBoundingClientRect().height;

        // offsetTop is relative to the document, not the scroll parent. lmao
        const scrollToElOffsetTop = scrollTo.offsetTop - scrollParent.offsetTop;

        scrollParent.scrollTop = scrollToElOffsetTop - scrollOffset + elementHeightOffset;
    }
}

export function scrollIntoViewRect(
    scrollParent: HTMLElement,
    scrollTo: HTMLElement,
    x0: number, y0: number, 
    x1: number, y1: number
) {
    let scrollH: number | null = null;
    let scrollV: number | null = null;

    if (getElementExtentNormalized(scrollParent, scrollTo, VERTICAL | START) < y0) {
        scrollV = y0;
    } else if (getElementExtentNormalized(scrollParent, scrollTo, VERTICAL | END) > y1) {
        scrollV = y1
    }

    if (getElementExtentNormalized(scrollParent, scrollTo, HORIZONTAL | START) < x0) {
        scrollH = x0;
    } else if (getElementExtentNormalized(scrollParent, scrollTo, HORIZONTAL | END) > x1) {
        scrollH = x1;
    }

    scrollIntoViewVH(scrollParent, scrollTo, scrollV, scrollH);
}

export function getElementExtentNormalized(
    scrollParent: HTMLElement,
    scrollTo: HTMLElement,
    flags = VERTICAL | START
) {
    if (flags & VERTICAL) {
        const scrollOffset = scrollTo.offsetTop - scrollParent.scrollTop - scrollParent.offsetTop;

        if (flags & END) {
            return (scrollOffset + scrollTo.getBoundingClientRect().height) / scrollParent.offsetHeight;
        } else {
            return scrollOffset / scrollParent.offsetHeight;
        }
    } else {
        // NOTE: This is just a copy-paste from above. 
        // I would paste a vim-macro here, but it causes all sorts of linting errors.

        const scrollOffset = scrollTo.offsetLeft - scrollParent.scrollLeft - scrollParent.offsetLeft;

        if (flags & END) {
            return (scrollOffset + scrollTo.getBoundingClientRect().width) / scrollParent.offsetWidth;
        } else {
            return scrollOffset / scrollParent.offsetWidth;
        }
    }
}

///////// 
// The immediate-mode rendering API.
// You might think I made this for performance, but I didn't. 
// What I really wanted, was a UI framework that lets me colocate logic and UI, and composes correctly
// i.e There is never a scenario where I _have_ to create a function or a class to get some sort of 
// component-like behavior, and I can put 'state' as close to some UI as needed, so that we can
// evolve better abstractions.

const currentStack: (UIRoot | ListRenderer)[] = [];
let itemsRendered = 0;
let itemsRenderedLastFrame = 0;

// Only one of these is defined at a time.
let currentRoot: UIRoot | undefined;
let currentListRenderer: ListRenderer | undefined;

let imDisabled = false; 

const ITEM_LIST_RENDERER = 2;
const ITEM_UI_ROOT = 1;
const ITEM_STATE = 3;

let appRoot: UIRoot = newUiRoot(() => document.body);

export type ValidElement = HTMLElement | SVGElement;
export type StyleObject<U extends ValidElement> = (U extends HTMLElement ? keyof HTMLElement["style"] : keyof SVGElement["style"]);

export type StateItem  = {
    t: typeof ITEM_STATE;
    v: unknown;
    supplier: () => unknown;
};

export type UIRootItem = UIRoot | ListRenderer | StateItem;

export type DomAppender<E extends ValidElement = ValidElement> = {
    root: E;
    idx: number;
};

export function resetDomAppender(domAppender: DomAppender, idx = -1) {
    domAppender.idx = idx;
}

export function appendToDomRoot(domAppender: DomAppender, child: ValidElement) {
    const i = ++domAppender.idx;

    const root = domAppender.root;
    const children = root.children;

    if (i === children.length) {
        root.appendChild(child);
    } else if (children[i] !== child) {
        root.insertBefore(child, children[i]);
    }
}

export type RenderPoint =  {
    domAppenderIdx: number;
    itemsIdx: number;
}

function newRenderPoint(): RenderPoint {
    return {
        domAppenderIdx: -1,
        itemsIdx: -1
    };
}

export function imRenderPoint() {
    const s = imState(newRenderPoint);
    return s;
}

export function getRenderPoint(p: RenderPoint) {
    const root = getCurrentRoot();
    p.itemsIdx = root.itemsIdx;
    p.domAppenderIdx = root.domAppender.idx;
}

export function setRenderPoint(p: RenderPoint) {
    const root = getCurrentRoot();
    startRendering(root, p.domAppenderIdx, p.itemsIdx);
}

/**
 * Whenever your app starts rendering, a {@link UIRoot} backed by the DOM root is pushed onto {@link currentStack}.
 * {@link imEl} will create a {@link UIRoot} backed by a custom DOM node, and push it onto {@link currentStack}.
 * {@link imEnd} will pop a {@link UIRoot} from {@link currentStack}.
 * {@link getCurrentRoot} can be used to get the current UIRoot.
 *
 * ```ts
 * function imApp() {
 *     r = getCurrentRoot()  // assertion failed - no current root
 *     imDiv(); {
 *          r = getCurrentRoot() // div that we rendered above
 *     } imEnd();
 *     r = getCurrentRoot()  // assertion failed - no current root
 * }
 * ```
 *
 * In the first render, any number of things can be rendered. 
 * To be more specific, a 'thing' is an immediate mode state entry. 
 * Only 3 methods can create im-state entries - {@link imEl}, {@link imState}, and {@link imList}.
 * In every subsequent render, the same number of im-state entries must be 'created' in the same order.
 * This is because in subsequent renders, calls to the im-state functions don't recreate state, but 
 * increment an array index, and retrieve the state they created in the first render.
 * 
 * For example:
 *
 * ```ts
 * // Valid
 * function imApp() {
 *     imDiv(); imEnd();
 * }
 *
 * // Not valid
 * let n = 0;
 * function imApp() {
 *      n++;
 *      for (let i = 0; i < n; i++) {
 *          // As soon as n is incremented, the app will (ideally) throw an Error, complaining about a different number of 
 *          // things being rendered. // TODO: fix the current code, which doesn't care if the number of things keeps growing, and only complains when it shrinks
 *          imDiv(); imEnd{}; 
 *      }
 * }
 *
 * // Also not valid
 * let n = 0;
 * function imApp() {
 *      n++
 *      if (n < 10) {
 *          Component1();
 *      } else {
 *          // This is especially bad, because every im-state call in Component2 will retrieve state that was
 *          // created by Component1, and none of it will line up at all. You will corrupt your data, basically.
 *          // I haven't been able to think of any good safeguards against this.
 *          Component2();   
 *      }
 * }
 *
 * ```
 *
 * Then how the heck do we do conditional rendering, or list rendering, AKA anything actually useful?
 * You'll need to take a look at:
 * list rendering:
 *      {@link imList}.
 * conditional rendering helpers (they are just variants on `imList`):
 *      {@link imIf}
 *      {@link imElseIf}
 *      {@link imElse}
 * control flow helpers (they are also just variants on `imList`):
 *      {@link imTry}
 *      {@link imCatch}
 *      {@link imSwitch}
 *
 */
export type UIRoot<E extends ValidElement = ValidElement> = {
    readonly t: typeof ITEM_UI_ROOT;

    readonly root: E;
    readonly domAppender: DomAppender<E>;
    // If there was no supplier, then this root is attached to the same DOM element as another UI root that does have a supplier.
    readonly elementSupplier: (() => ValidElement) | null;

    readonly destructors: (() => void)[];

    readonly items: UIRootItem[];

    itemsIdx: number;

    hasRealChildren: boolean;   // can we add text to this element ?
    destroyed: boolean;         // have we destroyed this element ?

    lastText: string;
};

export function newUiRoot<E extends ValidElement>(supplier: (() => E) | null, domAppender: DomAppender<E> | null = null): UIRoot<E> {
    let root: E | undefined;
    if (domAppender === null) {
        hotAssert(supplier !== null);
        root = supplier();
        domAppender = { root, idx: -1  };
    } else {
        hotAssert(domAppender !== null);
        root = domAppender.root;
    }

    return {
        t: ITEM_UI_ROOT,
        root,
        domAppender,
        // If there was no supplier, then this root is attached to the same DOM element as another UI root that does have a supplier.
        elementSupplier: supplier, 
        destructors: [],
        items: [],
        itemsIdx: -1,
        hasRealChildren: false,
        destroyed: false,

        lastText: "",
    }
}


function __beginUiRoot(r: UIRoot, startDomIdx: number, startItemIdx: number) {
    resetDomAppender(r.domAppender, startDomIdx);
    r.itemsIdx = startItemIdx;
    pushRoot(r);

    // NOTE: avoid any more asertions here - the component may error out, and
    // __end may not get called. No I'm not going to catch it with an exception stfu. We livin on the edge, bois.
}

function isDerived(r: UIRoot) {
    return r.elementSupplier === null;
}

function assertNotDerived(r: UIRoot) {
    // When elementSupplier is null, this is because the root is not the 'owner' of a particular DOM element - 
    // rather, we got it from a ListRenderer somehow - setting attributes on these React.fragment type roots is always a mistake
    hotAssert(isDerived(r) === false);
}


export function setClass(val: string, enabled: boolean | number = true) {
    const r = getCurrentRoot();

    // NOTE: memoization should be done on your end, not mine

    if (enabled) {
        r.root.classList.add(val);
    } else {
        r.root.classList.remove(val);
    }

    return !!enabled;
}

export function setInnerText(text: string, r = getCurrentRoot()) {
    // don't overwrite the real children!
    hotAssert(r.hasRealChildren === false);

    assertNotDerived(r);

    if (r.lastText !== text) {
        r.lastText = text;

        if (r.root.childNodes.length === 0) {
            r.root.appendChild(document.createTextNode(text));
        } else {
            const textNode = r.root.childNodes[0];
            textNode.nodeValue = text;
        }
    }
}

export function setAttrElement(e: ValidElement, attr: string, val: string | null) {
    if (val !== null) {
        e.setAttribute(attr, val);
    } else {
        e.removeAttribute(attr);
    }
}

export function setAttr(k: string, v: string, r = getCurrentRoot()) {
    return setAttrElement(r.root, k, v);
}

export function __onRemoveUiRoot(r: UIRoot, destroy: boolean) {
    for (let i = 0; i < r.items.length; i++) {
        const item = r.items[i];
        if (item.t === ITEM_UI_ROOT) {
            __onRemoveUiRoot(item, destroy);
        } else if (item.t === ITEM_LIST_RENDERER) {
            const l = item;
            for (let i = 0; i < l.builders.length; i++) {
                __onRemoveUiRoot(l.builders[i], destroy);
            }
            if (l.keys) {
                for (const v of l.keys.values()) {
                    __onRemoveUiRoot(v.root, destroy);
                }
            }
        }
    }

    if (destroy) {
        // Don't call r twice.
        hotAssert(r.destroyed === false);
        r.destroyed = true;

        for (const d of r.destructors) {
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
export function __removeAllDomElementsFromUiRoot(r: UIRoot, destroy: boolean) {
    for (let i = 0; i < r.items.length; i++) {
        const item = r.items[i];
        if (item.t === ITEM_UI_ROOT) {
            item.domAppender.root.remove();
            __onRemoveUiRoot(item, destroy);
        } else if (item.t === ITEM_LIST_RENDERER) {
            // needs to be fully recursive. because even though our UI tree is like
            //
            // -list
            //   -list
            //     -list
            // 
            // They're still all rendering to the same DOM root!!!
            
            const l = item;
            for (let i = 0; i < l.builders.length; i++) {
                __removeAllDomElementsFromUiRoot(l.builders[i], destroy);
            }
            if (l.keys) {
                for (const v of l.keys.values()) {
                    __removeAllDomElementsFromUiRoot(v.root, destroy);
                }
            }
        }
    }
}

export function addDestructor(r: UIRoot, destructor: () => void) {
    r.destructors.push(destructor);
}


// TODO: keyed list renderer. It will be super useful, for type narrowing with switch statements.

type ValidKey = string | number | Function | object;

export type ListRenderer = {
    readonly t: typeof ITEM_LIST_RENDERER;
    readonly uiRoot: UIRoot;

    readonly builders: UIRoot[];
    keys: Map<ValidKey, { root: UIRoot, rendered: boolean }> | undefined;

    builderIdx: number;
    current: UIRoot | null;
}

function __beginListRenderer(l: ListRenderer) {
    l.builderIdx = 0;
    if (l.keys) {
        for (const v of l.keys.values()) {
            v.rendered = false;
        }
    }
    l.current = null;
    pushList(l);
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
 * imEnd();
 * ```
 */
export function imList(): ListRenderer {
    // Don't access immediate mode state when immediate mode is disabled
    hotAssert(imDisabled === false);

    const r = getCurrentRoot();

    let result: ListRenderer | undefined; 
    const items = r.items;
    const idx = ++r.itemsIdx;
    if (idx < items.length) {
        const val = items[idx];

        // The same hooks must be called in the same order every time
        hotAssert(val.t === ITEM_LIST_RENDERER);

        result = val;
    } else {
        result = newListRenderer(r);
        items.push(result);
    }

    __beginListRenderer(result);

    return result;
}

/**
 * Helpers to make conditional rendering with the list easier to type and read.
 *
 * ```ts
 *  if (imIf() && cond1) {
 *      imComponent1();
 *  } else if (imElseIf() && cond2) {
 *      imComponent2();
 *  } else {
 *      imElse()
 *      imComponent3();
 *  } imEndIf();
 * ```
 *
 * Everythig this method does can also be done using {@link imList}, {@link imEndList} and {@link nextListRoot},
 * but you have to type more, and I feel that code doesn't evolve correctly with 
 * that approach. For example, the following code is valid:
 *
 * ```ts
 *  imList();
 *  if (nextSlot() && cond0) {
 *      imComponent0();
 *  }   
 *  // We don't need an imEndList() and imBeginList() here, so we won't add it.
 *  // However, this has the consequence that the if-statement above is always grouped with
 *  // the one below, sometimes unnecessarily, making it harder to spot potential refactorings.
 *  if (nextSlot() && cond1) {
 *      imComponent1();
 *  } else if (nextSlot() && cond2) {
 *      imComponent2();
 *  } else {
 *      nextSlot();
 *      imComponent3();
 *  }
 *  imEndList();
 * ```
 */
export function imIf() {
    imList();
    nextListRoot();
    return true;
}

/**
 * Improves readability of imList being used for a switch.
 * ```ts
 * imSwitch(key);
 * switch(key) {
 *     case 1: imComponent1(); break;
 *     case 2: imComponent2(); break;
 * }
 * imEndSwitch();
 * ```
 */
export function imSwitch(key: ValidKey) {
    imList();
    nextListRoot(key);
}

/** See {@link imSwitch} */
export function imEndSwitch() {
    imEndList();
}

/** See {@link imIf} */
export function imElseIf() {
    nextListRoot();
    return true;
}

/** See {@link imIf} */
export function imElse() {
    nextListRoot();
    return true;
}

/** See {@link imIf} */
export function imEndIf() {
    imEndList();
}

/**
 * Helpers for implementing try-catch.
 * You can also do this with {@link imList}/{@link imEndList} and {@link nextListRoot},
 * but you need to know what you're doing, and it is annoying to remember.
 *
 * ```ts
 * const errorRef = imRef<any>();
 *
 * const l = imTry();
 * try {
 *      if (imIf() && !errorRef.val) {
 *          imComponent1();
 *      } else {
 *          imElse()
 *          imErrorStateComponent();
 *      }
 * } catch (e) {
 *      // unmounts imComponent1 immediately, rewinds the stack back to this list.
 *      imCatch(l);     
 *
 *      // NOTE: you can't and shouldn't render any components in this region, since the
 *      // app rerenders ever frame, so the only way to keep a component you render here on the screen
 *      // is by throwing the same Error exception every frame. 
 *      // Aside from the fact that it is a bad idea, this typically won't happen if the Error was thrown when 
 *      // you were handling a mouse click or keyboard input, for example.
 *      // You'll need to do something else instead!
 *
 *      console.error("An error occured while rendering: ", e);
 *      errorRef.val = e;
 * } 
 * imEndTry();
 *
 * ```
 */
export function imTry(): ListRenderer {
    const l = imList();
    nextListRoot();
    return l;
}

/** See {@link imTry} */
export function imCatch(l: ListRenderer) {
    abortListAndRewindUiStack(l);
    disableIm();
}

/** See {@link imTry} */
export function imEndTry() {
    enableIm();
    imEndList();
}


/**
 * Read {@link imList}'s doc first for context and examples.
 *
 * You can optionally specify a {@link key}.
 * If a key is present, the same UIRoot that was rendered for that particular key will be re-used. Make sure
 *      to not reuse the same key twice.
 *
 * If no key is present, the same UIRoot that was rendered for the nth call of nextListSlot() without a key will be re-used.
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

    let result;
    if (key !== undefined) {
        // use the hashmap
        // TODO: consider array of pairs

        if (l.keys === undefined) {
            l.keys = new Map();
        }

        let block = l.keys.get(key);
        if (block === undefined) {
            block = {
                root: newUiRoot(null, l.uiRoot.domAppender),
                rendered: false
            };
            l.keys.set(key, block);
        } else {
            // Don't render same list element twice in single render pass, haiyaaaa
            hotAssert(block.rendered === false);
        }

        block.rendered = true;

        result = block.root;
    } else {
        // use the array

        const idx = l.builderIdx++;

        if (idx < l.builders.length) {
            result = l.builders[idx];
        } else if (idx === l.builders.length) {
            result = newUiRoot(null, l.uiRoot.domAppender);
            l.builders.push(result);
        } else {
            // DEV: whenever l.builderIdx === this.builders.length, we should append another builder to the list
            hotAssert(false);
        }
    }

    __beginUiRoot(result, result.domAppender.idx, -1);

    l.current = result;

    return result;
}


///////// 
// Common immediate mode UI helpers

function imStateInternal<T>(supplier: () => T, skipSupplierCheck: boolean): T {
    // Don't access immediate mode state when immediate mode is disabled
    hotAssert(imDisabled === false);

    const r = getCurrentRoot();

    let result: T;
    const items = r.items;
    const idx = ++r.itemsIdx;
    if (idx < items.length) {
        const box = items[idx];
        hotAssert(box.t === ITEM_STATE);

        // The same hooks must be called in the same order every time.
        // If you have two hooks for state generated by the same supplier, but they were called out of order for some reason, 
        // this assertion won't catch that bug. I am assuming you won't write code like that...
        if (skipSupplierCheck === false) {
            hotAssert(supplier === box.supplier);
        }

        result = box.v as T;
    } else {
        // supplier can call getCurrentRoot() internally, and even add destructors.
        // But it shouldn't be doing immediate mode shenanigans.
        disableIm();
        result = supplier();
        enableIm();

        const box: StateItem = { t: ITEM_STATE, v: result, supplier };
        items.push(box);
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
    hotAssert(currentRoot !== undefined);

    return currentRoot as UIRoot;
}

// You probably don't want to use this, if you can help it
export function getCurrentListRendererInternal(): ListRenderer {
    /** Can't call this method without opening a new list renderer (see {@link imList}) */
    hotAssert(currentListRenderer !== undefined)

    return currentListRenderer;
}

function pushList(l: ListRenderer) {
    currentStack.push(l);
    currentRoot = undefined;
    currentListRenderer = l;
}

function pushRoot(r: UIRoot) {
    currentStack.push(r);
    currentRoot = r;
    currentListRenderer = undefined;
}

function startRendering(r: UIRoot = appRoot, itemIdx: number, domIdx: number) {
    currentStack.length = 0;
    enableIm();
    __beginUiRoot(r, itemIdx, domIdx);
}


export function imEl<E extends ValidElement = ValidElement>(elementSupplier: () => E): UIRoot<E> {
    // Don't access immediate mode state when immediate mode is disabled
    hotAssert(imDisabled === false);

    const r = getCurrentRoot();

    let result: UIRoot<E> | undefined;
    let items = r.items;
    const idx = ++r.itemsIdx;
    if (idx < items.length) {
        result = items[idx] as UIRoot<E>;

        // The same hooks must be called in the same order every time.
        hotAssert(result.t === ITEM_UI_ROOT);
        // string comparisons end up being quite expensive, so we're storing
        // a reference to the function that created the dom element and comparing those instead.
        hotAssert(result.elementSupplier === elementSupplier);
    } else {
        result = newUiRoot(elementSupplier);
        items.push(result);
    }

    r.hasRealChildren = true;
    appendToDomRoot(r.domAppender, result.domAppender.root);

    __beginUiRoot(result, -1, -1);

    return result as UIRoot<E>;
} 

/** 
 * This method pops any element from the global element stack that we created via {@link imEl}.
 * This is called `imEnd` instad of `end`, because `end` is a good variable name that we don't want to squat on.
 */
export function imEnd() {
    const r = getCurrentRoot();

    if (imEndRootInternal(r)) {
        // we rendered nothing to r root, so we should just remove it.
        // however, we may render to it again on a subsequent render.
        __removeAllDomElementsFromUiRoot(r, false);
    }

    return true;
}

/** 
 * Same as imEnd, but doesn't remove anything if we don't render anything.
 * I've not used it yet.
 */
export function imEndMemoized() {
    const r = getCurrentRoot();

    // we rendered nothing to r root, do nothing.
    imEndRootInternal(r)
}

function imEndRootInternal(r: UIRoot): boolean {
    // close out this UI Root.

    if (isDerived(r) === false) {
        // Defer the mouse events upwards, so that parent elements can handle it if they want
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

    itemsRendered += r.items.length;

    let result = false;

    if (r.itemsIdx === -1) {
        result = true;
    } else {
        hotAssert(r.itemsIdx === r.items.length - 1);
    }

    __popStack();

    return result;
}


function __popStack() {
    // fix the `current` variables
    currentStack.pop();
    if (currentStack.length === 0) {
        currentRoot = undefined;
        currentListRenderer = undefined;
    } else {
        const val = currentStack[currentStack.length - 1];
        if (val.t === ITEM_LIST_RENDERER) {
            currentListRenderer = val;
            currentRoot = undefined;
        } else {
            currentListRenderer = undefined;
            currentRoot = val;
        }
    }
}

export function imEndList() {
    if (currentRoot) {
        imEnd();
    }

    // NOTE: the main reason why I won't make a third ITEM_COMPONENT_FENCE 
    // to detect an incorrect number of calls to im() and imEnd() methods, is because
    // most UI components will interlace imList() and imEl() methods frequently enough that
    // this assertion here or the one in imEnd() will already catch this bug most of the time.
    const l = getCurrentListRendererInternal();

    // close out this list renderer.

    itemsRendered += l.builders.length;
    if (l.keys) {
        itemsRendered += l.keys.size;
    }

    // remove all the UI components that may have been added by other builders in the previous render.
    for (let i = l.builderIdx; i < l.builders.length; i++) {
        __removeAllDomElementsFromUiRoot(l.builders[i], true);
    }
    l.builders.length = l.builderIdx;

    if (l.keys) {
        for (const [k, v] of l.keys) {
            if (v.rendered === false) {
                __removeAllDomElementsFromUiRoot(v.root, true);
                l.keys.delete(k);
            }
        }
    }

    __popStack();
}

function newListRenderer(root: UIRoot): ListRenderer {
    return {
        t: ITEM_LIST_RENDERER,
        uiRoot: root,
        keys: undefined,
        builders: [],
        builderIdx: 0,
        current: null,
    };
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


export function newDiv() {
    return document.createElement("div");
}

export function newSpan() {
    return document.createElement("span");
}

export function imDiv(): UIRoot<HTMLDivElement> {
    return imEl<HTMLDivElement>(newDiv);
}

export function imSpan(): UIRoot<HTMLSpanElement> {
    return imEl<HTMLSpanElement>(newSpan);
}

export function imTextSpan(text: string) {
    imSpan(); setInnerText(text); imEnd();
}

export function imTextDiv(text: string) {
    imDiv(); setInnerText(text); imEnd();
}


export function abortListAndRewindUiStack(l: ListRenderer) {
    // need to wind the stack back to the current list component
    const idx = currentStack.lastIndexOf(l);
    hotAssert(idx !== -1);
    currentStack.length = idx + 1;
    currentRoot = undefined;
    currentListRenderer = l;

    const r = l.current;
    if (r) {
        __removeAllDomElementsFromUiRoot(r, false);

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
    return imState(newRef<T>);
}

function newArray() {
    return [];
}

export function imArray<T>(): T[] {
    return imState(newArray);
}


function newMap<K, V>() {
    return new Map<K, V>();
}

export function imMap<K, V>(): Map<K, V> {
    return imState(newMap<K, V>);
}


function newSet<T>() {
    return new Set<T>();
}

export function imSet<K>(): Set<K> {
    return imState(newSet<K>);
}


const MEMO_INITIAL_VALUE = {};
function newMemoState(): { last: unknown } {
    // this way, imMemo always returns true on the first render
    return { last: MEMO_INITIAL_VALUE };
}

/**
 * Returns true if it was different to the previous value.
 * ```ts
 * if (imMemo(val)) {
 *      // do expensive thing with val here
 *      setStyle("backgroundColor", getColor(val));
 * }
 * ```
 */
export function imMemo(val: unknown): boolean {
    const ref = imState(newMemoState);
    const changed = ref.last !== val;
    ref.last = val;
    return changed;
}

// TODO: performance benchmark vs imMemo
export function imMemoArray(...val: unknown[]): boolean {
    const arr = imArray();

    let changed = false;
    if (val.length !== arr.length) {
        changed = true;
        arr.length = val.length;
    }

    for (let i = 0; i < val.length; i++) {
        if (i === arr.length) {
            changed = true;
            arr.push(val[i]);
        } else if (arr[i] !== val[i]) {
            changed = true;
            arr[i] = val[i];
        }
    }

    return changed;
}

export function imMemoObjectVals(obj: Record<string, unknown>): boolean {
    const arr = imArray();

    let changed = false;
    let i = 0;
    for (const k in obj) {
        const val = obj[k];
        if (i === arr.length) {
            arr.push(val);
            changed = true;
        } else if (arr[i] !== val) {
            arr[i] = val;
            changed = true;
        }
        i++;
    }

    return changed;
}

export function disableIm() {
    imDisabled = true;
}

export function enableIm() {
    imDisabled = false;
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
            doRender(true);
        }
        r.root.addEventListener(
            type, 
            // @ts-expect-error this thing is fine, actually.
            handler
        );

        addDestructor(r, () => {
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
 * Returns true the first time it's called for a particular UIRoot, and false every other time.
 */
export function imInit(): boolean {
    const val = imRef<boolean>();
    if (val.val === null) {
        val.val = true;

        return true;
    }


    return false;
}

export function addClasses(classes: string[]) {
    for (let i = 0; i < classes.length; i++) {
        setClass(classes[i]);
    }
}


export function setStyle<K extends (keyof ValidElement["style"])>(key: K, value: string, r = getCurrentRoot()) {
    assertNotDerived(r);

    // NOTE: memoization should be done on your end, not mine

    // @ts-expect-error it sure can
    r.root.style[key] = value;
}


///////// 
// Realtime proper immediate-mode events API, with events.
//
// I wasn't able to find a good clean solution to the problem
// of adding and removing events locally, so I'm attempting to
// go down a second road of rerendering the entire app at 60fps.
//
// It would be interesting to see how far this approach scales. (23/03/2025)
//
// So far, it's going pretty great! (16/04/2025)

export type KeyPressEvent = {
    key: string;
    code: string;
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
};

let dtSeconds = 0;
let lastTime = 0;

export function deltaTimeSeconds(): number {
    return dtSeconds;
}

let doRender = (isEvent: boolean) => {};
let isRendering = false;
let _isExcessEventRender = false;

/**
 * This framework rerenders your entire application every event. 
 * This is required, so that we have a nice immediatem mode API for events, while 
 * also allowing for calling `e.preventDefault()` on any specific event, within that event cycle itself.
 *
 * This does mean that some expensive renders will become noticeably slow when you have multiple keys held down, for instance.
 *
 * ```ts
 * imCanvas2D(); 
 * if (!isExcessEventRender()) {
 *
 *      // draw expensive canvas thing
 * } 
 * imEnd();
 * ```
 *
 */
export function isExcessEventRender() {
    return _isExcessEventRender;
}

let initialized = false;

/**
 * @param renderFn This is the method that will be called inside of the `requestAnimationFrame` loop
 * @param renderRoot This is the dom element where we mount all the components. By default, it is the `body` element.
 */
export function initializeImDomUtils(renderFn: () => void, renderRoot?: UIRoot) {
    if (initialized) {
        return;
    }
    initialized = true;

    initializeImEvents();

    doRender = (isInsideEvent) => {
        if (isRendering) {
            return;
        }

        if (isInsideEvent === false) {
            _isExcessEventRender = false;
        }

        isRendering = true;
        startRendering(renderRoot, -1, -1);

        imFrame();

        renderFn();

        imEndFrame();

        hotAssert(currentStack.length === 1);

        isRendering = false;

        if (isInsideEvent) {
            _isExcessEventRender = isInsideEvent;
        }
    }

    const animation = (t: number) => {
        dtSeconds = (t - lastTime) / 1000;
        lastTime = t;

        doRender(false);

        requestAnimationFrame(animation);
    };
    
    requestAnimationFrame(animation);
}

export type ImKeyboardState = {
    // We need to use this approach instead of a buffered approach like `keysPressed: string[]`, so that a user
    // may call `preventDefault` on the html event as needed.
    // NOTE: another idea is to do `keys.keyDown = null` to prevent other handlers in this framework
    // from knowing about this event.
    keyDown: KeyboardEvent | null;
    keyUp: KeyboardEvent | null;
    blur: boolean;
};

function resetKeyboardState(keyEvent: ImKeyboardState) {
    keyEvent.keyDown = null;
    keyEvent.keyUp = null;
    keyEvent.blur = false;
}


const keyboardEvents: ImKeyboardState = {
    keyDown: null,
    keyUp: null,
    blur: false,
};

export type ImMouseState = {
    lastX: number;
    lastY: number;

    leftMouseButton: boolean;
    middleMouseButton: boolean;
    rightMouseButton: boolean;
    hasMouseEvent: boolean;

    dX: number;
    dY: number;
    X: number;
    Y: number;

    /**
     * NOTE: if you want to use this, you'll have to prevent scroll event propagation.
     * See {@link imPreventScrollEventPropagation}
     */
    scrollWheel: number;

    clickedElement: object | null;
    lastClickedElement: object | null;
    lastClickedElementOriginal: object | null;
    hoverElement: object | null;
    hoverElementOriginal: object | null;
};

function resetMouseState(mouse: ImMouseState, clearPersistedStateAsWell: boolean) {
    mouse.dX = 0;
    mouse.dY = 0;
    mouse.lastX = mouse.X;
    mouse.lastY = mouse.Y;

    mouse.clickedElement = null;
    mouse.scrollWheel = 0;

    if (clearPersistedStateAsWell) {
        mouse.leftMouseButton = false;
        mouse.middleMouseButton = false;
        mouse.rightMouseButton = false;

        mouse.lastClickedElement = null;
        mouse.lastClickedElementOriginal = null;
        mouse.hoverElement = null;
        mouse.hoverElementOriginal = null;
    }
}

const mouse: ImMouseState = {
    lastX: 0,
    lastY: 0,

    leftMouseButton: false,
    middleMouseButton: false,
    rightMouseButton: false,
    hasMouseEvent: false,

    dX: 0,
    dY: 0,
    X: 0,
    Y: 0,

    /**
     * NOTE: if you want to use this, you may have to prevent normal scroll event propagation.
     * See {@link imPreventScrollEventPropagation}
     */
    scrollWheel: 0,

    clickedElement: null,
    lastClickedElement: null,
    lastClickedElementOriginal: null,
    hoverElement: null,
    hoverElementOriginal: null,
};

export function getImMouse() {
    return mouse;
}

export function getImKeys(): ImKeyboardState {
    return keyboardEvents;
}


// I cant fking believe this shit works, lol

/**
 * Mouse press is distinct from mouse-click - A click is what happens when we release the mouse
 * above the same element that we pressed it on. However a press happens immediately on mouse-down.
 * TODO: add elementHasMouseClick
 */
export function elementHasMousePress() {
    const mouse = getImMouse();
    const r = getCurrentRoot();
    if (mouse.leftMouseButton) {
        return r.root === mouse.clickedElement;
    }
    return  false;
}

export function elementHasMouseDown(
    // Do we care that this element was initially clicked?
    // Set to false if you want to detect when an element drags their mouse over this element but 
    // it didn't initiate the click from this element.
    hadClick = true
) {
    const r = getCurrentRoot();

    if (hadClick) {
        return r.root === mouse.lastClickedElement;
    }

    return mouse.leftMouseButton && elementHasMouseHover();
}

export function elementHasMouseHover() {
    const r = getCurrentRoot();
    return r.root === mouse.hoverElement;
}

export function getHoveredElement() {
    return mouse.hoverElement;
}

function setClickedElement(el: object | null) {
    mouse.clickedElement = el;
    mouse.lastClickedElement = el;
    mouse.lastClickedElementOriginal = el;
}

function initializeImEvents() {
    document.addEventListener("mousedown", (e) => {
        setClickedElement(e.target);

        mouse.hasMouseEvent = true;

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
        mouse.X = e.clientX;
        mouse.Y = e.clientY;

        // Chromium can run two mousemove events in a single frame,
        // so it is more correct to accumulate the delta like this and then
        // zero it later.
        mouse.dX += mouse.X - mouse.lastX;
        mouse.dY += mouse.Y - mouse.lastY;

        mouse.hoverElementOriginal = e.target;

    });
    document.addEventListener("mouseenter", (e) => {
        mouse.hoverElementOriginal = e.target;
    });
    document.addEventListener("mouseup", (e) => {
        if (mouse.hasMouseEvent) {
            // when the framework starts lagging a lot, this mouse-up event can come directly after the mousedown, before the next frame.
            // this is not ideal. We should at least process these events.
            return;
        }

        if (e.button === 0) {
            mouse.leftMouseButton = false;
        } else if (e.button === 1) {
            mouse.middleMouseButton = false;
        } else if (e.button === 2) {
            mouse.rightMouseButton = false;
        }
    });
    document.addEventListener("wheel", (e) => {
        mouse.scrollWheel += e.deltaX + e.deltaY + e.deltaZ;
        mouse.hoverElementOriginal = e.target;
        e.preventDefault();
        console.log("[Scrolling]: ", mouse.scrollWheel);
    });
    document.addEventListener("keydown", (e) => {
        keyboardEvents.keyDown = e;
        doRender(true);
    });
    document.addEventListener("keyup", (e) => {
        keyboardEvents.keyUp = e;
        doRender(true);
    });
    window.addEventListener("blur", () => {
        resetMouseState(mouse, true);

        resetKeyboardState(keyboardEvents);

        keyboardEvents.blur = true;

        doRender(true);
    });
}

function newPreventScrollEventPropagationState() {
    return { 
        isBlocking: true,
        scrollY: 0,
    };
}

export function imPreventScrollEventPropagation() {
    const state = imState(newPreventScrollEventPropagationState);

    if (imInit()) {
        const r = getCurrentRoot();
        const handler = (e: Event) => {
            if (state.isBlocking) {
                e.preventDefault();
            }
        }
        r.root.addEventListener("wheel", handler);
        addDestructor(r, () => {
            r.root.removeEventListener("wheel", handler);
        });
    }

    const mouse = getImMouse();
    if (state.isBlocking && elementHasMouseHover() && mouse.scrollWheel !== 0) {
        state.scrollY += mouse.scrollWheel;
        mouse.scrollWheel = 0;
    } else {
        state.scrollY = 0;
    }

    return state;
}

function imFrame() {
    // persistent things need to be reset every frame, for bubling order to remain consistent per render
    mouse.lastClickedElement = mouse.lastClickedElementOriginal;
    mouse.hoverElement = mouse.hoverElementOriginal;
}

function imEndFrame() {
    resetKeyboardState(keyboardEvents);
    resetMouseState(mouse, false);

    mouse.hasMouseEvent = false;
    itemsRenderedLastFrame = itemsRendered;
    itemsRendered = 0;
}

export function getNumItemsRendered() {
    return itemsRenderedLastFrame;
}

let numResizeObservers = 0;

export type SizeState = {
    width: number;
    height: number;
}

function newImGetSizeState(): {
    size: SizeState;
    observer: ResizeObserver;
    resized: boolean;
} {
    const r = getCurrentRoot();

    const self = {
        size: { width: 0, height: 0, },
        resized: false,
        observer: new ResizeObserver((entries) => {
            for (const entry of entries) {
                // NOTE: resize-observer cannot track the top, right, left, bottom of a rect. Sad.
                
                self.size.width = entry.contentRect.width;
                self.size.height = entry.contentRect.height;
                break;
            }

            doRender(true);
        })
    };

    self.observer.observe(r.root);
    numResizeObservers++;
    addDestructor(r, () => {
        numResizeObservers--;
        self.observer.disconnect()
    });

    return self;
}

export function imTrackSize() {
    return imState(newImGetSizeState);
}
