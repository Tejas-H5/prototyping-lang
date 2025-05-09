import { defaultTextEditorKeyboardEventHandler, getLastNewlinePos, getNextNewlinePos, handleTextEditorClickEventForChar, imBeginTextEditor, imEndTextEditor, textEditorQueryBufferAtPos, loadText, newTextEditorState, textEditorCursorIsSelected, textEditorDeleteCurrentSelection, textEditorGetNextChar, textEditorHasChars, textEditorHasSelection, textEditorInsert, textEditorMarkViewEnd, textEditorRemove, textEditorSetSelection, TextEditorState, handleTextEditorMouseScrollEvent } from 'src/utils/text-editor';
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
import { BuiltinFunction, getBuiltinFunctionsMap, programResultTypeStringFromType, UI_INPUT_SLIDER } from './program-interpreter';
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
    getCurrentRoot,
    imArray,
    imBeginList,
    imBeginSpan,
    imEnd,
    imEndList,
    imInit,
    imMemo,
    imMemoArray,
    imRef,
    imState,
    imStateInline,
    nextListRoot,
    setAttributes,
    setClass,
    setInnerText,
    setStyle
} from './utils/im-dom-utils';
import { max } from './utils/math-utils';
import { isWhitespace } from './utils/text-utils';
import { assert } from './utils/assert';
import { cn } from './utils/cn';


const UNANIMOUSLY_DECIDED_TAB_SIZE = 4;

type CodeEditorState = {
    lastMaxLine: number;
    isFinding: boolean;
    allFindResults: Range[];
    currentFindResultIdx: number;
    cursorBeforeFind: number;
}

export type Range = {
    start: number;
    end: number;
}


function newCodeEditorState(): CodeEditorState {
    return  {
        lastMaxLine: 0,
        isFinding: false,
        allFindResults: [],
        currentFindResultIdx: -1,
        cursorBeforeFind: 0,
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
            imBeginSpan(); {
                imInit() && setAttributes({ style: "color: transparent" });
                setInnerText("0".repeat(max(0, err.pos.col + err.pos.tabs * UNANIMOUSLY_DECIDED_TAB_SIZE)));
            } imEnd();

            imBeginSpan(); {
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

    imBeginList();
    if (nextListRoot() && results.length > 0) {
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

                        imBeginList();
                        if (nextListRoot() && arg.optional) {
                            imTextSpan("?");
                        }
                        imEndList();

                        imTextSpan(":");

                        let type;
                        if (arg.type.length === 0) {
                            type = "any"
                        } else {
                            type = arg.type.map(programResultTypeStringFromType)
                                .join("|");
                        }
                        imTextSpan(type);

                        imBeginList();
                        if (nextListRoot() && i < v.args.length - 1) {
                            imTextSpan(", ");
                        }
                        imEndList();
                    }
                    imEndList();
                    imTextSpan(")");
                } imEnd();
            }
            imEndList();
        } imEnd();
    }
    imEndList();
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
};

function newSimpleTextEditorState(): SimpleTextEditorState {
    return {
        editorState: newTextEditorState(),
    };
}

function imBeginSimpleTextInput(s: SimpleTextEditorState) {
    imBeginTextEditor(s.editorState);
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
                    const textSpan = imBeginSpan(); {
                        const actualC = textEditorGetNextChar(s.editorState);
                        const ws = isWhitespace(actualC);
                        const c = getStringRepr(actualC, ws);
                        setInnerText(c);

                        handleTextEditorClickEventForChar(s.editorState, s.editorState._renderCursor.pos);

                        const isSelected = s.editorState.hasFocus && textEditorCursorIsSelected(
                            s.editorState, 
                            s.editorState._renderCursor.pos
                        );
                        const isCursor = s.editorState.hasFocus && 
                            s.editorState._renderCursor.pos === s.editorState.cursor;
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

        textEditorMarkViewEnd(s.editorState);
    } imEnd();

    return s;
}

function getSelectionRangeExtendedToLines(targetEditor: TextEditorState) {
    let start, end;
    if (textEditorHasSelection(targetEditor)) {
        const { selectionStart, selectionEnd } = targetEditor;
        start = getLastNewlinePos(targetEditor, selectionStart) + 1;
        end = getNextNewlinePos(targetEditor, selectionEnd) - 1;
    } else {
        start = getLastNewlinePos(targetEditor, targetEditor.cursor) + 1;
        end = getNextNewlinePos(targetEditor, targetEditor.cursor) - 1;
    }
    return [start, end] as const;
}

// toggles '//' on/off for the selected lines
function toggleSelectionLineComment(targetEditor: TextEditorState) {
    const [start, end] = getSelectionRangeExtendedToLines(targetEditor);

    if (start >= end) {
        return;
    }

    const slice = targetEditor.buffer.slice(start, end);

    const updatedSlice = [];

    const comment: string[] = ["/", "/", " "];
    const comment2: string[] = ["/", "/",];

    let shouldCommentBlock = false;
    {
        let expectComment = true;

        for (let i = 0; i < slice.length; i++) {
            const c = slice[i];

            if (!expectComment) {
                if (c === "\n") {
                    expectComment = true;
                }
            } else {
                if (!isWhitespace(c)) {
                    if (textEditorQueryBufferAtPos(slice, comment2, i)) {
                        i += comment.length - 1;
                        expectComment = false;
                        continue;
                    }

                    shouldCommentBlock = true;
                    break;
                }
            }
        }
    }

    if (shouldCommentBlock) {
        let expectComment = true;

        // for (let i = 0; i < slice.length; i++) {
        //     const c = slice[i];
        //
        //     if (!expectComment) {
        //         if (c === "\n") {
        //             expectComment = true;
        //         }
        //     } else {
        //         if (!isWhitespace(c) || c === "\n") {
        //             updatedSlice.push(...comment);
        //             expectComment = false;
        //         }
        //     }
        //
        //     updatedSlice.push(c);
        // }

        // Ideally, the code above should be updated to comment at the smallest indentation.
        // but it is just far simpler to insert the comment right after the new line.
        // We still get a similar effect in that all the // appear on the same line.
        updatedSlice.push(...comment);
        for (let i = 0; i < slice.length; i++) {
            const c = slice[i];

            updatedSlice.push(c);

            if (c === "\n") {
                updatedSlice.push(...comment);
            }
        }
    } else {
        let expectComment = true;

        for (let i = 0; i < slice.length; i++) {
            const c = slice[i];

            if (!expectComment) {
                if (c === "\n") {
                    expectComment = true;
                }
            } else {
                if (!isWhitespace(c)) {
                    if (textEditorQueryBufferAtPos(slice, comment, i)) {
                        i += comment.length - 1;
                        expectComment = false;
                        continue;
                    } else if (textEditorQueryBufferAtPos(slice, comment2, i)) {
                        i += comment2.length - 1;
                        expectComment = false;
                        continue;
                    }
                }
            }

            updatedSlice.push(c);
        }
    }

    textEditorRemove(targetEditor, start, end - start);
    textEditorInsert(targetEditor, start, updatedSlice);
    textEditorSetSelection(targetEditor, start, start + updatedSlice.length);
}

function indentSelection(targetEditor: TextEditorState) {
    if (!textEditorHasSelection(targetEditor)) {
        return;
    }

    const [start, end] = getSelectionRangeExtendedToLines(targetEditor);
    if (end <= start) {
        return;
    }

    const slice = targetEditor.buffer.slice(start, end);
    const tab = ["\t"];

    const updatedSlice = [...tab];
    for (let i = 0; i < slice.length; i++) {
        const c = slice[i];

        updatedSlice.push(c);

        if (c === "\n") {
            updatedSlice.push(...tab);
        }
    }

    textEditorRemove(targetEditor, start, end - start);
    textEditorInsert(targetEditor, start, updatedSlice);
    textEditorSetSelection(targetEditor, start, start + updatedSlice.length);
}

function deIndentSelection(targetEditor: TextEditorState) {
    if (!textEditorHasSelection(targetEditor)) {
        return;
    }

    const [start, end] = getSelectionRangeExtendedToLines(targetEditor);
    if (end <= start) {
        return;
    }

    const slice = targetEditor.buffer.slice(start, end);

    const updatedSlice = [];
    let whitespaceRemaining = UNANIMOUSLY_DECIDED_TAB_SIZE;
    for (let i = 0; i < slice.length; i++) {
        const c = slice[i];

        if (c === "\n") {
            whitespaceRemaining = UNANIMOUSLY_DECIDED_TAB_SIZE;
        } else if (whitespaceRemaining) {
            if (c === "\t") {
                whitespaceRemaining = 0;
                continue;
            } else if (c === " ") {
                whitespaceRemaining--;
                continue;
            } else {
                whitespaceRemaining = 0;
            }
        }

        updatedSlice.push(c);
    }

    textEditorRemove(targetEditor, start, end - start);
    textEditorInsert(targetEditor, start, updatedSlice);
    textEditorSetSelection(targetEditor, start, start + updatedSlice.length);
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
                    targetEditor.cursor = s.allFindResults[s.currentFindResultIdx].start;
                    targetEditor.isAutoScrolling = true;
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
            s.cursorBeforeFind = targetEditor.cursor;
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
        let numResults = 0;
        const queryBuffer = finderState.editorState.buffer;
        if (queryBuffer && queryBuffer.length > 0) {
            for (let i = 0; i < editorState.buffer.length; i++) {
                if (textEditorQueryBufferAtPos(editorState.buffer, queryBuffer, i)) {
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
            editorState.cursor = s.allFindResults[minIdx].start;
            editorState.isAutoScrolling = true;
        }
    } 

    imBeginScrollContainer(H100 | CODE | COL |  RELATIVE, true).root; {
        if (imInit()) {
            setInset("10px");
            setClass(cnApp.bgFocus);
            setStyle("userSelect", "none");
            setStyle("cursor", "text");
        }

        if (imMemo(ctx.lastLoaded)) {
            loadText(editorState, state.text);
        } 

        ctx.astStart = 1;
        ctx.astEnd = 5;
        hasSelection = editorState.selectionStart !== -1;

        ctx.textCursorIdx = editorState.cursor;

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
        imBeginTextEditor(editorState); {
            imBeginList();
            while (textEditorHasChars(editorState)) {
                nextListRoot();
                const line = imBeginLayout(COL); {
                    const lineIdx = editorState._renderCursor.line + 1;

                    imBeginLayout(COL); {
                        imBeginLayout(ROW | FLEX); {
                            const lineText = imRef<string>();
                            
                            if (imMemoArray(lineIdx, s.lastMaxLine) || lineText.val === null) {
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

                                        let astNode: ProgramExpression | undefined;
                                        if (astTraverserRef.val && lastParseResult) {
                                            astNode = getAstNodeForTextPos(
                                                astTraverserRef.val,
                                                lastParseResult,
                                                editorState._renderCursor.pos,
                                            );
                                        }

                                        const ws = isWhitespace(actualC);
                                        const c = getStringRepr(actualC, ws);

                                        const textSpan = imBeginSpan(); {
                                            setInnerText(c);
                                            handleTextEditorClickEventForChar(editorState, editorState._renderCursor.pos);

                                            let isFindResult = false;
                                            if (s.isFinding) {
                                                const i = editorState._renderCursor.pos;
                                                for (const range of s.allFindResults) {
                                                    if (range.start <= i && i <= range.end) {
                                                        isFindResult = true;
                                                    }
                                                }
                                            }

                                            const hasFocus = editorState.hasFocus || finderState.editorState.hasFocus;

                                            const isSelected = hasFocus && textEditorCursorIsSelected(editorState, editorState._renderCursor.pos);
                                            const isCursor = hasFocus && editorState._renderCursor.pos === editorState.cursor;
                                            if (isCursor) {
                                                editorState._cursorSpan = textSpan.root;
                                                ctx.textCursorLine = lineIdx;
                                            }

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
                                        handleTextEditorClickEventForChar(editorState, editorState._renderCursor.pos);
                                    } imEnd();
                                } imEnd();

                                // other stuff just below text
                                {
                                    let numErrors = 0;
                                    imBeginList();
                                    if (nextListRoot() && lastInterpreterResult?.errors) {
                                        renderDiagnostics(lastInterpreterResult.errors, "#F00", lineIdx);
                                        numErrors += lastInterpreterResult.errors.length;
                                    }

                                    if (nextListRoot() && lastParseResult?.warnings) {
                                        renderDiagnostics(lastParseResult.warnings, "#F00", lineIdx);
                                        numErrors += lastParseResult.warnings.length;
                                    }

                                    if (nextListRoot() &&
                                        // if this is true, Error: identifier isnt set will prevent this from opening, which is bad.
                                        // we should reconsider even showing that error.
                                        // numErrors === 0 && 
                                        lineIdx === ctx.textCursorLine &&
                                        !hasSelection
                                    ) {
                                        const pos = ctx.textCursorIdx;
                                        const lastIdentifier = parseIdentifierBackwardsFromPoint(state.text, pos - 1);
                                        imAutocomplete(lastIdentifier);
                                    }
                                    imEndList();
                                }
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
                        imBeginList();
                        if (nextListRoot() && inputs) {
                            imBeginList();
                            for (const ui of inputs) {
                                nextListRoot();

                                imBeginLayout(COL | GAP | NORMAL | PADDED); {
                                    imBeginList();
                                    nextListRoot(ui.t);
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
                                    }
                                    imEndList();
                                } imEnd();
                            }
                            imEndList();
                        }
                        imEndList();

                        const thisLineOutputs = lastInterpreterResult?.flushedOutputs?.get(lineIdx);
                        imBeginList();
                        if (nextListRoot() && thisLineOutputs && lastInterpreterResult) {
                            imBeginLayout(NORMAL | PADDED); {
                                if (imInit()) {
                                    setStyle("maxWidth", "60vw");
                                }

                                imProgramOutputs(ctx, lastInterpreterResult, thisLineOutputs);
                            } imEnd();
                        }
                        imEndList();
                    } imEnd();
                } imEnd();

                const rect = line.root.getBoundingClientRect();
                if (isPartiallyOffscreen(rect)) {
                    break;
                } else {
                    textEditorMarkViewEnd(editorState);
                }
            }
            imEndList();

            s.lastMaxLine = editorState._renderCursor.line + 1;

            handleCodeEditorEvents(s, editorState, editorState);

            handleTextEditorMouseScrollEvent(editorState);

        } imEndTextEditor(editorState);


        const modifiedAtChanged = imMemo(editorState.modifiedAt);
        if (modifiedAtChanged) {
            state.text = editorState.buffer.join("");
        } 

        // Empty space below the lines should just handle click events for the end of the line
        imBeginLayout(FLEX); {
            handleTextEditorClickEventForChar(editorState, editorState._renderCursor.pos);
        } imEnd();

        imBeginList();
        if (nextListRoot() && s.isFinding) {
            imBeginLayout(ROW | PRE | ABSOLUTE | OPAQUE); {
                if (imInit()) {
                    setAttributes({
                        style: "bottom: 0; left: 0; right: 0"
                    });
                }

                imBeginLayout(); {
                    imTextSpan("Find: ");
                } imEnd();

                imBeginSimpleTextInput(finderState)
                imSimpleTextInputBody(finderState);

                handleCodeEditorEvents(s, editorState, finderState.editorState);
                imEndSimpleTextInput(finderState)
            } imEnd();
        }
        imEndList();
    } imEnd();
}
