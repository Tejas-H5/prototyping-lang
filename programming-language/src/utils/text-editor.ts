/**
 * An immediate-mode core for building a text editor.
 *
 * ```ts
 *
 * ```
 */

import "src/styling";
import { copyToClipboard, readFromClipboard } from "src/utils/clipboard";
import { elementHasMouseClick, elementHasMouseDown, elementHasMouseHover, getMouse, imBeginEl, imEnd, imInit, imOn, setStyle, UIRoot } from 'src/utils/im-dom-utils';
import { clamp, max, min } from "src/utils/math-utils";
import { isWhitespace } from "src/utils/text-utils";
import { assert } from "./assert";



export function textEditorHasSelection(s: TextEditorState) {
    return s.selectionStart !== -1 || s.selectionEnd !== -1;
}

export function textEditorDeleteCurrentSelection(s: TextEditorState) {
    if (!textEditorHasSelection(s)) {
        return;
    }

    textEditorRemove(s, s.selectionStart, s.selectionEnd - s.selectionStart + 1);

    setCursor(s, s.selectionStart);
    clearSelection(s);
}

function countLinesUpToPos(s: TextEditorState, pos: number): number {
    if (pos === -1) {
        return -1;
    }

    let numLines = 0;
    for (let i = 0; i <= pos; i++) {
        if (s.buffer[i] === "\n") {
            numLines;
        }
    }
    return numLines;
}

function insertAtCursor(s: TextEditorState, char: string) {
    if (textEditorHasSelection(s)) {
        textEditorDeleteCurrentSelection(s);
    }
    textEditorInsert(s, s.cursor, [char]);
}

function currentChar(s: TextEditorState, offset = 0): string {
    const idx = s.cursor + offset;
    if (idx >= 0 && idx < s.buffer.length) {
        return s.buffer[s.cursor + offset];
    }

    return " ";
}

export function getLastNewlinePos(s: TextEditorState, pos: number) {
    if (pos < 0) return -1;

    while (pos >= 0 && s.buffer[pos] !== "\n") {
        pos--;
    }

    return pos;
}

export function getNextNewlinePos(s: TextEditorState, pos: number) {
    if (pos >= s.buffer.length) {
        return s.buffer.length;
    }

    while (pos < s.buffer.length && s.buffer[pos] !== "\n") {
        pos++;
    }

    return pos;
}

function moveToLastNewline(s: TextEditorState): number {
    const nextCursorPos = getLastNewlinePos(s, s.cursor);
    const delta = s.cursor - nextCursorPos;
    setCursor(s, nextCursorPos);
    return delta;
}

function moveDown(s: TextEditorState) {
    const cursor = s.cursor;
    // get current offset
    const currentLineOffset = moveToLastNewline(s);
    if (s.cursor === cursor) {
        s.cursor++;
        moveToNextNewline(s);
        return;
    }

    let i = 1;
    if (s.cursor === 0) {
        // move one more when moving down.
        i--;
    }

    setCursor(s, cursor);

    moveToNextNewline(s);
    s.cursor++;
    for (; i < currentLineOffset && currentChar(s) !== "\n"; i++) {
        s.cursor++;
    }
}

function clearSelection(s: TextEditorState) {
    s.selectionAnchor = -1;
    s.selectionAnchorEnd = -1;

    s.selectionStart = -1;
    s.selectionEnd = -1;

    s.isSelecting = false;
    s.canKeyboardSelect = false;
}

function moveUp(s: TextEditorState) {
    // get current offset
    const currentLineOffset = moveToLastNewline(s);
    s.cursor--;
    moveToLastNewline(s);

    if (s.cursor !== 0 && currentLineOffset > 0) {
        s.cursor++;
    }
    for (let i = 1; i < currentLineOffset && currentChar(s) !== "\n"; i++) {
        s.cursor++;
    }
}

function moveToEndOfThisWord(s: TextEditorState) {
    // get off whitespace
    while (s.cursor < s.buffer.length && isWhitespace(currentChar(s))) {
        s.cursor++;
    }

    // get to the end of the word
    while (s.cursor < s.buffer.length && !isWhitespace(currentChar(s))) {
        s.cursor++;
    }
}

function moveToStartOfLastWord(s: TextEditorState) {
    s.cursor--;

    // get off whitespace
    while (s.cursor > 0 && isWhitespace(currentChar(s))) {
        s.cursor--;
    }

    // get to the end of the word
    while (s.cursor > 0 && !isWhitespace(currentChar(s))) {
        s.cursor--;
    }

    if (isWhitespace(currentChar(s))) {
        s.cursor++;
    }
}


function moveToNextNewline(s: TextEditorState) {
    while (s.cursor < s.buffer.length && currentChar(s) !== "\n") {
        s.cursor++;
    }
}

// TODO: remove, or add incCursor and decCursor
function setCursor(s: TextEditorState, pos: number) {
    s.cursor = pos;
}

type TextEdit = {
    time: number;
    pos: number;
    insert: boolean;
    chars: string[];
};

function applyStep(s: TextEditorState, step: TextEdit, apply: boolean = true) {
    s.isUndoing = true;
    if (step.insert === apply) {
        textEditorInsert(s, step.pos, step.chars);
        setCursor(s, step.pos + step.chars.length);
    } else {
        textEditorRemove(s, step.pos, step.chars.length);
        setCursor(s, step.pos);
    }
    clearSelection(s);
    s.isUndoing = false;
}

function revertStep(s: TextEditorState, step: TextEdit) {
    applyStep(s, step, false);
}

export type TextEditorState = {
    _textAreaElement: UIRoot<HTMLTextAreaElement> | null;
    _cursorSpan: HTMLElement | null;
    _keyDownEvent: HTMLElementEventMap["keydown"] | null;
    _keyUpEvent: HTMLElementEventMap["keyup"] | null;
    _handledEvent: boolean;
    _viewCursorAtStart: boolean;
    _viewCursorAtEnd: boolean;

    inCommandMode: boolean;
    keyLower: string;

    shouldFocusTextArea: boolean;

    undoBuffer: TextEdit[];
    undoBufferIdx: number;
    isUndoing: boolean;

    buffer: string[];
    modifiedAt: number;

    cursor: number;
    cursorLine: number;
    viewCursor: LineCursor;
    isAutoScrolling: boolean;
    // These two get recomputed
    _viewEndCursor: LineCursor;
    _renderCursor: LineCursor;

    lastSelectCursor: number;
    hasFocus: boolean;

    selectionAnchor: number;
    selectionAnchorEnd: number;
    selectionStart: number;
    selectionEnd: number;
    hasClick: boolean;
    canKeyboardSelect: boolean;
    canMouseSelect: boolean;
    isSelecting: boolean;
    isShifting: boolean;
}

export type LineCursor = {
    pos: number;
    line: number
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

export function textEditorInsert(s: TextEditorState, pos: number, chars: string[]) {
    s.buffer.splice(pos, 0, ...chars);
    s.modifiedAt = Date.now();

    s.cursor = pos + chars.length;
    if (pos <= s.viewCursor.pos) {
        recomputeViewCursorLines(s);
    }

    pushToUndoBuffer(s, { 
        time: s.modifiedAt, 
        pos: pos, 
        insert: true, 
        chars: chars 
    });
}

function recomputeViewCursorLines(s: TextEditorState) {
    s.viewCursor.pos = getLastNewlinePos(s, s.cursor);
    s.viewCursor.line = countLinesUpToPos(s, s.viewCursor.pos);
    s._viewEndCursor.pos = s.viewCursor.pos;
    s._viewEndCursor.line = s.viewCursor.line;
}

export function textEditorRemove(s: TextEditorState, pos: number, count: number) {
    const removedChars = s.buffer.splice(pos, count);
    s.modifiedAt = Date.now();

    s.cursor = pos;
    if (pos <= s.viewCursor.pos) {
        recomputeViewCursorLines(s);
    }

    pushToUndoBuffer(s, { 
        time: s.modifiedAt, 
        pos: pos, 
        insert: false,
        chars: removedChars 
    });
}

export function textEditorSetSelection(s: TextEditorState, anchor: number, end: number) {
    s.selectionAnchor = anchor;
    s.selectionAnchorEnd = end;
    s.selectionStart = min(anchor, end);
    s.selectionEnd = max(anchor, end);
    s.canKeyboardSelect = false;
    s.canMouseSelect = false;
}

export function handleTextEditorMouseScrollEvent(s: TextEditorState) {
    const mouse = getMouse();
    if (mouse.scrollY !== 0) {
        if (elementHasMouseHover()) {
            const n = Math.max(Math.abs(mouse.scrollY / 50));
            if (mouse.scrollY < 0) {
                for (let i = 0; i < n; i++) {
                    decrementViewCursors(s);
                }
            } else {
                for (let i = 0; i < n; i++) {
                    incrementViewCursors(s);
                }
            }
        } 
    }
}

// events are only set to null if we handle them.
export function defaultTextEditorKeyboardEventHandler(s: TextEditorState) {
    if (s._handledEvent) {
        return;
    }
    s._handledEvent = true;

    const mouse = getMouse();
    if (!mouse.leftMouseButton) {
        s.hasClick = false;
        s.canMouseSelect = false;
    }

    const keyDownEvent = s._keyDownEvent;
    if (keyDownEvent) {
        // need to check up here, because they are invalidated after we edit the buffer

        const initialCursor = s.cursor;

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

                    if (shouldUndo) {
                        if (s.undoBufferIdx >= 0) {
                            // coalesce multiple undo ops into one
                            let time = s.undoBuffer[s.undoBufferIdx].time;
                            while (s.undoBufferIdx >= 0) {
                                const step = s.undoBuffer[s.undoBufferIdx];
                                if (Math.abs(step.time - time) > 100) {
                                    break;
                                }

                                s.undoBufferIdx--;
                                revertStep(s, step);
                            }
                        } else {
                            handled = false;
                        }
                    } else if (shouldRedo) {
                        shouldRedo = true;
                        if (s.undoBufferIdx < s.undoBuffer.length - 1) {
                            // coalesce multiple undo ops into one
                            let time = s.undoBuffer[s.undoBufferIdx].time;
                            while (s.undoBufferIdx >= 0) {
                                const step = s.undoBuffer[s.undoBufferIdx];
                                if (Math.abs(step.time - time) > 100) {
                                    break;
                                }

                                // increment and get in the opposite order as above
                                s.undoBufferIdx++;

                                applyStep(s, step);
                            }
                        } else {
                            handled = false;
                        }
                    }
                } else if (key === ")") {
                    // TODO: expand our selection
                    handled = false;
                } else if (key === "(") {
                    // TODO: contract our selection
                    handled = false;
                } else if (keyLower === "x") {
                    if (textEditorHasSelection(s)) {
                        const text = s.buffer.slice(s.selectionStart, s.selectionEnd + 1).join("");
                        copyToClipboard(text).then(() => {
                            textEditorDeleteCurrentSelection(s);
                        });
                    }
                } else if (keyLower === "c") {
                    if (textEditorHasSelection(s)) {
                        const text = s.buffer.slice(s.selectionStart, s.selectionEnd + 1).join("");
                        copyToClipboard(text).then(() => {
                            clearSelection(s);
                        });
                    } else {
                        handled = false;
                    }
                } else if (keyLower === "v") {
                    readFromClipboard().then(clipboardText => {
                        if (textEditorHasSelection(s)) {
                            textEditorDeleteCurrentSelection(s);
                            textEditorInsert(s, s.cursor, clipboardText.split(""));
                        } else {
                            textEditorInsert(s, s.cursor, clipboardText.split(""));
                        }
                    });
                } else if (keyLower === "a") {
                    textEditorSetSelection(s, 0, s.buffer.length - 1);
                } else {
                    handled = false;
                }
            }
        } else if (key === "Backspace") {
            if (textEditorHasSelection(s)) {
                textEditorDeleteCurrentSelection(s);
            } else if (s.inCommandMode) {
                if (s.cursor > 0) {
                    s.cursor--;

                    const cursor = s.cursor;
                    moveToStartOfLastWord(s);
                    s.selectionStart = s.cursor;
                    s.selectionEnd = cursor;
                    textEditorDeleteCurrentSelection(s);
                }
            } else {
                if (s.cursor > 0) {
                    s.cursor--;
                    textEditorRemove(s, s.cursor, 1);
                }
            }
        } else if (key === "ArrowLeft") {
            if (s.inCommandMode) {
                moveToStartOfLastWord(s);
            } else {
                s.cursor--;
            }
        } else if (key === "ArrowRight") {
            if (s.inCommandMode) {
                moveToEndOfThisWord(s);
            } else {
                s.cursor++;
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
                s.cursor = s.buffer.length;
            } else {
                moveToNextNewline(s);
            }
        } else if (key === "Home") {
            if (s.inCommandMode) {
                s.cursor = 0;
            } else {
                s.cursor--;
                moveToLastNewline(s);
                if (s.cursor !== 0) {
                    s.cursor++;
                }
            }
        } else if (key === "Enter") {
            insertAtCursor(s, "\n");
        } else if (key === "Tab") {
            insertAtCursor(s, "\t");
        } else if (key === "Shift") {
            if (!isRepeat) {
                setCanSelect(s, true);
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

        s.cursor = clamp(s.cursor, 0, s.buffer.length);

        if (s.cursor !== initialCursor) {
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

function viewWindowIsAtStart(s: TextEditorState) {
    return s.viewCursor.pos === -1;
}

function viewWindowIsAtEnd(s: TextEditorState) {
    return s._viewEndCursor.pos >= s.buffer.length - 1;
}

function autoScrollTextEditor(s: TextEditorState) {
    if (!s.isAutoScrolling) {
        return;
    }

    if (s.viewCursor.pos <= s.cursor && s.cursor <= s._viewEndCursor.pos) {
        const distanceToStartLine = s.cursorLine - s.viewCursor.line;
        const distanceToEndLine = s._viewEndCursor.line - s.cursorLine;
        const ratio = distanceToStartLine / (distanceToStartLine + distanceToEndLine);

        if (distanceToStartLine + distanceToEndLine !== 0) {
            if (ratio < 0.25 && !s._viewCursorAtStart) {
                decrementViewCursors(s);
            } else if (ratio > 0.75 && !s._viewCursorAtEnd) {
                incrementViewCursors(s);
            } else {
                // we no longer need to autoscroll.
                s.isAutoScrolling = false;
            }
        }
    } else {
        // NOTE: these could have been in a while loop if we wanted it to be faster.

        const scrollSpeed = Math.max(Math.abs(s.viewCursor.pos - s.cursor) / 50, 5);

        for (let i = 0; i < scrollSpeed; i++) {
            if (!s._viewCursorAtStart && s.cursor < s.viewCursor.pos) {
                decrementViewCursors(s);
            } else {
                break;
            }
        }

        for (let i = 0; i < scrollSpeed; i++) {
            if (!s._viewCursorAtEnd && s.cursor > s._viewEndCursor.pos) {
                // a trick we can use to check if two indices are on the same line
                incrementViewCursors(s);
            } else {
                break;
            }
        }
    }
}

function newLineCursor(): LineCursor {
    return { pos: 0, line: 0 };
}

export function newTextEditorState() {
    // fields with _ cannot be JSON-serialized
    const state: TextEditorState = {
        _textAreaElement: null,
        shouldFocusTextArea: false,
        _cursorSpan: null,
        hasFocus: false,

        modifiedAt: 0,
        cursor: 0,
        cursorLine: 0,
        _renderCursor: newLineCursor(),
        viewCursor: newLineCursor(),
        _viewEndCursor: newLineCursor(),
        lastSelectCursor: 0,

        isAutoScrolling: true,

        selectionStart: -1,
        selectionEnd: -1,
        selectionAnchorEnd: -1,
        selectionAnchor: -1,
        hasClick: false,
        canKeyboardSelect: false,
        canMouseSelect: false,
        isSelecting: false,

        isShifting: false,
        inCommandMode: false,
        keyLower: "",
        _keyUpEvent: null,
        _keyDownEvent: null,
        _handledEvent: false,
        _viewCursorAtStart:  false,
        _viewCursorAtEnd: false,

        undoBuffer: [],
        undoBufferIdx: -1,
        isUndoing: false,

        buffer: [],
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
    s.buffer.length = 0;
    s.undoBuffer.length = 0;
    s.undoBufferIdx = -1;
    s.cursor = 0;
    s.modifiedAt = 0;

    clearSelection(s);

    resetCursor(s.viewCursor);
    resetCursor(s._viewEndCursor);
    resetCursor(s._renderCursor);
}

function resetCursor(c: LineCursor) {
    c.pos = -1;
    c.line = -1;
}

export function loadText(s: TextEditorState, text: string) {
    resetTextEditorState(s);
    for (const c of text) {
        s.buffer.push(c);
    }
}

export type TextEditorInlineHint = {
    component: (line: number) => void;
}

function setCanSelect(s: TextEditorState, keyboard: boolean) {
    if (keyboard) {
        if (!s.canKeyboardSelect) {
            s.canKeyboardSelect = true;
            s.lastSelectCursor = s.cursor;
        }
    } else {
        if (!s.canMouseSelect) {
            s.canMouseSelect = true;
            s.lastSelectCursor = s.cursor;
        }
    }
}

// NOTE: this needs to be inside a container
// with position: relative to correctly position the fake text-area.
export function imBeginTextEditor(s: TextEditorState) {
    s._cursorSpan = null;
    s._renderCursor.pos = s.viewCursor.pos;
    s._renderCursor.line = s.viewCursor.line;
    s.cursorLine = -1;
    s._handledEvent = false;

    s._viewCursorAtStart = viewWindowIsAtStart(s);
    s._viewCursorAtEnd = viewWindowIsAtEnd(s);

    // using an input to allow hooking into the browser's existing focusing mechanisms.
    const textAreaRoot = imBeginEl(newTextArea); {
        s._textAreaElement = textAreaRoot;

        s._keyDownEvent = imOn("keydown");
        s._keyUpEvent = imOn("keyup");

        // preprocess events
        {
            if (s._keyUpEvent) {
                const key = s._keyUpEvent.key;
                if (key === "Shift") {
                    s.canKeyboardSelect = false;
                    s.isSelecting = false;
                    s.isShifting = false;
                } else if (key === "Control") {
                    s.inCommandMode = false;
                }
            }

            if (s._keyDownEvent) {
                const key = s._keyDownEvent.key;
                s.keyLower = key.toLowerCase();

                if (key === "Control") {
                    s.inCommandMode = true;
                }

                if (key === "Shift") {
                    s.isShifting = true;
                }
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
                resetTextEditorState

                s.isShifting = false;
                s.inCommandMode = false;
                s.canMouseSelect = false;
                s.canKeyboardSelect = false;
            }
        }
    } imEnd();
}

export function imEndTextEditor(s: TextEditorState) {
    if (s._cursorSpan && s._textAreaElement) {
        s._textAreaElement.setStyle("top", s._cursorSpan.offsetTop + "px")
        s._textAreaElement.setStyle("left", s._cursorSpan.offsetLeft + "px")
        s._textAreaElement.setStyle("height", s._cursorSpan.clientHeight + "px");
    }

    defaultTextEditorKeyboardEventHandler(s);

    autoScrollTextEditor(s);

    const canSelect = s.canKeyboardSelect || s.canMouseSelect;
    if (!s.isSelecting && canSelect && s.cursor !== s.lastSelectCursor) {
        if (s.buffer[s.lastSelectCursor] === "\n" && s.cursor < s.lastSelectCursor) {
            // dont want to start on newlines when selecting backwards. This is always an accident
            s.selectionAnchor = s.lastSelectCursor - 1;
        } else {
            s.selectionAnchor = s.lastSelectCursor;
        }
        s.lastSelectCursor = s.cursor;
        s.canKeyboardSelect = false;
        s.isSelecting = true;
    }

    if (s.isSelecting) {
        s.selectionEnd = s.cursor;
        s.selectionAnchorEnd = s.cursor;

        const start = min(s.selectionAnchor, s.selectionAnchorEnd);
        const end = max(s.selectionAnchor, s.selectionAnchorEnd);
        s.selectionStart = start;
        s.selectionEnd = end;

        s.lastSelectCursor = s.cursor;
    }
}

export function setCurrentSpan(s: TextEditorState, span: HTMLElement) {
    // We need to know where to position the fake text area.
    s._cursorSpan = span;
}

export function handleTextEditorClickEventForChar(s: TextEditorState, charIdx: number) {
    if (elementHasMouseClick()) {
        s.hasClick = true;

        // single click, clear selection
        clearSelection(s);
    }

    if (s.hasClick && elementHasMouseDown(false)) {
        // move cursor to current token
        s.cursor = charIdx;
        setCanSelect(s, false);

        s.shouldFocusTextArea = true;
    }
}

function incrementViewCursors(s: TextEditorState) {
    if (incrementCursorByLine(s, s._viewEndCursor)) {
        incrementCursorByLine(s, s.viewCursor);
    }
}

function decrementViewCursors(s: TextEditorState) {
    if (decrementCursorByLine(s, s._viewEndCursor)) {
        decrementCursorByLine(s, s.viewCursor);
    }
}

export function decrementCursorByLine(s: TextEditorState, cursor: LineCursor) {
    if (cursor.pos === -1) {
        assert(cursor.line === -1);
        return false;
    }

    let newViewCursorPos = getLastNewlinePos(s, cursor.pos - 1);
    if (newViewCursorPos === -1) {
        assert(cursor.line === 0);
    } else {
        assert(s.buffer[newViewCursorPos] === "\n");
    }

    cursor.pos = newViewCursorPos;
    cursor.line--;
    return true;
}

export function incrementCursorByLine(s: TextEditorState, cursor: LineCursor): boolean {
    assert(cursor.pos <= s.buffer.length);

    if (cursor.pos === s.buffer.length) {
        return false;
    }

    const newViewCursorPos = getNextNewlinePos(s, cursor.pos + 1);
    assert(
        newViewCursorPos === s.buffer.length ||
        s.buffer[newViewCursorPos] === "\n"
    );
    cursor.pos = newViewCursorPos;
    cursor.line++;

    return true;
}

// You'll need to do this to get scrolling behaviour.
// You can do it multiple times to extend the view as needed.
export function textEditorMarkViewEnd(s: TextEditorState) {
    s._viewEndCursor.pos = s._renderCursor.pos;
    s._viewEndCursor.line = s._renderCursor.line;
}

export function textEditorHasChars(s: TextEditorState): boolean {
    return s._renderCursor.pos < s.buffer.length;
}

function incrementCursor(s: TextEditorState, c: LineCursor) {
    c.pos++;
    if (s.buffer[c.pos] === "\n" || c.pos === s.buffer.length) {
        c.line++;
    }
}


export function textEditorGetNextChar(s: TextEditorState): string {
    if (s._renderCursor.pos < s.buffer.length) {
        incrementCursor(s, s._renderCursor);

        if (s._renderCursor.pos === s.cursor) {
            s.cursorLine = s._renderCursor.line;
        }

        if (s._renderCursor.pos < s.buffer.length) {
            return s.buffer[s._renderCursor.pos];
        }
    }

    return "\n";
}

export function textEditorCursorIsSelected(s: TextEditorState, pos: number) {
    return s.selectionStart <= pos && pos <= s.selectionEnd;
}

// TODO: more sane name
export function textEditorQueryBufferAtPos(buffer: string[], query: string[], pos: number): boolean {
    if (query.length === 0) {
        // this is a hot take.
        return false;
    }

    if (buffer.length < pos + query.length) {
        return false;
    }

    for (let i = 0; i < query.length; i++) {
        if (buffer[i + pos] !== query[i]) {
            return false;
        }
    }

    return true;
}
