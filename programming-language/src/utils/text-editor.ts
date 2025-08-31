import "src/styling";
import { copyToClipboard, readFromClipboard } from "src/utils/clipboard";
import { isWhitespace } from "src/utils/text-utils";
import * as tb from "./text-edit-buffer";
import {
    EL_TEXTAREA,
    elHasMousePress,
    elHasMouseOver,
    elSetStyle,
    EV_KEYDOWN,
    EV_KEYUP,
    getGlobalEventSystem,
    imElBegin,
    imElEnd,
    ImGlobalEventSystem,
    imOn
} from "./im-dom";
import { ImCache, imMemo, isFirstishRender } from "./im-core";

// TODO: the user of this 'library' like code shouldn't need to actually use the im-dom-utils framework.
// Should make it framework-agnostic. or at least moving the immediate mode functions to the bottom half of the file.

export function textEditorHasSelection(s: TextEditorState) {
    return s.selectionStart.pieceIdx !== -1 && s.selectionEnd.pieceIdx !== -1;
}

export function textEditorDeleteSelection(s: TextEditorState) {
    if (!textEditorHasSelection(s)) return;

    tb.itCopy(s.cursor, s.selectionStart);
    tb.iterateBackwards(s.cursor);
    textEditorRemove(s, s.selectionStart, s.selectionEnd);
    tb.iterate(s.cursor);

    textEditorClearSelection(s);
}

export function iterateToLastNewline(cursor: tb.Iterator) {
    let count = 0;
    while (tb.iterateBackwards(cursor) && tb.itGet(cursor) !== "\n") {
        count++;
    }
    return count;
}

export function iterateToNextNewline(cursor: tb.Iterator) {
    let count = 0;
    while (tb.iterate(cursor) && tb.itGet(cursor) !== "\n") {
        count++;
    }
    return count;
}

function moveDown(s: TextEditorState) {
    const { pieceIdx, textIdx } = s.cursor;
    const currentLineOffset = iterateToLastNewline(s.cursor);
    tb.itCopyValues(s.cursor, pieceIdx, textIdx);

    if (tb.itGet(s.cursor) !== "\n") {
        iterateToNextNewline(s.cursor);
    }

    let nextLineOffset = 0;
    while (tb.iterate(s.cursor) && tb.itGet(s.cursor) !== "\n") {
        if (currentLineOffset === nextLineOffset) break;
        nextLineOffset++;
    }
}

export function textEditorClearSelection(s: TextEditorState) {
    tb.itClear(s.selectionStart);
    tb.itClear(s.selectionEnd);
}

export function moveUp(s: TextEditorState) {
    const currentLineOffset = iterateToLastNewline(s.cursor);
    if (tb.itIsZero(s.cursor)) {
        return;
    }

    tb.iterateBackwards(s.cursor);
    iterateToLastNewline(s.cursor);

    let nextLineOffset = 0;
    if (tb.itIsZero(s.cursor)) {
        nextLineOffset = 1;
    }

    while (nextLineOffset <= currentLineOffset) {
        if (tb.iterate(s.cursor) && tb.itGet(s.cursor) !== "\n") {
            nextLineOffset++;
            continue;
        }
        break;
    }
}

export function moveToEndOfThisWord(s: TextEditorState) {
    // get off whitespace
    while (tb.iterate(s.cursor) && isWhitespace(tb.itGet(s.cursor))) {}

    // get to the end of the word
    while (tb.iterate(s.cursor) && !isWhitespace(tb.itGet(s.cursor))) {}
}

export function moveToStartOfLastWord(s: TextEditorState) {
    if (!tb.iterateBackwards(s.cursor)) return;

    // get off whitespace
    while (isWhitespace(tb.itGet(s.cursor)) && tb.iterateBackwards(s.cursor)) {}

    // get to the end of the word
    while (!isWhitespace(tb.itGet(s.cursor)) && tb.iterateBackwards(s.cursor)) {}
}


type TextEdit = {
    time: number;
    pos: number;
    insert: boolean;
    str: string;
};

export type TextEditorState = {
    _textAreaElement:      HTMLTextAreaElement            | null;
    _cursorSpan:           HTMLElement                    | null;
    _lastRenderedCharSpan: HTMLElement                    | null;
    _containerElement:     HTMLElement                    | null;
    _keyDownEvent:         HTMLElementEventMap["keydown"] | null;
    _keyUpEvent:           HTMLElementEventMap["keyup"]   | null;
    _handledEvent:         boolean;

    inCommandMode: boolean;
    keyLower:      string;

    shouldFocusTextArea: boolean;

    undoBuffer:    TextEdit[];
    undoBufferIdx: number;
    isUndoing:     boolean;

    buffer:     tb.Buffer;
    modifiedAt: number;

    wantedScrollAmount: number;
    // Curent line
    viewLine:           number;
    // number of lines we _can_ view at once. its the viewport height in lines
    viewTotalLines:     number;
    _cursorLine:        number;
    _hasCursorLine:     boolean;
    // TODO: viewCol for horizonal scrolling
    
    _renderPosStart:         number;
    _renderCursorReachedEnd: boolean;
    _renderCursorStart:      tb.Iterator;
    _renderCursorEnd:        tb.Iterator;
    _renderCursor:           tb.Iterator;
    _tempCursor:             tb.Iterator;
    _initialCursor:          tb.Iterator;
    cursor:                  tb.Iterator;
    selectionAnchor:         tb.Iterator;
    selectionAnchorEnd:      tb.Iterator;
    selectionStart:          tb.Iterator;
    selectionEnd:            tb.Iterator;
    selectionStartedCursor:  tb.Iterator;

    isMouseSelecting:    boolean;
    isKeyboardSelecting: boolean;

    isAutoScrolling: boolean;

    hasFocus:          boolean;
    hasClick:          boolean;
    isShifting:        boolean;

}

function pushToUndoBuffer(s: TextEditorState, edit: TextEdit) {
    if (s.isUndoing) {
        return;
    }

    s.undoBufferIdx++;
    if (s.undoBuffer.length !== s.undoBufferIdx) {
        // truncate the undo buffer. we don't need excess entries anymore.
        s.undoBuffer.length = s.undoBufferIdx;
    }

    s.undoBuffer.push(edit);
}

function applyOrRevertUndoStep(s: TextEditorState, step: TextEdit, apply: boolean) {
    s.isUndoing = true;

    tb.beginEditing(s.buffer); {

        if (step.insert) {
            if (apply) {
                tb.buffInsertAt(s.buffer, step.pos, step.str);
            } else {
                tb.buffRemoveAt(s.buffer, step.pos, step.str.length);
            }
        } else {
            if (apply) {
                tb.buffRemoveAt(s.buffer, step.pos, step.str.length);
            } else {
                tb.buffInsertAt(s.buffer, step.pos, step.str);
            }
        }

    } tb.endEditing(s.buffer) 

    s.isUndoing = false;
    s.modifiedAt = Date.now();
}

function traverseUndoBuffer(
    s: TextEditorState,
    forwards: boolean,
    withinTime = 100
) {
    if (s.undoBuffer.length === 0) return;

    if (forwards) {
        if (s.undoBufferIdx < s.undoBuffer.length - 1) {
            let time = s.undoBuffer[s.undoBufferIdx + 1].time;
            while (s.undoBufferIdx < s.undoBuffer.length - 1) {
                const step = s.undoBuffer[s.undoBufferIdx + 1];
                if (Math.abs(step.time - time) > withinTime) {
                    break;
                }

                s.undoBufferIdx++;

                textEditorClearSelection(s);
                applyOrRevertUndoStep(s, step, true);
            }
        } 
    } else {
        if (s.undoBufferIdx >= 0) {
            let time = s.undoBuffer[s.undoBufferIdx].time;
            while (s.undoBufferIdx >= 0) {
                const step = s.undoBuffer[s.undoBufferIdx];
                if (Math.abs(step.time - time) > withinTime) {
                    break;
                }

                textEditorClearSelection(s);
                applyOrRevertUndoStep(s, step, false);

                s.undoBufferIdx--;
            }
        } 
    }
}

export function textEditorInsert(s: TextEditorState, cursor: tb.Iterator, str: string) {
    tb.beginEditing(s.buffer); {
        textEditorInsertInternal(s, cursor, str);
    } tb.endEditing(s.buffer);
}

export function textEditorInsertInternal(s: TextEditorState, cursor: tb.Iterator, str: string) {
    const pos = tb.itGetPos(cursor);

    if (!tb.itInsert(cursor, str)) return; 

    s.modifiedAt = Date.now();

    pushToUndoBuffer(s, {
        time: s.modifiedAt,
        pos,
        insert: true,
        str: str
    });
}

export function textEditorRemove(s: TextEditorState, start: tb.Iterator, end: tb.Iterator) {
    tb.beginEditing(s.buffer); {
        textEditorRemoveInternal(s, start, end);
    } tb.endEditing(s.buffer);
}

export function textEditorRemoveLen(s: TextEditorState, start: tb.Iterator, len: number) {
    tb.beginEditing(s.buffer); {
        const end = tb.itNewTempFrom(start, len);
        textEditorRemoveInternal(s, start, end);
    } tb.endEditing(s.buffer);
}

export function textEditorRemoveInternal(s: TextEditorState, start: tb.Iterator, end: tb.Iterator) {
    const removed = tb.itGetTextBetween(start, end);
    if (!removed) return;

    const startPos = tb.itGetPos(start);
    if (!tb.itRemove(start, end)) return;

    s.modifiedAt = Date.now();

    pushToUndoBuffer(s, {
        time: s.modifiedAt,
        pos: startPos,
        insert: false,
        str: removed
    });
}

export function textEditorSetSelection(s: TextEditorState, start: tb.Iterator, end: tb.Iterator) {
    tb.itMin(s.selectionStart, start, end);
    tb.itMax(s.selectionStart, start, end);
}

export function textEditorScroll(s: TextEditorState, amount: number) {
    s.wantedScrollAmount = amount;
}

export function handleTextEditorMouseScrollEvent(c: ImCache, s: TextEditorState) {
    const mouse = getGlobalEventSystem().mouse;
    if (mouse.scrollWheel !== 0) {
        if (elHasMouseOver(c)) {
            const n = Math.max(mouse.scrollWheel / 50);
            textEditorScroll(s, n);
        } 
    }
}


export function textEditorMoveToEndOfLine(cursor: tb.Iterator) {
    if (tb.itGet(cursor) !== "\n") {
        iterateToNextNewline(cursor);
    }
}

export function textEditorMoveToStartOfLine(cursor: tb.Iterator) {
    if (tb.itIsZero(cursor)) return;

    tb.iterateBackwards(cursor);
    if (tb.itGet(cursor) !== "\n") {
        iterateToLastNewline(cursor);
    }

    if (!tb.itIsZero(cursor)) {
        tb.iterate(cursor);
    }
}

// events are only set to null if we handle them.
export function defaultTextEditorKeyboardEventHandler(s: TextEditorState) {
    if (s._handledEvent) {
        return;
    }
    s._handledEvent = true;

    const mouse = getGlobalEventSystem().mouse;
    if (!mouse.leftMouseButton) {
        s.hasClick = false;
    }

    const keyDownEvent = s._keyDownEvent;
    if (keyDownEvent) {
        // need to check up here, because they are invalidated after we edit the buffer

        // do our text editor command instead of the browser shortcut
        keyDownEvent.preventDefault();

        const key = keyDownEvent.key;
        const keyLower = s.keyLower;
        const isRepeat = keyDownEvent.repeat;
        const c = getChar(keyDownEvent);

        // Wherever we set this to false, we give the user an opportunity to handle this event
        // _if_ we didn't handle it here.
        let handled = true;
        const lastModified = s.modifiedAt;

        tb.itCopy(s._initialCursor, s.cursor);

        if (c) {
            if (!s.inCommandMode) {
                insertAtCursor(s, c);
            } else {
                if (keyLower === "z" || keyLower === "y") {
                    let shouldUndo = false;
                    let shouldRedo = false;

                    if (keyLower === "z") {
                        if (s.isShifting) {
                            shouldRedo = true;
                        } else {
                            shouldUndo = true;
                        }
                    } else {
                        shouldRedo = true;
                    }

                    if (shouldRedo) {
                        traverseUndoBuffer(s, true);
                    } else if (shouldUndo) {
                        traverseUndoBuffer(s, false);
                    } else {
                        handled = true;
                    }
                } else if (key === ")") {
                    // TODO: expand our selection
                    handled = false;
                } else if (key === "(") {
                    // TODO: contract our selection
                    handled = false;
                } else if (keyLower === "x") {
                    if (textEditorHasSelection(s)) {
                        const selectedText = tb.itGetTextBetween(s.selectionStart, s.selectionEnd);
                        if (selectedText) {
                            copyToClipboard(selectedText).then(() => {
                                textEditorDeleteSelection(s);
                            });
                        }
                    }
                } else if (keyLower === "c") {
                    if (textEditorHasSelection(s)) {
                        const selectedText = tb.itGetTextBetween(s.selectionStart, s.selectionEnd);
                        if (selectedText) {
                            copyToClipboard(selectedText).then(() => {
                                textEditorClearSelection(s);
                            });
                        }
                    } else {
                        handled = false;
                    }
                } else if (keyLower === "v") {
                    readFromClipboard().then(clipboardText => {
                        insertAtCursor(s, clipboardText);
                    });
                } else if (keyLower === "a") {
                    tb.itZero(s.selectionStart);
                    tb.itEnd(s.selectionEnd);
                    tb.iterate(s.selectionEnd);
                } else {
                    handled = false;
                }
            }
        } else if (key === "Backspace" || key === "Delete") {
            if (textEditorHasSelection(s)) {
                textEditorDeleteSelection(s);
            } else if (s.inCommandMode) {
                if (key === "Backspace") {
                    tb.itCopy(s.selectionEnd, s.cursor);
                    moveToStartOfLastWord(s);
                    tb.itCopy(s.selectionStart, s.cursor);
                } else {
                    tb.itCopy(s.selectionStart, s.cursor);
                    moveToEndOfThisWord(s);
                    tb.itCopy(s.selectionEnd, s.cursor);
                }

                textEditorDeleteSelection(s);
            } else {
                if (key === "Backspace") {
                    if (tb.iterateBackwards(s.cursor)) {
                        textEditorRemoveLen(s, s.cursor, 1);
                    }
                } else {
                    textEditorRemoveLen(s, s.cursor, 1);
                }
            }
        } else if (key === "ArrowLeft") {
            if (s.inCommandMode) {
                moveToStartOfLastWord(s);
            } else {
                tb.iterateBackwards(s.cursor);
            }
        } else if (key === "ArrowRight") {
            if (s.inCommandMode) {
                moveToEndOfThisWord(s);
            } else {
                tb.iterate(s.cursor);
            }
        } else if (key === "ArrowUp") {
            moveUp(s);
        } else if (key === "PageUp") {
            for (let i = 0; i < 20; i++) {
                moveUp(s);
            }
        } else if (key === "ArrowDown") {
            moveDown(s);
        } else if (key === "PageDown") {
            for (let i = 0; i < 20; i++) {
                moveDown(s);
            }
        } else if (key === "End") {
            if (s.inCommandMode) {
                while (tb.iterate(s.cursor)) { };
            } else {
                textEditorMoveToEndOfLine(s.cursor)
            }
        } else if (key === "Home") {
            if (s.inCommandMode) {
                s.cursor.pieceIdx = 0;
                s.cursor.textIdx = 0;
            } else {
                textEditorMoveToStartOfLine(s.cursor);
            }
        } else if (key === "Enter") {
            insertAtCursor(s, "\n");
        } else if (key === "Tab") {
            insertAtCursor(s, "\t");
        } else if (key === "Shift") {
            if (!isRepeat) {
                tb.itCopy(s.selectionStartedCursor, s.cursor);
            }
        } else if (key === "Escape") {
            if (textEditorHasSelection(s)) {
                textEditorClearSelection(s);
            } else {
                handled = false;
            }
        } else {
            handled = false;
        }

        const modified = lastModified !== s.modifiedAt;
        const movedCursor = !tb.itEquals(s._initialCursor, s.cursor);

        if (modified || movedCursor) {
            s.isAutoScrolling = true;
        }

        if (!modified && movedCursor && s.isShifting) {
            if (!s.isKeyboardSelecting) {
                s.isKeyboardSelecting = true;
                textEditorStartSelection(s, s._initialCursor);
            } 

            textEditorExtendSelection(s, s.cursor);
        }

        if (handled) {
            s._keyDownEvent = null;
        }
    }

    const keyUpEvent = s._keyUpEvent;
    if (keyUpEvent) {
        s._keyUpEvent =  null;
    }
}

function insertAtCursor(s: TextEditorState, str: string) {
    textEditorDeleteSelection(s);
    textEditorInsert(s, s.cursor, str);
}

export function newTextEditorState() {
    const buffer = tb.newBuff();

    // fields with _ cannot be JSON-serialized
    const state: TextEditorState = {
        _textAreaElement:      null,
        shouldFocusTextArea:   false,
        _cursorSpan:           null,
        _lastRenderedCharSpan: null,
        _containerElement:     null,
        hasFocus:              false,

        modifiedAt:         0,
        viewLine:           -1,
        wantedScrollAmount: 0,
        viewTotalLines:     1,
        _cursorLine:        0,
        _hasCursorLine:     false,

        _renderPosStart:         0,
        _renderCursorReachedEnd: false,
        _renderCursorStart:      tb.itNewPermanent(buffer),
        _renderCursorEnd:        tb.itNewPermanent(buffer),
        _renderCursor:           tb.itNewPermanent(buffer),
        _tempCursor:             tb.itNewPermanent(buffer),
        _initialCursor:          tb.itNewPermanent(buffer),
        cursor:                  tb.itNewPermanent(buffer),
        selectionStart:          tb.itNewPermanent(buffer),
        selectionEnd:            tb.itNewPermanent(buffer),
        selectionAnchor:         tb.itNewPermanent(buffer),
        selectionAnchorEnd:      tb.itNewPermanent(buffer),
        selectionStartedCursor:  tb.itNewPermanent(buffer),

        isMouseSelecting:    false,
        isKeyboardSelecting: false,

        isAutoScrolling: false,

        hasClick:          false,

        isShifting:    false,
        inCommandMode: false,
        keyLower:      "",
        _keyUpEvent:   null,
        _keyDownEvent: null,
        _handledEvent: false,

        undoBuffer:    [],
        undoBufferIdx: -1,
        isUndoing:     false,

        buffer,
    };

    textEditorReset(state);
    return state;
}

function newTextArea() {
    return document.createElement("textarea");
}

function getChar(e: KeyboardEvent) {
    let char = "";
    for (const c of e.key) {
        if (char !== "") {
            return "";
        }
        char = c;
    }
    return char;
}

function textEditorReset(s: TextEditorState) {
    s.buffer = tb.newBuff();

    s._renderCursorStart     = tb.itNewPermanent(s.buffer);
    s._renderCursorEnd       = tb.itNewPermanent(s.buffer);
    s._renderCursor          = tb.itNewPermanent(s.buffer);
    s._tempCursor            = tb.itNewPermanent(s.buffer);
    s._initialCursor         = tb.itNewPermanent(s.buffer);
    s.cursor                 = tb.itNewPermanent(s.buffer);
    s.selectionAnchor        = tb.itNewPermanent(s.buffer);
    s.selectionAnchorEnd     = tb.itNewPermanent(s.buffer);
    s.selectionStart         = tb.itNewPermanent(s.buffer);
    s.selectionEnd           = tb.itNewPermanent(s.buffer);
    s.selectionStartedCursor = tb.itNewPermanent(s.buffer);

    s.undoBuffer.length = 0;
    s.undoBufferIdx     = -1;
    s.modifiedAt        = 0;

    textEditorClearSelection(s);

    textEditorSetViewLine(s, 0);
}

export function loadText(s: TextEditorState, text: string): boolean {
    const existingText = tb.buffToString(s.buffer);
    if (existingText === text) return false;

    tb.beginEditing(s.buffer); {
        const start = tb.itNewTemp(s.buffer);
        const end = tb.itNewTemp(s.buffer);
        tb.itEnd(end);
        
        textEditorRemoveInternal(s, start, end);
        textEditorInsertInternal(s, s.cursor, text);

    } tb.endEditing(s.buffer);

    return true;
}

export type TextEditorInlineHint = {
    component: (line: number) => void;
}

function textEditorSetViewLine(s: TextEditorState, newViewLine: number): boolean {
    if (s.viewLine === newViewLine) return false;

    s.viewLine = newViewLine;

    tb.itZero(s._renderCursorStart);

    s._renderPosStart = 0;
    for (let i = 0; i < s.viewLine; i++) {
        const count = iterateToNextNewline(s._renderCursorStart);
        s._renderPosStart += count;
    }

    tb.iterateBackwardsUnclamped(s._renderCursorStart);

    return true;
}

function textEditorStartSelection(s: TextEditorState, cursor: tb.Iterator) {
    tb.itCopy(s.selectionAnchor, cursor);
    if (
        tb.itGet(s.selectionStartedCursor) === "\n" && 
        tb.itBefore(cursor, s.selectionStartedCursor)
    ) {
        // dont want to start on newlines when selecting backwards. This is always an accident
        tb.iterateBackwards(s.selectionAnchor);
    }

    tb.itCopy(s.selectionAnchorEnd, s.selectionAnchor);
    tb.itCopy(s.selectionStart,     s.selectionAnchor);
    tb.itCopy(s.selectionEnd,       s.selectionAnchor);
}

// TODO: handle potential aliasing bugs
function textEditorExtendSelection(s: TextEditorState, cursor: tb.Iterator) {
    tb.itCopy(s.selectionAnchorEnd, cursor);
    if (tb.itBefore(s.selectionAnchorEnd, s.selectionAnchor)) {
        tb.itCopy(s.selectionStart, s.selectionAnchorEnd);
        tb.itCopy(s.selectionEnd, s.selectionAnchor);
    } else {
        tb.itCopy(s.selectionEnd, s.selectionAnchorEnd);
        tb.itCopy(s.selectionStart, s.selectionAnchor);
    }
}

// NOTE: this needs to be inside a container
// with position: relative to correctly position the fake text-area.
export function imBeginTextEditor(
    c: ImCache,
    s: TextEditorState,
    container: HTMLElement | null,
    ctrlHeld: boolean,
    shiftHeld: boolean
) {
    s._cursorSpan = null;
    s._handledEvent = false;
    s.inCommandMode = ctrlHeld;
    s._containerElement = container;

    const wasShifting = s.isShifting;
    s.isShifting = shiftHeld;
    const mouse = getGlobalEventSystem().mouse;

    if (s.isMouseSelecting && !mouse.leftMouseButton) {
        s.isMouseSelecting = false;
    }

    if (s.isKeyboardSelecting && !s.isShifting) {
        s.isKeyboardSelecting = false;
    }

    const MINIMUM_SCROLL_WINDOW_LINES = 5;

    // handle scroll input from last frame (??? TODO: Move if needd)
    let newViewLine = s.viewLine;
    const numNewlines = tb.buffNumNewlines(s.buffer);
    while (
        s.wantedScrollAmount > 1 &&
        newViewLine < numNewlines - MINIMUM_SCROLL_WINDOW_LINES
    ) {
        s.wantedScrollAmount--;
        newViewLine++;
    }
    while (
        s.wantedScrollAmount < -1 &&
        newViewLine > 0
    ) {
        s.wantedScrollAmount++;
        newViewLine--;
    }
    textEditorSetViewLine(s, newViewLine);

    s._renderCursorReachedEnd = false;
    s._hasCursorLine = false;
    tb.itCopy(s._renderCursor, s._renderCursorStart);

    // using an input to allow hooking into the browser's existing focusing mechanisms.
    const textAreaRoot = imElBegin(c, EL_TEXTAREA).root; {
        s._textAreaElement = textAreaRoot;
        s._keyDownEvent = imOn(c, EV_KEYDOWN);
        s._keyUpEvent = imOn(c, EV_KEYUP);

        // preprocess events
        {
            if (s._keyDownEvent) {
                const key = s._keyDownEvent.key;
                s.keyLower = key.toLowerCase();
            }
        }

        if (isFirstishRender(c)) {
            elSetStyle(c, "all", "unset");
            elSetStyle(c, "width", "1px");
            elSetStyle(c, "position", "absolute");
            elSetStyle(c, "color", "transparent");
            elSetStyle(c, "textShadow", "0px 0px 0px tomato"); // hahaha tomato. lmao. https://stackoverflow.com/questions/44845792/hide-caret-in-textarea
            // debugging
            // setStyle("border", "1px solid red");
        }

        s.hasFocus = document.activeElement === s._textAreaElement;
        if (s._textAreaElement && s.shouldFocusTextArea) {
            s.shouldFocusTextArea = false;
            if (!s.hasFocus) {
                s._textAreaElement.focus();
                s.hasFocus = true;
            }
        }
    } imElEnd(c, EL_TEXTAREA);
}

export function imEndTextEditor(c: ImCache, s: TextEditorState) {
    tb.itCopy(s._renderCursorEnd, s._renderCursor);

    // NOTE: code that is in the rendering pass should be moved
    // out of the rendering pass unless there is no other way to do it.

    const offsetTopChanged    = imMemo(c, s._cursorSpan?.offsetTop);
    const offsetLeftChanged   = imMemo(c, s._cursorSpan?.offsetLeft);
    const offsetHeightChanged = imMemo(c, s._cursorSpan?.offsetHeight);

    if (s._cursorSpan && s._textAreaElement) {
        if (offsetTopChanged) {
            elSetStyle(c, "top", s._cursorSpan.offsetTop + "px", s._textAreaElement);
        }
        if (offsetLeftChanged) {
            elSetStyle(c, "left", s._cursorSpan.offsetLeft + "px", s._textAreaElement)
        }
        if (offsetHeightChanged) {
            elSetStyle(c, "height", s._cursorSpan.clientHeight + "px", s._textAreaElement);
        }
    }

    defaultTextEditorKeyboardEventHandler(s);

    // Make sure the cursor is still in view. autoscrolling.
    // Since the user can render anything inside a line, we actually can't make any assumptions about
    // how tall the line should be. Hence, we scroll by 1 step per frame.
    // TODO: think of better abstraction.

    if (s._cursorSpan && s._containerElement && s._lastRenderedCharSpan) {
        const cursorRect = s._cursorSpan.getBoundingClientRect();
        const containerRect = s._containerElement.getBoundingClientRect();

        const cursorTop = cursorRect.top;
        const cursorBottom = cursorRect.bottom;

        const containerTop = containerRect.top;
        const containerBottom = containerRect.bottom;

        const containerSize = containerBottom - containerTop;

        const percentToTop = (cursorBottom - containerTop) / containerSize;
        const percentToBottom = (containerBottom - cursorTop) / containerSize;

        const scrollThreshold = 0.25;

        let autoScrolled = false;

        if (percentToTop < scrollThreshold) {
            if (s.viewLine > 0) {
                s.wantedScrollAmount--;
                autoScrolled = true;
            }
        } else if (percentToBottom < scrollThreshold) {
            let canScrollDown = true;
            if (tb.itIsAtEnd(s._renderCursorEnd)) {
                const lastRenderedCharRect = s._lastRenderedCharSpan.getBoundingClientRect();
                const lastCharIsFullyVisible = lastRenderedCharRect.bottom < containerBottom;
                if (lastCharIsFullyVisible) {
                    canScrollDown = false;
                }
            }

            if (canScrollDown) {
                s.wantedScrollAmount++;
                autoScrolled = true;
            }
        }

        if (!autoScrolled) {
            s.isAutoScrolling = false;
        }
    } else {
        const cursorLine = tb.itLine(s.cursor);

        if (tb.itBefore(s.cursor, s._renderCursorStart)) {
            const dist = s.viewLine - cursorLine;
            s.wantedScrollAmount -= Math.ceil(dist / 2);
        } else if (tb.itBefore(s._renderCursorEnd, s.cursor)) {
            const endLine = s.viewLine + s.viewTotalLines;
            const dist = cursorLine - endLine;
            s.wantedScrollAmount += Math.ceil(dist / 2);
        }
    }
}

export function handleTextEditorClickEventForChar(c: ImCache, s: TextEditorState, cursor: tb.Iterator) {
    if (elHasMousePress(c)) {
        s.hasClick = true;

        // single click, clear selection
        s.isMouseSelecting = true;
        tb.itCopy(s.cursor, cursor);
        textEditorStartSelection(s, s.cursor);
    }

    if (s.hasClick && elHasMousePress(c)) {
        // mouse is down. could be a single click, or a drag click
        
        // we probably wanted to start selecting from here
        tb.itCopy(s.cursor, cursor);
        textEditorExtendSelection(s, s.cursor);

        s.shouldFocusTextArea = true;
    }
}

export function textEditorHasChars(s: TextEditorState): boolean {
    if (tb.itIsClear(s._renderCursor)) {
        return true;
    }

    return !!tb.itGet(s._renderCursor);
}


export function textEditorGetNextChar(s: TextEditorState): string {
    tb.iterate(s._renderCursor)
    const res = tb.itGet(s._renderCursor);
    return res ?? "\n";
}

export function textEditorCursorIsSelected(s: TextEditorState, cursor: tb.Iterator) {
    return (tb.itEquals(s.selectionStart, cursor) || tb.itBefore(s.selectionStart, cursor)) && 
           tb.itBefore(cursor, s.selectionEnd);
}
