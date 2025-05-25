import {
    defaultTextEditorKeyboardEventHandler,
    handleTextEditorClickEventForChar,
    imBeginTextEditor,
    imEndTextEditor,
    loadText,
    newTextEditorState,
    textEditorCursorIsSelected,
    textEditorGetNextChar,
    textEditorHasChars,
    textEditorHasSelection,
    textEditorRemove,
    TextEditorState,
    handleTextEditorMouseScrollEvent,
    iterateToLastNewline,
    iterateToNextNewline,
} from 'src/utils/text-editor';
import * as tb from "src/utils/text-edit-buffer";
import { imProgramOutputs } from './code-output';
import { renderSliderBody } from './components/slider';
import {
    ABSOLUTE,
    ALIGN_CENTER,
    CODE,
    COL,
    FLEX,
    GAP,
    H100,
    imBeginLayout,
    imBeginScrollContainer,
    imTextSpan,
    imVerticalBar,
    JUSTIFY_CENTER,
    NORMAL,
    OPAQUE,
    PADDED,
    PRE,
    PREWRAP,
    RELATIVE,
    ROW,
    setInset,
    TRANSPARENT
} from './layout';
import {
    BuiltinFunction,
    getBuiltinFunctionsMap,
    programResultTypeStringFromType,
    UI_INPUT_SLIDER
} from './program-interpreter';
import {
    DiagnosticInfo,
    getAstNodeForTextPos,
    newResumeableAstTraverser,
    parseIdentifierBackwardsFromPoint,
    ProgramExpression,
    resetAstTraversal,
    ResumeableAstTraverser,
    T_BLOCK,
    T_FN,
    T_IDENTIFIER,
    T_LIST_LITERAL,
    T_NUMBER_LITERAL,
    T_STRING_LITERAL,
    T_VECTOR_LITERAL
} from './program-parser';
import { GlobalContext, rerun } from './state';
import "./styling";
import { cnApp } from './styling';
import {
    disableIm,
    enableIm,
    imBeginList,
    imSpan,
    imEnd,
    imEndList,
    imInit,
    imMemo,
    imRef,
    imState,
    imStateInline,
    nextListRoot,
    setAttr,
    setClass,
    setInnerText,
    setStyle,
    imIf,
    imEndIf,
    imSwitch,
    imEndSwitch
} from './utils/im-dom-utils';
import { max } from './utils/math-utils';
import { isWhitespace } from './utils/text-utils';
import { assert } from './utils/assert';
import { cn } from './utils/cn';


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



const renderDiagnostics = (diagnostics: DiagnosticInfo[], col: string, line: number) => {
    // NOTE: we're currently looping over this for every line.
    // if it becomes too slow, may need to do something about it.
    imBeginList();
    for (const err of diagnostics) {
        if (err.pos.line !== line) {
            continue
        }

        nextListRoot();

        // transparent span
        imBeginLayout(); {
            imSpan(); {
                if (imInit()) {
                    setAttr("style", "color: transparent");
                }

                const numWhitespaces = max(0, err.pos.col + err.pos.tabs * UNANIMOUSLY_DECIDED_TAB_SIZE);
                setInnerText("0".repeat(numWhitespaces));
            } imEnd();

            imSpan(); {
                if (imInit()) {
                    setStyle("color", col);
                }

                imTextSpan("^ ");
                imTextSpan(err.problem);
            } imEnd();
        } imEnd();
    }
    imEndList();
}

function imAutocomplete(lastIdentifier: string) {
    // we do a little autocomplete

    // autocomplete
    // right now you can't interact with it - it is more so that I actually remember all the crap I've put into here

    const results = imStateInline<BuiltinFunction[]>(() => []);
    if (imMemo(lastIdentifier)) {
        results.length = 0;
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

    if (imIf() && results.length > 0) {
        // TODO: when we do the AST editor, this will completely change, or be ripped out.

        imBeginLayout(PREWRAP | CODE | TRANSPARENT); {
            if (imInit()) {
                setClass(cn.pointerEventsNone);
            }

            setStyle("border", "1px solid black");

            imBeginList();
            let i = 0;
            for (const v of results) {
                i++;
                if (i > 5) {
                    break;
                }
                nextListRoot();

                imBeginLayout(CODE); {
                    setStyle("border", "1px solid black");
                    imTextSpan(v.name);
                    imTextSpan("(");
                    imBeginList();
                    for (let i = 0; i < v.args.length; i++) {
                        const arg = v.args[i];
                        nextListRoot();
                        imTextSpan(arg.name);

                        if (imIf() && arg.optional) {
                            imTextSpan("?");
                        } imEndIf();

                        imTextSpan(":");

                        let type;
                        if (arg.type.length === 0) {
                            type = "any"
                        } else {
                            type = arg.type.map(programResultTypeStringFromType)
                                .join("|");
                        }
                        imTextSpan(type);

                        if (imIf() && i < v.args.length - 1) {
                            imTextSpan(", ");
                        } imEndIf();
                    }
                    imEndList();
                    imTextSpan(")");
                } imEnd();
            }
            imEndList();
        } imEnd();
    } imEndIf();
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

function imSimpleTextInput(s: SimpleTextEditorState, ctrlHeld: boolean, shiftHeld: boolean) {
    imBeginTextEditor(s.editorState, s.container, ctrlHeld, shiftHeld);
}

function imEndSimpleTextInput(s: SimpleTextEditorState) {
    imEndTextEditor(s.editorState);
}

// A simpler text editor that can be used for simpler text inputs
function imSimpleTextInputBody(s: SimpleTextEditorState) {
    imBeginLayout(COL); {
        imBeginList();
        while (textEditorHasChars(s.editorState)) {
            nextListRoot();
            imBeginLayout(ROW); {
                imBeginList();
                while (textEditorHasChars(s.editorState)) {
                    nextListRoot();
                    const textSpan = imSpan(); {
                        const actualC = textEditorGetNextChar(s.editorState);
                        const ws = isWhitespace(actualC);
                        const c = getStringRepr(actualC, ws);
                        setInnerText(c);

                        handleTextEditorClickEventForChar(s.editorState, s.editorState._renderCursor);

                        const isSelected = s.editorState.hasFocus && 
                            textEditorCursorIsSelected( s.editorState, s.editorState._renderCursor);

                        const isCursor = s.editorState.hasFocus && 
                            tb.itEquals(s.editorState._renderCursor, s.editorState.cursor)

                        if (isCursor) {
                            s.editorState._cursorSpan = textSpan.root;
                        }

                        const isSelectedChanged = imMemo(isSelected);
                        const isCursorChanged = imMemo(isCursor);
                        if (isSelectedChanged || isCursorChanged) {
                            setClass(cnApp.inverted, isSelected || isCursor);
                        } 

                        const wsChanged = imMemo(ws);
                        if (wsChanged) {
                            let color = "";
                            if (ws) {
                                color = "#0000";
                            }

                            setStyle("color", color);
                        } 
                    } imEnd();
                }
                imEndList();
            } imEnd();
        }
        imEndList();
    } imEnd();

    return s;
}

// toggles '//' on/off for the selected lines
function toggleSelectionLineComment(targetEditor: TextEditorState) {
    const comment = "// ";
    const comment2 = "//";

    if (!tb.itGet(targetEditor.selectionStart)) iterateToLastNewline(targetEditor.selectionStart);
    if (!tb.itGet(targetEditor.selectionEnd)) iterateToNextNewline(targetEditor.selectionEnd);

    const cursors: TextEditorCursor[] = [];

    const start = tb.itFrom(targetEditor.selectionStart);
    const end = tb.itFrom(targetEditor.selectionEnd);
    assert(tb.itBefore(targetEditor.selectionStart, targetEditor.selectionEnd));
    while (!tb.itEquals(start, end)) {
        if (tb.itQuery(start, comment) || tb.itQuery(start, comment2)) {
            cursors.push(tb.itFrom(start));
        }

        tb.iterate(start);
    }

    if (cursors.length > 0) {
        return;
    }

    // We didn't have any comments to delete. Let's create some comments instead

    tb.itCopy(start, targetEditor.selectionStart);
    tb.itCopy(end, targetEditor.selectionEnd);
    while (!tb.itEquals(start, end)) {
        if (tb.itQuery(start, "\n")) {
            const pos = tb.itFrom(start);
            // one after the newline
            tb.iterate(pos);
            cursors.push(pos);
        }

        tb.iterate(start);
    }

    if (cursors.length > 0) {
        tb.itBisectAll(cursors);
        for (const c of cursors) {
            tb.itInsert(c, "// ");
        }
    }
}

function indentSelection(targetEditor: TextEditorState) {
    if (!textEditorHasSelection(targetEditor)) {
        return;
    }

    const cursors: TextEditorCursor[] = [];

    const start = tb.itFrom(targetEditor.selectionStart);
    const end = tb.itFrom(targetEditor.selectionEnd);
    while (!tb.itEquals(start, end)) {
        if (tb.itQuery(start, "\n")) {
            const pos = tb.itFrom(start);
            // one after the newline
            tb.iterate(pos);
            cursors.push(pos);
        }

        tb.iterate(start);
    }

    if (cursors.length > 0) {
        tb.itBisectAll(cursors);
        for (const c of cursors) {
            tb.itInsert(c, "\t");
        }
    }
}

function deIndentSelection(targetEditor: TextEditorState) {
    if (!textEditorHasSelection(targetEditor)) {
        return;
    }

    iterateToLastNewline(targetEditor.selectionStart);
    iterateToNextNewline(targetEditor.selectionEnd);

    const cursors: TextEditorCursor[] = [];

    const it = tb.itFrom(targetEditor.selectionStart);
    while (!tb.itEquals(it, targetEditor.selectionEnd)) {
        const char = tb.itGet(it);
        if (char === "\n") {
            cursors.push(tb.itFrom(it));
        }

        tb.iterate(it);
    }

    tb.itBisectAll(cursors);
    for (const c of cursors) {
        const c1 = tb.itFrom(c);
        tb.iterate(c1);
        textEditorRemove(targetEditor, c, c1);
    }
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
            s.cursorBeforeFind = tb.itFrom(targetEditor.cursor);
        }
    }
}



function filterString(text: string, query: string) {
    return text.includes(query);
}


export function imAppCodeEditor(ctx: GlobalContext) {
    const { state, lastInterpreterResult, lastParseResult } = ctx;

    const s = imState(newCodeEditorState);
    const editorState = imState(newTextEditorState);
    const finderState = imState(newSimpleTextEditorState);
    let hasSelection = false;

    if (editorState.hasFocus && s.isFinding) {
        finderState.editorState.shouldFocusTextArea = true;
    } else if (finderState.editorState.hasFocus && !s.isFinding) {
        editorState.shouldFocusTextArea = true;
    }

    if (imMemo(finderState.editorState.modifiedAt)) {
        const it = tb.itNew(editorState.buffer);
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
                        start: tb.itFrom(it),
                        end: tb.itFrom(it, queryText.length),
                    });
                    if (!firstMatchIdx) firstMatchIdx = s.allFindResults.length - 1;
                }
                tb.iterate(it);
            }

            tb.itZero(it);
            while (!tb.itEquals(it, editorState.cursor)) {
                if (tb.itQuery(it, queryText)) {
                    s.allFindResults.push({
                        start: tb.itFrom(it),
                        end: tb.itFrom(it, queryText.length),
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
    } 

    
    const modifiedAtChanged = imMemo(editorState.modifiedAt);
    if (modifiedAtChanged) {
        ctx.state.text = tb.buffToString(editorState.buffer);
        ctx.astStart = 1;
        ctx.astEnd = 5;
        hasSelection = tb.itIsClear(editorState.selectionStart);
        ctx.textCursorIdx = tb.itGetPos(editorState.cursor);
    } 

    const container = imBeginScrollContainer(H100 | CODE | COL |  RELATIVE, true).root; {
        if (imInit()) {
            setInset("10px");
            setClass(cnApp.bgFocus);
            setStyle("userSelect", "none");
            setStyle("cursor", "text");
        }

        if (imMemo(ctx.lastLoaded)) {
            loadText(editorState, state.text);
        } 

        const astTraverserRef = imRef<ResumeableAstTraverser | null>();
        if (imMemo(lastParseResult)) {
            if (lastParseResult) {
                astTraverserRef.val = newResumeableAstTraverser(lastParseResult);
            } else {
                astTraverserRef.val = null;
            }
        }

        if (astTraverserRef.val && lastParseResult) {
            resetAstTraversal(astTraverserRef.val, lastParseResult);
        }

        // TODO: only render the stuff that is onscreen
        imBeginTextEditor(
            editorState,
            container,
            ctx.input.keyboard.ctrlHeld,
            ctx.input.keyboard.shiftHeld
        ); {
            let lineIdx = editorState.viewLine;
            let pos = editorState._renderPosStart;
            let renderedLine = false;
            imBeginList(); 
            while (textEditorHasChars(editorState) || !renderedLine) {
                renderedLine = true;
                nextListRoot(lineIdx);
                const line = imBeginLayout(COL); {
                    imBeginLayout(COL); {
                        imBeginLayout(ROW | FLEX); {
                            const lineText = imRef<string>();
                            
                            const lineChanged = imMemo(lineIdx);
                            const lastMaxLineChanged = imMemo(s.lastMaxLine);
                            if (lineChanged || lastMaxLineChanged || lineText.val === null) {
                                const numDigits = Math.ceil(Math.log10(s.lastMaxLine + 1));
                                lineText.val = lPad("" + lineIdx, numDigits) + " ";
                            }

                            imBeginLayout(ROW | ALIGN_CENTER | JUSTIFY_CENTER); {
                                setInnerText(lineText.val);
                            } imEnd();

                            imVerticalBar();

                            imBeginLayout(COL | FLEX); {
                                // Actual text line
                                imBeginLayout(ROW); {
                                    imBeginList();
                                    while (textEditorHasChars(editorState)) {
                                        nextListRoot();

                                        const actualC = textEditorGetNextChar(editorState);
                                        pos++;

                                        let astNode: ProgramExpression | undefined;
                                        if (astTraverserRef.val && lastParseResult) {
                                            astNode = getAstNodeForTextPos(
                                                astTraverserRef.val,
                                                lastParseResult,
                                                pos,
                                            );
                                        }

                                        const ws = isWhitespace(actualC);
                                        const c = getStringRepr(actualC, ws);

                                        const textSpan = imSpan(); {
                                            setInnerText(c);
                                            handleTextEditorClickEventForChar(editorState, editorState._renderCursor);

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
                                                ctx.textCursorLine         = lineIdx;
                                                editorState._cursorSpan    = textSpan.root;
                                                editorState._cursorLine    = lineIdx;
                                                editorState._hasCursorLine = true;
                                            }
                                            editorState._lastRenderedCharSpan = textSpan.root;


                                            const isSelectedChanged = imMemo(isSelected);
                                            const isCursorChanged = imMemo(isCursor);
                                            const isFindResultChanged = imMemo(isFindResult);
                                            if (isSelectedChanged || isCursorChanged || isFindResultChanged) {
                                                let bgCol = "";
                                                if (!setClass(cnApp.inverted, isSelected || isCursor)) {
                                                    if (isFindResult) {
                                                        bgCol = "#00F";
                                                    }
                                                }
                                                setStyle("backgroundColor", bgCol);
                                            }

                                            const wsChanged = imMemo(ws);
                                            const astNodeChanged = imMemo(astNode);
                                            disableIm();
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
                                                setStyle("color", color);
                                                setStyle("fontStyle", italic ? "italic" : "");
                                                setStyle("fontWeight", bold ? "bold" : "");
                                            } 
                                            enableIm();
                                        } imEnd();

                                        if (actualC === "\n") {
                                            break;
                                        }
                                    }
                                    imEndList();

                                    // flex element handles events for the entire newline
                                    imBeginLayout(FLEX); {
                                        handleTextEditorClickEventForChar(editorState, editorState._renderCursor);
                                    } imEnd();
                                } imEnd();

                                // other stuff just below text
                                let numErrors = 0;

                                if (imIf() && lastInterpreterResult?.errors) {
                                    renderDiagnostics(lastInterpreterResult.errors, "#F00", lineIdx);
                                    numErrors += lastInterpreterResult.errors.length;
                                } imEndIf();

                                if (imIf() && lastParseResult?.warnings) {
                                    renderDiagnostics(lastParseResult.warnings, "#F00", lineIdx);
                                    numErrors += lastParseResult.warnings.length;
                                } imEndIf();

                                if (imIf() &&
                                    // if this is true, Error: identifier isnt set will prevent this from opening, which is bad.
                                    // we should reconsider even showing that error.
                                    // numErrors === 0 && 
                                    lineIdx === ctx.textCursorLine &&
                                    !hasSelection
                                ) {
                                    const pos = ctx.textCursorIdx;
                                    const lastIdentifier = parseIdentifierBackwardsFromPoint(state.text, pos - 1);
                                    imAutocomplete(lastIdentifier);
                                } imEndIf();
                            } imEnd();
                        } imEnd();
                    } imEnd();

                    // figures
                    imBeginLayout(COL | NORMAL); {

                        if (imInit()) {
                            setStyle("borderRadius", "10px");
                            setStyle("overflow", "clip");
                        }

                        const outputs = lastInterpreterResult?.outputs;
                        const inputs = outputs?.uiInputsPerLine?.get(lineIdx);
                        if (imIf() && inputs) {
                            imBeginList();
                            for (const ui of inputs) {
                                nextListRoot();

                                imBeginLayout(COL | GAP | NORMAL | PADDED); {
                                    imSwitch(ui.t);
                                    switch (ui.t) {
                                        case UI_INPUT_SLIDER: {
                                            imBeginLayout(ROW | GAP); {
                                                imBeginLayout(); {
                                                    imTextSpan(ui.name);
                                                } imEnd();

                                                imBeginLayout(CODE); {
                                                    imTextSpan(ui.value + "");
                                                } imEnd();
                                            } imEnd();
                                            imBeginLayout(ROW); {
                                                if (imInit()) {
                                                    setStyle("height", "1em");
                                                }
                                                const s = renderSliderBody(ui.start, ui.end, ui.step, ui.value);
                                                if (imMemo(s.value)) {
                                                    ui.value = s.value;
                                                    rerun(ctx);
                                                }
                                            } imEnd();
                                        } break;
                                        default: {
                                            throw new Error("Unhandled UI input type");
                                        }
                                    } imEndSwitch();
                                } imEnd();
                            }
                            imEndList();
                        } imEndIf();

                        const thisLineOutputs = lastInterpreterResult?.flushedOutputs?.get(lineIdx);
                        if (imIf() && thisLineOutputs && lastInterpreterResult) {
                            imBeginLayout(NORMAL | PADDED); {
                                if (imInit()) {
                                    setStyle("maxWidth", "60vw");
                                }

                                imProgramOutputs(ctx, lastInterpreterResult, thisLineOutputs);
                            } imEnd();
                        } imEndIf();
                    } imEnd();
                } imEnd();

                const rect = line.root.getBoundingClientRect();
                if (isPartiallyOffscreen(rect)) {
                    break;
                }

                lineIdx++;
            }
            imEndList();

            s.lastMaxLine = lineIdx + 1;

            handleCodeEditorEvents(s, editorState, editorState);

            handleTextEditorMouseScrollEvent(editorState);

        } imEndTextEditor(editorState);


        // Empty space below the lines should just handle click events for the end of the line
        imBeginLayout(FLEX); {
            handleTextEditorClickEventForChar(editorState, editorState._renderCursor);
        } imEnd();

        if (imIf() && s.isFinding) {
            imBeginLayout(ROW | PRE | ABSOLUTE | OPAQUE).root; {
                if (imInit()) {
                    setAttr("style", "bottom: 0; left: 0; right: 0");
                }

                imBeginLayout(); {
                    imTextSpan("Find: ");
                } imEnd();

                imSimpleTextInput(
                    finderState,
                    ctx.input.keyboard.ctrlHeld,
                    ctx.input.keyboard.shiftHeld
                ); {
                    imSimpleTextInputBody(finderState);
                    handleCodeEditorEvents(
                        s,
                       editorState,
                        finderState.editorState
                    );
                } imEndSimpleTextInput(finderState)
            } imEnd();
        } imEndIf();
        // Empty space below the lines should just handle click events for the end of the line
        imBeginLayout(FLEX); {
            handleTextEditorClickEventForChar(editorState, editorState._renderCursor);
        } imEnd();
    } imEnd();
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

