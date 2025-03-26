import { beginTextArea } from './components/text-area.ts';
import { evaluateFunctionWithinProgramWithArgs, ProgramExecutionStep, ExecutionSteps, executionStepToString, getCurrentCallstack, interpret, newNumberResult, ProgramInterpretResult, ProgramPlotOutput, ProgramPlotOutputHeatmapFunction, ProgramResult, ProgramResultNumber, programResultTypeString, startInterpreting, stepProgram, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING, ProgramResultFunction } from './program-interpreter.ts';
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
import { cnApp, cssVars, getCurrentTheme } from './styling.ts';
import { abortListAndRewindUiStack, assert, beginFrame, beginList, cn, deferClickEventToParent, deltaTimeSeconds, div, el, elementHasMouseClick, elementHasMouseOver, elementWasLastClicked, end, endFrame, endList, getKeys, getMouse, imInit, beginMemo, imPreventScrollEventPropagation, imRef, imSetVal, imState, imStateInline, imVal, isShiftPressed, newCssBuilder, nextRoot, Ref, scrollIntoView, setAttributes, setClass, setInnerText, setStyle, span, UIRoot, endMemo, imSb } from './utils/im-dom-utils.ts';
import { clamp, inverseLerp, lerp, max, min } from './utils/math-utils.ts';
import { getSliceValue } from './utils/matrix-math.ts';
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
    const transparent = (flags & TRANSPARENT);

    setClass(cn.row, (flags & ROW));
    setClass(cn.col, (flags & COL));
    setClass(cn.flex1, (flags & FLEX));
    setClass(cnApp.gap5, (flags & GAP));
    setClass(cnApp.code, (flags & CODE));
    setClass(cnApp.bg2, !transparent && (flags & CODE));
    setClass(cn.pre, (flags & PRE));
    setClass(cn.preWrap, (flags & PREWRAP));
    setClass(cn.alignItemsCenter, (flags & ALIGN_CENTER));
    setClass(cn.justifyContentCenter, (flags & JUSTIFY_CENTER));
    setClass(cn.h100, (flags & H100));
    setClass(cn.w100, (flags & W100));
    setClass(cnApp.bold, (flags & BOLD));
    setClass(cnApp.italic, (flags & ITALIC));
    setClass(cnApp.h1, (flags & H1));
    setClass(cnApp.h2, (flags & H2));
    setClass(cnApp.h3, (flags & H3));
    setClass(cn.absolute, (flags & ABSOLUTE));
    setClass(cn.relative, (flags & RELATIVE));
    const fixed = (flags & FIXED);
    setClass(cn.fixed, fixed);
    setStyle("top", fixed ? "0" : "");
    setStyle("left", fixed ? "0" : "");
    setStyle("bottom", fixed ? "0" : "");
    setStyle("right", fixed ? "0" : "");
    setClass(cnApp.bg, (flags & OPAQUE));
    setClass(cnApp.translucent, (flags & TRANSLUCENT));
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

    if (beginMemo()
        .val(top).val(left).val(bottom).val(right)
        .changed()
    ) {
        setStyle("top", top === NONE ? "" : top + "px");
        setStyle("left", left === NONE ? "" : left + "px");
        setStyle("bottom", bottom === NONE ? "" : bottom + "px");
        setStyle("right", right === NONE ? "" : right + "px");
    } endMemo();

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


function ParserOutput(parseResult: ProgramParseResult | undefined) {
    beginList(); 
    if (nextRoot() && parseResult) {
        const statements = parseResult.statements;

        beginList(); 
        if (nextRoot() && statements.length > 0) {

            function renderRow(title: string, type: string, depth: number, code?: string) {
                nextRoot(); 
                div(); {
                    setStyle("paddingLeft", (depth * 20) + "px");

                    textSpan(title);
                    textSpan(" = ");
                    textSpan(type);
                    beginList();
                    if (code) {
                        nextRoot();

                        textSpan(" ");
                        textSpan(code, CODE);
                    } endList();
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

            beginList();
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                dfs("Statement " + (i + 1), statement, 0);
            }
            endList();
        } else {
            nextRoot();
            textSpan("Nothing parsed yet");
        }
        endList();

        renderDiagnosticInfo("Errors", parseResult.errors, "No parsing errors!");
        renderDiagnosticInfo("Warnings", parseResult.warnings, "No parsing warnings");
    } else {
        nextRoot();
        textSpan("No parse results yet");
    } endList();
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
    beginList();
    if (nextRoot() && heading) {
        beginHeading(); {
            textSpan(heading);
        } end();
    } endList();

    beginList(); 
    for (const e of info) {
        nextRoot(); 
        div(); {
            textSpan("Line " + e.pos.line + " Col " + (e.pos.col + 1) + " - " + e.problem);
        } end();
    }
    endList();

    beginList();
    if (nextRoot() && info.length === 0) {
        div(); {
            textSpan(emptyText);
        } end();
    }
    endList();
}

function renderProgramResult(res: ProgramResult) {
    div(); {
        beginLayout(COL | GAP); {
            beginList(); {
                nextRoot(res.t);
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
                                    nextRoot();
                                    renderProgramResult(res.values[i]);
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

                                beginList();
                                if (nextRoot() && !isLast) {
                                    textSpan(", ");
                                } 
                                endList();

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
                                        nextRoot(key);
                                        dfs(dim + 1, i === len - 1);
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
            } endList();
        } end();
    } end();
}

function beginExpandableSectionHeading(text: string, isCollapsed: boolean) {
    const root = beginHeading(); {
        textSpan(text);

        beginList();
        if (nextRoot() && isCollapsed) {
            textSpan(" <");
        } else {
            nextRoot();
            textSpan(" v");
        }
        endList();

        if (imInit()) {
            setStyle("cursor", "pointer");
            setClass(cn.userSelectNone);
        }
    } 

    return root;
}

function renderExecutionStep(step: ProgramExecutionStep) {
    textSpan(executionStepToString(step));
}

function renderFunctionInstructions(interpretResult: ProgramInterpretResult, { name, steps }: ExecutionSteps) {
    beginLayout(FLEX | COL); {
        const scrollContainer = beginScrollContainer(FLEX); {
            let rCurrent: UIRoot<HTMLElement> | undefined;

            beginCodeBlock(0); {
                beginList(); 
                if (nextRoot() && steps.length > 0) {
                    beginList(); 
                    for (let i = 0; i < steps.length; i++) {
                        nextRoot();

                        const step = steps[i];

                        const call = getCurrentCallstack(interpretResult);
                        const isCurrent = call?.code?.steps === steps
                            && i === call.i;

                        const currentStepDiv = div(); {
                            textSpan(i + " | ");

                            renderExecutionStep(step);

                            beginList();
                            if (nextRoot() && isCurrent) {
                                textSpan(" <----");
                            }
                            endList();
                        } end();

                        if (isCurrent) {
                            rCurrent = currentStepDiv;
                        }
                    }
                    endList();
                } else {
                    nextRoot();
                    div(); {
                        textSpan("no instructions present");
                    } end();
                } 
                endList();
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

function imFunctionName(fn: ProgramResultFunction | null) {
    const sb = imSb();

    if (beginMemo().val(fn).changed()) {
        sb.clear();
        if (!fn) {
            sb.s("Entry point");
        } else {
            sb.s(fn.code.name);
            sb.s("(");
            for (let i = 0; i < fn.args.length; i++) {
                if (i > 0) sb.s(", ");
                sb.s(fn.args[i].name);
            }
            sb.s(")");
        }
    } endMemo();

    return sb.toString();
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

        beginList();
        if (nextRoot() && !ctx.state.collapseParserOutput) {
            ParserOutput(parseResult);
        }
        endList();

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

        beginList();
        if(nextRoot() && !ctx.state.collapseInterpreterPass1Output) {
            beginList();
            if (nextRoot() && ctx.lastInterpreterResult) {
                const interpretResult = ctx.lastInterpreterResult;

                div(); {
                    renderDiagnosticInfo("Interpreting errors", interpretResult.errors, "No interpreting errors");

                    el(newH3); {
                        textSpan("Instructions");
                    } end();

                    beginList(); {
                        nextRoot();

                        beginLayout(ROW | GAP); {
                            textSpan(interpretResult.entryPoint.name, H3 | BOLD);

                            beginButton(); {
                                textSpan("Start debugging");
                                if (elementHasMouseClick()) {
                                    startDebugging(ctx);
                                }
                            } end();
                        } end();

                        renderFunctionInstructions(interpretResult, interpretResult.entryPoint);

                        for (const [, fn] of interpretResult.functions) {
                            nextRoot(); 

                            beginLayout(ROW | GAP); {
                                const fnName = imFunctionName(fn);
                                textSpan(fnName, H3 | BOLD);

                                beginButton(); {
                                    textSpan("Start debugging");
                                } end();
                            } end();

                            renderFunctionInstructions(interpretResult, fn.code);
                        }
                    } endList();

                } end();
            } else {
                nextRoot();
                beginLayout(); {
                    textSpan("No instructions generated yet");
                } end();
            } endList();
        } endList();

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

        beginList();
        if (nextRoot() && ctx.lastInterpreterResult) {
            renderProgramOutputs(ctx.lastInterpreterResult);
        } else {
            nextRoot();
            beginLayout(); {
                textSpan("Program hasn't been run yet");
            } end();
        }
        endList();

        beginList();
        if (nextRoot() && ctx.state.text === "") {
            // NOTE: might not be the best workflow. i.e maybe we want to be able to see the examples while we're writing things.

            beginHeading(); {
                textSpan("Examples")
            } end();

            beginLayout(COL | GAP); {
                beginList();
                for (const eg of codeExamples) {
                    nextRoot(); 
                    beginButton(); {
                        textSpan(eg.name);

                        if (elementHasMouseClick()) {
                            ctx.state.text = eg.code.trim();
                        }
                    } end();
                } 
                endList();
            } end();
        } 
        endList();
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
        nextRoot(); 
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

        beginTextArea({
            text: state.text,
            isEditing: true,
            onInput,
            onInputKeyDown,
            textAreaRef,
            config: {
                useSpacesInsteadOfTabs: true,
                tabStopSize: 4
            },
        }); {
            beginList();
            const errors = lastInterpreterResult?.errors;
            if (nextRoot() && errors) {
                renderDiagnosticInfoOverlay(state, textAreaRef, errors, "red");
            }
            const warnings = lastParseResult?.warnings;
            if (nextRoot() && warnings) {
                renderDiagnosticInfoOverlay(state, textAreaRef, warnings, "orange");
            };
            endList();
        } end();
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
                        ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult, true);
                        message.val = "";
                    }
                } end();
            } end();
        } end();

        beginList();
        if (nextRoot() && message.val) {
            div(); {
                textSpan(message.val);
            } end();
        } endList();

        assert(interpretResult);
        const cs = getCurrentCallstack(interpretResult);

        beginLayout(COL | FLEX); {
            beginLayout(COL | FLEX); {
                beginList();
                if (nextRoot() && cs) {
                    const fnName = imFunctionName(cs.fn);
                    beginLayout(H3 | BOLD); {
                        textSpan(fnName);
                    } end();

                    renderFunctionInstructions(interpretResult, cs.code);
                } endList()
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

                            nextRoot(); 

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

                                    beginList();
                                    if (nextRoot() && addr === interpretResult.stackIdx) {
                                        stackAddrArrow("");
                                    }
                                    endList();

                                    // every callstack will have a different return address
                                    let callstackIdx = -1;
                                    for (let i = 0; i < interpretResult.callStack.length; i++) {
                                        const cs = interpretResult.callStack[i];
                                        if (cs.returnAddress === addr) {
                                            callstackIdx = i;
                                        }
                                    }

                                    beginList();
                                    if (nextRoot() && callstackIdx !== -1) {
                                        stackAddrArrow("r" + callstackIdx + "");
                                    };
                                    endList();

                                    // every callstack will have a different next-variable address
                                    callstackIdx = -1;
                                    for (let i = 0; i < interpretResult.callStack.length; i++) {
                                        const cs = interpretResult.callStack[i];
                                        if (cs.nextVarAddress === addr) {
                                            callstackIdx = i;
                                        }
                                    }

                                    beginList();
                                    if (nextRoot() && callstackIdx !== -1) {
                                        stackAddrArrow("v" + callstackIdx + "");
                                    };
                                    endList();

                                    const variable = variablesReverseMap.get(addr);
                                    beginList();
                                    if (nextRoot() && variable) {
                                        div(); {
                                            textSpan(variable + " = ", CODE);
                                        } end();
                                    }
                                    endList();

                                    beginLayout(FLEX); {
                                        beginList();
                                        if (nextRoot() && res) {
                                            renderProgramResult(res);
                                        } else {
                                            nextRoot();
                                            textSpan("null");
                                        }
                                        endList();
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

                    renderProgramOutputs(interpretResult);
                } end();
            } end();
        } end();
    } end();
}

function newCanvasElement() {
    return document.createElement("canvas");
}

function renderProgramOutputs(program: ProgramInterpretResult) {
    const outputs = program.outputs;

    beginList();
    for (const result of outputs.prints) {
        nextRoot(); 
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
    };
    endList();
    beginList();
    if (nextRoot() && outputs.plots.size > 0) {
        beginList();
        for (const [idx, plot] of outputs.plots) {
            nextRoot(); 
            beginLayout(); {
                beginLayout(COL | GAP); {
                    textSpan("Plot #" + idx, H3);
                } end();


                const exprFrequencies = imStateInline(() => new Map<ProgramExpression, number>());

                if (!beginMemo().val(outputs).changed()) {
                    exprFrequencies.clear();
                    for (const line of plot.lines) {
                        const count = exprFrequencies.get(line.expr) ?? 0;
                        exprFrequencies.set(line.expr, count + 1);
                    }
                } endMemo();

                beginList();
                for (const [expr, count] of exprFrequencies) {
                    nextRoot(); 
                    beginLayout(ROW | GAP); {
                        textSpan(count + "x: ");
                        textSpan(expressionToString(expr), CODE);
                    } end();
                }
                endList();

                beginAspectRatio(16, 9).root; {
                    renderPlot(plot, program);
                } end();
            } end();
        }
        endList();
    } else {
        nextRoot();
        textSpan("No results yet");
    }
    endList();
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

function getDim(plot: PlotState): number {
    const { width, height } = plot;
    return max(width, height);
}

function getMaxDim(plot: PlotState): number {
    const { width, height } = plot;
    return max(width, height);
}

function getMinDim(plot: PlotState): number {
    const { width, height } = plot;
    return max(width, height);
}

function getCanvasElementX(plot: PlotState, x: number): number {
    const { posX } = plot;
    const extent = getExtent(plot);
    const x0Extent = posX - extent;
    const x1Extent = posX + extent;
    return inverseLerp(x0Extent, x1Extent, x) * getDim(plot);
}

function getCanvasElementY(plot: PlotState, y: number): number {
    const { posY } = plot;
    const extent = getExtent(plot);
    const y0Extent = posY - extent;
    const y1Extent = posY + extent;
    return inverseLerp(y0Extent, y1Extent, y) * getDim(plot);
}

function getPlotX(plot: PlotState, x: number): number {
    const { posX } = plot;
    const extent = getExtent(plot);
    const x0Extent = posX - extent;
    const x1Extent = posX + extent;

    return lerp(x0Extent, x1Extent, (x / getDim(plot)));
}

function getPlotLength(plot: PlotState, l: number): number {
    return getPlotX(plot, l) - getPlotX(plot, 0);
}

function getPlotY(plot: PlotState, y: number): number {
    const { posY } = plot;
    const extent = getExtent(plot);
    const y0Extent = posY - extent;
    const y1Extent = posY + extent;

    return lerp(y0Extent, y1Extent, (y / getDim(plot)));
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

function drawPointAt(ctx: CanvasRenderingContext2D, x: number, y: number, halfSize: number, strokeStyle: string = cssVars.fg) {
    ctx.beginPath();
    {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 2;

        ctx.moveTo(x - halfSize, y - halfSize);
        ctx.lineTo(x - halfSize, y + halfSize);
        ctx.lineTo(x + halfSize, y + halfSize);
        ctx.lineTo(x + halfSize, y - halfSize);
        ctx.lineTo(x - halfSize, y - halfSize);
        ctx.stroke();
    }
    ctx.closePath();
}

function renderPlot(plot: ProgramPlotOutput, program: ProgramInterpretResult) {
    const isMaximized = currentMaximizedPlot === plot;

    let rootLayoutFlags = GAP | W100 | H100 | COL;
    if (isMaximized) {
        rootLayoutFlags = rootLayoutFlags | FIXED | TRANSLUCENT;
    } 

    beginLayout(rootLayoutFlags).root; {
        if (beginMemo().val(isMaximized).changed()) {
            if (isMaximized) {
                setInset("10px");
            } else {
                setInset("");
            }
        } endMemo();

        beginLayout(COL | OPAQUE | FLEX | GAP); {
            beginLayout(ROW | GAP); {
                beginButton(isMaximized); {
                    textSpan(isMaximized ? "minimize" : "maximize");

                    const keys = getKeys();

                    if (isMaximized) {
                        if (
                            keys.escPressed ||
                            (elementHasMouseClick())
                        ) {
                            currentMaximizedPlot = null;
                        }
                    } else {
                        if (elementHasMouseClick()) {
                            currentMaximizedPlot = plot;
                        }
                    }
                } end();
            } end();

            const container = beginLayout(FLEX | RELATIVE).root; {
                const shiftScrollToZoomVal = imRef<number>();

                const problems = imRef<string[]>();
                if (!problems.val) {
                    problems.val = [];
                }

                const canvasRoot = el(newCanvasElement); 
                const canvas = canvasRoot.root; {
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

                    if (beginMemo().val(plot).changed()) {
                        let minX = Number.MAX_SAFE_INTEGER;
                        let maxX = Number.MIN_SAFE_INTEGER;
                        let minY = Number.MAX_SAFE_INTEGER;
                        let maxY = Number.MIN_SAFE_INTEGER;

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

                        if (minX === Number.MAX_SAFE_INTEGER || minX === maxX) {
                            plotState.zoom = 1;
                            plotState.originalExtent = 1;
                            plotState.posX = 0;
                            plotState.posY = 0;
                        } else {
                            let maxDist = Math.max(maxX - minX, maxY - minY);
                            const centerX = (minX + maxX) / 2;
                            const centerY = (minY + maxY) / 2;

                            plotState.zoom = 1;
                            plotState.originalExtent = maxDist / 2;;
                            plotState.posX = centerX;
                            plotState.posY = centerY;
                        }
                    } endMemo();

                    
                    if (mouse.leftMouseButton && elementWasLastClicked()) {
                        const dxPlot = getPlotLength(plotState, mouse.dX);
                        const dyPlot = getPlotLength(plotState, mouse.dY);

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

                            const dX = getPlotLength(plotState, mouseDX);
                            const dY = getPlotLength(plotState, mouseDY);

                            mx0 = mouseXPlot;
                            my0 = mouseYPlot;

                            mx1 = newMouseX;
                            my1 = newMouseY;

                            plotState.posX += dX;
                            plotState.posY += dY;
                        }
                    }

                    let ctx = imVal<CanvasRenderingContext2D | null>(null); 
                    if (!ctx) {
                        ctx = imSetVal(canvas.getContext("2d"));
                        if (!ctx) {
                            throw new Error("Canvas 2d isn't supported by your browser!!! I'd suggest _not_ plotting anything. Or updaing your browser");
                        }
                    }

                    const rows = imRef<number[][]>();
                    if (!rows.val) {
                        rows.val = [];
                    }

                    if (beginMemo().val(plot).objectVals(plotState).changed()) {
                        problems.val.length = 0;


                        // TODO: a better way to get boundingRect without triggering reflows
                        const rect = container.getBoundingClientRect();

                        canvas.width = rect.width;
                        canvas.height = rect.height;

                        plotState.width = rect.width;
                        plotState.height = rect.height;

                        const { width, height } = plotState;

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

                        // draw function heatmaps (if the program had no errors, since we need to evaluate the function in the same program context)
                        if (program.errors.length === 0) {
                            const n = program.outputs.heatmapSubdivisions + 1;
                            const dim = getMaxDim(plotState);

                            const centerX = getPlotX(plotState, width / 2);
                            const centerY = getPlotY(plotState, width / 2);
                            const sizeScreen = dim / n;
                            const size = getPlotLength(plotState, sizeScreen);

                            for (const output of plot.functions) {
                                if (program.isDebugging) {
                                // TODO: we need to be able to run functions that we're debugging.
                                // This will be useful when we want to implement a 'watch' window. Prob just as simple as
                                // duplicating the program stack. 
                                    problems.val.push("Can't render heatmaps while we're debugging - the program stack is still in use. ");
                                    break;
                                } 

                                rows.val.length = 0

                                const args: ProgramResultNumber[] = [
                                    newNumberResult(1),
                                    newNumberResult(1),
                                ];

                                let minValue = Number.MAX_SAFE_INTEGER;
                                let maxValue = Number.MIN_SAFE_INTEGER;

                                outer: for (let i = 0; i < n; i++) {
                                    const row: number[] = Array(n);
                                    row.fill(0);

                                    for (let j = 0; j < n; j++) {
                                        const evalPointX = centerX + (-(n / 2) + i) * size;
                                        const evalPointY = centerY + (-(n / 2) + j) * size;

                                        args[0].val = evalPointX;
                                        args[1].val = evalPointY;

                                        const result = evaluateFunctionWithinProgramWithArgs(program, output.step, output.fn, args);
                                        if (!result) {
                                            problems.val.push("result for " + i + ", " + j + " didn't return anything");
                                            break outer;
                                        }
                                        if (program.errors.length > 0) {
                                            // TODO: display the error
                                            problems.val.push("Encountered an error in the program");
                                            break outer;
                                        }
                                        if (result.t !== T_RESULT_NUMBER) {
                                            problems.val.push("result for " + i + ", " + j + " wasn't a number");
                                            break outer;
                                        }

                                        const res = result.val;
                                        row[j] = res;

                                        minValue = min(minValue, res);
                                        maxValue = max(maxValue, res);
                                    }

                                    rows.val.push(row);
                                }

                                if (problems.val.length === 0) {
                                    const theme = getCurrentTheme();
                                    const color = output.color ?? theme.fg;

                                    for (let i = 0; i < n; i++) {
                                        for (let j = 0; j < n; j++) {
                                            const val = rows.val[i][j];
                                            const heat = inverseLerp(minValue, maxValue, val);

                                            const evalPointX = centerX + (-(n / 2) + i) * size;
                                            const evalPointY = centerY + (-(n / 2) + j) * size;

                                            const x0 = getCanvasElementX(plotState, evalPointX);
                                            const y0 = getCanvasElementY(plotState, evalPointY);

                                            

                                            ctx.fillStyle = color.toCssString(heat);
                                            ctx.beginPath(); {
                                                ctx.rect(x0, y0, sizeScreen, sizeScreen);
                                                ctx.fill();
                                            }
                                            ctx.closePath();
                                        }
                                    }
                                }
                            }
                        }

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
                    } endMemo();
                } end();

                if (shiftScrollToZoomVal.val !== null) {
                    const dt = deltaTimeSeconds();
                    shiftScrollToZoomVal.val -= dt;
                    if (shiftScrollToZoomVal.val < 0) {
                        shiftScrollToZoomVal.val = null;
                    }
                }

                beginList();
                if (nextRoot() && shiftScrollToZoomVal.val !== 0) {
                    beginAbsoluteLayout(0, 5, NONE, NONE, 5); {
                        setStyle("opacity", shiftScrollToZoomVal.val + "");
                        textSpan("Shift + scroll to zoom");
                    } end();
                } endList();

                beginList();
                for (const prob of problems.val) {
                    nextRoot();
                    beginLayout(); {
                        textSpan("Problem: " + prob);
                    } end();
                }
                endList();

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

type CodeExample = {
    name: string;
    code: string;
}

// TODO: improve examples to be simpler and to demonstrate individual concepts. 
// right now, I'm just using this mechanism to save and load various scenarios.
const codeExamples: CodeExample[] = [
    {
        name: "Plotting lines",
        code: 
    `
// Multiple sine waves, each sine wave is made of multiple segments with gradually increasing colour

n = 10

for size in 1 -> 6 {
    period = 0.1
    pos = 0

    for i in 0 -> n {
        sine_wave = []L
        for j in pos -> pos + 3 / period {
            push(sine_wave, [j, size * 10 * sin(j * period)])
        }
        pos = pos + 3

        col = [i/n, 0, 0]

        // try changing this 1 to i
        plot_lines(1, sine_wave, col)
    }
}`
    },
    {
        name: "Signed distance fields",
        code: `
sdf(a, b) { 
    radius = 0.2
    thickness = 0.01
    sqrt(a*a + b*b) 
    (radius - thickness) < ^ && ^ < (radius + thickness)
}

sdf2(a, b) { 
    radius = 0.3
    thickness = 0.01
    sqrt(a*a + b*b) 
    (radius - thickness) < ^ && ^ < (radius + thickness)
}

set_heatmap_subdiv(40)
heatmap(1, sdf, [0.5, 0, 0])
heatmap(1, sdf2, "#F00")

plot_points(1, 0.5 * [
    [0, 0],
    [1, 0], 
    [-1, 0],
    [0, 1],
    [0, -1],
])
        `

    }
]

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
                    nextRoot(1);

                    const ctx = imState(newGlobalContext);

                    const { state } = ctx;

                    if (beginMemo()
                        .val(state.text)
                        .val(state.autorun)
                        .changed()
                    ) {
                        const text = state.text;
                        ctx.lastParseResult = parse(text);
                        if (state.autorun) {
                            ctx.lastInterpreterResult = interpret(ctx.lastParseResult);
                        }

                        saveStateDebounced(ctx);
                    } endMemo();

                    beginLayout(ROW | H100); {
                        beginLayout(FLEX); {
                            renderAppCodeEditor(ctx);
                        } end();
                        beginLayout(FLEX); {
                            beginList();
                            if(nextRoot() && ctx.isDebugging) {
                                const interpretResult = ctx.lastInterpreterResult;
                                assert(interpretResult);
                                renderDebugger(ctx, interpretResult);
                            } else {
                                nextRoot();
                                renderAppCodeOutput(ctx);
                            } 
                            endList();
                        } end();
                    } end();

                    div(); {
                        imInit() && setAttributes({
                            style: "right: 10px; bottom: 10px",
                            class: [cn.absolute],
                        });

                        setInnerText(saveTimeout ? "Saving..." : "Saved");
                    } end();
                } else {
                    nextRoot(2);

                    div(); {
                        textSpan("An error occured: " + error.val.message);
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
