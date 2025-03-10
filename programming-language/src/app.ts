import { EditableTextArea } from './components/text-area.ts';
import { ExecutionStep, interpret, ProgramInterpretResult, ProgramResult, programResultTypeString, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING } from './program-interpreter.ts';
import {
    binOpToOpString,
    binOpToString,
    binOpToOpString as binOpToSymbolString,
    DiagnosticInfo,
    expressionTypeToString,
    getSliceText,
    parse,
    ProgramExpression,
    ProgramParseResult,
    T_ASSIGNMENT,
    T_BINARY_OP,
    T_BLOCK,
    T_DATA_INDEX_OP,
    T_FN,
    T_IDENTIFIER,
    T_IDENTIFIER_THE_RESULT_FROM_ABOVE,
    T_LIST_LITERAL,
    T_NUMBER_LITERAL,
    T_RANGE_FOR,
    T_STRING_LITERAL,
    T_TERNARY_IF,
    T_VECTOR_LITERAL
} from './program-parser.ts';
import { GlobalState, loadState, saveState } from './state.ts';
import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { cn, div, el, imElse, imElseIf, imErrorBoundary, imIf, imList, imMemo, imOn, imRerenderable, imState, span, UIRoot } from './utils/im-dom-utils.ts';

function newH3() {
    return document.createElement("h3");
}


function textSpan(r: UIRoot, text: string) {
    span(r, r => r.text(text));
}


function codeSpan(r: UIRoot, text: string) {
    span(r, r => {
        if (r.isFirstRender) {
            r.c(cnApp.code)
             .s("backgroundColor", cssVars.bg2)
        }

        r.text(text);
    });
}

function codeBlock(r: UIRoot, indent: number, fn: (r: UIRoot) => void) {
    div(r, r => {
        if (r.isFirstRender) {
            r.c(cnApp.code)
             .s("backgroundColor", cssVars.bg2)
        }

        r.s("paddingLeft", (4 * indent) + "ch");

        fn(r);
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
                        codeSpan(r, code);
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
                    case T_ASSIGNMENT: {
                        renderRow(title, typeString, depth);
                        dfs("lhs", expr.lhs, depth + 1);
                        dfs("rhs", expr.rhs, depth + 1);
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
                        const queryText = getSliceText(expr.query.slice);
                        const trueText = getSliceText(expr.trueBranch.slice);
                        const falseText = expr.falseBranch ? getSliceText(expr.falseBranch.slice) : "";
                        renderRow(title, typeString, depth, `(${queryText}) ? (${trueText}) : (${falseText})`);

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
                        dfs("loop hi", expr.hiExpr, depth + 1);
                        dfs("loop lo", expr.loExpr, depth + 1);
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

        renderDiagnosticInfo(r, "Errors", parseResult.errors, "No parsing errors!");
        renderDiagnosticInfo(r, "Warnings", parseResult.warnings, "No parsing warnings");
    });
    imElse(r, r => {
        textSpan(r, "No parse results yet");
    });
}

// TODO: display these above the code editor itself. 
function renderDiagnosticInfo(r: UIRoot, heading: string, info: DiagnosticInfo[], emptyText: string) {
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

function newOutputState(): {
    lastText: string;
    lastPaseResult: ProgramParseResult | undefined;
    lastInterpreterResult: ProgramInterpretResult | undefined;
} {
    return { 
        lastText: "", 
        lastPaseResult: undefined, 
        lastInterpreterResult: undefined 
    };
}

function ProgramResults(r: UIRoot, output: ProgramInterpretResult | undefined) {
    imIf(output, r, (r, output) => {
        const renderResult = (r: UIRoot, res: ProgramResult) => {
            div(r, r => {
                imList(r, l => {
                    const r = l.get(res.t);
                    const typeString = programResultTypeString(res)
                    textSpan(r, typeString + " ");
                    switch (res.t) {
                        case T_RESULT_NUMBER:
                            codeSpan(r, "" + res.val);
                            break;
                        case T_RESULT_STRING:
                            codeSpan(r, res.val);
                            break;
                        case T_RESULT_LIST:
                            codeBlock(r, 0, r => {
                                codeSpan(r, "[");
                                codeBlock(r, 1, r => {
                                    imList(r, l => {
                                        for (let i = 0; i < res.values.length; i++) {
                                            const r = l.getNext();
                                            renderResult(r, res.values[i]);
                                            codeSpan(r, ", ");
                                        }
                                    })
                                })
                                codeSpan(r, "]L");
                            })
                            break;
                        case T_RESULT_MATRIX:
                            let idx = 0;
                            const dfs = (r: UIRoot, dim: number, isLast: boolean) => {
                                if (dim === res.val.m.shape.length) {
                                    const val = res.val.m.values[idx];
                                    idx++;

                                    textSpan(r, "" + val);
                                    imIf(!isLast, r, r => {
                                        textSpan(r, ", ");
                                    });
                                    return;
                                }

                                const renderInner = (r: UIRoot) => {
                                    textSpan(r, "[");
                                    imList(r, l => {
                                        const len = res.val.m.shape[dim];
                                        for (let i = 0; i < len; i++) {
                                            // This is because when the 'level' of the list changes, the depth itself changes,
                                            // and the components we're rendering at a particular level will change. 
                                            // so we need to re-key the list.
                                            const r = l.get((res.val.m.shape.length - dim) + "-" + i);
                                            dfs(r, dim + 1, i === len - 1);
                                        }
                                    });
                                    textSpan(r, "]");
                                }

                                codeBlock(r, dim === 0 ? 0 : 1, renderInner);
                            }
                            dfs(r, 0, false);
                            break;
                        case T_RESULT_RANGE:
                            codeSpan(r, "" + res.val.lo);
                            codeSpan(r, " -> ");
                            codeSpan(r, "" + res.val.hi);
                            break;
                        case T_RESULT_FN:
                            codeSpan(r, res.expr.fnName.name);
                            break;
                        default:
                            throw new Error("Unhandled result type: " + programResultTypeString(res));
                    }
                });
            })
        }


        imList(r, l => {
            for (const result of output.results) {
                const r = l.getNext();

                renderResult(r, result);
            }
        });
        imElse(r, r => {
            textSpan(r, "No results yet");
        });

        renderDiagnosticInfo(r, "Interpreting errors", output.errors, "No interpreting errors");
    });
    imElse(r, r => {
        textSpan(r, "No code output yet");
    });
}


function AppCodeOutput(r: UIRoot, ctx: GlobalContext) {
    const s = imState(r, newOutputState);

    const text = ctx.state.text;

    if (s.lastText !== text) {
        s.lastText = text;
        s.lastPaseResult = parse(text);
        s.lastInterpreterResult = interpret(s.lastPaseResult);
    }

    const parseResult = s.lastPaseResult;
    // const programOutput = outputState.lastOutput;

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


        heading("Instructions", ctx.state.collapseProgramOutput, () => {
            ctx.state.collapseProgramOutput = !ctx.state.collapseProgramOutput;
        });

        const renderExecutionStep = (r: UIRoot, interpretResult: ProgramInterpretResult, step: ExecutionStep, i: number) => {
            div(r, r => {
                textSpan(r, i + " | ");

                imIf(step.load, r, (r, value) => {
                    textSpan(r, "Load " + value);
                });
                imIf(step.loadPrevious, r, (r) => {
                    textSpan(r, "Load <the last result>");
                });
                imIf(step.set, r, (r, value) => {
                    textSpan(r, "Set " + value);
                });
                imIf(step.binaryOperator, r, (r, value) => {
                    textSpan(r, "Binary op: " + binOpToOpString(value) + " (" + binOpToString(value) + ")");
                });
                imIf(step.list, r, (r, value) => {
                    textSpan(r, "List " + value);
                });
                imIf(step.vector, r, (r, value) => {
                    textSpan(r, "Vector " + value);
                });
                imIf(step.number, r, (r, value) => {
                    textSpan(r, "Number " + value);
                });
                imIf(step.string, r, (r, value) => {
                    textSpan(r, "String " + value);
                });
                imIf(step.jump, r, (r, value) => {
                    textSpan(r, "Jump: " + value);
                });
                imIf(step.jumpIfFalse, r, (r, value) => {
                    textSpan(r, "Jump if false: " + value);
                });
                imIf(step.blockStatementEnd, r, (r, value) => {
                    textSpan(r, "------------------");
                });
                imIf(step.call, r, (r, value) => {
                    const fn = interpretResult.functions.get(value.fnName);
                    textSpan(r, "Call " + value.fnName + "(" + (fn ? fn.args.length + " args" : "doesn't exist!") + ")");
                });
            });
        }

        const renderFunction = (r: UIRoot, interpretResult: ProgramInterpretResult, steps: ExecutionStep[], name: string) => {
            el(r, newH3, r => {
                textSpan(r, name);
            });
            imList(r, l => {
                for (let i = 0; i < steps.length; i++) {
                    const step = steps[i];
                    const r = l.getNext();
                    renderExecutionStep(r, interpretResult, step, i);
                }
            });
            imElse(r, r => {
                div(r, r => {
                    textSpan(r, "no instructions present");
                });
            });
        }

        imIf(!ctx.state.collapseProgramOutput, r, r => {
            div(r, r => {
                imIf(s.lastInterpreterResult, r, (r, interpretResult) => {
                    ProgramResults(r, interpretResult);

                    el(r, newH3, r => {
                        textSpan(r, "Instructions");
                    });

                    renderFunction(r, interpretResult, interpretResult.entryPoint, "Entry point");
                    imList(r, l => {
                        for (const [name, fn] of interpretResult.functions) {
                            const r = l.getNext();
                            renderFunction(
                                r,
                                interpretResult,
                                fn.steps,
                                name + "(" + fn.args.map(a => a.name).join(", ") + ")"
                            );
                        }
                    })

                });
            });
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

export function renderApp(r: UIRoot) {
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
