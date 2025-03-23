import { EditableTextArea } from './components/text-area.ts';
import { ExecutionStep, ExecutionSteps, executionStepToString, getCurrentCallstack, interpret, ProgramInterpretResult, ProgramOutputs, ProgramPlotOutput, ProgramResult, programResultTypeString, startInterpreting, stepProgram, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING } from './program-interpreter.ts';
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
    T_UNARY_OP,
    T_VECTOR_LITERAL,
    unaryOpToOpString,
    unaryOpToString
} from './program-parser.ts';
import { GlobalContext, GlobalState, newGlobalContext, saveState, startDebugging } from './state.ts';
import "./styling.ts";
import { cnApp, cssVars } from './styling.ts';
import { assert, beginList, cn, div, el, end, endList, getComponentStackSize, imElse, imIf, imMemo, imRef, imRerenderable, imSetVal, imState, imStateInline, imTryCatch, imVal, imInit, newCssBuilder, nextRoot, Ref, scrollIntoView, setAttributes, setClass, setStyle, span, setInnerText, UIRoot, getCurrentRoot, endFrame, beginFrame, imPreventScrollEventPropagation, initializeImEvents, deferClickEventToParent, elementHasMouseClick, elementWasLastClicked, getMouse, elementHasMouseOver, isShiftPressed, getKeys, imElseIf, deltaTimeSeconds, abortListAndRewindUiStack } from './utils/im-dom-utils.ts';
import { clamp, inverseLerp, lerp } from './utils/math-utils.ts';
import { getMatrixValue, getSliceValue } from './utils/matrix-math.ts';
import { getLineBeforePos, getLineEndPos, getLineStartPos } from './utils/text-utils.ts';

// NOTE: you only get 32 of these. use them wisely.
// (while JS numbers are 64 bit, bit ops are all 32 bits)
const ROW = 1 << 1;
const COL = 1 << 2;
const FLEX = 1 << 3;
const GAP = 1 << 4;
const PRE = 1 << 6;
const ALIGN_CENTER = 1 << 7;
const JUSTIFY_CENTER = 1 << 8;
const W100 = 1 << 9;
const H100 = 1 << 10;

const CODE = 1 << 5;
const BOLD = 1 << 11;
const ITALIC = 1 << 12;
const H1 = 1 << 13;
const H2 = 1 << 14;
const H3 = 1 << 15;

const RELATIVE = 1 << 16;
const ABSOLUTE = 1 << 17;
const FIXED = 1 << 18;

const OPAQUE = 1 << 19;
const TRANSLUCENT = 1 << 20;
const PREWRAP = 1 << 21;

const TRANSPARENT = 1 << 22;

function setStyleFlags(flags: number) {
    const transparent = !!(flags & TRANSPARENT);

    setClass(cn.row, !!(flags & ROW));
    setClass(cn.col, !!(flags & COL));
    setClass(cn.flex1, !!(flags & FLEX));
    setClass(cnApp.gap5, !!(flags & GAP));
    setClass(cnApp.code, !!(flags & CODE));
    setClass(cnApp.bg2, !transparent && !!(flags & CODE));
    setClass(cn.pre, !!(flags & PRE));
    setClass(cn.preWrap, !!(flags & PREWRAP));
    setClass(cn.alignItemsCenter, !!(flags & ALIGN_CENTER));
    setClass(cn.justifyContentCenter, !!(flags & JUSTIFY_CENTER));
    setClass(cn.h100, !!(flags & H100));
    setClass(cn.w100, !!(flags & W100));
    setClass(cnApp.bold, !!(flags & BOLD));
    setClass(cnApp.italic, !!(flags & ITALIC));
    setClass(cnApp.h1, !!(flags & H1));
    setClass(cnApp.h2, !!(flags & H2));
    setClass(cnApp.h3, !!(flags & H3));
    setClass(cn.absolute, !!(flags & ABSOLUTE));
    setClass(cn.relative, !!(flags & RELATIVE));
    const fixed = !!(flags & FIXED);
    setClass(cn.fixed, fixed);
    setStyle("top", fixed ? "0" : "");
    setStyle("left", fixed ? "0" : "");
    setStyle("bottom", fixed ? "0" : "");
    setStyle("right", fixed ? "0" : "");
    setClass(cnApp.bg, !!(flags & OPAQUE));
    setClass(cnApp.translucent, !!(flags & TRANSLUCENT));
}

function textSpan(text: string, flags: number = 0) {
    const lastFlags = imRef();
    // Don't set the text every render. that way, we may modify it in the inspector.
    // may also be faster, idc
    const lastText = imRef();
    const root = span(); {
        if (lastFlags.val !== flags) {
            lastFlags.val = flags;
            setStyleFlags(flags);
        }

        deferClickEventToParent();

        if (lastText.val !== text) {
            lastText.val = text;
            root.text(text);
        }
    } end();

    return root;
}

function beginLayout(flags: number = 0) {
    const lastFlags = imRef();
    const root = div(); {
        if (lastFlags.val !== flags) {
            lastFlags.val = flags;
            setStyleFlags(flags);
        }
    };

    // NOTE: this is a possibility for a simple API to allow more higher-level layout primitives.
    // instructs the corresponding end() to pop more than 1 node.
    // setEndPopCount(2);

    return root;
}

const NONE = 9999999;
function beginAbsoluteLayout(flags: number = 0, top: number, left: number, bottom: number, right: number) {
    const root = beginLayout(flags | ABSOLUTE);

    if (!imMemo().val(top).val(left).val(bottom).val(right).isSame) {
        setStyle("top", top === NONE ? "" : top + "px");
        setStyle("left", left === NONE ? "" : left + "px");
        setStyle("bottom", bottom === NONE ? "" : bottom + "px");
        setStyle("right", right === NONE ? "" : right + "px");
    }

    return root;
}

function beginScrollContainer(flags: number = 0) {
    const root = beginLayout(flags);
    if (imInit()) {
        setClass(cn.overflowYAuto);
    }
    return root;
}

function beginAspectRatio(w: number, h: number, flags: number = 0) {
    const lastAr = imRef();
    const root = beginLayout(flags); {
        if (imInit()) {
            setStyle("width", "auto");
            setStyle("height", "auto");
        }

        const ar = w / h;
        if (lastAr.val !== ar) {
            lastAr.val = ar;
            setStyle("aspectRatio", w + " / " + h);
        }
    };

    return root;
}

function newH3() {
    return document.createElement("h3");
}

// Don't forget to call end()
function beginCodeBlock(indent: number) {
    const root = beginLayout(CODE); { 
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
                            textSpan(code, CODE);
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
                    case T_UNARY_OP: {
                        const exprText = expressionToString(expr.expr);
                        const opSymbol = unaryOpToOpString(expr.op);
                        const text = `${opSymbol}(${exprText})`;
                        renderRow(title, unaryOpToString(expr.op), depth, text);
                        dfs("expr", expr.expr, depth + 1);
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

function beginHeading() {
    const root = el(newH3); {
        if (imInit()) {
            setStyle("padding", "10px 0");
        }
    }
    return root;
}

// TODO: display these above the code editor itself. 
function renderDiagnosticInfo(heading: string, info: DiagnosticInfo[], emptyText: string) {
    imIf(!!heading, () => {
        beginHeading(); {
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
            nextRoot(res.t);  {
                beginLayout(COL | GAP); {
                    const typeString = programResultTypeString(res)
                    textSpan(typeString + " ");

                    switch (res.t) {
                        case T_RESULT_NUMBER:
                            textSpan("" + res.val, CODE);
                            break;
                        case T_RESULT_STRING:
                            beginLayout(COL | GAP); {
                                textSpan(res.val, CODE | PRE);
                            } end();
                            break;
                        case T_RESULT_LIST:
                            beginCodeBlock(0); {
                                textSpan("[", CODE);
                                beginCodeBlock(1); {
                                    beginList(); 
                                    for (let i = 0; i < res.values.length; i++) {
                                        nextRoot(); {
                                            renderProgramResult(res.values[i]);
                                        } end();
                                    }
                                    endList();
                                } end();
                                textSpan("]L", CODE);
                            } end();
                            break;
                        case T_RESULT_MATRIX:
                            let idx = 0;
                            const dfs = (dim: number, isLast: boolean) => {
                                if (dim === res.val.shape.length) {
                                    const val = getSliceValue(res.val.values, idx);

                                    // assuming everything renders in order, this is the only thing we need to do for this to work.
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
                                        const len = res.val.shape[dim];
                                        for (let i = 0; i < len; i++) {
                                            // This is because when the 'level' of the list changes, the depth itself changes,
                                            // and the components we're rendering at a particular level will change. 
                                            // We need to re-key the list, so that we may render a different kind of component at this position.
                                            const key = (res.val.shape.length - dim) + "-" + i;
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
                            textSpan("" + res.val.lo, CODE);
                            textSpan(" -> ", CODE);
                            textSpan("" + res.val.hi, CODE);
                            break;
                        case T_RESULT_FN:
                            textSpan(res.expr.fnName.name, CODE);
                            break;
                        default:
                            throw new Error("Unhandled result type: " + programResultTypeString(res));
                    } 
                } end();
            } end();
        } endList();
    } end();
}

function beginExpandableSectionHeading(text: string, isCollapsed: boolean) {
    const root = beginHeading(); {
        textSpan(text);

        imIf(isCollapsed, () => {
            textSpan(" <");
        });
        imElse(() => {
            textSpan(" v");
        })

        if (imInit()) {
            setStyle("cursor", "pointer");
            setClass(cn.userSelectNone);
        }
    } 

    return root;
}

function renderExecutionStep(step: ExecutionStep) {
    textSpan(executionStepToString(step));
}

function renderFunction(interpretResult: ProgramInterpretResult, { name, steps }: ExecutionSteps) {
    beginLayout(FLEX | COL); {
        el(newH3); {
            textSpan(name);
        } end()

        const scrollContainer = beginScrollContainer(FLEX); {
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
    ` { user-select: none; cursor: pointer; border: 2px solid ${cssVars.fg}; border: 2px solid currentColor; border-radius: 8px; padding: 2px 2px; box-sizing: border-box; }`,
    `:hover { background-color: ${cssVars.bg2} }`,
    `:active { background-color: ${cssVars.mg} }`,

    `.${cnApp.inverted}:hover { background-color: ${cssVars.fg2} }`,
]);


function beginButton(toggled: boolean = false) {
    const root = beginLayout(ROW | ALIGN_CENTER | JUSTIFY_CENTER); {
        if (imInit()) {
            setClass(cnButton);
        }

        setClass(cnApp.inverted, toggled);
    };

    return root;
}

function renderAppCodeOutput(ctx: GlobalContext) {
    div(); {
        if (imInit()) {
            setClass(cn.h100);
            setClass(cn.overflowYAuto);

            setInset("10px");
        }

        const parseResult = ctx.lastParseResult;

        beginExpandableSectionHeading("Parser output", ctx.state.collapseParserOutput); {
            if (elementHasMouseClick()) {
                ctx.state.collapseParserOutput = !ctx.state.collapseParserOutput;
            }
        } end();

        imIf(!ctx.state.collapseParserOutput, () => {
            ParserOutput(parseResult);
        });

        const message = imRef<string>();

        beginExpandableSectionHeading("Instruction generation - output", ctx.state.collapseInterpreterPass1Output); {
            if (elementHasMouseClick()) {
                ctx.state.collapseInterpreterPass1Output = !ctx.state.collapseInterpreterPass1Output;
            }
        } end();

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
                beginButton(ctx.state.autorun); {
                    textSpan("Autorun");

                    if (elementHasMouseClick()) {
                        ctx.state.autorun = !ctx.state.autorun
                    }
                } end();
            } end();

            beginLayout(FLEX); {
                beginButton(); {
                    textSpan("Start debugging");
                    if (elementHasMouseClick()) {
                        startDebugging(ctx);
                    }
                } end();
            } end();
        } end();

        beginHeading(); {
            textSpan("Code output");
        } end();

        imIf(ctx.lastInterpreterResult, (interpretResult) => {
            renderProgramOutputs(interpretResult.outputs, ctx);
        });
        imElse(() => {
            beginLayout(); {
                textSpan("Nothing yet");
            } end();
        })
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
            beginLayout(PREWRAP | ABSOLUTE | W100 | H100 | CODE | TRANSPARENT); {
                imInit() && setClass(cn.pointerEventsNone);

                const line = getLineBeforePos(state.text, e.pos.i);
                span(); {
                    imInit() && setAttributes({ style: "color: transparent" });

                    setInnerText(
                        state.text.substring(0, e.pos.i + 1) + "\n" + " ".repeat(line.length)
                    );
                } end();

                span(); {
                    imInit() && setAttributes({
                        style: `background-color: ${cssVars.bg2}`,
                    });

                    setStyle("color", color);

                    setInnerText("^ " + e.problem);

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
}: GlobalContext) {
    function onInput(newText: string) {
        state.text = newText;
    }

    function onInputKeyDown(_e: KeyboardEvent, _textArea: HTMLTextAreaElement) {
    }

    const textAreaRef = imRef<HTMLTextAreaElement>();

    beginScrollContainer(H100 | CODE); {
        if (imInit()) {
            setInset("10px");
            setClass(cnApp.bgFocus);
        }

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
        if (imInit()) {
            setClass(cn.h100);
            setClass(cn.overflowYAuto);
            setClass(cn.borderBox);
            setStyle("padding", "10px");
        }

        const message = imRef<string>();

        beginLayout(ROW | GAP); {
            beginLayout(FLEX); {
                beginButton(); {
                    textSpan("Stop debugging");
                    if(elementHasMouseClick()) {
                        ctx.isDebugging = false;
                    }
                } end();
            } end();

            beginLayout(FLEX); {
                beginButton(); {
                    textSpan("Step");

                    if (elementHasMouseClick()) {
                        const result = stepProgram(interpretResult);
                        if (!result) {
                            message.val = "Program complete! you can stop debugging now.";
                        }
                    }
                } end();
            } end();

            beginLayout(FLEX); {
                beginButton(); {
                    textSpan("Reset");
                    if (elementHasMouseClick()) {
                        assert(ctx.lastParseResult);
                        ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult);
                        message.val = "";
                    }
                } end();
            } end();
        } end();

        imIf(message.val, (message) => {
            div(); {
                textSpan(message);
            } end();
        });

        assert(interpretResult);
        const cs = getCurrentCallstack(interpretResult);

        beginLayout(COL | FLEX); {
            beginLayout(COL | FLEX); {
                imIf(cs, (cs) => {
                    renderFunction(interpretResult, cs.code);
                });
            } end();
            beginLayout(ROW | FLEX); {
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
                                                imInit() && setAttributes({
                                                    style: "padding-left: 10px; padding-right: 10px"
                                                });

                                                textSpan(name + "->", CODE);
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

                                        // every callstack will have a different return address
                                        callstackIdx = -1;
                                        for (let i = 0; i < interpretResult.callStack.length; i++) {
                                            const cs = interpretResult.callStack[i];
                                            if (cs.nextVarAddress === addr) {
                                                callstackIdx = i;
                                            }
                                        }

                                        imIf(callstackIdx !== -1, () => {
                                            stackAddrArrow("v" + callstackIdx + "");
                                        });

                                        const variable = variablesReverseMap.get(addr);
                                        imIf(variable, variable => {
                                            div(); {
                                                textSpan(variable + " = ", CODE);
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

                    renderProgramOutputs(interpretResult.outputs, ctx);
                } end();
            } end();
        } end();
    } end();
}

function newCanvasElement() {
    return document.createElement("canvas");
}

function renderProgramOutputs(outputs: ProgramOutputs, ctx: GlobalContext) {
    beginList();
    for (const result of outputs.prints) {
        nextRoot(); {
            beginLayout(ROW | GAP); {
                div(); {
                    imInit() && setAttributes({ 
                        style: `width: 5px; background-color: ${cssVars.fg};`
                    });
                } end();

                beginLayout(COL | GAP); {
                    beginCodeBlock(0); {
                        textSpan(
                            expressionToString(result.expr)
                        )
                    } end();

                    beginLayout(FLEX); {
                        renderProgramResult(result.val);
                    } end();
                } end();
            } end();

        } end();
    };
    endList();
    beginList();
    for (const [idx, plot] of outputs.plots) {
        nextRoot(); {
            beginLayout(); {
                beginLayout(COL | GAP); {
                    textSpan("Plot #" + idx, H3);
                } end();


                const exprFrequencies = imStateInline(() => new Map<ProgramExpression, number>());
                if (!imMemo().val(outputs).isSame) {
                    exprFrequencies.clear();
                    for (const line of plot.lines) {
                        const count = exprFrequencies.get(line.expr) ?? 0;
                        exprFrequencies.set(line.expr, count + 1);
                    }
                }

                beginList();
                for (const [expr, count] of exprFrequencies) {
                    nextRoot(); {
                        beginLayout(ROW | GAP); {
                            textSpan(count + "x: ");
                            textSpan(expressionToString(expr), CODE);
                        } end();
                    } end();
                }
                endList();

                beginAspectRatio(16, 9).root; {
                    renderPlot(plot);
                } end();
            } end();
        } end();
    }
    endList();
    imElse(() => {
        textSpan("No results yet");
    });
}

let currentMaximizedPlot: ProgramPlotOutput | null = null;

function setInset(amount: string) {
    if (amount) {
        setClass(cn.borderBox);
        setStyle("padding", amount);
    } else {
        setClass(cn.borderBox, false);
        setStyle("padding", "");
    }
}

type PlotState = {
    posX: number;
    posY: number;
    originalExtent: number;
    zoom: number;
    width: number;
    height: number;
    maximized: boolean;
}

function newPlotState(): PlotState {
    return { 
        posX: 0,
        posY: 0,
        zoom: 1,
        originalExtent: 0,
        width: 0,
        height: 0,
        maximized: false
    };
}

function getExtent(plot: PlotState): number {
    const { originalExtent, zoom } = plot;
    return originalExtent / zoom;
}

function getCanvasElementX(plot: PlotState, x: number): number {
    const { posX, width } = plot;
    const extent = getExtent(plot);
    const x0Extent = posX - extent;
    const x1Extent = posX + extent;
    return inverseLerp(x0Extent, x1Extent, x) * width;
}

function getCanvasElementY(plot: PlotState, y: number): number {
    const { posY, height } = plot;
    const extent = getExtent(plot);
    const y0Extent = posY - extent;
    const y1Extent = posY + extent;
    return inverseLerp(y0Extent, y1Extent, y) * height;
}

function getPlotX(plot: PlotState, x: number): number {
    const { posX, width } = plot;
    const extent = getExtent(plot);
    const x0Extent = posX - extent;
    const x1Extent = posX + extent;

    return lerp(x0Extent, x1Extent, (x / width));
}

function getPlotLengthX(plot: PlotState, l: number): number {
    const { width } = plot;
    const extent = getExtent(plot);
    return l * 2 * extent / width;
}

function getPlotLengthY(plot: PlotState, l: number): number {
    const { height } = plot;
    const extent = getExtent(plot);
    return l * 2 * extent / height;
}

function getPlotY(plot: PlotState, y: number): number {
    const { posY, height } = plot;
    const extent = getExtent(plot);
    const y0Extent = posY - extent;
    const y1Extent = posY + extent;

    return lerp(y0Extent, y1Extent, (y / height));
}

function isPointOnScreen(plot: PlotState, x: number, y: number) {
    const { posX, posY } = plot;

    const extent = getExtent(plot);

    const y0Extent = posY - extent;
    const y1Extent = posY + extent;
    const x0Extent = posX - extent;
    const x1Extent = posX + extent;

    return (x >= x0Extent && x <= x1Extent) &&
        (y >= y0Extent && y <= y1Extent);
}

function drawPointAt(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.beginPath();
    {
        ctx.strokeStyle = cssVars.fg;
        ctx.lineWidth = 2;

        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x + size, y - size);
        ctx.lineTo(x - size, y - size);
        ctx.stroke();
    }
    ctx.closePath();
}

function renderPlot(plot: ProgramPlotOutput) {
    const isMaximized = currentMaximizedPlot === plot;

    let rootLayoutFlags = GAP | W100 | H100 | COL;
    if (isMaximized) {
        rootLayoutFlags = rootLayoutFlags | FIXED | TRANSLUCENT;
    } 

    beginLayout(rootLayoutFlags).root; {
        if (!imMemo().val(isMaximized).isSame) {
            if (isMaximized) {
                setInset("10px");
            } else {
                setInset("");
            }
        }

        beginLayout(COL | OPAQUE | FLEX | GAP); {
            beginLayout(ROW | GAP); {
                beginButton(isMaximized); {
                    textSpan(isMaximized ? "minimize" : "maximize");

                    const keys = getKeys();
                    const mouse = getMouse();

                    if (isMaximized) {
                        if (
                            keys.escPressed ||
                            (mouse.leftMouseButton && elementHasMouseClick())
                        ) {
                            currentMaximizedPlot = null;
                        }
                    } else {
                        if (mouse.leftMouseButton && elementHasMouseClick()) {
                            currentMaximizedPlot = plot;
                        }
                    }
                } end();
            } end();

            const container = beginLayout(FLEX | RELATIVE).root; {
                const shiftScrollToZoomVal = imRef<number>();

                const canvasRoot = el(newCanvasElement); const canvas = canvasRoot.root; {
                    if (imInit()) {
                        setStyle("cursor", "move");
                    }

                    const mouse = getMouse();
                    const canZoom = elementHasMouseOver() && (isShiftPressed() || isMaximized);

                    if (elementHasMouseOver() && (mouse.scrollY !== 0 && !canZoom)) {
                        shiftScrollToZoomVal.val = 1;
                    }

                    // init canvas 
                    const plotState = imState(newPlotState);

                    plotState.maximized = isMaximized;

                    if (!imMemo().val(plot).isSame) {
                        let minX = Number.MAX_VALUE;
                        let maxX = Number.MIN_VALUE;
                        let minY = Number.MAX_VALUE;
                        let maxY = Number.MIN_VALUE;

                        for (const line of plot.lines) {
                            for (let i = 0; i < line.pointsX.length; i++) {
                                const x = line.pointsX[i];
                                minX = Math.min(x, minX);
                                maxX = Math.max(x, maxX);

                                const y = line.pointsY[i];
                                minY = Math.min(y, minY);
                                maxY = Math.max(y, maxY);
                            }
                        }

                        let maxDist = Math.max(maxX - minX, maxY - minY);
                        const centerX = (minX + maxX) / 2;
                        const centerY = (minY + maxY) / 2;

                        plotState.zoom = 1;
                        plotState.originalExtent = maxDist / 2;;
                        plotState.posX = centerX;
                        plotState.posY = centerY;
                    }

                    
                    if (mouse.leftMouseButton && elementWasLastClicked()) {
                        const dxPlot = getPlotLengthX(plotState, mouse.dX);
                        const dyPlot = getPlotLengthY(plotState, mouse.dY);

                        plotState.posX -= dxPlot;
                        plotState.posY -= dyPlot;
                    }


                    const scrollBlocker = imPreventScrollEventPropagation();
                    scrollBlocker.isBlocking = canZoom;

                    let mx0 = 0;
                    let my0 = 0;
                    let mx1 = 0;
                    let my1 = 0;

                    if (canZoom) {
                        if (mouse.scrollY !== 0) {
                            // When we zoom in or out, we want the graph-point that the mouse is currently over
                            // to remain the same.

                            // TODO: a better way to get boundingRect without triggering reflows
                            const rect = container.getBoundingClientRect();

                            const mouseX = mouse.X - rect.left;
                            const mouseY = mouse.Y - rect.top;
                            const mouseXPlot = getPlotX(plotState, mouseX);
                            const mouseYPlot = getPlotY(plotState, mouseY);

                            plotState.zoom -= mouse.scrollY / 100;
                            plotState.zoom = clamp(plotState.zoom, 0.5, 10);

                            const newMouseX = getCanvasElementX(plotState, mouseXPlot);
                            const newMouseY = getCanvasElementY(plotState, mouseYPlot);

                            const mouseDX = newMouseX - mouseX;
                            const mouseDY = newMouseY - mouseY;

                            const dX = getPlotLengthX(plotState, mouseDX);
                            const dY = getPlotLengthY(plotState, mouseDY);

                            mx0 = mouseXPlot;
                            my0 = mouseYPlot;

                            mx1 = newMouseX;
                            my1 = newMouseY;

                            plotState.posX += dX;
                            plotState.posY += dY;
                        }
                    }

                    if (!imMemo().objectVals(plotState).isSame) {
                        const { width, height } = plotState;


                        let ctx = imVal<CanvasRenderingContext2D>(); {
                            if (!ctx) {
                                ctx = imSetVal(canvas.getContext("2d"));
                                if (!ctx) {
                                    throw new Error("Canvas 2d isn't supported by your browser!!! I'd suggest _not_ plotting anything. Or updaing your browser");
                                }
                            }

                            // TODO: a better way to get boundingRect without triggering reflows
                            const rect = container.getBoundingClientRect();

                            const width = rect.width;
                            const height = rect.height;

                            canvas.width = width;
                            canvas.height = height;

                            plotState.width = width;
                            plotState.height = height;
                        }

                        ctx.clearRect(0, 0, width, height);

                        // draw boundary
                        ctx.beginPath();
                        {
                            ctx.strokeStyle = cssVars.fg;
                            ctx.lineWidth = 2;
                            const offset = 1;
                            ctx.moveTo(offset, offset);
                            ctx.lineTo(offset, height - offset);
                            ctx.lineTo(width - offset, height - offset);
                            ctx.lineTo(width - offset, offset);
                            ctx.lineTo(offset, offset);
                            ctx.stroke();
                        }
                        ctx.closePath();

                        // draw lines
                        {
                            for (const line of plot.lines) {
                                // TODO: labels

                                ctx.strokeStyle = line.color ? line.color.toString() : cssVars.fg;
                                ctx.lineWidth = 2;

                                // draw the actual lines

                                let x0 = line.pointsX[0];
                                let y0 = line.pointsY[0];
                                const x0Plot = getCanvasElementX(plotState, x0);
                                const y0Plot = getCanvasElementY(plotState, y0);
                                ctx.beginPath();
                                if (!line.displayAsPoints) {
                                    ctx.moveTo(x0Plot, y0Plot);
                                    for (let i = 1; i < line.pointsX.length; i++) {
                                        const x1 = line.pointsX[i];
                                        const y1 = line.pointsY[i];

                                        const x1Plot = getCanvasElementX(plotState, x1);
                                        const y1Plot = getCanvasElementY(plotState, y1);

                                        ctx.lineTo(x1Plot, y1Plot);

                                        x0 = x1; y0 = y1;
                                    }
                                    ctx.stroke();
                                }
                                ctx.closePath();

                                let renderPoints = line.displayAsPoints;
                                if (!renderPoints) {
                                    let numPointsOnScreen = 0;
                                    for (let i = 0; i < line.pointsX.length; i++) {
                                        const x1 = line.pointsX[i];
                                        const y1 = line.pointsY[i];
                                        if (isPointOnScreen(plotState, x1, y1)) {
                                            numPointsOnScreen++;
                                        }
                                    }

                                    renderPoints = numPointsOnScreen < 20;
                                }
                                if (renderPoints) {
                                   for (let i = 0; i < line.pointsX.length; i++) {
                                        const x1 = line.pointsX[i];
                                        const y1 = line.pointsY[i];

                                        const x1Plot = getCanvasElementX(plotState, x1);
                                        const y1Plot = getCanvasElementY(plotState, y1);

                                        drawPointAt(ctx, x1Plot, y1Plot, 5);
                                    }
                                }
                            }
                        }
                    }
                } end();

                if (shiftScrollToZoomVal.val !== null) {
                    const dt = deltaTimeSeconds();
                    shiftScrollToZoomVal.val -= dt;
                    if (shiftScrollToZoomVal.val < 0) {
                        shiftScrollToZoomVal.val = null;
                    }
                }

                imIf(shiftScrollToZoomVal.val, (val) => {
                    beginAbsoluteLayout(0, 5, NONE, NONE, 5); {
                        setStyle("opacity", val + "");
                        textSpan("Shift + scroll to zoom");
                    } end();
                })

            } end();
        } end();
    } end();
}

let saveTimeout = 0;
function saveStateDebounced(ctx: GlobalContext) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveState(ctx.state);
        saveTimeout = 0;
    }, 1000);
}


export function renderApp() {
    beginFrame(); {
        const error = imRef<any>();

        div(); {
            imInit() && setAttributes({
                class: [cn.fixed, cnApp.normalFont, cn.absoluteFill]
            });

            const l = beginList();
            try {
                if (!error.val) {
                    nextRoot(1); {
                        const ctx = imState(newGlobalContext);
                        // ctx.rerenderApp = rerender;

                        const { state } = ctx;

                        if (!imMemo().objectVals(state).isSame) {
                            const text = ctx.state.text;
                            ctx.lastParseResult = parse(text);
                            if (ctx.state.autorun) {
                                ctx.lastInterpreterResult = interpret(ctx.lastParseResult);
                            }

                            saveStateDebounced(ctx);
                        }

                        beginLayout(ROW | H100); {
                            beginLayout(FLEX); {
                                renderAppCodeEditor(ctx);
                            } end();
                            beginLayout(FLEX); {
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
                            imInit() && setAttributes({
                                style: "right: 10px; bottom: 10px",
                                class: [cn.absolute],
                            });

                            setInnerText(saveTimeout ? "Saving..." : "Saved");
                        } end();

                    } end();
                } else {
                    nextRoot(2); {
                        div(); {
                            textSpan("An error occured: " + error.val.message);
                        } end();
                    } end();
                }
            } catch (e) {
                abortListAndRewindUiStack(l);
                console.error(e);
                error.val = e;
            }
            endList();
        } end();

    } endFrame();
}
