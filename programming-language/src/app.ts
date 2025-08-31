import { imButtonIsClicked } from './app-components/im-button';
import { imAppCodeEditor as imCodeEditor } from './code-editor';
import { imAppCodeOutput } from "./code-output";
import {
    BLOCK,
    COL,
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
import { imDebugger } from './debugger';
import { parse } from "./program-parser";
import { GlobalContext, newGlobalContext, rerun, saveState } from './state';
import "./styling";
import { imTestHarness } from "./test-harness";
import { assert } from './utils/assert';
import {
    getDeltaTimeSeconds,
    ImCache,
    imFor,
    imForEnd,
    imGet,
    imIf,
    imIfElse,
    imIfEnd,
    imMemo,
    imSet,
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
    imElBegin,
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

    imLayout(c, BLOCK); imFixed(c, 0, PX, 0, PX, 0, PX, 0, PX); {
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

                imLayout(c, ROW); imSize(c, 0, NA, 100, PERCENT); {
                    imLayout(c, COL); imFlex(c); {
                        imCodeEditor(c, ctx);
                    } imLayoutEnd(c);

                    imLayout(c, COL); imFlex(c); imGap(c, 5, PX); imPadding(c, 10, PX, 10, PX, 10, PX, 10, PX); {
                        if (imIf(c) && ctx.isDebugging) {
                            const interpretResult = ctx.lastInterpreterResult;
                            assert(!!interpretResult);
                            imDebugger(c, ctx, interpretResult);
                        } else {
                            imIfElse(c);
                            imAppCodeOutput(c, ctx);
                        } imIfEnd(c);
                    } imLayoutEnd(c);
                } imLayoutEnd(c);

                imLayout(c, ROW); imGap(c, 5, PX); imAlign(c); imAbsolute(c, 0, NA, 10, PX, 10, PX, 0, NA); {
                    if (isFirstishRender(c)) {
                        elSetStyle(c, "right", "10px");
                        elSetStyle(c, "bottom", "10px");
                        elSetStyle(c, "borderRight", "10px");
                        elSetStyle(c, "height", "2em");
                    }

                    if (imIf(c) && saveTimeout) {
                        imStr(c, saveTimeout ? "Saving..." : "Saved");
                    } else {
                        imIfElse(c);

                        imLayout(c, BLOCK); {
                            imFpsCounterSimple(c, fps);
                            imExtraDiagnosticInfo(c);
                        } imLayoutEnd(c);
                    } imIfEnd(c);
                } imLayoutEnd(c);
            } else {
                const { errors, totalErrors } = errorState;

                assert(errors.size !== 0);

                imIfElse(c);

                imLayout(c, COL); imAlign(c); imJustify(c); imSize(c, 100, PERCENT, 100, PERCENT); {
                    if (imIf(c) && errors.size === 1 && errors.values().next().value === 1) {
                        imElBegin(c, EL_H1); imStr(c, "An error occured"); imElEnd(c, EL_H1);

                        imLayout(c, BLOCK); imStr(c, errors.keys().next().value!); imLayoutEnd(c);
                    } else {
                        imIfElse(c);

                        imElBegin(c, EL_H1); imStr(c, "The errors just keep occuring !!! Apologies."); imElEnd(c, EL_H1);

                        imFor(c); for (const [err, count] of errors) {
                            imLayout(c, BLOCK); imStr(c, err + " [" + count + "x]"); imLayoutEnd(c);
                        } imForEnd(c);
                    } imIfEnd(c);

                    imLayout(c, BLOCK); imSize(c, 0, NA, 10, PX); imLayoutEnd(c);

                    imLayout(c, BLOCK); {
                        if (imIf(c) && totalErrors && totalErrors < 10) {
                            if (imButtonIsClicked(c, "Dismiss [Warning - may lead to data corruption]")) {
                                errorState.dismissed = false;
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
