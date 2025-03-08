import { EditableTextArea } from './components/text-area.ts';
import {
    binOpToString,
    getBinaryOperatorTypeOpString as binOpToSymbolString,
    DiagnosticInfo,
    expressionTypeToString,
    getSliceText,
    interpret,
    parse,
    ProgramExpression,
    ProgramOutput,
    programResultTypeString,
    ProgramParseResult,
    T_BINARY_OP,
    T_BLOCK,
    T_DATA_INDEX_OP,
    T_FN,
    T_IDENTIFIER,
    T_IDENTIFIER_THE_RESULT_FROM_ABOVE,
    T_LIST_LITERAL,
    T_VECTOR_LITERAL,
    T_NUMBER_LITERAL,
    T_RANGE_FOR,
    T_STRING_LITERAL,
    T_TERNARY_IF
} from './program-parser.ts';
import { GlobalState, loadState, saveState } from './state.ts';
import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { cn, div, el, imElse, imErrorBoundary, imIf, imList, imMemo, imOn, imRerenderable, imState, span, UIRoot } from './utils/im-dom-utils.ts';

function newH3() {
    return document.createElement("h3");
}

function newOutputState(): {
    lastText: string;
    lastPaseResult: ProgramParseResult | undefined;
    lastOutput: ProgramOutput | undefined;
} {
    return { lastText: "", lastOutput: undefined, lastPaseResult: undefined, };
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


function ParserOutput(r: UIRoot, parseResult: ProgramParseResult | undefined) {
    imIf(parseResult, r, (r, parseResult) => {
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

            const dfs = (title: string, expr: ProgramExpression | undefined, depth: number, showCode = true) => {
                if (!expr) {
                    renderRow(title, INCOMPLETE, depth);
                    return;
                }

                let typeString = expressionTypeToString(expr);
                switch (expr.t) {
                    case T_IDENTIFIER: {
                        renderRow(title, typeString, depth, getSliceText(expr.slice));
                    } break;
                    case T_IDENTIFIER_THE_RESULT_FROM_ABOVE: {
                        renderRow(title, typeString, depth);
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
                    case T_LIST_LITERAL: 
                    case T_VECTOR_LITERAL: {
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
                    case T_TERNARY_IF: {
                        renderRow(title, typeString, depth, getSliceText(expr.slice));

                        dfs("query", expr.query, depth + 1);
                        dfs("trueBranch", expr.trueBranch, depth + 1);
                        if (expr.falseBranch) {
                            dfs("falseBranch", expr.falseBranch, depth + 1);
                        }
                    } break;
                    case T_BLOCK: {
                        renderRow(title, typeString, depth, "statement count: " + expr.statements.length);

                        for (let i = 0; i < expr.statements.length; i++) {
                            dfs("s" + i, expr.statements[i], depth + 1);
                        }
                    } break;
                    case T_RANGE_FOR: {
                        renderRow(title, typeString, depth);
                        dfs("loop var", expr.loopVar, depth + 1);
                        dfs("loop range", expr.range, depth + 1);
                        dfs("loop body", expr.body, depth + 1);
                    } break;
                    case T_FN: {
                        renderRow(title, typeString, depth);
                        dfs("name", expr.fnName, depth + 1);
                        for (let i = 0; i < expr.arguments.length; i++) {
                            dfs("arg" + i, expr.arguments[i], depth + 1);
                        }
                        if (expr.body) {
                            dfs("body", expr.body, depth + 1);
                        }
                    } break;
                    case T_DATA_INDEX_OP: {
                        renderRow(title, typeString, depth);
                        dfs("var", expr.lhs, depth + 1);
                        for (let i = 0; i < expr.indexes.length; i++) {
                            dfs("[" + i + "]", expr.indexes[i], depth + 1);
                        }
                    } break;
                    default: {
                        throw new Error("Unhandled type: " + typeString);
                    }
                }
            }

            const statements = parseResult.statements;
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                dfs("Statement " + (i + 1), statement, 0);
            }
        });
        imElse(r, r => {
            textSpan(r, "Nothing parsed yet");
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

        displayInfo("Errors", parseResult.errors, "No parsing errors!");
        displayInfo("Warnings", parseResult.warnings, "No parsing warnings");
    });
    imElse(r, r => {
        textSpan(r, "No parse results yet");
    });
}

function CodeOuptut(r: UIRoot, output: ProgramOutput | undefined) {
    imIf(output, r, (r, output) => {
        imList(r, l => {
            for (const result of output.results) {
                const r = l.getNext();
                imList(r, l => {
                    const r = l.get(result.t);

                    switch(r) {
                    default:
                        throw new Error("Unhandled result type: " + programResultTypeString(result));
                    }
                });
            }
        });
        imElse(r, r => {
            textSpan(r, "No results yet");
        });
    });
    imElse(r, r => {
        textSpan(r, "No code output yet");
    });
}

function AppCodeOutput(r: UIRoot, ctx: GlobalContext) {
    const outputState = imState(r, newOutputState);

    const text = ctx.state.text;

    if (outputState.lastText !== text) {
        outputState.lastText = text;
        outputState.lastPaseResult = parse(text);
        outputState.lastOutput = interpret(outputState.lastPaseResult);
    }

    const parseResult = outputState.lastPaseResult;
    const programOutput = outputState.lastOutput;

    div(r, r => {
        if (r.isFirstRender) {
            r.c(cn.h100).c(cn.overflowYAuto).c(cn.borderBox)
                // .c(cn.preWrap)
             .s("padding", "10px");
        }

        const heading = (heading: string, isCollapsed: boolean, toggle: () => void) => {
            el(r, newH3, r => {
                r.isFirstRender && r.s("padding", "10px 0").s("userSelect", "none").s("cursor", "pointer");

                textSpan(r, heading);
                imIf(isCollapsed, r, r => {
                    textSpan(r, " (collapsed)");
                });

                imOn(r, "click", () => {
                    toggle();
                    ctx.rerenderApp();
                });
            });
        }

        heading("Parser output", ctx.state.collapseParserOutput, () => {
            ctx.state.collapseParserOutput = !ctx.state.collapseParserOutput;
        });
        imIf(!ctx.state.collapseParserOutput, r, r => {
            ParserOutput(r, parseResult);
        });

        heading("Program output", ctx.state.collapseProgramOutput, () => {
            ctx.state.collapseProgramOutput = !ctx.state.collapseProgramOutput;
        });
        imIf(!ctx.state.collapseProgramOutput, r, r => {
            CodeOuptut(r, programOutput);
        });
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
    imRerenderable(r, (r, rerender) => {
        const ctx = imState(r, newGlobalContext);
        ctx.rerenderApp = rerender;

        const { state } = ctx;

        if (!imMemo(r).keys(state).isSame) {
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
    });
}
