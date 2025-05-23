import "src/styling";
import { copyToClipboard, readFromClipboard } from "src/utils/clipboard";
import {
    elementHasMousePress,
    elementHasMouseDown,
    elementHasMouseHover,
    getImMouse,
    imEl,
    imEnd,
    imInit,
    imOn,
    setStyle,
    UIRoot,
    imMemo
} from 'src/utils/im-dom-utils';
import { isWhitespace } from "src/utils/text-utils";
import { assert } from "./assert";
import * as tb from "./text-edit-buffer";

// TODO: the user of this 'library' like code shouldn't need to actually use the im-dom-utils framework.
// Should make it framework-agnostic. or at least moving the immediate mode functions to the bottom half of the file.

export function textEditorHasSelection(s: TextEditorState) {
    return s.selectionStart.pieceIdx !== -1 && s.selectionEnd.pieceIdx !== -1;
}

export function textEditorDeleteCurrentSelection(s: TextEditorState) {
    if (!textEditorHasSelection(s)) {
        return;
    }

    textEditorRemove(s, s.selectionStart, s.selectionEnd);

    tb.itCopy(s.cursor, s.selectionStart);
    clearSelection(s);
}

export function iterateToLastNewline(cursor: TextEditorCursor) {
    if (!tb.iterateBackwards(cursor)) return;

    while (tb.itGet(cursor) !== "\n") {
        tb.iterateBackwards(cursor);
    }
}


function moveToLastNewline(s: TextEditorState) {
    iterateToLastNewline(s.cursor);
}

function moveDown(s: TextEditorState) {
    moveToLastNewline(s);
    tb.iterate(s.cursor);
}

function clearSelection(s: TextEditorState) {
    tb.itClear(s.selectionStart);
    tb.itClear(s.selectionEnd);

    s.isSelecting = false;
    s.canKeyboardSelect = false;
}

function moveUp(s: TextEditorState) {
    // get current offset
    tb.iterateBackwards(s.cursor);
    iterateToLastNewline(s.cursor);
}

function moveToEndOfThisWord(s: TextEditorState) {
    // get off whitespace
    while (tb.iterate(s.cursor) && 
        isWhitespace(tb.itGet(s.cursor))
    ) {}

    // get to the end of the word
    while (tb.iterate(s.cursor) && 
        !isWhitespace(tb.itGet(s.cursor))
    ) {}
}

function moveToStartOfLastWord(s: TextEditorState) {
    if (!tb.iterateBackwards(s.cursor)) return;

    // get off whitespace
    while (isWhitespace(tb.itGet(s.cursor))) {
        tb.iterateBackwards(s.cursor);
    }

    // get to the end of the word
    while (!isWhitespace(tb.itGet(s.cursor))) {
        tb.iterateBackwards(s.cursor);
    }
}

export function iterateToNextNewline(cursor: TextEditorCursor) {
    while (tb.iterate(cursor) && tb.itGet(cursor) !== "\n") {}
}

type TextEdit = {
    time: number;
    cursor: TextEditorCursor;
    insert: boolean;
    str: string;
};

export type TextEditorCursor = tb.Iterator;

export type TextEditorState = {
    _textAreaElement: UIRoot<HTMLTextAreaElement>    | null;
    _cursorSpan:      HTMLElement                    | null;
    _keyDownEvent:    HTMLElementEventMap["keydown"] | null;
    _keyUpEvent:      HTMLElementEventMap["keyup"]   | null;
    _handledEvent:    boolean;

    inCommandMode: boolean;
    keyLower:      string;

    shouldFocusTextArea: boolean;

    undoBuffer:    TextEdit[];
    undoBufferIdx: number;
    isUndoing:     boolean;

    buffer:     tb.Buffer;
    modifiedAt: number;

    wantedScrollAmount: number;
    viewLine:           number;
    _viewEndLine:       number;
    // TODO: viewCol for horizonal scrolling
    
    _renderCursorStart:     TextEditorCursor;
    _renderCursor:          TextEditorCursor;
    _tempCursor:            TextEditorCursor;
    _initialCursor:         TextEditorCursor;
    cursor:                 TextEditorCursor;
    selectionAnchor:        TextEditorCursor;
    selectionAnchorEnd:     TextEditorCursor;
    selectionStart:         TextEditorCursor;
    selectionEnd:           TextEditorCursor;
    selectionStartedCursor: TextEditorCursor;

    isAutoScrolling:   boolean;
    hasFocus:          boolean;
    hasClick:          boolean;
    canKeyboardSelect: boolean;
    canMouseSelect:    boolean;
    isSelecting:       boolean;
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

    if (step.insert) {
        if (apply) {
            textEditorInsert(s, step.cursor, step.str);
        } else {
            textEditorRemoveLen(s, step.cursor, step.str.length);
        }
    } else {
        if (apply) {
            textEditorRemoveLen(s, step.cursor, step.str.length);
        } else {
            textEditorInsert(s, step.cursor, step.str);
        }
    }

    s.isUndoing = false;
}

function traverseUndoBuffer(s: TextEditorState, forwards: boolean, withinTime = 100) {
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

                clearSelection(s);
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

                s.undoBufferIdx--;

                clearSelection(s);
                applyOrRevertUndoStep(s, step, false);
            }
        } 
    }
}
export function textEditorInsert(s: TextEditorState, cursor: TextEditorCursor, str: string) {
    const it = tb.itInsert(cursor, str);
    if (!it) return;

    tb.itCopy(s.cursor, it);
    
    s.modifiedAt = Date.now();

    pushToUndoBuffer(s, { 
        time: s.modifiedAt, 
        cursor: it, 
        insert: true, 
        str: str 
    });
}


export function textEditorInsertAtCursor(s: TextEditorState, cursor: TextEditorCursor, str: string) {
    assert(s.buffer === cursor.buff);
    const it = tb.itInsert(cursor, str);
    if (!it) return;

    tb.itCopy(s.cursor, it);
    
    s.modifiedAt = Date.now();

    pushToUndoBuffer(s, { 
        time: s.modifiedAt, 
        cursor: cursor, 
        insert: true, 
        str: str 
    });
}

export function textEditorRemoveLen(s: TextEditorState, pos: TextEditorCursor, len: number) {
    tb.itCopy(s._tempCursor, pos);
    for (let i = 0; i < len; i++) tb.iterate(s._tempCursor);

    textEditorRemove(s, pos, s._tempCursor);
}

export function textEditorRemove(s: TextEditorState, pos: TextEditorCursor, end: TextEditorCursor) {
    const removed = tb.itRemove(pos, end);
    if (!removed) return;

    s.modifiedAt = Date.now();

    tb.itCopy(s.cursor, pos);
    tb.iterateBackwards(s.cursor);

    pushToUndoBuffer(s, { 
        time: s.modifiedAt, 
        cursor: pos, 
        insert: false,
        str: removed
    });
}

export function textEditorSetSelection(s: TextEditorState, start: TextEditorCursor, end: TextEditorCursor) {
    tb.itMin(s.selectionStart, start, end);
    tb.itMax(s.selectionStart, start, end);
    
    // TODO: ??? not sure why .
    s.canKeyboardSelect = false;
    s.canMouseSelect = false;
}

export function textEditorScroll(s: TextEditorState, amount: number) {
    s.wantedScrollAmount = amount;
}

export function handleTextEditorMouseScrollEvent(s: TextEditorState) {
    const mouse = getImMouse();
    if (mouse.scrollWheel !== 0) {
        if (elementHasMouseHover()) {
            const n = Math.max(mouse.scrollWheel / 50);
            textEditorScroll(s, n);
        } 
    }
}

// events are only set to null if we handle them.
export function defaultTextEditorKeyboardEventHandler(s: TextEditorState) {
    if (s._handledEvent) {
        return;
    }
    s._handledEvent = true;

    const mouse = getImMouse();
    if (!mouse.leftMouseButton) {
        s.hasClick = false;
        s.canMouseSelect = false;
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
                textEditorInsertAtCursor(s, s.cursor, c);
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
                                textEditorDeleteCurrentSelection(s);
                            });
                        }
                    }
                } else if (keyLower === "c") {
                    if (textEditorHasSelection(s)) {
                        const selectedText = tb.itGetTextBetween(s.selectionStart, s.selectionEnd);
                        if (selectedText) {
                            copyToClipboard(selectedText).then(() => {
                                clearSelection(s);
                            });
                        }
                    } else {
                        handled = false;
                    }
                } else if (keyLower === "v") {
                    readFromClipboard().then(clipboardText => {
                        if (textEditorHasSelection(s)) {
                            textEditorDeleteCurrentSelection(s);
                            textEditorInsert(s, s.cursor, clipboardText);
                        } else {
                            textEditorInsert(s, s.cursor, clipboardText);
                        }
                    });
                } else if (keyLower === "a") {
                    tb.itZero(s.selectionStart);
                    tb.itEnd(s.selectionEnd);
                    s.canKeyboardSelect = false;
                    s.canMouseSelect = false;
                } else {
                    handled = false;
                }
            }
        } else if (key === "Backspace" || key === "Delete") {
            // TODO: DELETE should keep the cursor in the same place.

            if (textEditorHasSelection(s)) {
                textEditorDeleteCurrentSelection(s);
            } else if (s.inCommandMode) {
                // Delete word
                tb.itCopy(s.selectionEnd, s.cursor);
                moveToStartOfLastWord(s);
                tb.itCopy(s.selectionStart, s.cursor);
                textEditorDeleteCurrentSelection(s);
            } else {
                // Delete singular letter
                tb.itCopy(s.selectionStart, s.cursor);
                tb.iterate(s.cursor);
                tb.itCopy(s.selectionEnd, s.cursor);
                tb.itCopy(s.cursor, s.selectionStart);
                tb.iterateBackwards(s.cursor);

                textEditorDeleteCurrentSelection(s);
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
                iterateToNextNewline(s.cursor);
            }
        } else if (key === "Home") {
            if (s.inCommandMode) {
                s.cursor.pieceIdx = 0;
                s.cursor.textIdx = 0;
            } else {
                iterateToLastNewline(s.cursor);
            }
        } else if (key === "Enter") {
            textEditorInsertAtCursor(s, s.cursor, "\n");
        } else if (key === "Tab") {
            textEditorInsertAtCursor(s, s.cursor, "\t");
        } else if (key === "Shift") {
            if (!isRepeat) {
                setInitialSelectionCursor(s, true);
            }
        } else if (key === "Escape") {
            if (textEditorHasSelection(s)) {
                clearSelection(s);
            } else {
                handled = false;
            }
        } else {
            handled = false;
        }

        const modified = lastModified !== s.modifiedAt;
        if (modified) {
            // Typing a capital letter with Shift + key shouldn't start selecting words...
            s.canKeyboardSelect = false;
        }

        if (!tb.itEquals(s._initialCursor, s.cursor)) {
            // we only want to autoscroll when we've pressed a key. If we don't do this, then we can easily end up in
            // an infinite loop, where we scroll up one line, but that line is so tall that it brings the cursor so far down the screen
            // that we then have to scroll down one line, and so on and so forth
            s.isAutoScrolling = true;
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

function autoScrollTextEditor(s: TextEditorState) {
    if (!s.isAutoScrolling) {
        return;
    }

    // TODO: Reimplement
    
}

export function newTextEditorState() {
    const buffer = tb.newBuff();

    // fields with _ cannot be JSON-serialized
    const state: TextEditorState = {
        _textAreaElement:    null,
        shouldFocusTextArea: false,
        _cursorSpan:         null,
        hasFocus:            false,

        modifiedAt:         0,
        viewLine:           0,
        wantedScrollAmount: 0,
        _viewEndLine:       1,

        _renderCursorStart: tb.itNew(buffer),
        _renderCursor:      tb.itNew(buffer),
        _tempCursor:        tb.itNew(buffer),
        _initialCursor:     tb.itNew(buffer),
        cursor:             tb.itNew(buffer),
        selectionStart:     tb.itNew(buffer),
        selectionEnd:       tb.itNew(buffer),
        selectionAnchor:     tb.itNew(buffer),
        selectionAnchorEnd:       tb.itNew(buffer),
        selectionStartedCursor:   tb.itNew(buffer),

        isAutoScrolling:   true,
        hasClick:          false,
        canKeyboardSelect: false,
        canMouseSelect:    false,
        isSelecting:       false,

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
    resetTextEditorState(state);
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

function resetTextEditorState(s: TextEditorState) {
    s.buffer = tb.newBuff();

    s._renderCursorStart.buff     = s.buffer;
    s._renderCursor.buff          = s.buffer;
    s._tempCursor.buff            = s.buffer;
    s._initialCursor.buff         = s.buffer;
    s.cursor.buff                 = s.buffer;
    s.selectionStart.buff         = s.buffer;
    s.selectionEnd.buff           = s.buffer;
    s.selectionAnchor.buff        = s.buffer;
    s.selectionAnchorEnd.buff     = s.buffer;
    s.selectionStartedCursor.buff = s.buffer;

    s.undoBuffer.length = 0;
    s.undoBufferIdx     = -1;
    s.modifiedAt        = 0;

    clearSelection(s);
}


export function loadText(s: TextEditorState, text: string) {
    resetTextEditorState(s);
    tb.buffInsertAt(s.buffer, 0, text);
}

export type TextEditorInlineHint = {
    component: (line: number) => void;
}

function setInitialSelectionCursor(s: TextEditorState, keyboard: boolean) {
    if (keyboard) {
        if (!s.canKeyboardSelect) {
            s.canKeyboardSelect = true;
            tb.itCopy(s.selectionStartedCursor, s.cursor);
        }
    } else {
        if (!s.canMouseSelect) {
            s.canMouseSelect = true;
            tb.itCopy(s.selectionStartedCursor, s.cursor);
        }
    }
}

// NOTE: this needs to be inside a container
// with position: relative to correctly position the fake text-area.
export function imBeginTextEditor(s: TextEditorState, ctrlHeld: boolean, shiftHeld: boolean) {
    s._cursorSpan = null;
    s._handledEvent = false;
    s.inCommandMode = ctrlHeld;

    const wasShifting = s.isShifting;
    s.isShifting = shiftHeld;

    if (wasShifting && !shiftHeld) {
        s.isSelecting = false;
    }

    // handle scroll input from last frame (??? TODO: Move if needd)
    let prevViewLine = s.viewLine;
    while (s.wantedScrollAmount > 1) {
        s.wantedScrollAmount--;
        s.viewLine--;
    }
    s.viewLine = Math.max(0, s.viewLine);

    while (s.wantedScrollAmount < 1) {
        s.wantedScrollAmount++;
        s.viewLine++;
    }

    if (prevViewLine !== s.viewLine) {
        tb.iterateToLineCol(s._renderCursorStart, s.viewLine, 0);
    }

    s._renderCursor.pieceIdx = s._renderCursorStart.pieceIdx;
    s._renderCursor.textIdx = s._renderCursorStart.textIdx;

    // using an input to allow hooking into the browser's existing focusing mechanisms.
    const textAreaRoot = imEl(newTextArea); {
        s._textAreaElement = textAreaRoot;
        s._keyDownEvent = imOn("keydown");
        s._keyUpEvent = imOn("keyup");

        // preprocess events
        {
            if (s._keyDownEvent) {
                const key = s._keyDownEvent.key;
                s.keyLower = key.toLowerCase();
            }
        }

        if (imInit()) {
            setStyle("all", "unset");
            setStyle("width", "1px");
            setStyle("position", "absolute");
            setStyle("color", "transparent");
            setStyle("textShadow", "0px 0px 0px tomato"); // hahaha tomato. lmao. https://stackoverflow.com/questions/44845792/hide-caret-in-textarea
            // debugging
            // setStyle("border", "1px solid red");
        }

        s.hasFocus = document.activeElement === s._textAreaElement.root;
        if (s._textAreaElement && s.shouldFocusTextArea) {
            s.shouldFocusTextArea = false;
            if (!s.hasFocus) {
                s._textAreaElement.root.focus();
                s.hasFocus = true;
                s.canMouseSelect = false;
                s.canKeyboardSelect = false;
            }
        }
    } imEnd();
}

export function imEndTextEditor(s: TextEditorState) {
    const offsetTopChanged = imMemo(s._cursorSpan?.offsetTop);
    const offsetLeftChanged = imMemo(s._cursorSpan?.offsetLeft);
    const offsetHeightChanged = imMemo(s._cursorSpan?.offsetHeight);

    if (s._cursorSpan && s._textAreaElement) {
        if (offsetTopChanged) {
            setStyle("top", s._cursorSpan.offsetTop + "px", s._textAreaElement);
        }
        if (offsetLeftChanged) {
            setStyle("left", s._cursorSpan.offsetLeft + "px", s._textAreaElement)
        }
        if (offsetHeightChanged) {
            setStyle("height", s._cursorSpan.clientHeight + "px", s._textAreaElement);
        }
    }

    defaultTextEditorKeyboardEventHandler(s);

    autoScrollTextEditor(s);

    // TODO: this code should be near where we move the cursor. onCursorMoved() ?
    {
        const canStartSelecting = s.canKeyboardSelect || s.canMouseSelect;
        if (
            canStartSelecting && !s.isSelecting &&
            !tb.itEquals(s.cursor, s.selectionStartedCursor)
        ) {
            tb.itCopy(s.selectionAnchor, s.cursor);
            if (tb.itGet(s.selectionStartedCursor) === "\n" && tb.itBefore(s.cursor, s.selectionStartedCursor)) {
                // dont want to start on newlines when selecting backwards. This is always an accident
                tb.iterateBackwards(s.selectionAnchor);
            }

            tb.itCopy(s.selectionAnchorEnd, s.selectionAnchor);
            tb.itCopy(s.selectionStart,     s.selectionAnchor);
            tb.itCopy(s.selectionEnd,       s.selectionAnchor);

            s.isSelecting = true;
        }

        if (s.isSelecting) {
            tb.itCopy(s.selectionAnchorEnd, s.cursor);
            if (tb.itBefore(s.selectionAnchorEnd, s.selectionAnchor)) {
                tb.itCopy(s.selectionStart, s.selectionAnchorEnd);
                tb.itCopy(s.selectionEnd, s.selectionAnchor);
            } else {
                tb.itCopy(s.selectionEnd, s.selectionAnchorEnd);
                tb.itCopy(s.selectionStart, s.selectionAnchor);
            }
        }
    }
}

export function setCurrentSpan(s: TextEditorState, span: HTMLElement) {
    // We need to know where to position the fake text area.
    s._cursorSpan = span;
}

export function handleTextEditorClickEventForChar(s: TextEditorState, cursor: TextEditorCursor) {
    if (elementHasMousePress()) {
        s.hasClick = true;

        // single click, clear selection
        clearSelection(s);
    }

    if (s.hasClick && elementHasMouseDown(false)) {
        // mouse is down. could be a single click, or a drag click
        
        // we probably wanted to start selecting from here
        tb.itCopy(s.cursor, cursor);
        setInitialSelectionCursor(s, false);

        s.shouldFocusTextArea = true;
    }
}

export function textEditorHasChars(s: TextEditorState): boolean {
    assert(s.buffer === s._renderCursor.buff);
    const result = tb.itGet(s._renderCursor);
    return !!result;
}


export function textEditorGetNextChar(s: TextEditorState): string {
    tb.iterate(s._renderCursor)
    return tb.itGet(s._renderCursor) ?? "\n";
}

export function textEditorCursorIsSelected(s: TextEditorState, cursor: TextEditorCursor) {
    return tb.itBefore(s.selectionStart, cursor) && 
           tb.itBefore(cursor, s.selectionEnd);
}
