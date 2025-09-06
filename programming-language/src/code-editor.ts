import * as tb from "src/utils/text-edit-buffer";
import {
    defaultTextEditorKeyboardEventHandler,
    handleTextEditorClickEventForChar,
    handleTextEditorMouseScrollEvent,
    imBeginTextEditor,
    imEndTextEditor,
    loadText,
    newTextEditorState,
    textEditorCursorIsSelected,
    textEditorGetNextChar,
    textEditorHasChars,
    textEditorHasSelection,
    textEditorInsertInternal,
    textEditorMoveToEndOfLine,
    textEditorMoveToStartOfLine,
    textEditorRemoveInternal,
    TextEditorState
} from 'src/utils/text-editor';
import { imCode, imNotCode } from "./app-styling";
import { imCodeInputUIs, imProgramOutputs } from './code-output';
import {
    BLOCK,
    COL,
    imAbsolute,
    imAlign,
    imBg,
    imFlex,
    imFlexWrap,
    imJustify,
    imLayout,
    imLayoutEnd,
    imPadding,
    imPre,
    imRelative,
    imSize,
    INLINE,
    INLINE_BLOCK,
    NA,
    PERCENT,
    PX,
    ROW,
    START
} from "./components/core/layout";
import { cn } from "./components/core/stylesheets";
import { imScrollContainerBegin, newScrollContainer } from "./components/scroll-container";
import {
    programResultTypeStringFromType
} from './program-interpreter';
import { BuiltinFunction, getBuiltinFunctionsMap } from "./program-interpreter-builtins";
import {
    DiagnosticInfo,
    getAstNodeForTextPos,
    parseIdentifierBackwardsFromPoint,
    ProgramExpression,
    T_BLOCK,
    T_FN,
    T_IDENTIFIER,
    T_LIST_LITERAL,
    T_NUMBER_LITERAL,
    T_STRING_LITERAL,
    T_VECTOR_LITERAL
} from './program-parser';
import { GlobalContext, mutateState } from './state';
import "./styling";
import { cnApp, cssVars } from './styling';
import { assert } from './utils/assert';
import {
    ImCache,
    imFor,
    imForEnd,
    imGet,
    imIf,
    imIfEnd,
    imKeyedBegin,
    imKeyedEnd,
    imMemo,
    imSet,
    imState,
    inlineTypeId,
    isFirstishRender
} from "./utils/im-core";
import {
    EL_SPAN,
    elSetClass,
    elSetStyle,
    imEl,
    imElEnd,
    imStr
} from "./utils/im-dom";
import { max } from './utils/math-utils';
import { isWhitespace } from './utils/text-utils';


const UNANIMOUSLY_DECIDED_TAB_SIZE = 4;

// Do not leak this abstraction out of this file...
// Other subsystems should not care about 'text editor cursor tb editor' or watever.
type TextEditorCursor = tb.Iterator;

type CodeEditorState = {
    lastMaxLine: number;
    isFinding: boolean;
    allFindResults: Range[];
    currentFindResultIdx: number;
    cursorBeforeFind: TextEditorCursor | null;
}

export type Range = {
    start: TextEditorCursor;
    end:   TextEditorCursor;
}


function newCodeEditorState(): CodeEditorState {
    return  {
        lastMaxLine: 0,
        isFinding: false,
        allFindResults: [],
        currentFindResultIdx: -1,
        cursorBeforeFind: null,
    };
}


function lPad(str: string, num: number): string {
    if (str.length > num) {
        return str;
    }

    return "0".repeat(num - str.length) + str;
}

function imDiagnostics(c: ImCache, diagnostics: DiagnosticInfo[], col: string, line: number) {
    imFor(c); for (const err of diagnostics) {
        if (err.pos.line !== line) {
            continue
        }

        imLayout(c, BLOCK); {
            // transparent span
            imLayout(c, INLINE); {
                if (isFirstishRender(c)) {
                    elSetStyle(c, "color", "transparent");
                }

                const numWhitespaces = max(0, err.pos.col + err.pos.tabs * UNANIMOUSLY_DECIDED_TAB_SIZE);
                imStr(c, "0".repeat(numWhitespaces));
            } imLayoutEnd(c);

            imLayout(c, INLINE); {
                if (isFirstishRender(c)) {
                    elSetStyle(c, "color", col);
                }

                imStr(c, "^ ");
                imStr(c, err.problem);
            } imLayoutEnd(c);
        } imLayoutEnd(c);
    } imForEnd(c);
}

function imAutocomplete(c: ImCache, lastIdentifier: string) {
    // we do a little autocomplete

    // autocomplete
    // right now you can't interact with it - it is more so that I actually remember all the crap I've put into here

    const lastIdentifierChanged = imMemo(c, lastIdentifier)

    let results: BuiltinFunction[] | undefined; results = imGet(c, inlineTypeId(Array));
    if (!results || lastIdentifierChanged) {
        results = imSet(c, []);

        if (lastIdentifier.length > 0) {
            const funcs = getBuiltinFunctionsMap();
            for (const [k, v] of funcs) {
                if (!filterString(k, lastIdentifier)) {
                    continue;
                }
                results.push(v);
            }
        }
    }

    if (imIf(c) && results.length > 0) {
        // TODO: when we do the AST editor, this will completely change, or be ripped out.

        imLayout(c, BLOCK); imCode(c, 0); imPre(c); imCode(c); imBg(c, "transparent"); {
            if (isFirstishRender(c)) {
                elSetClass(c, cn.pointerEventsNone);
            }

            elSetStyle(c, "border", "1px solid black");

            let i = 0;
            imFor(c); for (const v of results) {
                i++;
                if (i > 5) {
                    break;
                }

                imLayout(c, BLOCK); imCode(c); {
                    elSetStyle(c, "border", "1px solid black");
                    imStr(c, v.name);
                    imStr(c, "(");
                    imFor(c); for (let i = 0; i < v.args.length; i++) {
                        const arg = v.args[i];
                        imStr(c, arg.name);

                        if (imIf(c) && arg.optional) {
                            imStr(c, "?");
                        } imIfEnd(c);

                        imStr(c, ":");

                        let type;
                        if (arg.type.length === 0) {
                            type = "any"
                        } else {
                            type = arg.type.map(programResultTypeStringFromType)
                                .join("|");
                        }
                        imStr(c, type);

                        if (imIf(c) && i < v.args.length - 1) {
                            imStr(c, ", ");
                        } imIfEnd(c);
                    } imForEnd(c);
                    imStr(c, ")");
                } imLayoutEnd(c);
            } imForEnd(c);
        } imLayoutEnd(c);
    } imIfEnd(c);
}

function isPartiallyOffscreen(rect: DOMRect) {
    return (
        // rect.x < 0 || rect.x + rect.width > window.innerWidth ||
        rect.y < 0 || rect.y + rect.height > window.innerHeight
    );
}


function getStringRepr(bufferChar: string, isWhitespace: boolean) {
    const isTab = bufferChar === "\t";
    let c;
    if (isWhitespace) {
        if (isTab) {
            c = "0".repeat(UNANIMOUSLY_DECIDED_TAB_SIZE);
        } else {
            c = "0";
        }
    } else {
        c = bufferChar;
    }

    return c;
}


type SimpleTextEditorState = { 
    editorState: TextEditorState;
    container: HTMLElement | null;
};

function newSimpleTextEditorState(): SimpleTextEditorState {
    return {
        editorState: newTextEditorState(),
        container: null,
    };
}

function imSimpleTextInput(
    c: ImCache,
    s: SimpleTextEditorState,
    ctrlHeld: boolean,
    shiftHeld: boolean
) {
    imBeginTextEditor(c, s.editorState, s.container, ctrlHeld, shiftHeld);
}

function imEndSimpleTextInput(
    c: ImCache,
    s: SimpleTextEditorState
) {
    imEndTextEditor(c, s.editorState);
}

// A simpler text editor that can be used for simpler text inputs
function imSimpleTextInputBody(c: ImCache, s: SimpleTextEditorState) {
    imLayout(c, COL); {
        imFor(c); while (textEditorHasChars(s.editorState)) {
            imLayout(c, ROW); {
                imFor(c); while (textEditorHasChars(s.editorState)) {
                    const textSpan = imEl(c, EL_SPAN).root; {
                        const actualC = textEditorGetNextChar(s.editorState);
                        const ws = isWhitespace(actualC);
                        const char = getStringRepr(actualC, ws);

                        if (textSpan.innerText !== char) textSpan.innerText = char;

                        handleTextEditorClickEventForChar(c, s.editorState, s.editorState._renderCursor);

                        const isSelected = s.editorState.hasFocus && 
                            textEditorCursorIsSelected( s.editorState, s.editorState._renderCursor);

                        const isCursor = s.editorState.hasFocus && 
                            tb.itEquals(s.editorState._renderCursor, s.editorState.cursor)

                        if (isCursor) {
                            s.editorState._cursorSpan = textSpan;
                        }

                        const isSelectedChanged = imMemo(c, isSelected);
                        const isCursorChanged   = imMemo(c, isCursor);
                        if (isSelectedChanged || isCursorChanged) {
                            elSetClass(c, cn.inverted, isSelected || isCursor);
                        } 

                        const wsChanged = imMemo(c, ws);
                        if (wsChanged) {
                            let color = "";
                            if (ws) {
                                color = "#0000";
                            }

                            elSetStyle(c, "color", color);
                        } 
                    } imElEnd(c, EL_SPAN);
                } imForEnd(c);
            } imLayoutEnd(c);
        } imForEnd(c);
    } imLayoutEnd(c);
}

// toggles '//' on/off for the selected lines
// TODO: fix edge cases that arise due to blank lines
function toggleSelectionLineComment(targetEditor: TextEditorState) {
    let deletedComments = false;

    tb.beginEditing(targetEditor.buffer); {
        const [start, end] = getCurentRangeCursors(targetEditor);

        const it = tb.itNewTempFrom(start);
        const temp = tb.itNewTempFrom(start);
        const temp2 = tb.itNewTempFrom(start);

        while (!tb.itEquals(it, end)) {
            if (isStartOfLine(it, temp) && tb.itQuery(it, "//")) {
                tb.itCopy(temp2, it, "//".length);
                textEditorRemoveInternal(targetEditor, it, temp2);
                deletedComments = true;
            }

            tb.iterate(it);
        }
    } tb.endEditing(targetEditor.buffer);

    if (deletedComments) {
        return;
    }

    tb.beginEditing(targetEditor.buffer); {
        const [start, end] = getCurentRangeCursors(targetEditor);

        const it = tb.itNewTempFrom(start);
        const temp = tb.itNewTempFrom(start);

        while (!tb.itEquals(it, end)) {
            if (isStartOfLine(it, temp)) {
                textEditorInsertInternal(targetEditor, it, "//");
            } 

            tb.iterate(it);
        }
    } tb.endEditing(targetEditor.buffer);
}

function getCurentRangeCursors(s: TextEditorState) {
    let start, end;
    if (textEditorHasSelection(s)) {
        start = tb.itNewTempFrom(s.selectionStart);
        end = tb.itNewTempFrom(s.selectionEnd);
    } else {
        start = tb.itNewTempFrom(s.cursor);
        end = tb.itNewTempFrom(s.cursor);
    }

    textEditorMoveToStartOfLine(start);
    textEditorMoveToEndOfLine(end);

    return [start, end] as const;
}

function indentSelection(targetEditor: TextEditorState) {
    tb.beginEditing(targetEditor.buffer); {
        const [start, end] = getCurentRangeCursors(targetEditor);

        const it = tb.itNewTempFrom(start);
        const temp = tb.itNewTempFrom(start);

        while (!tb.itEquals(it, end)) {
            if (isStartOfLine(it, temp)) {
                textEditorInsertInternal(targetEditor, it, "\t");
            } 

            tb.iterate(it);
        }
    } tb.endEditing(targetEditor.buffer);
}

function deIndentSelection(targetEditor: TextEditorState) {
    tb.beginEditing(targetEditor.buffer); {
        const [start, end] = getCurentRangeCursors(targetEditor);

        const it = tb.itNewTempFrom(start);
        const temp = tb.itNewTempFrom(start);
        const temp2 = tb.itNewTempFrom(start);

        while (!tb.itEquals(it, end)) {
            if (isStartOfLine(it, temp) && tb.itGet(it) === "\t") {
                tb.itCopy(temp2, it, 1);
                textEditorRemoveInternal(targetEditor, it, temp2);
            }

            tb.iterate(it);
        }
    } tb.endEditing(targetEditor.buffer);

}

function isStartOfLine(it: tb.Iterator, temp: tb.Iterator): boolean {
    return tb.itIsZero(it) || tb.itGetRelative(it, temp, -1) === "\n"
}


function handleCodeEditorEvents(s: CodeEditorState, targetEditor: TextEditorState, eventSource: TextEditorState) {
    let handled = false;

    if (s.isFinding) {
        if (eventSource._keyDownEvent) {
            if (eventSource.keyLower === "enter") {
                if (eventSource.isShifting) {
                    s.currentFindResultIdx--;
                    if (s.currentFindResultIdx < 0) {
                        s.currentFindResultIdx = s.allFindResults.length - 1;
                    }
                } else {
                    s.currentFindResultIdx++;
                    if (s.currentFindResultIdx >= s.allFindResults.length) {
                        s.currentFindResultIdx = 0;
                    }
                }

                handled = true;

                if (s.currentFindResultIdx >= 0 && s.currentFindResultIdx < s.allFindResults.length) {
                    tb.itCopy(targetEditor.cursor, s.allFindResults[s.currentFindResultIdx].start);
                }
            }
        }
    } else {
        assert(eventSource === targetEditor);

        if (eventSource._keyDownEvent) {
            if (eventSource.inCommandMode) {
                if (eventSource.keyLower === "\/") {
                    handled = true;
                    toggleSelectionLineComment(targetEditor);
                } 
            }

            if (!handled && eventSource.keyLower === "tab") {
                if (textEditorHasSelection(targetEditor)) {
                    handled = true;

                    eventSource._keyDownEvent.preventDefault();
                    if (eventSource.isShifting) {
                        deIndentSelection(targetEditor);
                    } else {
                        indentSelection(targetEditor);
                    }
                }
            }
        }
    }

    if (handled) {
        eventSource._keyDownEvent = null;
    }

    defaultTextEditorKeyboardEventHandler(eventSource);

    if (!eventSource._keyDownEvent) {
        return;
    }

    if (s.isFinding) {
        // If we have something selected in the finder, I want escape to 
        // be able to clear it, and only if there is no selection, I want to handle it
        // the next time around. So we're just processing default events first.

        // However, I want to intercept all the Enter and Shift+Enter events, so 
        // they aren't here with these other events.

        if (
            (eventSource.inCommandMode && eventSource.keyLower === "f") ||
            (eventSource.keyLower === "escape")
        ) {
            s.isFinding = false;
        }
    } else {
        if (eventSource.inCommandMode && eventSource.keyLower === "f") {
            eventSource._keyDownEvent.preventDefault();
            s.isFinding = true;
            s.cursorBeforeFind = { ...targetEditor.cursor };
        }
    }
}



function filterString(text: string, query: string) {
    return text.includes(query);
}


function recomputeAllFindResults(
    s: CodeEditorState,
    editorState: TextEditorState,
    finderState: SimpleTextEditorState,
) {
    tb.beginEditing(editorState.buffer); {
        const it = tb.itNewTemp(editorState.buffer);
        const queryText = tb.buffToString(finderState.editorState.buffer);

        s.allFindResults.length = 0;
        let firstMatchIdx: number | undefined;
        if (queryText && queryText.length > 0) {
            // loop goes from cursor -> end, then start -> cursor.
            // that way, `firstMatchIdx` is correct.

            tb.itCopy(it, editorState.cursor);
            while (!tb.itIsAtEnd(it)) {
                if (tb.itQuery(it, queryText)) {
                    s.allFindResults.push({
                        start: tb.itNewTempFrom(it),
                        end: tb.itNewTempFrom(it, queryText.length),
                    });
                    if (!firstMatchIdx) firstMatchIdx = s.allFindResults.length - 1;
                }
                tb.iterate(it);
            }

            tb.itZero(it);
            while (!tb.itEquals(it, editorState.cursor)) {
                if (tb.itQuery(it, queryText)) {
                    s.allFindResults.push({
                        start: tb.itNewTempFrom(it),
                        end: tb.itNewTempFrom(it, queryText.length),
                    });
                    if (!firstMatchIdx) firstMatchIdx = s.allFindResults.length - 1;
                }
                tb.iterate(it);
            }
        }

        if (firstMatchIdx !== undefined) {
            // move cursor to the result that is closest to it
            s.currentFindResultIdx = firstMatchIdx;
        }

    } tb.endEditing(editorState.buffer);
}

export function imAppCodeEditor(c: ImCache, ctx: GlobalContext) {
    const { state, lastInterpreterResult, lastParseResult } = ctx;

    const sc =          imState(c, newScrollContainer);
    const s =           imState(c, newCodeEditorState);
    const editorState = imState(c, newTextEditorState);
    const finderState = imState(c, newSimpleTextEditorState);

    const debug = ctx.state.debugTextEditor;

    let hasSelection = false;

    if (editorState.hasFocus && s.isFinding) {
        finderState.editorState.shouldFocusTextArea = true;
    } else if (finderState.editorState.hasFocus && !s.isFinding) {
        editorState.shouldFocusTextArea = true;
    }

    if (imMemo(c, state.text)) {
        if (loadText(editorState, state.text))  {
            loadText(finderState.editorState, "")
        }
    } 

    if (imMemo(c, finderState.editorState.modifiedAt)) {
        recomputeAllFindResults(s, editorState, finderState);
    } 

    const modifiedAtChanged = imMemo(c, editorState.modifiedAt);
    if (modifiedAtChanged) {
        ctx.state.text = tb.buffToString(editorState.buffer);
        mutateState(ctx.state);
        ctx.astStart = 1;
        ctx.astEnd = 5;
        hasSelection = tb.itIsClear(editorState.selectionStart);
        ctx.textCursorIdx = tb.itGetPos(editorState.cursor);
    } 

    const container = imScrollContainerBegin(c, sc, COL); imRelative(c);  
    imPadding(c, 10, PX, 10, PX, 10, PX, 10, PX); imCode(c); {
        if (isFirstishRender(c)) {
            elSetClass(c, cnApp.bgFocus);
            elSetStyle(c, "userSelect", "none");
            elSetStyle(c, "cursor", "text");
        }

        // TODO: only render the stuff that is onscreen
        imBeginTextEditor(
            c, 
            editorState,
            container,
            ctx.input.keyboard.ctrlHeld,
            ctx.input.keyboard.shiftHeld
        ); {
            let lineIdx = editorState.viewLine;
            let pos = editorState._renderPosStart;
            let renderedLine = false;
            imFor(c); while (textEditorHasChars(editorState) || !renderedLine) {
                renderedLine = true;
                imKeyedBegin(c, lineIdx); 
                const line = imLayout(c, COL); {
                    imLayout(c, COL); {
                        imLayout(c, ROW); imFlex(c); {
                            const lineChanged = imMemo(c, lineIdx);
                            const lastMaxLineChanged = imMemo(c, s.lastMaxLine);

                            let lineText = imGet(c, String);
                            if (lineChanged || lastMaxLineChanged || lineText === undefined) {
                                const numDigits = Math.ceil(Math.log10(s.lastMaxLine + 1));
                                lineText = lPad("" + lineIdx, numDigits) + " ";
                                imSet(c, lineText);
                            }

                            imLayout(c, ROW); imAlign(c, START); imJustify(c); {
                                imStr(c, lineText);
                            } imLayoutEnd(c);



                            imLayout(c, BLOCK); imPadding(c, 0, NA, 5, PX, 0, NA, 5, PX);  {
                                imLayout(c, BLOCK); imSize(c, 5, PX, 100, PERCENT); imBg(c, cssVars.fg); imLayoutEnd(c);
                            } imLayoutEnd(c);

                            imLayout(c, COL); imFlex(c); {
                                // Actual text line
                                imLayout(c, ROW); imFlexWrap(c); {
                                    imFor(c); while (textEditorHasChars(editorState)) {
                                        const actualC = textEditorGetNextChar(editorState);

                                        // Debug the text editor datastructure
                                        if (imIf(c) && debug) {
                                            const cursor = editorState._renderCursor;
                                            if (imIf(c) && (
                                                cursor.textIdx <= 0 ||
                                                actualC === "\t"
                                            )) {
                                                imLayout(c, INLINE_BLOCK); {
                                                    if (isFirstishRender(c)) {
                                                        elSetStyle(c, "border", "1px solid red");
                                                    }

                                                    imStr(c, cursor.pieceIdx);
                                                } imLayoutEnd(c);
                                            } imIfEnd(c);
                                        } imIfEnd(c);

                                        let astNode: ProgramExpression | undefined;
                                        if (lastParseResult) {
                                            astNode = getAstNodeForTextPos(lastParseResult, pos);
                                            pos++;
                                        }

                                        const ws = isWhitespace(actualC);
                                        const char = getStringRepr(actualC, ws);

                                        const textSpan = imEl(c, EL_SPAN); {
                                            imStr(c, char);
                                            handleTextEditorClickEventForChar(c, editorState, editorState._renderCursor);

                                            let isFindResult = false;
                                            if (s.isFinding) {
                                                const i = editorState._renderCursor;
                                                for (const range of s.allFindResults) {
                                                    if (range.start <= i && i <= range.end) {
                                                        isFindResult = true;
                                                    }
                                                }
                                            }

                                            const hasFocus = editorState.hasFocus || finderState.editorState.hasFocus;

                                            const isSelected = hasFocus && textEditorCursorIsSelected(editorState, editorState._renderCursor);
                                            const isCursor = hasFocus && tb.itEquals(editorState._renderCursor, editorState.cursor);
                                            if (isCursor) {
                                                ctx.textCursorLine = lineIdx;
                                                editorState._cursorSpan = textSpan.root;
                                                editorState._cursorLine = lineIdx;
                                                editorState._hasCursorLine = true;
                                            }
                                            editorState._lastRenderedCharSpan = textSpan.root;

                                            const isSelectedChanged = imMemo(c, isSelected);
                                            const isCursorChanged = imMemo(c, isCursor);
                                            const isFindResultChanged = imMemo(c, isFindResult);
                                            if (isSelectedChanged || isCursorChanged || isFindResultChanged) {
                                                let bgCol = "";
                                                if (!elSetClass(c, cn.inverted, isSelected || isCursor)) {
                                                    if (isFindResult) {
                                                        bgCol = "#00F";
                                                    }
                                                }
                                                elSetStyle(c, "backgroundColor", bgCol);
                                            }

                                            const wsChanged = imMemo(c, ws);
                                            const astNodeChanged = imMemo(c, astNode);
                                            if (wsChanged || astNodeChanged) {
                                                let italic = false;
                                                let bold = false;
                                                let color = "";
                                                if (ws) {
                                                    color = "#0000";
                                                } else {
                                                    if (astNode) {
                                                        if (astNode.t === T_IDENTIFIER) {
                                                            if (astNode.parent !== null && astNode.parent.t === T_FN) {
                                                                // Funny, because now we don't know if it was the function name, or an argument passed into the function.
                                                                // TODO: identifier types
                                                                bold = true;
                                                            } else {
                                                                italic = true;
                                                            }
                                                        } else if (
                                                            astNode.t === T_FN ||
                                                            astNode.t === T_BLOCK ||
                                                            astNode.t === T_LIST_LITERAL ||
                                                            astNode.t === T_VECTOR_LITERAL
                                                        ) {
                                                            bold = true;
                                                        } else if (astNode.t === T_STRING_LITERAL) {
                                                            color = "#F62";
                                                        } else if (astNode.t === T_NUMBER_LITERAL) {
                                                            color = "#00F";
                                                        }
                                                    } else {
                                                        // whitespace/comment
                                                        color = "#370";
                                                    }
                                                }
                                                elSetStyle(c, "color", color);
                                                elSetStyle(c, "fontStyle", italic ? "italic" : "");
                                                elSetStyle(c, "fontWeight", bold ? "bold" : "");
                                            }
                                        } imElEnd(c, EL_SPAN);

                                        // break statement needs to be at the end of the loop
                                        if (actualC === "\n") {
                                            break;
                                        }
                                    } imForEnd(c);

                                    // flex element handles events for the entire newline
                                    imLayout(c, BLOCK); imFlex(c); {
                                        handleTextEditorClickEventForChar(c, editorState, editorState._renderCursor);
                                    } imLayoutEnd(c);
                                } imLayoutEnd(c);

                                // other stuff just below text
                                let numErrors = 0;

                                if (imIf(c) && lastInterpreterResult?.errors) {
                                    imDiagnostics(c, lastInterpreterResult.errors, "#F00", lineIdx);
                                    numErrors += lastInterpreterResult.errors.length;
                                } imIfEnd(c);

                                if (imIf(c) && lastParseResult?.warnings) {
                                    imDiagnostics(c, lastParseResult.warnings, "#F00", lineIdx);
                                    numErrors += lastParseResult.warnings.length;
                                } imIfEnd(c);

                                if (imIf(c) &&
                                    // if this is true, Error: identifier isnt set will prevent this from opening, which is bad.
                                    // we should reconsider even showing that error.
                                    // numErrors === 0 && 
                                    lineIdx === ctx.textCursorLine &&
                                    !hasSelection
                                ) {
                                    const pos = ctx.textCursorIdx;
                                    const lastIdentifier = parseIdentifierBackwardsFromPoint(state.text, pos - 1);
                                    imAutocomplete(c, lastIdentifier);
                                } imIfEnd(c);
                            } imLayoutEnd(c);
                        } imLayoutEnd(c);
                    } imLayoutEnd(c);

                    // figures
                    imLayout(c, COL); imNotCode(c); {
                        if (isFirstishRender(c)) {
                            elSetStyle(c, "borderRadius", "10px");
                            elSetStyle(c, "overflow", "clip");
                        }

                        // NOTE: turns out that putting UI components in with the code
                        // feels like ass to use. Maybe they should just snap to the closest 
                        // plot or something? I much prefer the current behaviour
                        // where they accumulate in the global UI panel. 
                        // const outputs = lastInterpreterResult?.outputs;
                        // const inputs = outputs?.uiInputsPerLine?.get(lineIdx);
                        // if (imIf(c) && inputs) {
                        //     imCodeInputUIs(c, ctx, inputs)
                        // } imIfEnd(c);

                        const thisLineOutputs = lastInterpreterResult?.flushedOutputs?.get(lineIdx);
                        if (imIf(c) && thisLineOutputs && lastInterpreterResult) {
                            imLayout(c, BLOCK); imPadding(c, 5, PX, 5, PX, 5, PX, 5, PX); {
                                if (isFirstishRender(c)) {
                                    elSetStyle(c, "maxWidth", "60vw");
                                }

                                imProgramOutputs(c, ctx, lastInterpreterResult, thisLineOutputs);
                            } imLayoutEnd(c);
                        } imIfEnd(c);
                    } imLayoutEnd(c);
                } imLayoutEnd(c);
                imKeyedEnd(c);

                // break statement needs to be at the end of the loop
                const rect = line.getBoundingClientRect();
                if (isPartiallyOffscreen(rect)) {
                    break;
                }
                lineIdx++;
            } imForEnd(c);

            s.lastMaxLine = lineIdx + 1;

            handleCodeEditorEvents(s, editorState, editorState);

            handleTextEditorMouseScrollEvent(c, editorState);

        } imEndTextEditor(c, editorState);

        // Empty space below the lines should just handle click events for the end of the line
        imLayout(c, BLOCK); imFlex(c); {
            handleTextEditorClickEventForChar(c, editorState, editorState._renderCursor);
        } imLayoutEnd(c);

        if (imIf(c) && s.isFinding) {
            imLayout(c, ROW); imPre(c); imBg(c, cssVars.bg); imAbsolute(c, 0, NA, 0, PX, 0, PX, 0, PX); {
                imStr(c, "Find: ");

                imSimpleTextInput(
                    c, 
                    finderState,
                    ctx.input.keyboard.ctrlHeld,
                    ctx.input.keyboard.shiftHeld
                ); {
                    imSimpleTextInputBody(c, finderState);
                    handleCodeEditorEvents(
                        s,
                        editorState,
                        finderState.editorState
                    );
                } imEndSimpleTextInput(c, finderState)
            } imLayoutEnd(c);
        } imIfEnd(c);
        // Empty space below the lines should just handle click events for the end of the line
        imLayout(c, BLOCK); imFlex(c); {
            handleTextEditorClickEventForChar(c, editorState, editorState._renderCursor);
        } imLayoutEnd(c);
    } imLayoutEnd(c);
}


export function textEditorCheckIfQueryIsAtPos(
    buffer: string,
    query: string,
    pos: number
): boolean {
    if (query.length === 0) {
        // While technically true, it's more practical to return false here.
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

