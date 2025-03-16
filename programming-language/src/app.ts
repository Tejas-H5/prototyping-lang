import { EditableTextArea } from './components/text-area.ts';
import { ExecutionStep, ExecutionSteps, executionStepToString, getCurrentCallstack, interpret, ProgramInterpretResult, ProgramOutputs, ProgramResult, programResultTypeString, startInterpreting, stepProgram, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING } from './program-interpreter.ts';
import {
    binOpToString,
    binOpToOpString as binOpToSymbolString,
    DiagnosticInfo,
    expressionToString,
    expressionTypeToString,
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
import { GlobalContext, GlobalState, newGlobalContext, saveState, startDebugging } from './state.ts';
import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { addClasses, assert, beginList, cn, div, el, end, endList, getComponentStackSize, imElse, imIf, imMemo, imOn, imRef, imRerenderable, imState, imStateInline, imTryCatch, init, newCssBuilder, nextRoot, Ref, scrollIntoView, setAttributes, setClass, setStyle, span, textNode, textSpan, UIRoot } from './utils/im-dom-utils.ts';
import { getLineBeforePos, getLineEndPos, getLineStartPos } from './utils/text-utils.ts';

function newH3() {
    return document.createElement("h3");
}

function codeSpan(text: string) {
    const root = span(); { 
        init() && setAttributes({
            class: [cnApp.code],
            style: `background-color: ${cssVars.bg2}`
        });

        textNode(text);
    } end();

    return root;
}

// Don't forget to call end()
function beginCodeBlock(indent: number) {
    const root = div(); { 
        init() && setAttributes({
            class: [cnApp.code],
            style: `background-color: ${cssVars.bg2}`
        });

        setStyle("paddingLeft", (4 * indent) + "ch");
    } 

    return root;
}


function ParserOutput(parseResultOrUndefined: ProgramParseResult | undefined) {
    imIf(parseResultOrUndefined, (parseResult) => {
        beginList(); {
            function renderRow(title: string, type: string, depth: number, codeOrUndefined?: string) {
                nextRoot(); {
                    div(); {
                        setStyle("paddingLeft", (depth * 20) + "px");

                        textSpan(title);
                        textSpan(" = ");
                        textSpan(type);
                        imIf(codeOrUndefined, (code) => {
                            textSpan(" ");
                            codeSpan(code);
                        });
                    } end();
                } end();
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
                        renderRow(title, typeString, depth, expressionToString(expr));
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
                        const lhsText = expressionToString(expr.lhs);
                        const rhsText = expr.rhs ? expressionToString(expr.rhs) : INCOMPLETE;
                        const opSymbol = binOpToSymbolString(expr.op);
                        const text = `(${lhsText}) ${opSymbol} (${rhsText})`;
                        renderRow(title, binOpToString(expr.op), depth, text);

                        dfs("lhs", expr.lhs, depth + 1);
                        dfs("rhs", expr.rhs, depth + 1);
                    } break;
                    case T_LIST_LITERAL: 
                    case T_VECTOR_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(expr));

                        for (let i = 0; i < expr.items.length; i++) {
                            dfs("[" + i + "]", expr.items[i], depth + 1);
                        }
                    } break;
                    case T_NUMBER_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(expr));
                    } break;
                    case T_STRING_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(expr));
                    } break;
                    case T_TERNARY_IF: {
                        const queryText = expressionToString(expr.query);
                        const trueText = expressionToString(expr.trueBranch);
                        const falseText = expr.falseBranch ? expressionToString(expr.falseBranch) : "";
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
        } endList();
        imElse(() => {
            textSpan("Nothing parsed yet");
        });

        renderDiagnosticInfo("Errors", parseResult.errors, "No parsing errors!");
        renderDiagnosticInfo("Warnings", parseResult.warnings, "No parsing warnings");
    });
    imElse(() => {
        textSpan("No parse results yet");
    });
}

// TODO: display these above the code editor itself. 
function renderDiagnosticInfo(heading: string, info: DiagnosticInfo[], emptyText: string) {
    imIf(!!heading, () => {
        el(newH3); {
            init() && setAttributes({ style: "padding: 10px 0" });
            textSpan(heading);
        } end();
    });

    beginList(); 
    for (const e of info) {
        nextRoot(); {
            div(); {
                textSpan("Line " + e.pos.line + " Col " + (e.pos.col + 1) + " - " + e.problem);
            } end();
        } end();
    }
    endList();
    imIf(info.length === 0, () => {
        div(); {
            textSpan(emptyText);
        } end();
    })
}

function renderProgramResult(res: ProgramResult) {
    div(); {
        beginList(); {
            nextRoot(); {
                const typeString = programResultTypeString(res)
                textSpan(typeString + " ");
            } end();

            nextRoot(res.t); 
            switch (res.t) {
                case T_RESULT_NUMBER:
                    codeSpan("" + res.val);
                    break;
                case T_RESULT_STRING:
                    codeSpan(res.val);
                    break;
                case T_RESULT_LIST:
                    beginCodeBlock(0); {
                        codeSpan("[");
                        beginCodeBlock(1); {
                            beginList(); 
                            for (let i = 0; i < res.values.length; i++) {
                                nextRoot(); {
                                    renderProgramResult(res.values[i]);
                                } end();
                            }
                            endList();
                        } end();
                        codeSpan("]L");
                    } end();
                    break;
                case T_RESULT_MATRIX:
                    let idx = 0;
                    const dfs = (dim: number, isLast: boolean) => {
                        if (dim === res.val.m.shape.length) {
                            const val = res.val.m.values[idx];
                            idx++;

                            textSpan("" + val);
                            imIf(!isLast, () => {
                                textSpan(", ");
                            });
                            return;
                        }

                        beginCodeBlock(dim === 0 ? 0 : 1); {
                            textSpan("[");
                            beginList(); {
                                const len = res.val.m.shape[dim];
                                for (let i = 0; i < len; i++) {
                                    // This is because when the 'level' of the list changes, the depth itself changes,
                                    // and the components we're rendering at a particular level will change. 
                                    // We need to re-key the list, so that we may render a different kind of component at this position.
                                    const key = (res.val.m.shape.length - dim) + "-" + i;
                                    nextRoot(key); {
                                        dfs(dim + 1, i === len - 1);
                                    } end();
                                }
                            } endList();
                            textSpan("]");
                        } end();
                    }
                    dfs(0, false);
                    break;
                case T_RESULT_RANGE:
                    codeSpan("" + res.val.lo);
                    codeSpan(" -> ");
                    codeSpan("" + res.val.hi);
                    break;
                case T_RESULT_FN:
                    codeSpan(res.expr.fnName.name);
                    break;
                default:
                    throw new Error("Unhandled result type: " + programResultTypeString(res));
            } end();
        } endList();
    } end();
}

// this component kinda suss. 
function collapsableHeading(heading: string, isCollapsed: boolean, toggle: () => void) {
    el(newH3); {
        init() && setAttributes({
            style: "padding: 10px 0; cursor: pointer",
            class: [cn.userSelectNone]
        });

        textSpan(heading);

        imIf(isCollapsed, () => {
            textSpan(" (collapsed)");
        });

        imOn("mousedown", () => {
            toggle();
        });
    } end();
}

function renderExecutionStep(step: ExecutionStep) {
    span(); {
        textNode(executionStepToString(step));
    } end();
}

function renderFunction(interpretResult: ProgramInterpretResult, { name, steps }: ExecutionSteps) {
    beginLayout(); {
        el(newH3); {
            textSpan(name);
        } end()

        const scrollContainer = beginLayout(); {
            init() && addClasses([ cn.overflowAuto ]);

            let rCurrent: UIRoot<HTMLElement> | undefined;

            beginCodeBlock(0); {
                beginList(); {
                    for (let i = 0; i < steps.length; i++) {
                        nextRoot(); {
                            const step = steps[i];

                            const call = getCurrentCallstack(interpretResult);
                            const isCurrent = call?.code?.steps === steps
                                && i === call.i;

                            const currentStepDiv = div(); {
                                textSpan(i + " | ");

                                renderExecutionStep(step);

                                imIf(isCurrent, () => {
                                    textSpan(" <----");
                                });
                            } end();

                            if (isCurrent) {
                                rCurrent = currentStepDiv;

                            }
                        } end();
                    }
                } endList();
                imElse(() => {
                    div(); {
                        textSpan("no instructions present");
                    } end();
                });
            } end();

            if (rCurrent) {
                scrollIntoView(scrollContainer.root, rCurrent.root, 0.5, 0.5);
            }
        } end();
    } end();
}

const cssb = newCssBuilder();

const cnButton = cssb.cn("button", [
    ` { user-select: none; cursor: pointer; border: 2px solid ${cssVars.fg}; border: 2px solid currentColor; border-radius: 8px; }`,
    `:hover { background-color: ${cssVars.bg2} }`,
    `:active { background-color: ${cssVars.mg} }`,
]);

function Button(text: string, onClick: () => void, toggled: boolean = false) {
    const root = div(); {
        init() && setAttributes({
            class: [
                cnButton, 
                cn.row, cn.alignItemsCenter, cn.justifyContentCenter
            ],
        });

        setClass(cnApp.inverted, toggled);

        textSpan(text);

        imOn("mousedown", onClick);
    } end();
    return root;
}

const ROW = 1 << 1;
const COL = 1 << 2;
const FLEX = 1 << 3;
const GAP = 1 << 4;

function beginLayout(flags: number = 0) {
    const root = div(); {
        if (init()) {
            if (flags & ROW) {
                setClass(cn.row);
            }
            if (flags & COL) {
                setClass(cn.col);
            }
            if (flags & FLEX) {
                setClass(cn.flex1);
            }
            if (flags & GAP) {
                setClass(cnApp.gap5);
            }
        }
    };

    return root;
}

function renderAppCodeOutput(ctx: GlobalContext) {
    div(); {
        init() && setAttributes({
            class: [cn.h100, cn.overflowYAuto, cn.borderBox],
            style: "padding: 10px"
        });

        const parseResult = ctx.lastParseResult;

        collapsableHeading("Parser output", ctx.state.collapseParserOutput, () => {
            ctx.state.collapseParserOutput = !ctx.state.collapseParserOutput;
            ctx.rerenderApp();
        });

        imIf(!ctx.state.collapseParserOutput, () => {
            ParserOutput(parseResult);
        });

        const message = imRef<string>();

        collapsableHeading("Instruction generation - output", ctx.state.collapseInterpreterPass1Output, () => {
            ctx.state.collapseInterpreterPass1Output = !ctx.state.collapseInterpreterPass1Output;
            ctx.rerenderApp();
        });

        // TODO: better UI for this message
        div(); {
            textSpan(message.val ?? "");
        } end();

        imIf(!ctx.state.collapseInterpreterPass1Output, () => {
            imIf(ctx.lastInterpreterResult, (interpretResult) => {
                div(); {
                    renderDiagnosticInfo("Interpreting errors", interpretResult.errors, "No interpreting errors");

                    el(newH3); {
                        textSpan("Instructions");
                    } end();

                    beginList(); {
                        nextRoot(); {
                            renderFunction(interpretResult, interpretResult.entryPoint);
                        } end()

                        for (const [, fn] of interpretResult.functions) {
                            nextRoot(); {
                                renderFunction(interpretResult, fn.code);
                            } end();
                        } 
                    } endList();
                    imElse(() => {
                        textSpan("No code output yet");
                    });

                } end();
            });
        });

        beginLayout(ROW | GAP); {
            beginLayout(FLEX); {
                Button("Autorun", () => {
                    ctx.state.autorun = !ctx.state.autorun
                    ctx.rerenderApp();
                }, ctx.state.autorun)
            } end();

            beginLayout(FLEX); {
                Button("Start debugging", () => {
                    startDebugging(ctx);
                    ctx.rerenderApp();
                });
            } end();
        } end();

        collapsableHeading("Code output", ctx.state.collapseInterpreterCodeOutput, () => {
            ctx.state.collapseInterpreterCodeOutput = !ctx.state.collapseInterpreterCodeOutput;
            ctx.rerenderApp();
        });

        imIf(!ctx.state.collapseInterpreterCodeOutput, () => {
            imIf(ctx.lastInterpreterResult, (interpretResult) => {
                renderProgramOutputs(interpretResult.outputs);
            });
        });
    } end();
}

function renderDiagnosticInfoOverlay(
    state: GlobalState, 
    textAreaRef: Ref<HTMLTextAreaElement>, 
    errors: DiagnosticInfo[], 
    color: string
) {
    beginList(); 
    for (const e of errors) {
        nextRoot(); {
            div(); {
                init() && setAttributes({
                    class: [
                        cn.absolute, cn.w100, cn.h100, cn.preWrap,
                        cn.pointerEventsNone,
                        cnApp.code,
                    ],
                });

                const line = getLineBeforePos(state.text, e.pos.i);
                span(); {
                    init() && setAttributes({ style: "color: transparent" });

                    textNode(
                        state.text.substring(0, e.pos.i + 1) + "\n" + " ".repeat(line.length)
                    );
                } end();

                span(); {
                    init() && setAttributes({
                        style: `background-color: ${cssVars.bg2}`,
                    });

                    setStyle("color", color);

                    textNode("^ " + e.problem);

                    let opacity = 1;
                    if (textAreaRef.val) {
                        const errorLinePos = getLineEndPos(state.text, e.pos.i);
                        const textAreaLinePos = getLineStartPos(state.text, textAreaRef.val.selectionStart);
                        if (textAreaLinePos === errorLinePos) {
                            opacity = 0.2;
                        }
                    }

                    setStyle("opacity", "" + opacity);
                } end();
            } end();
        } end();
    } endList();
}

function renderAppCodeEditor({
    state,
    lastInterpreterResult,
    lastParseResult,
    rerenderApp
}: GlobalContext) {
    function onInput(newText: string) {
        state.text = newText;
        rerenderApp();
    }

    function onInputKeyDown(_e: KeyboardEvent, _textArea: HTMLTextAreaElement) {
        setTimeout(() => {
            rerenderApp();
        }, 1);
    }

    const textAreaRef = imRef<HTMLTextAreaElement>();

    div(); {
        init() && setAttributes({
            class: [
                cnApp.bgFocus, cn.h100, cn.overflowYAuto, cn.borderBox,
                cnApp.code,
            ],
            style: "padding: 10px"
        });

        EditableTextArea({
            text: state.text,
            isEditing: true,
            onInput,
            onInputKeyDown,
            textAreaRef,
            config: {
                useSpacesInsteadOfTabs: true,
                tabStopSize: 4
            },
            overlays: () => {
                const errors = lastInterpreterResult?.errors;
                imIf(errors, (errors) => {
                    renderDiagnosticInfoOverlay(state, textAreaRef, errors, "red");
                })
                const warnings = lastParseResult?.warnings;
                imIf(warnings, (warnings) => {
                    renderDiagnosticInfoOverlay(state, textAreaRef, warnings, "orange");
                });
            }
        });
    } end();
}

function renderDebugger(ctx: GlobalContext, interpretResult: ProgramInterpretResult) {
    beginLayout(COL | GAP); {
        if (init()) {
            setClass(cn.h100);
            setClass(cn.overflowYAuto);
            setClass(cn.borderBox);
            setStyle("padding", "10px");
        }

        beginLayout(ROW | GAP); {
            beginLayout(FLEX); {
                Button("Stop debugging", () => {
                    ctx.isDebugging = false;
                    ctx.rerenderApp();
                });
            } end();

            beginLayout(FLEX); {
                Button("Step", () => {
                    const result = stepProgram(interpretResult);
                    if (!result) {
                        message.val = "Program complete! you can stop debugging now.";
                    }

                    ctx.rerenderApp();
                });
            } end();

            beginLayout(FLEX); {
                Button("Reset", () => {
                    assert(ctx.lastParseResult);
                    ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult);
                    message.val = "";
                    ctx.rerenderApp();
                });
            } end();
        } end();

        const message = imRef<string>();
        imIf(message.val, (message) => {
            div(); {
                textSpan(message);
            } end();
        });

        assert(interpretResult);
        const cs = getCurrentCallstack(interpretResult);

        beginLayout(); {
            imIf(cs, (cs) => {
                renderFunction(interpretResult, cs.code);
            });
            beginLayout(ROW); {
                beginLayout(COL | FLEX); {
                    el(newH3); {
                        textSpan("Stack");
                    } end();

                    // render the stack
                    {
                        const variablesReverseMap = imStateInline(() => new Map<number, string>());
                        variablesReverseMap.clear();
                        for (const cs of interpretResult.callStack) {
                            for (const [varName, addr] of cs.variables) {
                                variablesReverseMap.set(addr, varName);
                            }
                        }

                        const cs = getCurrentCallstack(interpretResult);

                        let n = interpretResult.stack.length;
                        while (n > 0) {
                            n--;
                            if (interpretResult.stack[n]) {
                                break;
                            }
                        }

                        // show a couple more addresses after, why not.
                        n += 10;
                        if (n > interpretResult.stack.length) {
                            n = interpretResult.stack.length - 1;
                        }


                        beginList();
                        for (let addr = 0; addr <= n; addr++) {
                            const res = interpretResult.stack[addr];

                            nextRoot(); {
                                div(); {
                                    beginLayout(ROW | GAP); {
                                        const stackAddrArrow = (name: string) => {
                                            div(); {
                                                init() && setAttributes({
                                                    style: "padding-left: 10px; padding-right: 10px"
                                                });

                                                codeSpan(name + "->");
                                            } end();
                                        }

                                        imIf(addr === interpretResult.stackIdx, () => {
                                            stackAddrArrow("");
                                        });

                                        // every callstack will have a different return address
                                        let callstackIdx = -1;
                                        for (let i = 0; i < interpretResult.callStack.length; i++) {
                                            const cs = interpretResult.callStack[i];
                                            if (cs.returnAddress === addr) {
                                                callstackIdx = i;
                                            }
                                        }

                                        imIf(callstackIdx !== -1, () => {
                                            stackAddrArrow("r" + callstackIdx + "");
                                        });

                                        const variable = variablesReverseMap.get(addr);
                                        imIf(variable, variable => {
                                            div(); {
                                                codeSpan(variable + " = ");
                                            } end();
                                        })

                                        beginLayout(FLEX); {
                                            imIf(res, (res) => {
                                                renderProgramResult(res);
                                            });

                                            imElse(() => {
                                                textSpan("null");
                                            });
                                        } end();
                                    } end();
                                } end();
                            } end();
                        } endList();
                    }
                } end();
                beginLayout(FLEX | COL); {
                    el(newH3); {
                        textSpan("Results");
                    } end();

                    renderProgramOutputs(interpretResult.outputs);
                } end();
            } end();
        } end();
    } end();
}

function renderProgramOutputs(outputs: ProgramOutputs) {
    beginList();
    for (const result of outputs.prints) {
        nextRoot(); {
            beginLayout(ROW | GAP); {
                div(); { 
                    beginCodeBlock(0); {
                        textNode(
                            expressionToString(result.expr)
                        )
                    } end();
                } end();

                div(); {
                    init() && setAttributes({ 
                        style: `width: 5px; background-color: ${cssVars.fg};`
                    });
                } end();

                div(); {
                    init() && setAttributes({ 
                        class: [cn.flex1], 
                        style: `padding-top: 5px;`
                    });

                    renderProgramResult(result.val);
                } end();
            } end();

        } end();
    };
    endList();
    imElse(() => {
        textSpan("No results yet");
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

export function renderApp() {
    imRerenderable((rerender) => {
        const stackSize = getComponentStackSize();

        const ctx = imState(newGlobalContext);
        ctx.rerenderApp = rerender;

        const { state } = ctx;

        if (!imMemo().keys(state).isSame) {
            const text = ctx.state.text;
            ctx.lastParseResult = parse(text);
            if (ctx.state.autorun) {
                ctx.lastInterpreterResult = interpret(ctx.lastParseResult);
            }

            saveStateDebounced(ctx);
        }

        div(); {
            init() && setAttributes({
                class: [cn.fixed, cnApp.normalFont, cn.absoluteFill]
            });

            imTryCatch({
                tryFn: () => {

                    div(); {
                        init() && setAttributes({
                            class: [cn.row, cn.alignItemsStretch, cn.h100],
                        });

                        div(); {
                            init() && setAttributes({ class: [cn.flex1] });
                            renderAppCodeEditor(ctx);
                        } end();
                        div(); {
                            init() && setAttributes({ class: [cn.flex1] });

                            imIf(ctx.isDebugging, () => {
                                const interpretResult = ctx.lastInterpreterResult;
                                assert(interpretResult);
                                renderDebugger(ctx, interpretResult);
                            });
                            imElse(() => {
                                renderAppCodeOutput(ctx);
                            });
                        } end();
                    } end();

                    div(); {
                        init() && setAttributes({
                            style: "right: 10px; bottom: 10px",
                            class: [cn.absolute],
                        });

                        textNode(saveTimeout ? "Saving..." : "Saved");
                    } end();

                },
                catchFn: (error, _recover) => {
                    console.error(error);

                    div(); {
                        textSpan("An error occured: " + error.message);
                    } end();
                }
            })
        } end();

        assert(stackSize === getComponentStackSize());
    });
}
