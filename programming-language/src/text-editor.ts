import "./styling.ts";
import { copyToClipboard, readFromClipboard } from "./utils/clipboard.ts";

import { assert, elementHasMouseClick, elementHasMouseDown, getMouse, imBeginEl, imBeginMemo, imEnd, imEndMemo, imInit, imOn, setStyle } from './utils/im-dom-utils.ts';
import { clamp, max, min } from "./utils/math-utils.ts";
import { getCol } from "./utils/matrix-math.ts";
import { isWhitespace } from "./utils/text-utils.ts";



function hasSelection(s: TextEditorState) {
    return s.selectionStart !== -1 || s.selectionEnd !== -1;
}
function deleteSelectedAndMoveCursorToStart(s: TextEditorState) {
    if (!hasSelection(s)) {
        return;
    }

    remove(s, s.selectionStart, s.selectionEnd - s.selectionStart + 1);
    setCursor(s, s.selectionStart);
    clearSelection(s);
}

function insertAtCursor(s: TextEditorState, char: string) {
    if (hasSelection(s)) {
        deleteSelectedAndMoveCursorToStart(s);
    }
    insert(s, s.cursor, [char]);
}

function currentChar(s: TextEditorState, offset = 0): string {
    const idx = s.cursor + offset;
    if (idx >= 0 && idx < s.buffer.length) {
        return s.buffer[s.cursor + offset];
    }

    return " ";
}

function eof(s: TextEditorState) {
    return s.buffer.length === s.cursor;
}

function getLastNewlinePos(s: TextEditorState, pos: number) {
    if (pos < 0) return 0;

    while (pos > 0 && s.buffer[pos] !== "\n") {
        pos--;
    }

    return pos;
}

function getNextNewlinePos(s: TextEditorState, pos: number) {
    if (pos >= s.buffer.length) {

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
    s.canStartSelecting = false;
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

function moveToNextWord(s: TextEditorState) {
    // get off the current word, and onto some whitespace
    while (s.cursor < s.buffer.length && !isWhitespace(currentChar(s))) {
        s.cursor++;
    }

    // then get to the next word
    while (s.cursor < s.buffer.length && isWhitespace(currentChar(s))) {
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


function moveToEndOfLastWord(s: TextEditorState) {
    // get off the current word, and onto some whitespace
    while (s.cursor > 0 && !isWhitespace(currentChar(s))) {
        s.cursor--;
    }

    // then get to the next word
    while (s.cursor > 0 && isWhitespace(currentChar(s))) {
        s.cursor--;
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
        insert(s, step.pos, step.chars);
        setCursor(s, step.pos + step.chars.length);
    } else {
        remove(s, step.pos, step.chars.length);
        setCursor(s, step.pos);
    }
    clearSelection(s);
    s.isUndoing = false;
}

function revertStep(s: TextEditorState, step: TextEdit) {
    applyStep(s, step, false);
}

interface Focusable {
    focus(): void;
}

export type TextEditorState = {
    _textAreaElement: HTMLTextAreaElement | null;
    _cursorSpan: HTMLElement | null;
    // Automatically shifts focus to this element if this one were focused for some reason.
    // TODO: consider if we still need this
    _beingControlledBy: Focusable | null;

    shouldFocusTextArea: boolean;
    undoBuffer: TextEdit[];
    undoBufferIdx: number;
    isUndoing: boolean;

    // TODO: 
    // // array of lines. each line is a string[]. (unicode chars may be longer than 1, so can't just use string as the line)
    buffer: string[];
    numLines: number;
    modifiedAt: number;

    cursor: number;
    cursorLine: number;

    // inferred by the cursor.
    viewCursor: LineCursor;
    viewEndCursor: LineCursor;

    // slightly different - it starts at -1 and increments to the current index.
    renderCursor: LineCursor;

    lastSelectCursor: number;
    hasFocus: boolean;

    currentKeyDown: string;
    canStartSelecting: boolean;
    isSelecting: boolean;
    isShifting: boolean;

    selectionAnchor: number;
    selectionAnchorEnd: number;
    selectionStart: number;
    selectionEnd: number;
    hasClick: boolean;

    inCommandMode: boolean;
}

type LineCursor = {
    pos: number;
    line: number
}

type Range = {
    start: number;
    end: number;
};

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

function insert(s: TextEditorState, pos: number, chars: string[]) {
    s.buffer.splice(pos, 0, ...chars);
    s.modifiedAt = Date.now();

    pushToUndoBuffer(s, { time: s.modifiedAt, pos: pos, insert: true, chars: chars });
}

function remove(s: TextEditorState, pos: number, count: number) {
    const removedChars = s.buffer.splice(pos, count);
    s.modifiedAt = Date.now();

    pushToUndoBuffer(s, { time: s.modifiedAt, pos: pos, insert: false, chars: removedChars });
}

function handleTextEditorEvents(
    s: TextEditorState,
    keyDownEvent: HTMLElementEventMap["keydown"] | null,
    keyUpEvent: HTMLElementEventMap["keyup"] | null,
) {
    const mouse = getMouse();
    if (!mouse.leftMouseButton) {
        s.hasClick = false;
    }

    if (mouse.scrollY !== 0) {
        if (mouse.scrollY < 0) {
            decrementViewCursors(s);
        } else {
            incrementViewCursors(s);
        }
    } 

    if (keyUpEvent) {
        const key = keyUpEvent.key;
        if (key === "Shift") {
            s.canStartSelecting = false;
            s.isSelecting = false;
            s.isShifting = false;
        } else if (key === "Control") {
            s.inCommandMode = false;
        }
    }

    if (keyDownEvent) {
        const key = keyDownEvent.key;

        if (key === "Control") {
            s.inCommandMode = true;
        }

        if (key === "Shift") {
            s.isShifting = true;
        }
    }

    // need to check up here, because they are invalidated after we edit the buffer
    let viewCursorAtStart = s.viewCursor.pos === 0;
    let viewCursorAtEnd = s.viewEndCursor.pos === s.buffer.length;

    if (keyDownEvent) {

        const initialCursor = s.cursor;

        // do our text editor command instead of the browser shortcut
        keyDownEvent.preventDefault();

        const key = keyDownEvent.key;
        const keyLower = key.toLowerCase();
        const isRepeat = keyDownEvent.repeat;
        const c = getChar(keyDownEvent);

        const lastModified = s.modifiedAt;

        if (c) {

            if (!s.inCommandMode) {
                insertAtCursor(s, c);
                s.cursor++;
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
                            const step = s.undoBuffer[s.undoBufferIdx];
                            s.undoBufferIdx--;
                            revertStep(s, step);
                        }
                    } else if (shouldRedo) {
                        shouldRedo = true;
                        if (s.undoBufferIdx < s.undoBuffer.length - 1) {
                            // increment and get in the opposite order as above
                            s.undoBufferIdx++;
                            const step = s.undoBuffer[s.undoBufferIdx];

                            applyStep(s, step);
                        }
                    }
                } else if (key === ")") {
                    // TODO: expand our selection
                } else if (key === "(") {
                    // TODO: contract our selection
                } else if (keyLower === "x") {
                    if (hasSelection(s)) {
                        const text = s.buffer.slice(s.selectionStart, s.selectionEnd + 1).join("");
                        copyToClipboard(text).then(() => {
                            deleteSelectedAndMoveCursorToStart(s);
                        });
                    }

                    // TODO: cut
                } else if (keyLower === "c") {
                    if (hasSelection(s)) {
                        const text = s.buffer.slice(s.selectionStart, s.selectionEnd + 1).join("");
                        copyToClipboard(text).then(() => {
                            clearSelection(s);
                        });
                    }
                } else if (keyLower === "v") {
                    readFromClipboard().then(clipboardText => {
                        if (hasSelection(s)) {
                            deleteSelectedAndMoveCursorToStart(s);
                            insert(s, s.cursor, clipboardText.split(""));
                        } else {
                            insert(s, s.cursor, clipboardText.split(""));
                        }
                    });
                } else if (keyLower === "a") {
                    s.selectionAnchor = 0;
                    s.selectionAnchorEnd = s.buffer.length - 1;
                    s.selectionStart = 0;
                    s.selectionEnd = s.selectionAnchorEnd;
                }
            }
        } else if (key === "Backspace") {
            if (hasSelection(s)) {
                deleteSelectedAndMoveCursorToStart(s);
            } else if (s.inCommandMode) {
                if (s.cursor > 0) {
                    s.cursor--;

                    const cursor = s.cursor;
                    moveToStartOfLastWord(s);
                    s.selectionStart = s.cursor;
                    s.selectionEnd = cursor;
                    deleteSelectedAndMoveCursorToStart(s);
                }
            } else {
                if (s.cursor > 0) {
                    s.cursor--;
                    remove(s, s.cursor, 1);
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
            s.cursor++;
        } else if (key === "Tab") {
            insertAtCursor(s, "\t");
            s.cursor++;
        } else if (key === "Shift") {
            if (!isRepeat) {
                setCanSelect(s);
            }
        } else if (key === "Escape") {
            if (hasSelection(s)) {
                clearSelection(s);
            }
        }

        const modified = lastModified !== s.modifiedAt;
        if (modified) {
            // Typing a capital letter with Shift + key shouldn't start selecting words...
            s.canStartSelecting = false;
        }

        s.cursor = clamp(s.cursor, 0, s.buffer.length);

        if (s.cursor !== initialCursor) {
            // we only want to autoscroll when we've pressed a key. If we don't do this, then we can easily end up in
            // an infinite loop, where we scroll up one line, but that line is so tall that it brings the cursor so far down the screen
            // that we then have to scroll down one line, and so on and so forth
            autoScroll(s, viewCursorAtStart, viewCursorAtEnd);
        }
    }

    // Mouse events can move the cursor too!
    if (!s.isSelecting && s.canStartSelecting && s.cursor !== s.lastSelectCursor) {
        if (s.buffer[s.lastSelectCursor] === "\n" && s.cursor < s.lastSelectCursor) {
            // dont want to start on newlines when selecting backwards. This is always an accident
            s.selectionAnchor = s.lastSelectCursor - 1;
        } else {
            s.selectionAnchor = s.lastSelectCursor;
        }
        s.lastSelectCursor = s.cursor;
        s.canStartSelecting = false;
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

function autoScroll(s: TextEditorState, viewCursorWasAtStart: boolean, viewCursorWasAtEnd: boolean) {
    if (s.viewCursor.pos <= s.cursor && s.cursor <= s.viewEndCursor.pos) {
        const distanceToStartLine = s.cursorLine - s.viewCursor.line;
        const distanceToEndLine = s.viewEndCursor.line - s.cursorLine;
        const ratio = distanceToStartLine / (distanceToStartLine + distanceToEndLine);

        if (distanceToStartLine + distanceToEndLine !== 0) {
            if (ratio < 0.25 && !viewCursorWasAtStart) {
                decrementViewCursors(s);
            } else if (ratio > 0.75 && !viewCursorWasAtEnd) {
                incrementViewCursors(s);
            }
        }
    } else {
        // NOTE: these could have been in a while loop if we wanted it to be faster.

        const scrollSpeed = Math.max(Math.abs(s.viewCursor.pos - s.cursor) / 50, 5);

        for (let i = 0; i < scrollSpeed; i++) {
            if (!viewCursorWasAtStart && s.cursor < s.viewCursor.pos) {
                decrementViewCursors(s);
            } else {
                break;
            }
        }

        for (let i = 0; i < scrollSpeed; i++) {
            if (!viewCursorWasAtEnd && s.cursor > s.viewEndCursor.pos) {
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

export function newTextEditorState(): TextEditorState {
    // fields with _ cannot be JSON-serialized
    return {
        _textAreaElement: null,
        shouldFocusTextArea: false,
        _cursorSpan: null,
        _beingControlledBy: null,
        hasFocus: false,

        currentKeyDown: "",
        modifiedAt: 0,
        cursor: 0,
        cursorLine: 0,
        renderCursor: newLineCursor(),
        viewCursor: newLineCursor(),
        viewEndCursor: newLineCursor(),
        lastSelectCursor: 0,

        selectionStart: -1,
        selectionEnd: -1,
        selectionAnchorEnd: -1,
        selectionAnchor: -1,
        hasClick: false,
        canStartSelecting: false,
        isSelecting: false,

        isShifting: false,
        inCommandMode: false,

        undoBuffer: [],
        // quite important for this to start at -1 actually.
        undoBufferIdx: -1,
        isUndoing: false,

        buffer: [],
        numLines: 0,
    }
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

    s.viewCursor.line = 0;
    s.viewCursor.pos = 0;
    s.viewEndCursor.line = 0;
    s.viewEndCursor.pos = 0;
    s.renderCursor.line = 0;
    s.renderCursor.pos = 0;
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

function setCanSelect(s: TextEditorState) {
    if (!s.canStartSelecting) {
        s.canStartSelecting = true;
        s.lastSelectCursor = s.cursor;
    }
}

// NOTE: this needs to be inside a container
// with position: relative to correctly position the fake text-area.
export function imBeginTextEditor(s: TextEditorState) {
    s._beingControlledBy = null;
    s._cursorSpan = null;
    s.renderCursor.pos = s.viewCursor.pos - 1;
    s.renderCursor.line = s.viewCursor.line;
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
        setCanSelect(s);

        s.shouldFocusTextArea = true;
    }
}

export function imEndTextEditor(s: TextEditorState) {
    // using an input to allow hooking into the browser's existing focusing mechanisms.
    const textAreaRoot = imBeginEl(newTextArea); {
        s._textAreaElement = textAreaRoot.root;

        if (imInit()) {
            setStyle("all", "unset");
            setStyle("width", "1px");
            setStyle("position", "absolute");
            setStyle("color", "transparent");
            setStyle("textShadow", "0px 0px 0px tomato"); // hahaha tomato. lmao. https://stackoverflow.com/questions/44845792/hide-caret-in-textarea
            // debugging
            // setStyle("border", "1px solid red");
        }

        if (s._cursorSpan) {
            setStyle("top", s._cursorSpan.offsetTop + "px")
            setStyle("left", s._cursorSpan.offsetLeft + "px")
            setStyle("height", s._cursorSpan.clientHeight + "px");
        }

        s.hasFocus = document.activeElement === s._textAreaElement;
        if (s._beingControlledBy && s.hasFocus) {
            s._beingControlledBy.focus();
        } else if (s.shouldFocusTextArea && s._textAreaElement) {
            s.shouldFocusTextArea = false;
            s._textAreaElement.focus();
        }


        // Handle events after we do scrolling - it is sensitive to inserts/removes
        const keyDownEvent = imOn("keydown");
        const keyUpEvent = imOn("keyup");

        if (s._beingControlledBy === null) {
            handleTextEditorEvents(s, keyDownEvent, keyUpEvent);
        }
    } imEnd();
}

function incrementViewCursors(s: TextEditorState) {
    if (incrementCursor(s, s.viewEndCursor)) {
        incrementCursor(s, s.viewCursor);
    }
}

function decrementViewCursors(s: TextEditorState) {
    if (decrementCursor(s, s.viewEndCursor)) {
        decrementCursor(s, s.viewCursor);
    }
}

export function decrementCursor(s: TextEditorState, cursor: LineCursor) {
    const newViewCursorPos = getLastNewlinePos(s, cursor.pos - 1);
    if (cursor.pos !== newViewCursorPos) {
        cursor.pos = newViewCursorPos;
        cursor.line--;
        return true;
    }
    return false;
}

export function incrementCursor(s: TextEditorState, cursor: LineCursor): boolean {
    const newViewCursorPos = getNextNewlinePos(s, cursor.pos + 1);
    if (cursor.pos !== newViewCursorPos) {
        cursor.pos = newViewCursorPos;
        cursor.line++;
        return true;
    }
    return false;
}

// You'll need to do this to get scrolling behaviour.
// You can do it multiple times to extend the view as needed.
export function textEditorMarkViewEnd(s: TextEditorState) {
    s.viewEndCursor.pos = s.renderCursor.pos;
    s.viewEndCursor.line = s.renderCursor.line;
}

export function textEditorHasChars(s: TextEditorState): boolean {
    return s.renderCursor.pos < s.buffer.length;
}

export function textEditorNextChar(s: TextEditorState): string {
    if (s.renderCursor.pos < s.buffer.length) {
        s.renderCursor.pos++;
        if (s.buffer[s.renderCursor.pos] === "\n") {
            s.renderCursor.line++;
        }
    }

    if (s.renderCursor.pos === s.cursor) {
        s.cursorLine = s.renderCursor.line;
    }

    if (s.renderCursor.pos < s.buffer.length) {
        return s.buffer[s.renderCursor.pos];
    }

    return '\n';
}

export function textEditorCursorIsSelected(s: TextEditorState, pos: number) {
    return s.selectionStart <= pos && pos <= s.selectionEnd;
}

// There's a lot of user-code I used to have in here that is now only findable via git history:
// - finder code
// - line number code
// - token rendering code




// TODO: use this insert and remove implementation instead

// function getCodePoints(str: string): string[] {
//     const chars: string[] = [];
//     for (const c of str) {
//         chars.push(c);
//     }
//     return chars;
// }
//
// function getLine(buff: string[][], line: number) {
//     if (line < buff.length || line >= buff.length) return;
//     return buff[line];
// }
//
// function getLineChar(lineChars: string[], col: number) {
//     if (col < lineChars.length || col >= lineChars.length) return;
//     return lineChars[col];
// }
//
// function insert(s: TextEditorState, line: number, col: number, chars: string) {
//     if (chars.length === 0) {
//         return;
//     }
//
//     // NOTE: this is never undone
//     s.modifiedAt = Date.now();
//
//     const buff = s.buffer;
//     let lineChars = getLine(buff, line);
//     if (!lineChars) {
//         return;
//     }
//
//     const char = getLineChar(lineChars, col);
//     if (!char) {
//         return;
//     }
//
//     const startLine = line;
//     const startCol = col;
//     let endLine = startLine;
//     let endCol = startCol;
//
//     const codePoints = getCodePoints(chars);
//     const charsToInsert = [];
//     for (let i = 0; i < codePoints.length; i++) {
//         if (codePoints[i] !== "\n") {
//             charsToInsert.push(codePoints[i]);
//             endCol++;
//         } else {
//             if (col !== lineChars.length) {
//                 const slice = lineChars.slice(col, lineChars.length);
//                 buff.splice(line, 0, slice);
//                 lineChars.length = col;
//             }
//             lineChars.splice(col, 0, ...charsToInsert);
//
//             lineChars = [];
//             endCol = 0;
//             endLine++;
//             buff.splice(line, 0, lineChars);
//             charsToInsert.length = 0;
//         }
//     }
//
//     // flush remaining chars.
//     lineChars.splice(col, 0, ...charsToInsert);
//     pushToUndoBuffer(s, {
//         time: s.modifiedAt,
//         insert: true,
//         startLine, startCol,
//         endLine, endCol,
//         codePoints
//     });
// }
//
// // This was hard to implement ...
// function remove(
//     s: TextEditorState,
//     startLine: number, startCol: number,
//     endLine: number, endCol: number,
// ) {
//     if (startLine === endLine && startCol === endCol) {
//         return;
//     }
//
//     const buff = s.buffer;
//     const startLineChars = getLine(buff, startLine);
//     if (!startLineChars) {
//         throw new Error("Invalid startLine");
//     }
//     if (startCol < 0 || startCol > startLineChars.length) {
//         throw new Error("Invalid startCol");
//     }
//
//     const endLineChars = getLine(buff, endLine);
//     if (!endLineChars) {
//         throw new Error("Invalid endLine");
//     }
//     if (endCol < 0 || endCol > endLineChars.length) {
//         throw new Error("Invalid endCol");
//     }
//
//     const removedChars: string[] = [];
//
//     // TODO: debug
//     if (startLineChars === endLineChars && endCol < endLineChars.length) {
//         // All removals occur within a single line
//         const numToRemove = endCol - startCol + 1;
//         const spliced = startLineChars.splice(startCol, numToRemove);
//         for (const c of spliced) {
//             removedChars.push(c);
//         }
//     } else {
//         // Removals occuring across multiple lines.
//         let spliced = startLineChars.splice(startCol, startLineChars.length - startCol - 1);
//         for (const c of spliced) {
//             removedChars.push(c);
//         }
//         removedChars.push("\n");
//
//         const linesToRemove = endLine - startLine;
//         const splicedLines = buff.splice(startLine + 1, linesToRemove);
//         for (let i = 0; i < splicedLines.length - 1; i++) {
//             // ignore the last line, we deal with it later
//             const spliced = splicedLines[i];
//             for (const c of spliced) {
//                 removedChars.push(c);
//             }
//             removedChars.push("\n");
//         }
//
//         // remove from zer to end col. By this point, endLineChars has already been removed from buff.
//         spliced = endLineChars.splice(0, endCol);
//         for (const c of spliced) {
//             removedChars.push(c);
//         }
//
//         // we actually need to concat endLineChars onto the end of startLineChars.
//         startLineChars.push(...endLineChars);
//     }
//
//     pushToUndoBuffer(s, {
//         time: s.modifiedAt,
//         startLine,
//         startCol,
//         endLine,
//         endCol,
//         insert: false,
//         codePoints: removedChars
//     });
// }
//
