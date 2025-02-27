import { EditableTextArea } from './components/text-area.ts';
import { GlobalState, newGlobalState } from './state.ts';
import "./styling.ts";
import { cnApp } from './styling.ts';
import { cn, div, RenderGroup } from './utils/dom-utils.ts';

function AppCodeOutput(rg: RenderGroup<GlobalContext>) {
    return div({
        class: [cn.h100, cn.preWrap]
    }, [
        rg.text(s => s.state.text),
    ]);
}

function AppCodeEditor(rg: RenderGroup<GlobalContext>) {
    function onInput(newText: string) {
        const state = rg.s.state;

        state.text = newText;

        rg.s.rerenderApp();
    }

    function onInputKeyDown(e: KeyboardEvent, textArea: HTMLTextAreaElement) {
    }

    return div({
        class: [
            // cnApp.bgFocus, 
            cn.h100, cn.borderBox],
        style: "padding: 10px",
    }, [
        div({
            class: [
                cn.w100,
                //cn.h100
            ],
        }, [
            rg.c(EditableTextArea, (c, s) => {
                c.render({
                    text: s.state.text,
                    isEditing: true,
                    onInput,
                    onInputKeyDown,
                    config: {
                        useSpacesInsteadOfTabs: true,
                        tabStopSize: 4
                    },
                });
            })
        ])
    ]);

}

export type GlobalContext = {
    rerenderApp(): void;
    state: GlobalState;
}

export function App(rg: RenderGroup) {
    const ctx: GlobalContext =  {
        rerenderApp: () => {
            rg.renderWithCurrentState();
        },
        state: newGlobalState(),
    }

    ctx.state.text = `Henlo!


        `;

    return div({
        class: [cn.fixed, cn.absoluteFill, cnApp.normalFont],
    }, [
        div({ class: [cn.row, cn.alignItemsStretch, cn.h100] }, [
            div({ class: [cn.flex1] }, [
                rg.c(AppCodeEditor, c => c.render(ctx))
            ]),
            div({ class: [cn.flex1] }, [
                rg.c(AppCodeOutput, c => c.render(ctx))
            ]),
        ]),
    ]);
}
