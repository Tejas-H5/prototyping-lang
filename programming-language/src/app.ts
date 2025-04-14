import { imAppCodeEditor } from './code-editor';
import { renderAppCodeOutput } from './code-output';
import { renderDebugger } from './debugger';
import {
    ABSOLUTE,
    ALIGN_CENTER,
    COL,
    FIXED,
    FLEX,
    GAP,
    H100,
    imBeginLayout,
    imTextSpan,
    NORMAL,
    ROW,
    setInset
} from './layout';
import { GlobalContext, newGlobalContext, rerun, saveState } from './state';
import "./styling";
import { cnApp } from './styling';
import { assert } from './utils/assert';
import { abortListAndRewindUiStack, cn, imBeginDiv, imBeginList, imBeginMemo, imEnd, imEndList, imEndMemo, imInit, imRef, imState, nextListRoot, setClass, setStyle } from './utils/im-dom-utils';

let saveTimeout = 0;
function saveStateDebounced(ctx: GlobalContext) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveState(ctx.state);
        saveTimeout = 0;
    }, 1000);
}

export function renderApp() {
    const error = imRef<any>();

    imBeginLayout(FIXED | NORMAL); {
        if (imInit()) {
            setClass(cnApp.normalFont);
            setClass(cn.absoluteFill);
        }

        const l = imBeginList();
        try {
            if (nextListRoot() && !error.val) {
                const ctx = imState(newGlobalContext);

                const { state } = ctx;


                if (imBeginMemo()
                    .val(state.text)
                    .val(state.autoRun)
                    .changed()
                ) {
                    saveStateDebounced(ctx);
                    if (state.autoRun) {
                        rerun(ctx);
                    }
                } imEndMemo();

                imBeginLayout(ROW | H100); {
                    imBeginLayout(FLEX); {
                        imAppCodeEditor(ctx);
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
                nextListRoot();

                imBeginDiv(); {
                    imTextSpan("An error occured: " + error.val.message);
                } imEnd();
            }
        } catch (e) {
            abortListAndRewindUiStack(l);
            console.error(e);
            error.val = e;
        }
        imEndList();
    } imEnd();

}
