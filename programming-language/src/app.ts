import { EditableTextArea } from './components/text-area.ts';
import { GlobalState, newGlobalState } from './state.ts';
import "./styling.ts";
import { cnApp } from './styling.ts';
import { cn, div, imState, imRerenderFn, UIRoot } from './utils/im-dom-utils.ts';

function AppCodeOutput(r: UIRoot, ctx: GlobalContext) {
    const { state } = ctx;

    div(r, r => {
        if (r.isFirstRender) {
            r.c(cn.h100).c(cn.preWrap).c(cn.overflowYAuto).c(cn.borderBox)
             .s("padding", "10px");
        }

        r.text(state.text);
    });
}

function AppCodeEditor(r: UIRoot, ctx: GlobalContext) {
    const { state, rerenderApp } = ctx;

    function onInput(newText: string) {
        state.text = newText;
        rerenderApp();
    }

    function onInputKeyDown(e: KeyboardEvent, textArea: HTMLTextAreaElement) {

    }

    div(r, r => {
        if (r.isFirstRender) {
            r.c(cnApp.bgFocus).c(cn.h100).c(cn.overflowYAuto).c(cn.borderBox)
             .s("padding", "10px");
        }

        EditableTextArea(r, {
            text: state.text,
            isEditing: true,
            onInput,
            onInputKeyDown,
            config: {
                useSpacesInsteadOfTabs: true,
                tabStopSize: 4
            },
        });
    });
}

export type GlobalContext = {
    state: GlobalState;
    rerenderApp: () => void;
}

function newGlobalContext() {
    return {
        rerenderApp: () => {},
        state: newGlobalState(),
    };
}

export function App(r: UIRoot) {
    const rerender = imRerenderFn(r, () => App(r));

    const ctx = imState(r, newGlobalContext);
    ctx.rerenderApp = rerender;

    div(r, r => {
        if (r.isFirstRender) {
            r.c(cn.fixed).c(cn.absoluteFill)
             .c(cnApp.normalFont);
        }

        div(r, r => {
            if (r.isFirstRender) {
                r.c(cn.row).c(cn.alignItemsStretch).c(cn.h100);
            }

            div(r, r => {
                if (r.isFirstRender) {
                    r.c(cn.flex1);
                }

                AppCodeEditor(r, ctx);
            });
            div(r, r => {
                if (r.isFirstRender) {
                    r.c(cn.flex1);
                }

                AppCodeOutput(r, ctx);
            });
        });
    });
}
