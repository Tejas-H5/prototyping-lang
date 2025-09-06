import { imButtonIsClicked } from './app-components/im-button';
import { imAppCodeEditor } from './code-editor';
import { imAppCodeOutput } from "./code-output";
import {
    BLOCK,
    COL,
    EM,
    imAbsolute,
    imAlign,
    imFixed,
    imFlex,
    imGap,
    imJustify,
    imLayout,
    imLayoutEnd,
    imPadding,
    imSize,
    NA,
    PERCENT,
    PX,
    ROW
} from "./components/core/layout";
import { cn } from './components/core/stylesheets';
import { FpsCounterState, imExtraDiagnosticInfo, imFpsCounterSimple } from "./components/fps-counter";
import { imLine, LINE_VERTICAL } from './components/im-line';
import { imDebugger } from './debugger';
import { stepProgram } from './program-interpreter';
import { parse } from "./program-parser";
import { GlobalContext, mutateState, newGlobalContext, rerun, saveState, startDebugging, stopDebugging } from './state';
import "./styling";
import { imTestHarness } from "./test-harness";
import { assert } from './utils/assert';
import {
    getDeltaTimeSeconds,
    ImCache,
    imFor,
    imForEnd,
    imGet,
    imGetInline,
    imIf,
    imIfElse,
    imIfEnd,
    imMemo,
    imSet,
    imState,
    imTry,
    imTryCatch,
    imTryEnd,
    inlineTypeId,
    isFirstishRender
} from "./utils/im-core";
import {
    EL_H1,
    elSetClass,
    elSetStyle,
    getGlobalEventSystem,
    imEl,
    imElEnd,
    imStr
} from "./utils/im-dom";

let saveTimeout = 0;
let savingDisabled = false;
function saveStateDebounced(ctx: GlobalContext) {
    if (savingDisabled) return;

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveState(ctx.state);
        saveTimeout = 0;
    }, 1000);
}


// const TESTING_ENABLED = !IS_PROD;
const TEST_HARNESS_ENABLED = true;
let isTesting = false;

export function imApp(c: ImCache, fps: FpsCounterState) {
    let errorState; errorState = imGet(c, inlineTypeId(imApp));
    if (!errorState) errorState = imSet(c, {
        errors: new Map<string, number>(),
        dismissed: false,
        totalErrors: 0,
    });

    let ctx = imGet(c, newGlobalContext);
    if (!ctx) ctx = imSet(c, newGlobalContext());


    if (TEST_HARNESS_ENABLED) {
        const keys = getGlobalEventSystem().keyboard;
        if (keys.keyDown) {
            const key = keys.keyDown.key;
            if (key === "F1") {
                isTesting = !isTesting;
            } else if (key === "Escape" && isTesting) {
                isTesting = !isTesting;
                keys.keyDown = null;
            }
        }
    }

    imLayout(c, COL); imFixed(c, 0, PX, 0, PX, 0, PX, 0, PX); {
        if (isFirstishRender(c)) {
            elSetClass(c, cn.normalFont);
            elSetClass(c, cn.absoluteFill);
        }

        const tryState = imTry(c); try {
            savingDisabled = false;

            if (imIf(c) && !errorState.dismissed) {
                const input = ctx.input;

                input.keyboard.escape = false;

                // input handling
                {
                    const { keyDown, keyUp, blur } = getGlobalEventSystem().keyboard;

                    if (keyDown) {
                        const shiftPressed = keyDown.key === "Shift";
                        const ctrlPressed = keyDown.key === "Control" || keyDown.key === "Meta";
                        if (shiftPressed) input.keyboard.shiftHeld = true;
                        if (ctrlPressed) input.keyboard.ctrlHeld = true;
                        if (keyDown.key === "Escape") input.keyboard.escape = true;
                    }

                    if (keyUp) {
                        const shiftPressed = keyUp.key === "Shift";
                        const ctrlPressed = keyUp.key === "Control" || keyUp.key === "Meta";
                        if (shiftPressed) input.keyboard.shiftHeld = false;
                        if (ctrlPressed) input.keyboard.ctrlHeld = false;
                    }

                    if (blur) {
                        input.keyboard.shiftHeld = false;
                        input.keyboard.ctrlHeld = false;
                    }
                }

                if (imMemo(c, ctx.state._version)) {
                    saveStateDebounced(ctx);

                    // Need to parse as soon as the text changes
                    ctx.lastParseResult = parse(ctx.state.text);

                    // Run the code with a slight debounce
                    if (ctx.state.autoRun) {
                        ctx.autoRunTimer = 0.15;
                    }
                } 

                const timerOn = ctx.autoRunTimer > 0;
                if (timerOn) {
                    ctx.autoRunTimer -= getDeltaTimeSeconds(c);
                }

                if (imMemo(c, timerOn)) {
                    if (!timerOn) {
                        rerun(ctx);
                    }
                }

                const editorIsOpen = ctx.editorIsOpen || ctx.isDebugging;
                const resultsIsOpen = ctx.resultsIsOpen && !ctx.isDebugging;
                const debuggerIsOpen = ctx.isDebugging;

                const mouse = getGlobalEventSystem().mouse;
                const isTopBarMinimized = mouse.Y > 100;
                imLayout(c, ROW); imGap(c, 5, PX); imPadding(c, 2, PX, 5, PX, 2, PX, 5, PX); 
                imSize(c, 0, NA, 10, isTopBarMinimized ? PX: NA); {
                    if (imButtonIsClicked(c, "Editor", editorIsOpen)) {
                        ctx.editorIsOpen = !ctx.editorIsOpen;

                        if (!ctx.editorIsOpen && !ctx.resultsIsOpen) {
                            ctx.resultsIsOpen = true;
                        }
                    }

                    if (imIf(c) && editorIsOpen) {
                        imLayout(c, ROW);  imGap(c, 5, PX); {
                            imLayout(c, ROW); imFlex(c); imGap(c, 5, PX); {
                                if (imButtonIsClicked(c, "Debug text editor", ctx.state.debugTextEditor)) {
                                    ctx.state.debugTextEditor = !ctx.state.debugTextEditor;
                                    mutateState(ctx.state);
                                }
                            } imLayoutEnd(c);
                        } imLayoutEnd(c);
                    } imIfEnd(c);

                    imLayout(c, ROW); imFlex(c); imAlign(c); imJustify(c); {
                        if (imIf(c) && !isTopBarMinimized) {
                            if (imIf(c) && saveTimeout) {
                                imStr(c, saveTimeout ? "Saving..." : "Saved");
                            } else {
                                imIfElse(c);

                                imLayout(c, ROW); imGap(c, 10, PX); imJustify(c); {
                                    imFpsCounterSimple(c, fps);
                                    imExtraDiagnosticInfo(c);
                                } imLayoutEnd(c);
                            } imIfEnd(c);
                        } imIfEnd(c);
                    } imLayoutEnd(c);


                    if (imIf(c) && resultsIsOpen) {
                        imLayout(c, ROW); imGap(c, 5, PX); {
                            if (imButtonIsClicked(c, "Autorun", ctx.state.autoRun)) {
                                ctx.state.autoRun = !ctx.state.autoRun
                                mutateState(ctx.state);

                                if (ctx.state.autoRun) {
                                    rerun(ctx);
                                }
                            }

                            if (imButtonIsClicked(c, "Grouped", ctx.state.showGroupedOutput)) {
                                ctx.state.showGroupedOutput = !ctx.state.showGroupedOutput;
                                mutateState(ctx.state);
                            }

                            if (imButtonIsClicked(c, "Show AST", ctx.state.showParserOutput)) {
                                ctx.state.showParserOutput = !ctx.state.showParserOutput;
                                mutateState(ctx.state);
                            }

                            if (imButtonIsClicked(c, "Show instructions", ctx.state.showInterpreterOutput)) {
                                ctx.state.showInterpreterOutput = !ctx.state.showInterpreterOutput;
                                mutateState(ctx.state);
                            }
                        } imLayoutEnd(c);

                        imLine(c, LINE_VERTICAL, 2);

                    } imIfEnd(c);

                    if (imIf(c) && debuggerIsOpen && ctx.lastInterpreterResult) {
                        imLayout(c, ROW); imGap(c, 5, PX); {
                            if (imButtonIsClicked(c, "Step")) {
                                stepProgram(ctx.lastInterpreterResult);
                            }

                            if (imButtonIsClicked(c, "Reset")) {
                                assert(ctx.lastParseResult !== undefined);
                                startDebugging(ctx);
                            }
                        } imLayoutEnd(c);
                    } imIfEnd(c);


                    imLayout(c, ROW); imGap(c, 5, PX); {
                        if (imIf(c) && !debuggerIsOpen) {
                            if (imButtonIsClicked(c, "Results", resultsIsOpen)) {
                                ctx.resultsIsOpen = !ctx.resultsIsOpen;

                                if (!ctx.editorIsOpen && resultsIsOpen) {
                                    ctx.editorIsOpen = true;
                                }
                            }
                        } imIfEnd(c);

                        if (imButtonIsClicked(c, "Debugger", debuggerIsOpen)) {
                            if (!ctx.isDebugging) {
                                startDebugging(ctx);
                            } else {
                                stopDebugging(ctx);
                                rerun(ctx);
                            }
                        }
                    } imLayoutEnd(c);
                } imLayoutEnd(c);

                imLayout(c, ROW); imFlex(c); {
                    if (imIf(c) && editorIsOpen) {
                        imLayout(c, COL); imFlex(c); {
                            imAppCodeEditor(c, ctx);
                        } imLayoutEnd(c);
                    } imIfEnd(c);

                    if (imIf(c) && (resultsIsOpen || debuggerIsOpen)) {
                        imLayout(c, COL); imFlex(c); {
                            if (imIf(c) && resultsIsOpen) {
                                imAppCodeOutput(c, ctx);
                            } imIfEnd(c);

                            if (imIf(c) && debuggerIsOpen && ctx.isDebugging && ctx.lastInterpreterResult) {
                                // TODO: 
                                // - watch window, eval arbitrary expressions
                                // - callstack, and step actual sourcecode
                                // - highlight the exact expression in the sourcecode

                                imDebugger(c, ctx, ctx.lastInterpreterResult);
                            } imIfEnd(c);
                        } imLayoutEnd(c);
                    } imIfEnd(c);
                } imLayoutEnd(c);
            } else {
                const { errors, totalErrors } = errorState;

                assert(errors.size !== 0);

                imIfElse(c);

                imLayout(c, COL); imAlign(c); imJustify(c); imFlex(c); {
                    if (imIf(c) && errors.size === 1 && errors.values().next().value === 1) {
                        imEl(c, EL_H1); imStr(c, "An error occured"); imElEnd(c, EL_H1);

                        imLayout(c, BLOCK); imStr(c, errors.keys().next().value!); imLayoutEnd(c);
                    } else {
                        imIfElse(c);

                        imEl(c, EL_H1); imStr(c, "The errors just keep occuring !!! Apologies."); imElEnd(c, EL_H1);

                        imFor(c); for (const [err, count] of errors) {
                            imLayout(c, BLOCK); imStr(c, err + " [" + count + "x]"); imLayoutEnd(c);
                        } imForEnd(c);
                    } imIfEnd(c);

                    imLayout(c, BLOCK); imSize(c, 0, NA, 10, PX); imLayoutEnd(c);

                    imLayout(c, BLOCK); {
                        if (imIf(c) && totalErrors && totalErrors < 10) {
                            if (imButtonIsClicked(c, "Dismiss [Warning - may lead to data corruption]")) {
                                errorState.dismissed = false;
                                tryState.recover();
                            }
                        } else {
                            imIfElse(c);
                            imStr(c, "This button was a bad idea ...");
                        } imIfEnd(c);
                    } imLayoutEnd(c);
                } imLayoutEnd(c); 
            } imIfEnd(c);

            if (TEST_HARNESS_ENABLED) {
                if (imIf(c) && isTesting) {
                    imTestHarness(c);
                } imIfEnd(c);
            }
        } catch (e) {
            imTryCatch(c, tryState, e);

            savingDisabled = true;

            console.error(e);

            const msg = `` + e;
            const existing = errorState.errors.get(msg) ?? 0;
            errorState.errors.set(msg, existing + 1);
            errorState.totalErrors++;
            errorState.dismissed = true;
        } imTryEnd(c, tryState);
    } imLayoutEnd(c);
}
