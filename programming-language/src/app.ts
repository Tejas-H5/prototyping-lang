import { cn } from "src/utils/cn";
import { imAppCodeEditor } from './code-editor';
import { renderAppCodeOutput } from './code-output';
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
    W100
} from './layout';
import { GlobalContext, newGlobalContext, rerun, saveState } from './state';
import "./styling";
import { cnApp } from './styling';
import { assert } from './utils/assert';
import { abortListAndRewindUiStack, elementHasMouseClick, imBeginList, imEnd, imEndList, imInit, imMap, imMemo, imRef, imState, nextListRoot, setClass, setStyle } from './utils/im-dom-utils';
import { imEditableTextArea } from "./components/text-area";

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

        const l = imBeginList();
        try {
            savingDisabled = false;

            if (nextListRoot() && !dismissedRef.val) {
                const ctx = imState(newGlobalContext);

                const { state } = ctx;


                const textChanged = imMemo(state.text);
                const autorunChanged = imMemo(state.autoRun);
                if (textChanged || autorunChanged) {
                    saveStateDebounced(ctx);
                    if (state.autoRun) {
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

                        imBeginList();
                        if (nextListRoot() && ctx.isDebugging) {
                            const interpretResult = ctx.lastInterpreterResult;
                            assert(interpretResult);
                            renderDebugger(ctx, interpretResult);
                        } else {
                            nextListRoot();
                            renderAppCodeOutput(ctx);
                        }
                        imEndList();
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

                nextListRoot();

                imBeginLayout(COL | ALIGN_CENTER | JUSTIFY_CENTER | W100 | H100); {
                    imBeginList(); {
                        if (nextListRoot() && errors.size === 1 && errors.values().next().value === 1) {
                            imBeginHeading(); {
                                imTextSpan("An error occured");
                            } imEnd();
                            imBeginLayout(); {
                                imTextSpan(errors.keys().next().value!);
                            } imEnd();
                        } else {
                            nextListRoot();

                            imBeginHeading(); {
                                imTextSpan("The errors just keep occuring !!! Apologies.");
                            } imEnd();

                            imBeginList();
                            for (const [err, count] of errors) {
                                nextListRoot();
                                imBeginLayout(); {
                                    imTextSpan(err + " [" + count + "x]");
                                } imEnd();
                            } imEndList();
                        }
                    } imEndList();
                    imBeginSpace(NaN, 10); imEnd();
                    imBeginLayout(); {
                        imBeginList();
                        if (nextListRoot() && totalErrorsRef.val && totalErrorsRef.val < 10) {
                            imBeginButton(); {
                                imTextSpan("Dismiss [Warning - may lead to data corruption]");
                                if (elementHasMouseClick()) {
                                    dismissedRef.val = false;
                                }
                            } imEnd();
                        } else {
                            nextListRoot();

                            imTextSpan("This button was a bad idea ...");
                        }
                        imEndList();
                    } imEnd();
                } imEnd();
            }
        } catch (e) {
            savingDisabled = true;

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
