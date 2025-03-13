import { EditableTextArea } from './components/text-area.ts';
import { ExecutionStep, ExecutionSteps, getCurrentCallstack, interpret, ProgramInterpretResult, ProgramResult, programResultTypeString, startInterpreting, stepProgram, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING } from './program-interpreter.ts';
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
import { GlobalContext, GlobalState, loadState, newGlobalContext, saveState, startDebugging } from './state.ts';
import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { assert, cn, div, el, imElse, imElseIf, imErrorBoundary, imIf, imList, imMemo, imOn, imRef, imRerenderable, imState, imStateInline, newCssBuilder, Ref, RenderFn, scrollIntoView, span, UIRoot } from './utils/im-dom-utils.ts';
import { getLineBeforePos, getLineEndPos, getLineStartPos } from './utils/text-utils.ts';

function newH3() {
    return document.createElement("h3");
}


function textSpan(r: UIRoot, text: string, fn?: RenderFn) {
    span(r, r => {
        r.text(text)
        fn?.(r);
    });
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

function codeBlock(r: UIRoot, indent: number, fn: (r: UIRoot<HTMLDivElement>) => void) {
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

function renderProgramResult(r: UIRoot, res: ProgramResult) {
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
                                    renderProgramResult(r, res.values[i]);
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
                                    // We need to re-key the list, so that we may render a different kind of component at this position.
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

function renderProgramResults(r: UIRoot, output: ProgramInterpretResult | undefined) {
}

function collapsableHeading(r: UIRoot, heading: string, isCollapsed: boolean, toggle: () => void) {
    el(r, newH3, r => {
        r.isFirstRender && r.s("padding", "10px 0").s("userSelect", "none").s("cursor", "pointer");

        textSpan(r, heading);
        imIf(isCollapsed, r, r => {
            textSpan(r, " (collapsed)");
        });

        imOn(r, "click", () => {
            toggle();
        });
    });
}

function renderExecutionStep(r: UIRoot, interpretResult: ProgramInterpretResult, step: ExecutionStep, i: number, isCurrentInstruction: boolean) {
    return div(r, r => {
        textSpan(r, i + " | ");

        imIf(step.load, r, (r, value) => {
            textSpan(r, "Load " + value);
        });
        // imIf(step.loadPrevious, r, (r) => {
        //     textSpan(r, "Load <the last result>");
        // });
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
        imIf(step.blockStatementEnd !== undefined, r, (r, value) => {
            textSpan(r, value ? "------------------" : "---");
        });
        imIf(step.call, r, (r, value) => {
            const fn = interpretResult.functions.get(value.fnName);
            textSpan(r, "Call " + value.fnName + "(" + (fn ? fn.args.length + " args" : "doesn't exist!") + ")");
        });
        imIf(step.incr, r, (r, value) => {
            textSpan(r, "Increment var  " + value);
        });
        imIf(step.decr, r, (r, value) => {
            textSpan(r, "Decrement var  " + value);
        });

        imIf(isCurrentInstruction, r, r => {
            textSpan(r, " <----");
        });
    });
}

function renderFunction(r: UIRoot, interpretResult: ProgramInterpretResult, { name, steps }: ExecutionSteps) {
    div(r, r => {
        r.isFirstRender && r.c(cn.flex1).c(cn.col);

        el(r, newH3, r => {
            textSpan(r, name);
        });

        div(r, r => {
            r.isFirstRender && r.c(cn.flex1).c(cn.overflowYAuto);

            const scrollContainer = r;

            codeBlock(r, 0, r => {

                imList(r, l => {
                    let rCurrent: UIRoot<HTMLDivElement> | undefined;

                    for (let i = 0; i < steps.length; i++) {
                        const step = steps[i];
                        const r = l.getNext();

                        const call = getCurrentCallstack(interpretResult);
                        const isCurrent = call?.code?.steps === steps
                            && i === call.i;

                        const r1 = renderExecutionStep(r, interpretResult, step, i, isCurrent);
                        if (isCurrent) {
                            rCurrent = r1;
                        }
                    }

                    if (rCurrent) {
                        scrollIntoView(scrollContainer.root, rCurrent.root, 0.5, 0.5);
                    }
                });
                imElse(r, r => {
                    div(r, r => {
                        textSpan(r, "no instructions present");
                    });
                });
            });
        })
    });
}

const cssb = newCssBuilder();

const cnButton = cssb.cn("button", [
    ` { user-select: none; cursor: pointer; border: 2px solid ${cssVars.fg}; border: 2px solid currentColor; border-radius: 8px; }`,
    `:hover { background-color: ${cssVars.bg2} }`,
    `:active { background-color: ${cssVars.mg} }`,
]);

function Button(r: UIRoot, text: string, onClick: () => void, toggled: boolean = false) {
    div(r, r => {
        if (r.isFirstRender) {
            r.c(cnButton);
            r.c(cn.row).c(cn.alignItemsCenter).c(cn.justifyContentCenter);
        }

        r.c(cnApp.inverted, toggled);

        textSpan(r, text);
        imOn(r, "click", onClick);
    });
}

function renderAppCodeOutput(r: UIRoot, ctx: GlobalContext) {
    const parseResult = ctx.lastParseResult;

    div(r, r => {
        if (r.isFirstRender) {
            r.c(cn.h100).c(cn.overflowYAuto).c(cn.borderBox)
                // .c(cn.preWrap)
             .s("padding", "10px");
        }

        collapsableHeading(r, "Parser output", ctx.state.collapseParserOutput, () => {
            ctx.state.collapseParserOutput = !ctx.state.collapseParserOutput;
            ctx.rerenderApp();
        });

        imIf(!ctx.state.collapseParserOutput, r, r => {
            ParserOutput(r, parseResult);
        });

        const message = imRef<string>(r);

        div(r, r => {
            textSpan(r, message.val ?? "");
        });

        collapsableHeading(r, "Interpreter output", ctx.state.collapseProgramOutput, () => {
            ctx.state.collapseProgramOutput = !ctx.state.collapseProgramOutput;
            ctx.rerenderApp();
        });

        imIf(!ctx.state.collapseProgramOutput, r, r => {
            Button(r, "Autorun", () => {
                ctx.state.autorun = !ctx.state.autorun
                ctx.rerenderApp();
            }, ctx.state.autorun)

            Button(r, "Start debugging", () => {
                startDebugging(ctx);
                ctx.rerenderApp();
            });

            div(r, r => {
                imIf(ctx.lastInterpreterResult, r, (r, interpretResult) => {
                    imList(r, l => {
                        for (const result of interpretResult.results) {
                            const r = l.getNext();
                            renderProgramResult(r, result);
                        }
                    });
                    imElse(r, r => {
                        textSpan(r, "No results yet");
                    });

                    renderDiagnosticInfo(r, "Interpreting errors", interpretResult.errors, "No interpreting errors");

                    el(r, newH3, r => {
                        textSpan(r, "Instructions");
                    });

                    imList(r, l => {
                        const r = l.getNext();
                        renderFunction(r, interpretResult, interpretResult.entryPoint);

                        for (const [name, fn] of interpretResult.functions) {
                            const r = l.getNext();
                            renderFunction(
                                r,
                                interpretResult,
                                fn.code, 
                            );
                        }
                    });
                    imElse(r, r => {
                        textSpan(r, "No code output yet");
                    });
                });
            });
        });
    });
}

function renderDiagnosticInfoOverlay(
    r: UIRoot, 
    state: GlobalState, 
    textAreaRef: Ref<HTMLTextAreaElement>, 
    errors: DiagnosticInfo[], 
    color: string
) {
    imList(r, l => {
        for (const e of errors) {
            const r = l.getNext();
            div(r, r => {
                r.isFirstRender && r.c(cn.absolute).c(cn.w100).c(cn.h100).c(cn.preWrap)
                    .c(cn.pointerEventsNone)
                    .c(cnApp.code)
                    .s("color", "red");

                const line = getLineBeforePos(state.text, e.pos.i);
                textSpan(
                    r,
                    state.text.substring(0, e.pos.i + 1) + "\n" + " ".repeat(line.length),
                    r => {
                        r.isFirstRender && r.s("color", "transparent");
                    }
                );

                textSpan(
                    r,
                    "^ " + e.problem,
                    r => {
                        r.isFirstRender && r.s("color", color).s("backgroundColor", cssVars.bg2);

                        let opacity = 1;
                        if (textAreaRef.val) {
                            const errorLinePos = getLineEndPos(state.text, e.pos.i);
                            const textAreaLinePos = getLineStartPos(state.text, textAreaRef.val.selectionStart);
                            if (textAreaLinePos === errorLinePos) {
                                opacity = 0.2;
                            }
                        }
                        r.s("opacity", "" + opacity);
                    }
                );
            });
        }
    });
}

function renderAppCodeEditor(r: UIRoot, {
    state,
    lastInterpreterResult,
    lastParseResult,
    rerenderApp
}: GlobalContext) {
    function onInput(newText: string) {
        state.text = newText;
        rerenderApp();
    }

    function onInputKeyDown(e: KeyboardEvent, textArea: HTMLTextAreaElement) {
        setTimeout(() => {
            rerenderApp();
        }, 1);
    }

    const textAreaRef = imRef<HTMLTextAreaElement>(r);

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
            textAreaRef,
            config: {
                useSpacesInsteadOfTabs: true,
                tabStopSize: 4
            },
            overlays: (r) => {
                const errors = lastInterpreterResult?.errors;
                imIf(errors, r, (r, errors) => {
                    renderDiagnosticInfoOverlay(r, state, textAreaRef, errors, "red");
                })
                const warnings = lastParseResult?.warnings;
                imIf(warnings, r, (r, warnings) => {
                    renderDiagnosticInfoOverlay(r, state, textAreaRef, warnings, "orange");
                });
            }
        });
    });
}

function renderDebugMenu(r: UIRoot, ctx: GlobalContext, interpretResult: ProgramInterpretResult) {
    renderDiagnosticInfo(r, "Interpreting errors", interpretResult.errors, "No interpreting errors");

    const message = imRef<string>(r);

    imIf(message.val, r, (r, message) => {
        div(r, r => {
            textSpan(r, message);
        });
    });

    div(r, r => {
        r.isFirstRender && r.c(cn.h100).c(cn.col);

        Button(r, "Stop debugging", () => {
            ctx.isDebugging = false;
            ctx.rerenderApp();
        });

        Button(r, "Step", () => {
            const result = stepProgram(interpretResult);
            if (!result) {
                message.val = "Program complete! you can stop debugging now.";
            }

            ctx.rerenderApp();
        });

        Button(r, "Reset", () => {
            assert(ctx.lastParseResult);
            ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult);
            message.val = "";
            ctx.rerenderApp();
        });


        assert(interpretResult);
        const cs = getCurrentCallstack(interpretResult);
        div(r, r => {
            r.isFirstRender && r.c(cn.col).c(cn.flex1);
            imIf(cs, r, (r, cs) => {
                renderFunction(r, interpretResult, cs.code);
            });
            div(r, r => {
                r.isFirstRender && r.c(cn.row).c(cn.flex1);
                div(r, r => {
                    r.isFirstRender && r.c(cn.flex1);
                    imIf(cs, r, (r, cs) => {
                        div(r, r => {
                            div(r, r => {
                                textSpan(r, "stack idx: " + interpretResult.stackIdx);
                            });
                            div(r, r => {
                                textSpan(r, "callstack length: " + interpretResult.callStack.length);
                            });
                            div(r, r => {
                                textSpan(r, "return address: " + cs.returnAddress);
                            });
                        });
                    });

                    el(r, newH3, r => {
                        textSpan(r, "Stack");
                    });

                    imList(r, l => {
                        let n = interpretResult.stack.length;
                        while (n > 0) {
                            n--;
                            if (interpretResult.stack[n]) {
                                break;
                            }
                        }

                        for (let i = 0; i <= n; i++) {
                            const res = interpretResult.stack[i];

                            const r = l.getNext();
                            div(r, r => {
                                div(r, r => {
                                    if (r.isFirstRender) {
                                        r.c(cn.row);
                                    }

                                    imIf(i === interpretResult.stackIdx, r, r => {
                                        div(r, r => {
                                            codeSpan(r, "-> ");
                                        });
                                    });

                                    div(r, r => {
                                        imIf(res, r, (r, res) => {
                                            if (r.isFirstRender) {
                                                r.c(cn.flex1);
                                            }

                                            renderProgramResult(r, res);
                                        });
                                        imElse(r, (r) => {
                                            textSpan(r, "null");
                                        });
                                    });
                                });
                            });
                        }
                    });
                });
                div(r, r => {
                    if (r.isFirstRender) {
                        r.c(cn.flex1);
                    }

                    el(r, newH3, r => {
                        textSpan(r, "Variables");
                    });
                    imList(r, l => {
                        for (const cs of interpretResult.callStack) {
                            const r = l.getNext();

                            div(r, r => {
                                imList(r, l => {
                                    for (const [k, addr] of cs.variables) {
                                        const r = l.getNext();

                                        div(r, r => {
                                            textSpan(r, k);
                                        });
                                        textSpan(r, " addr=" + addr);
                                        const v = interpretResult.stack[addr];
                                        imIf(v, r, (r, v) => {
                                            renderProgramResult(r, v);
                                        });
                                    }
                                });
                            });
                        }
                    });
                })
            });
        });
        imList(r, l => {
            for (const result of interpretResult.results) {
                const r = l.getNext();
                renderProgramResult(r, result);
            }
        });
        imElse(r, r => {
            textSpan(r, "No results yet");
        });
    });
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
            const text = ctx.state.text;
            ctx.lastParseResult = parse(text);
            if (ctx.state.autorun) {
                ctx.lastInterpreterResult = interpret(ctx.lastParseResult);
            }

            saveStateDebounced(ctx);
        }

        div(r, r => {
            r.isFirstRender && r.c(cn.fixed).c(cn.absoluteFill).c(cnApp.normalFont);

            imErrorBoundary(r, r => {
                div(r, r => {
                    r.isFirstRender && r.c(cn.row).c(cn.alignItemsStretch).c(cn.h100);

                    div(r, r => {
                        r.isFirstRender && r.c(cn.flex1);

                        renderAppCodeEditor(r, ctx);
                    });
                    div(r, r => {
                        r.isFirstRender && r.c(cn.flex1);

                        imIf(ctx.isDebugging, r, r => {
                            const interpretResult = ctx.lastInterpreterResult;
                            assert(interpretResult);
                            renderDebugMenu(r, ctx, interpretResult);
                        });
                        imElse(r, r => {
                            renderAppCodeOutput(r, ctx);
                        });
                    });
                });


                div(r, r => {
                    r.isFirstRender && r.c(cn.absolute).s("right", "10px").s("bottom", "10px")

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
