import { EditableTextArea } from './components/text-area.ts';
import { binOpToString, expressionTypeToString, getBinaryOperatorType, getBinaryOperatorTypeOpString as binOpToSymbolString, getSliceText, interpret, parse, ProgramExpression, ProgramOutput, T_BINARY_OP, T_IDENTIFIER, T_LIST_LITERAL, T_NUMBER_LITERAL, DiagnosticInfo, T_STRING_LITERAL } from './program-parser.ts';
import { GlobalState, loadState, saveState } from './state.ts';
import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { cn, div, el, imElse, imErrorBoundary, imIf, imList, imRef, imRerenderFn, imState, span, UIRoot } from './utils/im-dom-utils.ts';

function newH3() {
    return document.createElement("h3");
}

function newOutputState(): {
    lastText: string;
    lastOutput: ProgramOutput | null;
} {
    return { lastText: "", lastOutput: null };
}

function textSpan(r: UIRoot, text: string) {
    span(r, r => r.text(text));
}


function textCode(r: UIRoot, text: string) {
    span(r, r => {
        if (r.isFirstRender) {
            r.c(cnApp.code)
             .s("backgroundColor", cssVars.bg2)
        }

        r.text(text);
    });
}

function AppCodeOutput(r: UIRoot, ctx: GlobalContext) {
    const outputState = imState(r, newOutputState);

    const text = ctx.state.text;
    if (outputState.lastText !== text) {
        outputState.lastText = text;

        const program = parse(text);
        outputState.lastOutput = interpret(program);
    }

    const output = outputState.lastOutput;

    div(r, r => {
        if (r.isFirstRender) {
            r.c(cn.h100).c(cn.overflowYAuto).c(cn.borderBox)
                // .c(cn.preWrap)
             .s("padding", "10px");
        }

        el(r, newH3, r => {
            r.isFirstRender && r.s("padding", "10px 0");

            textSpan(r, "Output");
        });

        imIf(output, r, (r, output) => {
            imList(r, l => {
                function renderRow(title: string, type: string, depth: number, code?: string) {
                    const r = l.getNext();
                    div(r, r => {
                        r.s("paddingLeft", (depth * 20) + "px");
                        textSpan(r, title);
                        textSpan(r, " = ");
                        textSpan(r, type);
                        imIf(code, r, (r, code) => {
                            textSpan(r, " ");
                            textCode(r, code);
                        })
                    });
                }

                const INCOMPLETE = " <Incomplete!> ";

                const dfs = (title: string, expr: ProgramExpression | undefined, depth: number) => {
                    if (!expr) {
                        renderRow(title, INCOMPLETE, depth);
                        return;
                    }

                    let typeString = expressionTypeToString(expr);
                    switch (expr.t) {
                        case T_IDENTIFIER: {
                            renderRow(title, typeString, depth, getSliceText(expr.slice));

                            if (expr.indexers) {
                                for (let i = 0; i < expr.indexers.length; i++) {
                                    dfs("[" + i + "]", expr.indexers[i], depth + 1);
                                }
                            }
                        } break;
                        case T_BINARY_OP: {
                            const lhsText = getSliceText(expr.lhs.slice);
                            const rhsText = expr.rhs ? getSliceText(expr.rhs.slice) : INCOMPLETE;
                            const opSymbol = binOpToSymbolString(expr.op);
                            const text = `(${lhsText}) ${opSymbol} (${rhsText})`;
                            renderRow(title, binOpToString(expr.op), depth, text);

                            dfs("lhs", expr.lhs, depth + 1);
                            dfs("rhs", expr.rhs, depth + 1);
                        } break;
                        case T_LIST_LITERAL: {
                            renderRow(title, typeString, depth, getSliceText(expr.slice));

                            for (let i = 0; i < expr.items.length; i++) {
                                dfs("[" + i + "]", expr.items[i], depth + 1);
                            }
                        } break;
                        case T_NUMBER_LITERAL: {
                            renderRow(title, typeString, depth, getSliceText(expr.slice));
                        } break;
                        case T_STRING_LITERAL: {
                            renderRow(title, typeString, depth, getSliceText(expr.slice));
                        } break;
                        default: {
                            throw new Error("Unhandled type: " + typeString);
                        }
                    }
                }

                const statements = output.program.statements;
                for (let i = 0; i < statements.length; i++) {
                    const statement = statements[i];
                    dfs("Statement " + (i + 1), statement, 0);
                }
            });

            // TODO: display these in the code editor itself. 

            const displayInfo = (heading: string, info: DiagnosticInfo[], emptyText: string) => {
                el(r, newH3, r => {
                    r.isFirstRender && r.s("padding", "10px 0");
                    textSpan(r, heading);
                });
                imList(r, l => {
                    for (const e of info) {
                        const r = l.getNext();
                        div(r, r => {
                            textSpan(r, "Line " + e.pos.line + " Col " + (e.pos.col + 1) + " - " + e.problem);
                        });
                    }
                });
                imIf(info.length === 0, r, r => {
                    div(r, r => {
                        textSpan(r, emptyText);
                    });
                })
            }

            displayInfo("Errors", output.program.errors, "No parsing errors!");
            displayInfo("Warnings", output.program.warnings, "No parsing warnings");
        });
        imElse(r, r => {
            textSpan(r, "No output yet");
        })

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
             .c(cnApp.code)
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
        state: loadState(),
    };
}

let saveTimeout = 0;
function saveStateDebounced(ctx: GlobalContext) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveState(ctx.state);
        saveTimeout = 0;

        ctx.rerenderApp();
    }, 1000);
}

export function App(r: UIRoot) {
    const rerender = imRerenderFn(r, () => App(r));

    const ctx = imState(r, newGlobalContext);
    ctx.rerenderApp = rerender;

    const { state } = ctx;

    const lastTextRef = imRef<string>(r);
    if (lastTextRef.val === null) {
        lastTextRef.val = state.text;
    } else if (lastTextRef.val !== state.text) {
        lastTextRef.val = state.text;
        saveStateDebounced(ctx);
    }

    div(r, r => {
        if (r.isFirstRender) {
            r.c(cn.fixed).c(cn.absoluteFill)
             .c(cnApp.normalFont);
        }

        imErrorBoundary(r, r => {
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


            div(r, r => {
                if (r.isFirstRender) {
                    r.c(cn.absolute)
                     .s("right", "10px").s("bottom", "10px")
                }

                r.text(saveTimeout ? "Saving..." : "Saved");
            });
        }, (r, error, _recover) => {
            console.error(error);

            div(r, r => {
                textSpan(r, "An error occured: " + error.message);
            });
        });
    });
}
