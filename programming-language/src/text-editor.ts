import { ALIGN_CENTER, ALIGN_STRETCH, CODE, COL, FLEX, GAP, imBeginLayout, JUSTIFY_CENTER, PRE, RELATIVE, ROW, imTextSpan } from "./layout.ts";
import "./styling.ts";
import { cnApp, cssVars } from "./styling.ts";
import { copyToClipboard, readFromClipboard } from "./utils/clipboard.ts";

import { elementHasMouseClick, elementHasMouseDown, elementHasMouseHover, getCurrentRoot, getHoveredElement, getMouse, imBeginDiv, imBeginEl, imBeginList, imBeginMemo, imBeginMemoComputation, imBeginSpan, imEnd, imEndList, imEndMemo, imInit, imOn, imSb, imState, nextListRoot, setClass, setInnerText, setStyle } from './utils/im-dom-utils.ts';
import { clamp, max, min } from "./utils/math-utils.ts";
import { isWhitespace } from "./utils/text-utils.ts";

export const UNANIMOUSLY_DECIDED_TAB_SIZE = 4;


function hasSelection(s: TextEditorState) {
    return s.selectionStart !== -1 || s.selectionEnd !== -1;
}
function deleteSelectedAndMoveCursorToStart(s: TextEditorState) {
    if (!hasSelection(s)) {
        return;
    }

    remove(s, s.selectionStart, s.selectionEnd - s.selectionStart + 1);
    s.cursor = s.selectionStart;
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
    if (idx>= 0 && idx < s.buffer.length) {
        return s.buffer[s.cursor + offset];
    }

    return " ";
}

function eof(s: TextEditorState) {
    return s.buffer.length === s.cursor;
}

function moveToLastNewline(s: TextEditorState): number {
    let num = 0;
    while (s.cursor > 0 && currentChar(s) !== "\n") {
        s.cursor--;
        num++;
    }

    return num;
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

    s.cursor = cursor;

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
        s.cursor = step.pos + step.chars.length;
    } else {
        remove(s, step.pos, step.chars.length);
        s.cursor = step.pos;
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
    _cursorSpan: HTMLSpanElement | null;
    // Automatically shifts focus to this element if this one were focused for some reason.
    _beingControlledBy: Focusable | null;
    undoBuffer: TextEdit[];
    undoBufferIdx: number;
    isUndoing: boolean;

    buffer: string[];
    numLines: number;
    modifiedAt: number;
    cursor: number;
    cursorLine: number;
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
    wasFinding: boolean;
    isFinding: boolean;
    finderTextEditorState: TextEditorState | null;
    allFindResults: Range[];
    currentFindResultIdx: number;
    cursorBeforeFind: number;
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
    canFind: boolean,
    keyDownEvent: HTMLElementEventMap["keydown"] | null,
    keyUpEvent: HTMLElementEventMap["keyup"] | null,
) {
    s.wasFinding = s.isFinding;

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

    // We need to handle infinitely recursive find ops.
    // ok, we don't 'need' to, but I did want to see if I could do it. Apparently, I can. 
    if (s.finderTextEditorState && s.wasFinding && s.isFinding) {
        let handled = false;

        if (!s.finderTextEditorState.isFinding) {
            if (keyDownEvent) {
                const key = keyDownEvent.key;
                if (key === "Enter") {
                    handled = true;

                    if (s.isShifting) {
                        s.canStartSelecting = false;
                        if (s.currentFindResultIdx > 0) {
                            s.currentFindResultIdx--;
                        }
                    } else {
                        if (s.currentFindResultIdx < s.allFindResults.length - 1) {
                            s.currentFindResultIdx++;
                        }
                    }

                    if (s.currentFindResultIdx < s.allFindResults.length) {
                        s.cursor = s.allFindResults[s.currentFindResultIdx].start;
                    }
                } else if (key === "Escape") {
                    handled = true;

                    if (s.finderTextEditorState) {
                        s.isFinding = false;
                        resetTextEditorState(s.finderTextEditorState);
                    }
                }
            }
        }

        if (!handled) {
            handleTextEditorEvents(s.finderTextEditorState, canFind, keyDownEvent, keyUpEvent);
        }
        return;
    }

    if (keyDownEvent) {

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
                if (keyLower === "f") {
                    if (canFind) {
                        s.isFinding = true;
                    }
                } else if (keyLower === "z" || keyLower === "y") {
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
                const cursor = s.cursor;
                moveToStartOfLastWord(s);
                s.selectionStart = s.cursor;
                s.selectionEnd = cursor;
                deleteSelectedAndMoveCursorToStart(s);
            } else {
                if (s.cursor > 0) {
                    s.cursor--;
                }

                remove(s, s.cursor, 1);
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
                s.cursor = s.buffer.length - 1;
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


export function newTextEditorState(): TextEditorState {
    // fields with _ cannot be JSON-serialized
    return {
        _textAreaElement: null,
        _cursorSpan: null,
        _beingControlledBy: null,
        hasFocus: false,

        currentKeyDown: "",
        modifiedAt: 0,
        cursor: 0,
        cursorLine: 0,
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

        isFinding: false,
        wasFinding: false,
        finderTextEditorState: null,
        allFindResults: [],
        currentFindResultIdx: 0,
        cursorBeforeFind: -1,

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

function lPad(str: string, num: number): string {
    if (str.length > num) {
        return str;
    }

    return " ".repeat(num - str.length) + str;
}

function isEqual(buffer: string[], query: string[], pos: number): boolean {
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

function resetTextEditorState(s: TextEditorState) {
    s.buffer.length = 0;
    s.undoBuffer.length = 0;
    s.undoBufferIdx = -1;
    s.cursor = 0;
    s.modifiedAt = 0;
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

// This ting is no neovim, and it chokes on any reasonably large files.
// Still, it lets us add custom inline hints and annotations on a per-line basis.
// Also, we actually know where the cursor is, and can query the cursor's on-screen position, 
// making stuff like autocomplete easier to implement.
// TODO: mouse selection support.
export function imTextEditor(s: TextEditorState, {
    isSingleLine = false,
    canFind = true,
    annotations,
    inlineHints,
    figures,
}: {
    isSingleLine?: boolean;
    canFind?: boolean;

    // Currently can't think of a way to do this without callbacks. sad.
        
    // rendered at the end of a particular line
    inlineHints?: (line: number) => void;   
    // rendered just below a line, still next to the line number
    annotations?: (line: number) => void;
    // rendered below the line and the line number
    figures?: (line: number) => void;   
}) {

    const mouse = getMouse();
    if (!mouse.leftMouseButton) {
        s.hasClick = false;
    }

    // Only want to initialize this state if we've actually started
    // finding.
    imBeginList();
    if (nextListRoot() && s.isFinding && s.finderTextEditorState === null) {
        s.finderTextEditorState = imState(newTextEditorState);
    } imEndList();

    if (imBeginMemoComputation().val(s.isFinding).changed()) {
        if (s.isFinding && s.finderTextEditorState) {
            s.cursorBeforeFind = s.cursor;
            resetTextEditorState(s.finderTextEditorState);
            s.finderTextEditorState._beingControlledBy = s._textAreaElement;
        }
    } imEndMemo();

    let textArea: HTMLTextAreaElement | undefined;
    let shouldFocusTextArea = false;
    let findResultIdx = 0;

    if (imBeginMemoComputation()
        .val(s.finderTextEditorState?.modifiedAt)
        .changed()
    ) {
        let numResults = 0;
        const queryBuffer = s.finderTextEditorState?.buffer;
        if (queryBuffer && queryBuffer.length > 0) {
            for (let i = 0; i < s.buffer.length; i++) {
                if (isEqual(s.buffer, queryBuffer, i)) {
                    if (numResults === s.allFindResults.length) {
                        s.allFindResults.push({ start: 0, end: 0 });
                    }

                    s.allFindResults[numResults].start = i;
                    s.allFindResults[numResults].end = i + queryBuffer.length - 1;   // inclusive range
                    numResults++;
                }
            }
        }
        // we do a little object pooling
        s.allFindResults.length = numResults;
        if (numResults > 0) {
            // move cursor to the result that is closest to it

            let minIdx = 0;
            let minDistance = Math.abs(s.allFindResults[0].start - s.cursorBeforeFind);
            for (let i = 1; i < s.allFindResults.length; i++) {
                const res = s.allFindResults[i];
                const dist = Math.abs(res.start - s.cursorBeforeFind);
                if (dist < minDistance) {
                    minDistance = dist;
                    minIdx = i;
                }
            }

            s.currentFindResultIdx = minIdx;
            s.cursor = s.allFindResults[minIdx].start;
        }
    } imEndMemo();

    let keyDownEvent: HTMLElementEventMap["keydown"] | null = null;
    let keyUpEvent: HTMLElementEventMap["keyup"] | null = null;
    let wasFinding = s.isFinding;

    imBeginLayout(COL | FLEX); {
        imBeginLayout(CODE | RELATIVE | FLEX); {
            let rerenderedTextEditor = false;
            let renderedCursor = false;
            let currentSpan: HTMLSpanElement | undefined;

            let i = 0;
            let lineIdx = 0;

            const numDigits = Math.ceil(Math.log10(s.numLines));

            const mouse = getMouse();
            if (
                imBeginMemo()
                    .objectVals(s)
                    .val(getHoveredElement())
                    .val(s.finderTextEditorState?.modifiedAt)
                    .objectVals(mouse)
                    .changed()
            ) {
                rerenderedTextEditor = true;

                // Render lines
                imBeginList();
                while (i <= s.buffer.length) {
                    nextListRoot();

                    let lineHasCursor = false;

                    imBeginLayout(CODE | PRE | ROW); {
                        if (imInit()) {
                            setStyle("alignItems", "flex-start");
                        }

                        imBeginList();
                        if (nextListRoot() && !isSingleLine) {
                            const lineSb = imSb();
                            if (imBeginMemoComputation().val(lineIdx).val(numDigits).changed()) {
                                lineSb.clear();
                                if (!isSingleLine) {
                                    lineSb
                                        .s(lPad("" + lineIdx, numDigits))
                                        .s(" ");
                                }
                            } imEndMemo();

                            const lineStr = lineSb.toString();
                            imBeginLayout(ROW | ALIGN_CENTER | JUSTIFY_CENTER); {
                                setInnerText(lineStr);
                            } imEnd();

                            imBeginDiv(); {
                                if (imInit()) {
                                    setStyle("paddingLeft", "5px");
                                    setStyle("paddingRight", "5px");
                                }

                                imBeginDiv(); {
                                    if (imInit()) {
                                        setStyle("width", "2px");
                                        setStyle("height", "100%");
                                        setStyle("backgroundColor", cssVars.fg);
                                    }
                                } imEnd();
                            } imEnd();
                        }
                        imEndList();

                        imBeginLayout(FLEX); {
                            if (imInit()) {
                                setStyle("cursor", "text");
                            }

                            imBeginLayout(); {
                                let tokenIdx = 0;

                                // Render individual tokens
                                imBeginList();
                                const ROOT_INLINE_HINT = 1;
                                while (i <= s.buffer.length) {
                                    const actualC = (i < s.buffer.length) ? s.buffer[i] : " ";
                                    const ws = isWhitespace(actualC);
                                    const isTab = actualC === "\t";
                                    const c = ws ? (isTab ? "0".repeat(UNANIMOUSLY_DECIDED_TAB_SIZE) : ".") : actualC;

                                    nextListRoot();

                                    const root = imBeginSpan(); {
                                        if (imInit()) {
                                            setStyle("display", "inline-block");
                                        }

                                        let isEscapeSequence = false;
                                        if (actualC == "\n" && isSingleLine) {
                                            root.text("\\n");
                                            isEscapeSequence = true;
                                        } else {
                                            root.text(c);
                                        }

                                        if (elementHasMouseClick()) {
                                            s.hasClick = true;
                                        }

                                        if (s.hasClick && elementHasMouseDown(false)) {
                                            // move cursor to current token
                                            s.cursor = i;
                                            setCanSelect(s);
                                            shouldFocusTextArea = true;

                                            if (elementHasMouseClick()) {
                                                // single click, clear selection
                                                clearSelection(s);
                                            }
                                        }

                                        const isSelected = s.selectionStart <= i && i <= s.selectionEnd;
                                        const isCursor = s.hasFocus && i === s.cursor;
                                        if (isCursor) {
                                            s._cursorSpan = root.root;
                                            lineHasCursor = true;
                                        } 
                                        if (imBeginMemoComputation().val(isSelected).val(isCursor).changed()) {
                                            setClass(cnApp.inverted, isSelected || isCursor);
                                        } imEndMemo();

                                        // Make sure we're always looking at the latest find result
                                        let isAFindResultToken = false;
                                        if (findResultIdx < s.allFindResults.length) {
                                            let result = s.allFindResults[findResultIdx];
                                            while (result.end < i) {
                                                findResultIdx++;
                                                if (findResultIdx < s.allFindResults.length) {
                                                    result = s.allFindResults[findResultIdx];
                                                } else {
                                                    break;
                                                }
                                            }

                                            if (result.start <= i && i <= result.end) {
                                                isAFindResultToken = true;
                                            }
                                        }

                                        if (imBeginMemoComputation()
                                            .val(ws)
                                            .val(isEscapeSequence)
                                            .changed()
                                        ) {
                                            const color = isEscapeSequence ? "#FFA" :
                                                ws ? "#0000" :
                                                    "";
                                            setStyle("color", color);
                                        } imEndMemo();

                                        if (imBeginMemoComputation()
                                            .val(isAFindResultToken)
                                            .val(isCursor)
                                            .changed()
                                        ) {
                                            setStyle("backgroundColor", (!isCursor && isAFindResultToken) ? "#00F" : "");
                                            s.cursorLine = lineIdx;
                                        } imEndMemo();
                                    } imEnd();

                                    if (!renderedCursor && s.cursor === i) {
                                        renderedCursor = true;
                                        currentSpan = root.root;
                                    }

                                    i++;

                                    let isEol = false;
                                    if ((actualC === "\n" || i === s.buffer.length + 1) && !isSingleLine) {
                                        lineIdx++;
                                        tokenIdx = 0;
                                        isEol = true;
                                    }

                                    if (isEol) {
                                        nextListRoot(ROOT_INLINE_HINT);
                                        inlineHints?.(lineIdx - 1);
                                        break;
                                    }
                                }
                                imEndList();

                                if (elementHasMouseClick()) {
                                    s.hasClick = true;
                                }
                                if (s.hasClick && elementHasMouseDown(false)) {
                                    // Don't defer event for the line.

                                    // move cursor to current line
                                    s.cursor = i - 1;
                                    shouldFocusTextArea = true;
                                    setCanSelect(s);

                                    if (elementHasMouseClick()) {
                                        // single click, clear selection
                                        clearSelection(s);
                                    }
                                }
                            } imEnd();

                            imBeginLayout(); {
                                imBeginList();
                                nextListRoot();
                                annotations?.(lineIdx - 1);
                                imEndList();
                            } imEnd();
                        } imEnd();
                    } imEnd();

                    // Annocations section
                    {
                        const hSeperator = () => {
                            imBeginDiv(); {
                                if (imInit()) {
                                    setStyle("height", "2px");
                                    setStyle("backgroundColor", cssVars.fg)
                                }
                            } imEnd();
                        }

                        // Just put the find modal directly under the cursor, so that it's always in view.
                        imBeginList();
                        if (nextListRoot() && lineHasCursor && s.isFinding && s.finderTextEditorState) {
                            hSeperator();

                            imBeginLayout(COL); {
                                imBeginLayout(ROW | GAP); {
                                    // NOTE: I am now thinking that this is better implemented at the user level...

                                    imTextSpan("Find: ");
                                    imTextEditor(s.finderTextEditorState, {
                                        isSingleLine: true,
                                        canFind: false,
                                    });
                                } imEnd();
                            } imEnd();
                        } imEndList();

                        const r = getCurrentRoot();
                        const idx = r.domAppender.idx;
                        imBeginList();
                        if (nextListRoot() && figures) {
                            figures(lineIdx - 1);
                        }
                        // Only draw a seprarator if figures didn't render any DOM elements
                        if (nextListRoot() && figures && idx !== r.domAppender.idx) {
                            hSeperator();
                        }
                        imEndList();
                    }
                }
                imEndList();

                s.numLines = lineIdx;
            } imEndMemo();

            // using an input to allow hooking into the browser's existing focusing mechanisms.
            const textAreaRoot = imBeginEl(newTextArea); {
                textArea = textAreaRoot.root;
                s._textAreaElement = textArea;

                s.hasFocus = document.activeElement === textArea;
                if (s._beingControlledBy && s.hasFocus) {
                    s._beingControlledBy.focus();
                }

                if (imInit()) {
                    setStyle("all", "unset");
                    setStyle("width", "10px");
                    setStyle("height", "1px");
                    setStyle("position", "absolute");
                    setStyle("color", "transparent");
                    setStyle("textShadow", "0px 0px 0px tomato"); // hahaha tomato. lmao. https://stackoverflow.com/questions/44845792/hide-caret-in-textarea
                }

                if (
                    imBeginMemoComputation().val(currentSpan).changed()
                    && rerenderedTextEditor
                    && currentSpan
                ) {
                    setStyle("top", currentSpan.offsetTop + "px")
                    setStyle("left", currentSpan.offsetLeft + "px")
                } imEndMemo();

                // Handle events
                keyDownEvent = imOn("keydown");
                keyUpEvent = imOn("keyup");

                if (s._beingControlledBy === null) {
                    handleTextEditorEvents(s, canFind, keyDownEvent, keyUpEvent);
                }
            } imEnd();

            if (elementHasMouseClick() || shouldFocusTextArea) {
                textArea.focus();
            }
        } imEnd();

        imBeginLayout(); {
            imTextSpan(s.buffer.length + " chars | " + s.undoBuffer.length + " in undo buffer ");
        } imEnd();
    } imEnd();
}
