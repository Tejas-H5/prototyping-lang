import { cn } from "src/utils/cn";
import { imAppCodeEditor } from './code-editor';
import { renderDebugger } from './debugger';
import {
    ABSOLUTE,
    ALIGN_CENTER,
    imBeginHeading,
    COL,
    FIXED,
    FLEX,
    GAP,
    H100,
    imBeginButton,
    imBeginLayout,
    imBeginSpace,
    imTextSpan,
    JUSTIFY_CENTER,
    NORMAL,
    ROW,
    setInset,
    W100,
    NOT_SET,
    PX
} from './layout';
import { GlobalContext, newGlobalContext, rerun, saveState } from './state';
import "./styling";
import { cnApp } from './styling';
import { assert } from './utils/assert';
import {
    abortListAndRewindUiStack,
    deltaTimeSeconds,
    disableIm,
    elementHasMousePress,
    enableIm,
    getImKeys,
    imBeginList,
    imEnd,
    imEndList,
    imInit,
    imMap,
    imMemo,
    imMemoObjectVals,
    imRef,
    imState,
    nextListRoot,
    setClass,
    setStyle,
    imIf,
    imElse,
    imEndIf,
    imTry,
} from './utils/im-dom-utils';
import { parse } from "./program-parser";
import { renderAppCodeOutput } from "./code-output";

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

export function renderApp() {
    const errors = imMap<string, number>();
    const dismissedRef = imRef();
    const totalErrorsRef = imRef<number>();

    imBeginLayout(FIXED | NORMAL); {
        if (imInit()) {
            setClass(cnApp.normalFont);
            setClass(cn.absoluteFill);
        }

        const l = imTry();
        try {
            savingDisabled = false;

            if (imIf() && !dismissedRef.val) {
                const ctx = imState(newGlobalContext);

                const { state } = ctx;


                const input = ctx.input;

                input.keyboard.escape = false;

                disableIm(); {
                    const { keyDown, keyUp, blur } = getImKeys();

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
                enableIm();

                const stateChanged = imMemoObjectVals(state);
                if (stateChanged) {
                    saveStateDebounced(ctx);

                    // Need to parse as soon as the text changes
                    ctx.lastParseResult = parse(ctx.state.text);

                    // Run the code with a slight debounce
                    if (state.autoRun) {
                        ctx.autoRunTimer = 0.15;
                    }
                } 

                const timerOn = ctx.autoRunTimer > 0;
                if (timerOn) {
                    ctx.autoRunTimer -= deltaTimeSeconds();
                }

                if (imMemo(timerOn)) {
                    if (!timerOn) {
                        rerun(ctx);
                    }
                }

                imBeginLayout(ROW | H100); {
                    imBeginLayout(FLEX); {
                        imAppCodeEditor(ctx);

                        // imEditableTextArea({
                        //     text: ctx.state.text,
                        //     isEditing: true,
                        //     onInput: text => ctx.state.text = text,
                        //     config: {},
                        // }); imEnd();
                    } imEnd();

                    imBeginLayout(FLEX | COL | GAP); {
                        if (imInit()) {
                            setInset("10px");
                        }

                        if (imIf() && ctx.isDebugging) {
                            const interpretResult = ctx.lastInterpreterResult;
                            assert(interpretResult);
                            renderDebugger(ctx, interpretResult);
                        } else {
                            imElse();
                            nextListRoot();
                            renderAppCodeOutput(ctx);
                        } imEndIf();
                    } imEnd();
                } imEnd();

                imBeginLayout(ROW | GAP | ALIGN_CENTER | ABSOLUTE | NORMAL); {
                    if (imInit()) {
                        setStyle("right", "10px");
                        setStyle("bottom", "10px");
                        setStyle("borderRight", "10px");
                        setStyle("height", "2em");
                    }

                    imTextSpan(saveTimeout ? "Saving..." : "Saved");
                } imEnd();
            } else {
                assert(errors.size !== 0);

                imElse();

                imBeginLayout(COL | ALIGN_CENTER | JUSTIFY_CENTER | W100 | H100); {
                    if (imIf() && errors.size === 1 && errors.values().next().value === 1) {
                        imBeginHeading(); {
                            imTextSpan("An error occured");
                        } imEnd();
                        imBeginLayout(); {
                            imTextSpan(errors.keys().next().value!);
                        } imEnd();
                    } else {
                        imElse();

                        imBeginHeading(); {
                            imTextSpan("The errors just keep occuring !!! Apologies.");
                        } imEnd();

                        imBeginList();
                        for (const [err, count] of errors) {
                            nextListRoot();
                            imBeginLayout(); {
                                imTextSpan(err + " [" + count + "x]");
                            } imEnd();
                        } 
                        imEndList();
                    } imEndIf();
                    imBeginSpace(0, NOT_SET, 10, PX); imEnd();
                    imBeginLayout(); {
                        if (imIf() && totalErrorsRef.val && totalErrorsRef.val < 10) {
                            imBeginButton(); {
                                imTextSpan("Dismiss [Warning - may lead to data corruption]");
                                if (elementHasMousePress()) {
                                    dismissedRef.val = false;
                                }
                            } imEnd();
                        } else {
                            imElse();
                            imTextSpan("This button was a bad idea ...");
                        } imEndIf();
                    } imEnd();
                } imEnd();
            } imEndIf();
        } catch (e) {
            savingDisabled = true;

            console.error(e);

            abortListAndRewindUiStack(l);
            const msg = `` + e;
            const existing = errors.get(msg) ?? 0;
            errors.set(msg, existing + 1);

            if (!totalErrorsRef.val) totalErrorsRef.val = 0;
            totalErrorsRef.val++;

            dismissedRef.val = true;
        }
        imEndList();
    } imEnd();

}
