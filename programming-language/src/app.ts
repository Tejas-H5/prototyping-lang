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
import { GlobalContext, GlobalState, newGlobalContext, saveState, startDebugging } from './state.ts';
import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { assert, beginList, cn, div, el, end, getComponentStackSize, imElse, imIf, imMemo, imOn, imRef, imRerenderable, imState, imTryCatch, init, newCssBuilder, nextRoot, Ref, scrollIntoView, setAttributes, setClass, setStyle, span, textNode, textSpan, UIRoot } from './utils/im-dom-utils.ts';
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
        } end();
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
    el(newH3); {
        init() && setAttributes({ style: "padding: 10px 0" });
        textSpan(heading);
    } end();
    beginList(); 
    for (const e of info) {
        nextRoot(); {
            div(); {
                textSpan("Line " + e.pos.line + " Col " + (e.pos.col + 1) + " - " + e.problem);
            } end();
        } end();
    }
    end();
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
                            end();
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
                            } end();
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
        } end();
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

        imOn("click", () => {
            toggle();
        });
    } end();
}

function renderExecutionStep(interpretResult: ProgramInterpretResult, step: ExecutionStep, i: number, isCurrentInstruction: boolean) {
    const result = div(); {
        textSpan(i + " | ");

        imIf(step.load, (value) => {
            textSpan("Load " + value);
        });
        // imIf(step.loadPrevious, r, (r) => {
        //     textSpan(r, "Load <the last result>");
        // });
        imIf(step.set, (value) => {
            textSpan("Set " + value);
        });
        imIf(step.binaryOperator, (value) => {
            textSpan("Binary op: " + binOpToOpString(value) + " (" + binOpToString(value) + ")");
        });
        imIf(step.list, (value) => {
            textSpan("List " + value);
        });
        imIf(step.vector, (value) => {
            textSpan("Vector " + value);
        });
        imIf(step.number, (value) => {
            textSpan("Number " + value);
        });
        imIf(step.string, (value) => {
            textSpan("String " + value);
        });
        imIf(step.jump, (value) => {
            textSpan("Jump: " + value);
        });
        imIf(step.jumpIfFalse, (value) => {
            textSpan("Jump if false: " + value);
        });
        imIf(step.blockStatementEnd !== undefined, (value) => {
            textSpan(value ? "------------------" : "---");
        });
        imIf(step.call, (value) => {
            const fn = interpretResult.functions.get(value.fnName);
            textSpan("Call " + value.fnName + "(" + (fn ? fn.args.length + " args" : "doesn't exist!") + ")");
        });
        imIf(step.incr, (value) => {
            textSpan("Increment var  " + value);
        });
        imIf(step.decr, (value) => {
            textSpan("Decrement var  " + value);
        });
        imIf(isCurrentInstruction, () => {
            textSpan(" <----");
        });
    } end();

    return result;
}

function renderFunction(interpretResult: ProgramInterpretResult, { name, steps }: ExecutionSteps) {
    div(); {
        init() && setAttributes({
            class: [cn.flex1, cn.col],
        });

        el(newH3); {
            textSpan(name);
        } end()

        const scrollContainer = div(); {
            init() && setAttributes({
                class: [cn.flex1, cn.overflowAuto]
            });

            let rCurrent: UIRoot<HTMLDivElement> | undefined;

            beginCodeBlock(0); {
                beginList(); {
                    for (let i = 0; i < steps.length; i++) {
                        nextRoot(); {
                            const step = steps[i];

                            const call = getCurrentCallstack(interpretResult);
                            const isCurrent = call?.code?.steps === steps
                                && i === call.i;

                            const r1 = renderExecutionStep(interpretResult, step, i, isCurrent);
                            if (isCurrent) {
                                rCurrent = r1;
                            }
                        } end();
                    }
                } end();
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

        imOn("click", onClick);
    } end();
    return root;
}

function renderAppCodeOutput(ctx: GlobalContext) {
    const parseResult = ctx.lastParseResult;

    div(); {
        init() && setAttributes({
            class: [cn.h100, cn.overflowYAuto, cn.borderBox],
            style: "padding: 10px"
        });

        collapsableHeading("Parser output", ctx.state.collapseParserOutput, () => {
            ctx.state.collapseParserOutput = !ctx.state.collapseParserOutput;
            ctx.rerenderApp();
        });

        imIf(!ctx.state.collapseParserOutput, () => {
            ParserOutput(parseResult);
        });

        const message = imRef<string>();

        div(); {
            textSpan(message.val ?? "");
        } end();

        collapsableHeading("Interpreter output", ctx.state.collapseProgramOutput, () => {
            ctx.state.collapseProgramOutput = !ctx.state.collapseProgramOutput;
            ctx.rerenderApp();
        });

        imIf(!ctx.state.collapseProgramOutput, () => {
            Button("Autorun", () => {
                ctx.state.autorun = !ctx.state.autorun
                ctx.rerenderApp();
            }, ctx.state.autorun)

            Button("Start debugging", () => {
                startDebugging(ctx);
                ctx.rerenderApp();
            });

            div(); {
                imIf(ctx.lastInterpreterResult, (interpretResult) => {
                    beginList();
                    for (const result of interpretResult.results) {
                        nextRoot(); {
                            renderProgramResult(result);
                        } end();
                    }
                    end();

                    imElse(() => {
                        textSpan("No results yet");
                    });

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
                    } end();
                    imElse(() => {
                        textSpan("No code output yet");
                    });
                });
            } end();
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
    }
    end();
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

function renderDebugMenu(ctx: GlobalContext, interpretResult: ProgramInterpretResult) {
    renderDiagnosticInfo("Interpreting errors", interpretResult.errors, "No interpreting errors");

    const message = imRef<string>();

    imIf(message.val, (message) => {
        div(); {
            textSpan(message);
        } end();
    });

    div(); {
        init() && setAttributes({ class: [cn.h100, cn.col] });

        Button("Stop debugging", () => {
            ctx.isDebugging = false;
            ctx.rerenderApp();
        });

        Button("Step", () => {
            const result = stepProgram(interpretResult);
            if (!result) {
                message.val = "Program complete! you can stop debugging now.";
            }

            ctx.rerenderApp();
        });

        Button("Reset", () => {
            assert(ctx.lastParseResult);
            ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult);
            message.val = "";
            ctx.rerenderApp();
        });

        assert(interpretResult);
        const cs = getCurrentCallstack(interpretResult);
        div(); {
            init() && setAttributes({ class: [cn.flex1, cn.col] });

            imIf(cs, (cs) => {
                renderFunction(interpretResult, cs.code);
            });
            div(); {
                init() && setAttributes({ class: [cn.flex1, cn.row] });

                div(); {
                    init() && setAttributes({ class: [cn.flex1] });

                    imIf(cs, (cs) => {
                        div(); {
                            div(); {
                                textSpan("stack idx: " + interpretResult.stackIdx);
                            } end();
                            div(); {
                                textSpan("callstack length: " + interpretResult.callStack.length);
                            } end();
                            div(); {
                                textSpan("return address: " + cs.returnAddress);
                            } end();
                        } end();
                    });

                    el(newH3); {
                        textSpan("Stack");
                    } end();

                    beginList(); {
                        let n = interpretResult.stack.length;
                        while (n > 0) {
                            n--;
                            if (interpretResult.stack[n]) {
                                break;
                            }
                        }

                        for (let i = 0; i <= n; i++) {
                            const res = interpretResult.stack[i];

                            nextRoot(); {
                                div(); {
                                    div(); {
                                        init() && setAttributes({ class: [cn.row] });

                                        imIf(i === interpretResult.stackIdx, () => {
                                            div(); {
                                                codeSpan("-> ");
                                            } end();
                                        });

                                        div(); {
                                            imIf(res, (res) => {
                                                init() && setAttributes({ class: [cn.flex1] });

                                                renderProgramResult(res);
                                            });
                                            imElse(() => {
                                                textSpan("null");
                                            });
                                        } end();
                                    } end();
                                } end();
                            } end();
                        }
                    } end();
                } end();
                div(); {
                    init() && setAttributes({ class: [cn.flex1] });

                    el(newH3); {
                        textSpan("Variables");
                    } end();
                    beginList(); 
                    for (const cs of interpretResult.callStack) {
                        nextRoot(); {
                            div(); {
                                beginList(); 
                                for (const [k, addr] of cs.variables) {
                                    nextRoot(); {
                                        div(); {
                                            textSpan(k);
                                        } end();
                                        textSpan(" addr=" + addr);
                                        const v = interpretResult.stack[addr];
                                        imIf(v, (v) => {
                                            renderProgramResult(v);
                                        });
                                    } end();
                                } 
                                end();
                            } end();
                        } end();
                    }
                    end();
                } end();
            } end();
        } end();
        beginList(); 
        for (const result of interpretResult.results) {
            nextRoot(); {
                renderProgramResult(result);
            } end();
        };
        end();
        imElse(() => {
            textSpan("No results yet");
        });
    } end();
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
                                renderDebugMenu(ctx, interpretResult);
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
