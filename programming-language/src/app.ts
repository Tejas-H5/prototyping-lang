import { beginTextArea } from './components/text-area.ts';
import {
    ABSOLUTE,
    ALIGN_CENTER,
    beginAbsoluteLayout,
    beginAspectRatio,
    imBeginLayout,
    beginScrollContainer,
    BOLD,
    CODE,
    COL,
    FIXED,
    FLEX,
    GAP,
    H100,
    H3,
    JUSTIFY_CENTER,
    NONE,
    OPAQUE,
    PRE,
    PREWRAP,
    RELATIVE,
    ROW,
    setStyleFlags,
    textSpan,
    TRANSLUCENT,
    TRANSPARENT,
    W100
} from './layout.ts';
import { BuiltinFunction, evaluateFunctionWithinProgramWithArgs, ExecutionSteps, executionStepToString, getBuiltinFunctionsMap, getCurrentCallstack, interpret, newNumberResult, ProgramExecutionStep, ProgramGraphOutput, ProgramImageOutput, ProgramInterpretResult, ProgramPlotOutput, ProgramResult, ProgramResultFunction, ProgramResultNumber, programResultTypeString, programResultTypeStringFromType, stepProgram, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MAP, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING, UI_INPUT_SLIDER } from './program-interpreter.ts';
import {
    binOpToString,
    binOpToOpString as binOpToSymbolString,
    DiagnosticInfo,
    expressionToString,
    expressionTypeToString,
    parse,
    parseIdentifierBackwardsFromPoint,
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
    T_MAP_LITERAL,
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
import { abortListAndRewindUiStack, assert, beginFrame, imBeginList, imBeginMemoComputation, cn, deferClickEventToParent, deltaTimeSeconds, imBeginDiv, imBeginEl, elementWasClicked, elementWasHovered, elementWasLastClicked, imEnd, endFrame, imEndList, endMemo, getCurrentRoot, getKeys, getMouse, imInit, imPreventScrollEventPropagation, imRef, imSb, imSetVal, imState, imStateInline, imTrackSize, imVal, isShiftPressed, newCssBuilder, nextListRoot, Ref, scrollIntoView, setAttributes, setClass, setInnerText, setStyle, SizeState, imBeginSpan, UIRoot } from './utils/im-dom-utils.ts';
import { clamp, inverseLerp, lerp, max, min } from './utils/math-utils.ts';
import { getSliceValue } from './utils/matrix-math.ts';
import { getLineBeforePos, getLineEndPos, getLineStartPos } from './utils/text-utils.ts';


function newH3() {
    return document.createElement("h3");
}

// Don't forget to call end()
function beginCodeBlock(indent: number) {
    const root = imBeginLayout(CODE); {
        setStyle("paddingLeft", (4 * indent) + "ch");
    }

    return root;
}


function ParserOutput(parseResult: ProgramParseResult | undefined) {
    imBeginList();
    if (nextListRoot() && parseResult) {
        const statements = parseResult.statements;

        imBeginList();
        if (nextListRoot() && statements.length > 0) {

            function renderRow(title: string, type: string, depth: number, code?: string) {
                nextListRoot();
                imBeginDiv(); {
                    setStyle("paddingLeft", (depth * 20) + "px");

                    textSpan(title);
                    textSpan(" = ");
                    textSpan(type);
                    imBeginList();
                    if (code) {
                        nextListRoot();

                        textSpan(" ");
                        textSpan(code, CODE);
                    } imEndList();
                } imEnd();
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
                    case T_MAP_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(expr));

                        for (let i = 0; i < expr.kvPairs.length; i++) {
                            dfs("key[" + i + "]", expr.kvPairs[i][0], depth + 1);
                            dfs("val[" + i + "]", expr.kvPairs[i][1], depth + 1);
                        }
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
                        dfs("range expr", expr.rangeExpr, depth + 1);
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
                        throw new Error("Unhandled type (parse view): " + typeString);
                    }
                }
            }

            imBeginList();
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                dfs("Statement " + (i + 1), statement, 0);
            }
            imEndList();
        } else {
            nextListRoot();
            textSpan("Nothing parsed yet");
        }
        imEndList();

        renderDiagnosticInfo("Errors", parseResult.errors, "No parsing errors!");
        renderDiagnosticInfo("Warnings", parseResult.warnings, "No parsing warnings");
    } else {
        nextListRoot();
        textSpan("No parse results yet");
    } imEndList();
}

function beginHeading() {
    const root = imBeginEl(newH3); {
        if (imInit()) {
            setStyle("padding", "10px 0");
        }
    }
    return root;
}

// TODO: display these above the code editor itself. 
function renderDiagnosticInfo(heading: string, info: DiagnosticInfo[], emptyText: string) {
    imBeginList();
    if (nextListRoot() && heading) {
        beginHeading(); {
            textSpan(heading);
        } imEnd();
    } imEndList();

    imBeginList();
    for (const e of info) {
        nextListRoot();
        imBeginDiv(); {
            textSpan("Line " + e.pos.line + " Col " + (e.pos.col + 1) + " - " + e.problem);
        } imEnd();
    }
    imEndList();

    imBeginList();
    if (nextListRoot() && info.length === 0) {
        imBeginDiv(); {
            textSpan(emptyText);
        } imEnd();
    }
    imEndList();
}

function renderProgramResult(res: ProgramResult) {
    imBeginDiv(); {
        imBeginLayout(COL | GAP); {
            imBeginList(); {
                nextListRoot(res.t);
                const typeString = programResultTypeString(res)
                textSpan(typeString + " ");

                switch (res.t) {
                    case T_RESULT_NUMBER:
                        textSpan("" + res.val, CODE);
                        break;
                    case T_RESULT_STRING:
                        imBeginLayout(COL | GAP); {
                            textSpan(res.val, CODE | PRE);
                        } imEnd();
                        break;
                    case T_RESULT_LIST:
                        beginCodeBlock(0); {
                            textSpan("list[", CODE);
                            beginCodeBlock(1); {
                                imBeginList();
                                for (let i = 0; i < res.values.length; i++) {
                                    nextListRoot();
                                    renderProgramResult(res.values[i]);
                                }
                                imEndList();
                            } imEnd();
                            textSpan("]", CODE);
                        } imEnd();
                        break;
                    case T_RESULT_MAP: {
                        beginCodeBlock(0); {
                            textSpan("map{", CODE);
                            beginCodeBlock(1); {
                                imBeginList();
                                for (const [k, val] of res.map) {
                                    nextListRoot();
                                    textSpan(k + "", CODE);
                                    renderProgramResult(val);
                                }
                                imEndList();
                            } imEnd();
                            textSpan("}", CODE);
                        } imEnd();
                    } break;
                    case T_RESULT_MATRIX:
                        let idx = 0;
                        const dfs = (dim: number, isLast: boolean) => {
                            if (dim === res.val.shape.length) {
                                const val = getSliceValue(res.val.values, idx);

                                // assuming everything renders in order, this is the only thing we need to do for this to work.
                                idx++;

                                textSpan("" + val);

                                imBeginList();
                                if (nextListRoot() && !isLast) {
                                    textSpan(", ");
                                }
                                imEndList();

                                return;
                            }

                            beginCodeBlock(dim === 0 ? 0 : 1); {
                                textSpan("[");
                                imBeginList(); {
                                    const len = res.val.shape[dim];
                                    for (let i = 0; i < len; i++) {
                                        // This is because when the 'level' of the list changes, the depth itself changes,
                                        // and the components we're rendering at a particular level will change. 
                                        // We need to re-key the list, so that we may render a different kind of component at this position.
                                        const key = (res.val.shape.length - dim) + "-" + i;
                                        nextListRoot(key);
                                        dfs(dim + 1, i === len - 1);
                                    }
                                } imEndList();
                                textSpan("]");
                            } imEnd();
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
            } imEndList();
        } imEnd();
    } imEnd();
}

function beginExpandableSectionHeading(text: string, isCollapsed: boolean) {
    const root = beginHeading(); {
        textSpan(text);

        imBeginList();
        if (nextListRoot() && isCollapsed) {
            textSpan(" <");
        } else {
            nextListRoot();
            textSpan(" v");
        }
        imEndList();

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
    imBeginLayout(FLEX | COL); {
        const scrollContainer = beginScrollContainer(FLEX); {
            let rCurrent: UIRoot<HTMLElement> | undefined;

            beginCodeBlock(0); {
                imBeginList();
                if (nextListRoot() && steps.length > 0) {
                    imBeginList();
                    for (let i = 0; i < steps.length; i++) {
                        nextListRoot();

                        const step = steps[i];

                        const call = getCurrentCallstack(interpretResult);
                        const isCurrent = call?.code?.steps === steps
                            && i === call.i;

                        const currentStepDiv = imBeginDiv(); {
                            textSpan(i + " | ");

                            renderExecutionStep(step);

                            imBeginList();
                            if (nextListRoot() && isCurrent) {
                                textSpan(" <----");
                            }
                            imEndList();
                        } imEnd();

                        if (isCurrent) {
                            rCurrent = currentStepDiv;
                        }
                    }
                    imEndList();
                } else {
                    nextListRoot();
                    imBeginDiv(); {
                        textSpan("no instructions present");
                    } imEnd();
                }
                imEndList();
            } imEnd();

            if (rCurrent) {
                scrollIntoView(scrollContainer.root, rCurrent.root, 0.5, 0.5);
            }
        } imEnd();
    } imEnd();
}

const cssb = newCssBuilder();

const cnButton = cssb.cn("button", [
    ` { user-select: none; cursor: pointer; border: 2px solid ${cssVars.fg}; border: 2px solid currentColor; border-radius: 8px; padding: 2px 2px; box-sizing: border-box; }`,
    `:hover { background-color: ${cssVars.bg2} }`,
    `:active { background-color: ${cssVars.mg} }`,

    `.${cnApp.inverted}:hover { background-color: ${cssVars.fg2} }`,
]);


function beginButton(toggled: boolean = false) {
    const root = imBeginLayout(ROW | ALIGN_CENTER | JUSTIFY_CENTER); {
        if (imInit()) {
            setClass(cnButton);
        }

        setClass(cnApp.inverted, toggled);
    };

    return root;
}

function imFunctionName(fn: ProgramResultFunction | null) {
    const sb = imSb();

    if (imBeginMemoComputation().val(fn).changed()) {
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
    imBeginDiv(); {
        if (imInit()) {
            setClass(cn.h100);
            setClass(cn.overflowYAuto);

            setInset("10px");
        }

        const parseResult = ctx.lastParseResult;

        beginExpandableSectionHeading("Parser output", ctx.state.collapseParserOutput); {
            if (elementWasClicked()) {
                ctx.state.collapseParserOutput = !ctx.state.collapseParserOutput;
            }
        } imEnd();

        imBeginList();
        if (nextListRoot() && !ctx.state.collapseParserOutput) {
            ParserOutput(parseResult);
        }
        imEndList();

        const message = imRef<string>();

        beginExpandableSectionHeading("Instruction generation - output", ctx.state.collapseInterpreterPass1Output); {
            if (elementWasClicked()) {
                ctx.state.collapseInterpreterPass1Output = !ctx.state.collapseInterpreterPass1Output;
            }
        } imEnd();

        // TODO: better UI for this message
        imBeginDiv(); {
            textSpan(message.val ?? "");
        } imEnd();

        imBeginList();
        if (nextListRoot() && !ctx.state.collapseInterpreterPass1Output) {
            imBeginList();
            if (nextListRoot() && ctx.lastInterpreterResult) {
                const interpretResult = ctx.lastInterpreterResult;

                imBeginDiv(); {
                    renderDiagnosticInfo("Interpreting errors", interpretResult.errors, "No interpreting errors");

                    imBeginEl(newH3); {
                        textSpan("Instructions");
                    } imEnd();

                    imBeginList(); {
                        nextListRoot();

                        imBeginLayout(ROW | GAP); {
                            textSpan(interpretResult.entryPoint.name, H3 | BOLD);

                            beginButton(); {
                                textSpan("Start debugging");
                                if (elementWasClicked()) {
                                    startDebugging(ctx);
                                }
                            } imEnd();
                        } imEnd();

                        renderFunctionInstructions(interpretResult, interpretResult.entryPoint);

                        for (const [, fn] of interpretResult.functions) {
                            nextListRoot();

                            imBeginLayout(ROW | GAP); {
                                const fnName = imFunctionName(fn);
                                textSpan(fnName, H3 | BOLD);

                                beginButton(); {
                                    textSpan("Start debugging");
                                } imEnd();
                            } imEnd();

                            renderFunctionInstructions(interpretResult, fn.code);
                        }
                    } imEndList();

                } imEnd();
            } else {
                nextListRoot();
                imBeginLayout(); {
                    textSpan("No instructions generated yet");
                } imEnd();
            } imEndList();
        } imEndList();

        imBeginLayout(ROW | GAP); {
            imBeginLayout(FLEX); {
                beginButton(ctx.state.autorun); {
                    textSpan("Autorun");

                    if (elementWasClicked()) {
                        ctx.state.autorun = !ctx.state.autorun
                    }
                } imEnd();
            } imEnd();

            imBeginLayout(FLEX); {
                beginButton(); {
                    textSpan("Start debugging");
                    if (elementWasClicked()) {
                        startDebugging(ctx);
                    }
                } imEnd();
            } imEnd();
        } imEnd();

        beginHeading(); {
            textSpan("Code output");
        } imEnd();

        imBeginList();
        if (nextListRoot() && ctx.lastInterpreterResult) {
            renderProgramOutputs(ctx, ctx.lastInterpreterResult);
        } else {
            nextListRoot();
            imBeginLayout(); {
                textSpan("Program hasn't been run yet");
            } imEnd();
        }
        imEndList();

        imBeginList();
        if (nextListRoot() && ctx.state.text === "") {
            // NOTE: might not be the best workflow. i.e maybe we want to be able to see the examples while we're writing things.

            beginHeading(); {
                textSpan("Examples")
            } imEnd();

            imBeginLayout(COL | GAP); {
                imBeginList();
                for (const eg of codeExamples) {
                    nextListRoot();
                    beginButton(); {
                        textSpan(eg.name);

                        if (elementWasClicked()) {
                            ctx.state.text = eg.code.trim();
                        }
                    } imEnd();
                }
                imEndList();
            } imEnd();
        }
        imEndList();
    } imEnd();
}

function renderInvisibleSpanUpToPos(
    text: string,
    idx: number
) {
    imBeginSpan(); {
        imInit() && setAttributes({ style: "color: transparent" });

        const line = getLineBeforePos(text, idx);
        setInnerText(
            text.substring(0, idx + 1) + "\n" + " ".repeat(line.length)
        );
    } imEnd();
}

function renderDiagnosticInfoOverlay(
    state: GlobalState,
    textAreaRef: Ref<HTMLTextAreaElement>,
    errors: DiagnosticInfo[],
    color: string
) {
    imBeginList();
    for (const e of errors) {
        nextListRoot();
        imBeginLayout(PREWRAP | ABSOLUTE | W100 | H100 | CODE | TRANSPARENT); {
            if (imInit()) {
                setClass(cn.pointerEventsNone);
                setStyle("left", "0px");
                setStyle("top", "0px");
            }

            renderInvisibleSpanUpToPos(state.text, e.pos.i);

            imBeginSpan(); {
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
            } imEnd();
        } imEnd();
    } imEndList();
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

    beginScrollContainer(H100 | CODE | COL); {
        if (imInit()) {
            setInset("10px");
            setClass(cnApp.bgFocus);
        }

        // NOTE: WE are no longer going to bother wrestling with this hting, we will just make our own using divs and spans, as god intended.
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

            let hasErrors = false;

            // error overlays
            imBeginList();
            const errors = lastInterpreterResult?.errors;
            if (nextListRoot() && errors && errors.length > 0) {
                hasErrors = true;
                renderDiagnosticInfoOverlay(state, textAreaRef, errors, "red");
            }
            // warning overlays
            const warnings = lastParseResult?.warnings;
            if (nextListRoot() && warnings && warnings.length > 0) {
                hasErrors = true;
                renderDiagnosticInfoOverlay(state, textAreaRef, warnings, "orange");
            };
            imEndList();

            // autocomplete
            // right now you can't interact with it - it is more so that I actually remember all the crap I've put into here
            {
                assert(textAreaRef.val);
                const pos = textAreaRef.val.selectionStart;
                const lastIdentifier = parseIdentifierBackwardsFromPoint(
                    state.text,
                    pos - 1
                );

                const results = imStateInline<BuiltinFunction[]>(() => []);
                if (imBeginMemoComputation().val(lastIdentifier).changed()) {
                    results.length = 0;
                    if (lastIdentifier.length > 0) {
                        const funcs = getBuiltinFunctionsMap();
                        for (const [k, v] of funcs) {
                            if (!filterString(k, lastIdentifier)) {
                                continue;
                            }
                            results.push(v);
                        }
                    }
                } endMemo();

                imBeginList();
                if (nextListRoot() && results.length > 0) {
                    // TODO: when we do the AST editor, this will completely change, or be ripped out.

                    imBeginLayout(PREWRAP | ABSOLUTE | CODE | TRANSPARENT); {
                        if (imInit()) {
                            setClass(cn.pointerEventsNone);
                        }

                        if (imInit()) {
                            setStyleFlags(RELATIVE);
                        }

                        // this thing is going to have 0x0 dimensions, so it could have also been rect.bottom here.
                        // also, top -> bottom coordinate system.
                        const r = getCurrentRoot();
                        const rect = r.root.getBoundingClientRect();
                        const isAboveCenter = rect.top < window.innerHeight / 2;

                        setStyle("width", "fit-content");
                        setStyle("left", "0px");
                        setStyle("right", "0px");
                        setStyle("top", isAboveCenter ? "0px" : "");
                        setStyle("bottom", !isAboveCenter ? "0em" : "");
                        setStyle("border", "1px solid black");

                        imBeginList();
                        let i = 0;
                        for (const v of results) {
                            i++;
                            if (i > 5) {
                                break;
                            }
                            nextListRoot();

                            imBeginLayout(CODE); {
                                setStyle("border", "1px solid black");
                                textSpan(v.name);
                                textSpan("(");
                                imBeginList();
                                for (let i = 0; i < v.args.length; i++) {
                                    const arg = v.args[i];
                                    nextListRoot();
                                    textSpan(arg.name);

                                    imBeginList();
                                    if (nextListRoot() && arg.optional) {
                                        textSpan("?");
                                    }
                                    imEndList();

                                    textSpan(":");

                                    let type;
                                    if (arg.type.length === 0) {
                                        type = "any"
                                    } else {
                                        type = arg.type.map(programResultTypeStringFromType)
                                            .join("|");
                                    }
                                    textSpan(type);

                                    imBeginList();
                                    if (nextListRoot() && i < v.args.length - 1) {
                                        textSpan(", ");
                                    }
                                    imEndList();
                                }
                                imEndList();
                                textSpan(")");
                            } imEnd();
                        }
                        imEndList();
                    } imEnd();
                }
            }
            imEndList();
        } imEnd();
    } imEnd();
}

function filterString(text: string, query: string) {
    return text.includes(query);
}

function renderDebugger(ctx: GlobalContext, interpretResult: ProgramInterpretResult) {
    imBeginLayout(COL | GAP); {
        if (imInit()) {
            setClass(cn.h100);
            setClass(cn.overflowYAuto);
            setClass(cn.borderBox);
            setStyle("padding", "10px");
        }

        const message = imRef<string>();

        imBeginLayout(ROW | GAP); {
            imBeginLayout(FLEX); {
                beginButton(); {
                    textSpan("Stop debugging");
                    if (elementWasClicked()) {
                        ctx.isDebugging = false;
                    }
                } imEnd();
            } imEnd();

            imBeginLayout(FLEX); {
                beginButton(); {
                    textSpan("Step");

                    if (elementWasClicked()) {
                        const result = stepProgram(interpretResult);
                        if (!result) {
                            message.val = "Program complete! you can stop debugging now.";
                        }
                    }
                } imEnd();
            } imEnd();

            imBeginLayout(FLEX); {
                beginButton(); {
                    textSpan("Reset");
                    if (elementWasClicked()) {
                        assert(ctx.lastParseResult);
                        ctx.reinterpretSignal = true;
                        message.val = "";
                    }
                } imEnd();
            } imEnd();
        } imEnd();

        imBeginList();
        if (nextListRoot() && message.val) {
            imBeginDiv(); {
                textSpan(message.val);
            } imEnd();
        } imEndList();

        assert(interpretResult);
        const cs = getCurrentCallstack(interpretResult);

        imBeginLayout(COL | FLEX); {
            imBeginLayout(COL | FLEX); {
                imBeginList();
                if (nextListRoot() && cs) {
                    const fnName = imFunctionName(cs.fn);
                    imBeginLayout(H3 | BOLD); {
                        textSpan(fnName);
                    } imEnd();

                    renderFunctionInstructions(interpretResult, cs.code);
                } imEndList()
            } imEnd();
            imBeginLayout(ROW | FLEX); {
                imBeginLayout(COL | FLEX); {
                    imBeginEl(newH3); {
                        textSpan("Stack");
                    } imEnd();

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

                        imBeginList();
                        for (let addr = 0; addr <= n; addr++) {
                            const res = interpretResult.stack[addr];

                            nextListRoot();

                            imBeginDiv(); {
                                imBeginLayout(ROW | GAP); {
                                    const stackAddrArrow = (name: string) => {
                                        imBeginDiv(); {
                                            imInit() && setAttributes({
                                                style: "padding-left: 10px; padding-right: 10px"
                                            });

                                            textSpan(name + "->", CODE);
                                        } imEnd();
                                    }

                                    imBeginList();
                                    if (nextListRoot() && addr === interpretResult.stackIdx) {
                                        stackAddrArrow("");
                                    }
                                    imEndList();

                                    // every callstack will have a different return address
                                    let callstackIdx = -1;
                                    for (let i = 0; i < interpretResult.callStack.length; i++) {
                                        const cs = interpretResult.callStack[i];
                                        if (cs.returnAddress === addr) {
                                            callstackIdx = i;
                                        }
                                    }

                                    imBeginList();
                                    if (nextListRoot() && callstackIdx !== -1) {
                                        stackAddrArrow("r" + callstackIdx + "");
                                    };
                                    imEndList();

                                    // every callstack will have a different next-variable address
                                    callstackIdx = -1;
                                    for (let i = 0; i < interpretResult.callStack.length; i++) {
                                        const cs = interpretResult.callStack[i];
                                        if (cs.nextVarAddress === addr) {
                                            callstackIdx = i;
                                        }
                                    }

                                    imBeginList();
                                    if (nextListRoot() && callstackIdx !== -1) {
                                        stackAddrArrow("v" + callstackIdx + "");
                                    };
                                    imEndList();

                                    const variable = variablesReverseMap.get(addr);
                                    imBeginList();
                                    if (nextListRoot() && variable) {
                                        imBeginDiv(); {
                                            textSpan(variable + " = ", CODE);
                                        } imEnd();
                                    }
                                    imEndList();

                                    imBeginLayout(FLEX); {
                                        imBeginList();
                                        if (nextListRoot() && res) {
                                            renderProgramResult(res);
                                        } else {
                                            nextListRoot();
                                            textSpan("null");
                                        }
                                        imEndList();
                                    } imEnd();
                                } imEnd();
                            } imEnd();
                        } imEndList();
                    }
                } imEnd();
                imBeginLayout(FLEX | COL); {
                    imBeginEl(newH3); {
                        textSpan("Results");
                    } imEnd();

                    renderProgramOutputs(ctx, interpretResult);
                } imEnd();
            } imEnd();
        } imEnd();
    } imEnd();
}

function newCanvasElement() {
    return document.createElement("canvas");
}

function verticalBar() {
    imBeginDiv(); {
        imInit() && setAttributes({
            style: `width: 5px; background-color: ${cssVars.fg};`
        });
    } imEnd();
}

function newSliderState() {
    return {
        value: 0,
        start: 0,
        end: 1,
        step: 0 as number | null,
        t: 0,
    };
}

function renderSliderBody(
    sliderStart: number,
    sliderEnd: number,
    step: number | null,
    value: number = sliderStart,
) {
    const s = imState(newSliderState);

    // slider body
    imBeginLayout(FLEX | RELATIVE); {
        const { rect } = imTrackSize();

        if (imInit()) {
            setStyle("backgroundColor", cssVars.bg2);
            setStyle("borderRadius", "1000px");
            setStyle("cursor", "ew-resize");
            setStyle("userSelect", "none");
        }

        s.start = sliderStart;
        s.end = sliderEnd;
        if (s.end < s.start) {
            [s.start, s.end] = [s.end, s.start];
        }
        s.step = step;

        if (imBeginMemoComputation().val(value).changed()) {
            s.value = value;
        } endMemo();

        s.value = clamp(s.value, s.start, s.end);

        const sliderHandleSize = rect.height;

        // little dots for every step
        imBeginList(); {
            if (s.step) {
                const width = s.end - s.start;
                const count = Math.floor(width / s.step);
                if (count < 50) {
                    for (let i = 0; i < count - 1; i++) {
                        let t = (i + 1) / count;
                        const sliderPos = lerp(0, rect.width - sliderHandleSize, t);

                        nextListRoot();

                        imBeginLayout(ABSOLUTE); {
                            if (imInit()) {
                                setStyle("aspectRatio", "1 / 1");
                                setStyle("height", "100%");
                                setStyle("backgroundColor", cssVars.mg);
                                setStyle("transformOrigin", "center");
                                setStyle("transform", "scale(0.4) rotate(45deg)");
                            }

                            setStyle("left", sliderPos + "px");
                        } imEnd();
                    }
                }
            }
        }
        imEndList();

        // slider handle
        imBeginLayout(ABSOLUTE); {
            if (imInit()) {
                setStyle("backgroundColor", cssVars.fg);
                setStyle("borderRadius", "1000px");
                setStyle("aspectRatio", "1 / 1");
                setStyle("height", "100%");

                setStyle("userSelect", "none");
                setStyle("cursor", "ew-resize");
            }

            if (imBeginMemoComputation().objectVals(s).changed()) {
                const t = inverseLerp(s.start, s.end, s.value);
                const sliderPos = lerp(0, rect.width - sliderHandleSize, t);
                setStyle("left", sliderPos + "px");
            } endMemo();

            deferClickEventToParent();
        } imEnd();

        const mouse = getMouse();
        if (mouse.leftMouseButton && elementWasLastClicked()) {
            const rect = getCurrentRoot().root.getBoundingClientRect();
            const x0 = rect.left + sliderHandleSize / 2;
            const x1 = rect.right - sliderHandleSize / 2;
            let t = inverseLerp(x0, x1, mouse.X);
            t = clamp(t, 0, 1);

            s.value = lerp(s.start, s.end, t);
            s.t = s.value;
            if (s.step && s.step > 0.0001) {
                s.value = Math.round(s.value / s.step) * s.step;
            }
            s.value = clamp(s.value, s.start, s.end);

        }

    } imEnd();

    return s;
}

function renderImageOutput(image: ProgramImageOutput) {
    beginMaximizeableContainer(image); {
        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
            imBeginLayout(ROW | GAP); {
                maximizeItemButton(image);
            } imEnd();

            imBeginLayout(FLEX | RELATIVE); {
                const { rect } = imTrackSize();

                imBeginList();
                if (nextListRoot() && (image.width !== 0)) {
                    const plotState = imState(newPlotState);

                    const [canvasRoot, ctx] = beginCanvasRenderingContext2D();
                    const canvas = canvasRoot.root; {
                        imPlotZoomingAndPanning(plotState, true, rect);

                        const { width, height } = rect;
                        const pixelSize = 10;

                        if (imBeginMemoComputation().val(image).changed()) {
                            const minX = 0,
                                minY = 0,
                                maxX = image.width * pixelSize,
                                maxY = image.height * pixelSize;

                            recomputePlotExtent(plotState, minX, maxX, minY, maxY);
                        } endMemo();

                        if (imBeginMemoComputation().val(image).objectVals(plotState).changed()) {
                            canvas.width = width;
                            canvas.height = width * 9 / 16;

                            for (let i = 0; i < image.width; i++) {
                                for (let j = 0; j < image.height; j++) {
                                    const x0 = i * pixelSize;
                                    const y0 = j * pixelSize;
                                    let color;
                                    if (image.rgb) {
                                        const idx = (j * image.width + i) * 3;
                                        assert(idx + 2 < image.pixels.length);

                                        const r = image.pixels[idx];
                                        const g = image.pixels[idx + 1];
                                        const b = image.pixels[idx + 2];

                                        color = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
                                    } else {
                                        const idx = (j * image.width + i);
                                        assert(idx < image.pixels.length);
                                        const v = image.pixels[idx];
                                        color = `rgb(${v * 255}, ${v * 255}, ${v * 255})`;
                                    }

                                    ctx.beginPath();
                                    {
                                        ctx.fillStyle = color;
                                        const x0Canvas = getCanvasElementX(plotState, x0);
                                        const y0Canvas = getCanvasElementY(plotState, y0);
                                        const size = getCanvasElementLength(plotState, pixelSize);
                                        drawRectSized(
                                            ctx,
                                            x0Canvas,
                                            y0Canvas,
                                            size,
                                            size
                                        );
                                        ctx.fill();
                                    }
                                    ctx.closePath();
                                }
                            }

                            drawBoundary(ctx, width, height);
                        } endMemo();
                    } imEnd();
                } else {
                    nextListRoot();
                    imBeginLayout(COL | ALIGN_CENTER | JUSTIFY_CENTER); {
                        textSpan("Value was empty");
                    } imEnd();
                }
                imEndList();

            } imEnd();
        } imEnd();
    } imEnd();
}

function imPlotZoomingAndPanning(
    plotState: PlotState,
    canZoom: boolean,
    size: SizeState,
) {
    if (imInit()) {
        setStyle("cursor", "move");
    }

    plotState.width = size.width;
    plotState.height = size.height;

    const mouse = getMouse();

    if (mouse.leftMouseButton && elementWasLastClicked()) {
        const dxPlot = getPlotLength(plotState, mouse.dX);
        const dyPlot = getPlotLength(plotState, mouse.dY);

        plotState.posX -= dxPlot;
        plotState.posY -= dyPlot;
    }

    const scrollBlocker = imPreventScrollEventPropagation();
    scrollBlocker.isBlocking = canZoom;

    if (canZoom) {
        if (mouse.scrollY !== 0) {
            // When we zoom in or out, we want the graph-point that the mouse is currently over
            // to remain the same.

            const rect = getCurrentRoot().root.getBoundingClientRect();

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

            plotState.posX += dX;
            plotState.posY += dY;
        }
    }
}

function renderGraph(graph: ProgramGraphOutput) {
    const plotState = imState(newPlotState);

    const s = imStateInline((): {
        nodeData: Map<string | number, {
            position: { x: number, y: number };
            adjacencies: (string | number)[];
        }>;
    } => {
        return {
            nodeData: new Map(),
        };
    });

    if (imBeginMemoComputation().val(graph).changed()) {
        let minX = Number.MAX_SAFE_INTEGER;
        let maxX = Number.MIN_SAFE_INTEGER;
        let minY = Number.MAX_SAFE_INTEGER;
        let maxY = Number.MIN_SAFE_INTEGER;

        for (const node of s.nodeData.values()) {
            const { x, y } = node.position;
            minX = Math.min(x, minX);
            maxX = Math.max(x, maxX);
            minY = Math.min(y, minY);
            maxY = Math.max(y, maxY);
        }

        recomputePlotExtent(plotState, minX, maxX, minY, maxY);
    } endMemo();

    imBeginLayout(FLEX | RELATIVE | H100).root; {
        const { rect } = imTrackSize();

        const { width, height } = rect;

        const [canvasRoot, ctx] = beginCanvasRenderingContext2D();
        const canvas = canvasRoot.root; {
            imPlotZoomingAndPanning(plotState, true, rect);

            if (imBeginMemoComputation().val(width).val(height).val(graph).objectVals(plotState).changed()) {
                canvas.width = width;
                canvas.height = height;

                ctx.clearRect(0, 0, width, height);

                for (const [key] of s.nodeData) {
                    if (!graph.graph.has(key)) {
                        s.nodeData.delete(key);
                    }
                }

                for (const [key, connections] of graph.graph) {
                    let node = s.nodeData.get(key);
                    if (!node) {
                        node = {
                            position: {
                                x: Math.random(),
                                y: Math.random(),
                            },
                            adjacencies: [],
                        };
                        s.nodeData.set(key, node);
                    }

                    node.adjacencies = [...connections];
                }

                const theme = getCurrentTheme();
                const CIRCLE_RADIUS = 0.01;
                const LINE_WIDTH = CIRCLE_RADIUS / 3;

                // draw edges
                ctx.strokeStyle = theme.mg.toString();
                ctx.lineWidth = getCanvasElementLength(plotState, LINE_WIDTH);
                for (const node of s.nodeData.values()) {
                    const x0Canvas = getCanvasElementX(plotState, node.position.x);
                    const y0Canvas = getCanvasElementY(plotState, node.position.y);

                    for (const key of node.adjacencies) {
                        const otherNode = s.nodeData.get(key);
                        if (!otherNode) continue;

                        const x1Canvas = getCanvasElementX(plotState, otherNode.position.x);
                        const y1Canvas = getCanvasElementY(plotState, otherNode.position.y);

                        ctx.beginPath(); {
                            ctx.moveTo(x0Canvas, y0Canvas);
                            ctx.lineTo(x1Canvas, y1Canvas);
                            ctx.stroke();
                        } ctx.closePath();
                    }
                }

                // draw nodes over the edges
                ctx.fillStyle = theme.fg.toString();
                for (const node of s.nodeData.values()) {
                    const xCanvas = getCanvasElementX(plotState, node.position.x);
                    const yCanvas = getCanvasElementY(plotState, node.position.y);
                    const rCanvas = getCanvasElementLength(plotState, CIRCLE_RADIUS);
                    drawCircle(ctx, xCanvas, yCanvas, rCanvas);
                    ctx.fill();
                }

                drawBoundary(ctx, width, height);
            } endMemo();
        } imEnd();
    } imEnd();
}

function renderProgramOutputs(ctx: GlobalContext, program: ProgramInterpretResult) {
    const outputs = program.outputs;

    // TODO: scroll container, also collapse repeated prints.
    imBeginLayout(COL | GAP); {
        imBeginList();
        for (const ui of outputs.uiInputs.values()) {
            nextListRoot();

            imBeginList();
            nextListRoot(ui.t);
            switch (ui.t) {
                case UI_INPUT_SLIDER: {
                    imBeginLayout(COL | GAP); {
                        imBeginLayout(ROW | GAP); {
                            imBeginLayout(); {
                                textSpan(ui.name);
                            } imEnd();

                            imBeginLayout(CODE); {
                                textSpan(ui.value + "");
                            } imEnd();
                        } imEnd();
                        imBeginLayout(ROW); {
                            if (imInit()) {
                                setStyle("height", "1em");
                            }
                            const s = renderSliderBody(ui.start, ui.end, ui.step);
                            if (imBeginMemoComputation().val(s.value).changed()) {
                                ui.value = s.value;
                                ctx.reinterpretSignal = true;
                            } endMemo();
                        } imEnd();
                    } imEnd();
                } break;
                default: {
                    throw new Error("Unhandled UI input type");
                }
            }
            imEndList();
        }
        imEndList();
    } imEnd();
    imBeginLayout(); {
        if (imInit()) {
            setStyle("height", "5px")
        }
    } imEnd();
    imBeginList();
    for (const result of outputs.prints) {
        nextListRoot();
        imBeginLayout(ROW | GAP); {
            verticalBar();

            imBeginLayout(COL | GAP); {
                beginCodeBlock(0); {
                    textSpan(
                        expressionToString(result.expr)
                    )
                } imEnd();

                imBeginLayout(FLEX); {
                    renderProgramResult(result.val);
                } imEnd();
            } imEnd();
        } imEnd();
    };
    imEndList();
    imBeginLayout(COL | GAP); {
        imBeginList();
        for (const [idx, graph] of outputs.graphs) {
            nextListRoot();
            imBeginLayout(COL | GAP); {
                textSpan("Graph #" + idx, H3);
            } imEnd();
            imBeginLayout(ROW | GAP); {
                verticalBar();

                imBeginLayout(COL | GAP | FLEX); {
                    beginCodeBlock(0); {
                        textSpan(
                            expressionToString(graph.expr)
                        )
                    } imEnd();

                    beginCodeBlock(0); {
                        textSpan(
                            JSON.stringify(Object.fromEntries(graph.graph)),
                        )
                    } imEnd();

                    beginMaximizeableContainer(graph); {
                        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
                            imBeginLayout(ROW | GAP); {
                                maximizeItemButton(graph);
                            } imEnd();

                            beginAspectRatio(16, 9); {
                                renderGraph(graph);
                            } imEnd();
                        } imEnd();
                    } imEnd();
                } imEnd();
            } imEnd();
        };
        imEndList();
    } imEnd();
    imBeginList();
    for (const image of outputs.images) {
        nextListRoot();
        imBeginLayout(ROW | GAP); {
            verticalBar();

            imBeginLayout(COL | GAP | FLEX); {
                beginCodeBlock(0); {
                    textSpan(
                        expressionToString(image.expr)
                    )
                } imEnd();

                renderImageOutput(image);
            } imEnd();
        } imEnd();
    };
    imEndList();
    imBeginList();
    if (nextListRoot() && outputs.plots.size > 0) {
        imBeginList();
        for (const [idx, plot] of outputs.plots) {
            nextListRoot();
            imBeginLayout(COL | GAP); {
                imBeginLayout(COL | GAP); {
                    textSpan("Plot #" + idx, H3);
                } imEnd();

                const exprFrequencies = imStateInline(() => new Map<ProgramExpression, number>());

                if (!imBeginMemoComputation().val(outputs).changed()) {
                    exprFrequencies.clear();
                    for (const line of plot.lines) {
                        const count = exprFrequencies.get(line.expr) ?? 0;
                        exprFrequencies.set(line.expr, count + 1);
                    }
                } endMemo();

                imBeginList();
                for (const [expr, count] of exprFrequencies) {
                    nextListRoot();
                    imBeginLayout(ROW | GAP); {
                        textSpan(count + "x: ");
                        textSpan(expressionToString(expr), CODE);
                    } imEnd();
                }
                imEndList();

                beginAspectRatio(16, 9).root; {
                    renderPlot(plot, program);
                } imEnd();
            } imEnd();
        }
        imEndList();
    } else {
        nextListRoot();
        textSpan("No results yet");
    }
    imEndList();
}

let currentMaximizedItem: object | null = null;

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

function recomputePlotExtent(
    state: PlotState,
    minX: number, maxX: number,
    minY: number, maxY: number,
) {
    if (minX === Number.MAX_SAFE_INTEGER || minX === maxX) {
        state.zoom = 1;
        state.originalExtent = 1;
        state.posX = 0;
        state.posY = 0;
    } else {
        let maxDist = Math.max(maxX - minX, maxY - minY);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        state.zoom = 1;
        state.originalExtent = maxDist;
        state.posX = centerX;
        state.posY = centerY;
    }
}

function getExtent(plot: PlotState): number {
    const { originalExtent, zoom } = plot;
    return originalExtent / zoom;
}

function getDim(plot: PlotState): number {
    const { width, height } = plot;
    return max(width, height);
}

function getOtherDim(plot: PlotState): number {
    const { width, height } = plot;
    return min(width, height);
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

    const dim = getDim(plot);
    const other = getOtherDim(plot);
    const diff = dim - other;

    return inverseLerp(y0Extent, y1Extent, y) * dim - (diff / 2);
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

function getCanvasElementLength(plot: PlotState, l: number): number {
    return getCanvasElementX(plot, l) - getCanvasElementX(plot, 0);
}

function getPlotY(plot: PlotState, y: number): number {
    const { posY } = plot;
    const extent = getExtent(plot);
    const y0Extent = posY - extent;
    const y1Extent = posY + extent;

    const dim = getDim(plot);
    const other = getOtherDim(plot);
    const diff = dim - other;


    // NOTE: needs to be an exact inverse of getCanvasElementY
    // for zooming in and out to work properly
    return lerp(y0Extent, y1Extent, ((y + (diff / 2)) / getDim(plot)));
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

function beginCanvasRenderingContext2D() {
    const canvasRoot = imBeginEl(newCanvasElement);
    const canvas = canvasRoot.root;
    let ctx = imVal<[UIRoot<HTMLCanvasElement>, CanvasRenderingContext2D] | null>(null);
    if (!ctx) {
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 2d isn't supported by your browser!!! I'd suggest _not_ plotting anything. Or updaing your browser");
        }
        ctx = imSetVal([canvasRoot, context]);
    }

    return ctx;
}

function drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number
) {
    ctx.beginPath();
    {
        ctx.arc(x, y, r, 0, 2 * Math.PI);
    }
    ctx.closePath();
}

function drawRectSized(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number,
    w: number, h: number,
) {
    ctx.rect(x0, y0, w, h);
}

function drawRect(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number,
    x1: number, y1: number
) {
    ctx.rect(
        x0, y0,
        x1 - x0, y1 - y0
    );
}

// normally done at the end, so that it doesn't get drown over
function drawBoundary(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const theme = getCurrentTheme();
    ctx.strokeStyle = theme.fg.toString();

    const offset = 1
    ctx.lineWidth = 2;
    ctx.beginPath();
    {
        drawRect(
            ctx,
            offset, offset,
            width - offset, height - offset
        );
        ctx.stroke();
    }
    ctx.closePath();
}

function beginMaximizeableContainer(item: object) {
    const isMaximized = item === currentMaximizedItem;

    let rootLayoutFlags = GAP | W100 | H100 | COL;
    if (isMaximized) {
        rootLayoutFlags = rootLayoutFlags | FIXED | TRANSLUCENT;
    }

    imBeginLayout(rootLayoutFlags).root; {
        if (imBeginMemoComputation().val(isMaximized).changed()) {
            if (isMaximized) {
                setInset("10px");
            } else {
                setInset("");
            }
        } endMemo();
    }

}

function maximizeItemButton(item: object) {
    const isMaximized = currentMaximizedItem === item;

    beginButton(isMaximized); {
        textSpan(isMaximized ? "minimize" : "maximize");

        const keys = getKeys();

        if (isMaximized) {
            if (
                keys.escPressed ||
                (elementWasClicked())
            ) {
                currentMaximizedItem = null;
            }
        } else {
            if (elementWasClicked()) {
                currentMaximizedItem = item;
            }
        }
    } imEnd();
}

function renderPlot(plot: ProgramPlotOutput, program: ProgramInterpretResult) {
    const isMaximized = plot === currentMaximizedItem;
    beginMaximizeableContainer(plot); {
        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
            imBeginLayout(ROW | GAP); {
                maximizeItemButton(plot);
            } imEnd();

            imBeginLayout(FLEX | RELATIVE).root; {
                const { rect } = imTrackSize();

                const shiftScrollToZoomVal = imRef<number>();

                const problems = imRef<string[]>();
                if (!problems.val) {
                    problems.val = [];
                }

                const [canvasRoot, ctx] = beginCanvasRenderingContext2D();
                const canvas = canvasRoot.root; {
                    const mouse = getMouse();
                    const canZoom = elementWasHovered() && (isShiftPressed() || isMaximized);

                    if (elementWasHovered() && (mouse.scrollY !== 0 && !canZoom)) {
                        shiftScrollToZoomVal.val = 1;
                    }

                    // init canvas 
                    const plotState = imState(newPlotState);
                    plotState.maximized = isMaximized;

                    imPlotZoomingAndPanning(plotState, canZoom, rect);

                    const { width, height } = rect;
                    if (imBeginMemoComputation().val(program.parseResult.text).val(width).val(height).changed()) {
                        plotState.width = rect.width;
                        plotState.height = rect.height;
                        canvas.width = width;
                        canvas.height = height;

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

                        recomputePlotExtent(plotState, minX, maxX, minY, maxY);
                    } endMemo();



                    const rows = imRef<number[][]>();
                    if (!rows.val) {
                        rows.val = [];
                    }

                    if (imBeginMemoComputation().val(plot).objectVals(plotState).changed()) {
                        problems.val.length = 0;

                        const { width, height } = plotState;

                        ctx.clearRect(0, 0, width, height);

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

                        drawBoundary(ctx, width, height);
                    } endMemo();
                } imEnd();

                if (shiftScrollToZoomVal.val !== null) {
                    const dt = deltaTimeSeconds();
                    shiftScrollToZoomVal.val -= dt;
                    if (shiftScrollToZoomVal.val < 0) {
                        shiftScrollToZoomVal.val = null;
                    }
                }

                imBeginList();
                if (nextListRoot() && shiftScrollToZoomVal.val !== 0) {
                    beginAbsoluteLayout(0, 5, NONE, NONE, 5); {
                        setStyle("opacity", shiftScrollToZoomVal.val + "");
                        textSpan("Shift + scroll to zoom");
                    } imEnd();
                } imEndList();

                imBeginList();
                for (const prob of problems.val) {
                    nextListRoot();
                    imBeginLayout(); {
                        textSpan("Problem: " + prob);
                    } imEnd();
                }
                imEndList();
            } imEnd();
        } imEnd();
    } imEnd();
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
        name: "Plotting",
        code:
            `
// Multiple sine waves, each sine wave is made of multiple segments with gradually increasing colour

n = 10

for size in range(1, 6) {
    period = 0.1
    pos = 0

    for i in range(0, n) {
        sine_wave = list[]
        for j in range(pos, pos + 3 / period) {
            push(
                sine_wave, 
                [j, size * 10 * sin(j * period) + i]
            )
        }
        pos = pos + 3

        col = [i/n, 0, 0]

        // try changing this 1 to i
        plot_lines(1, sine_wave, col)
    }
}
`
    },
    {
        name: "Signed distance fields",
        code: `
// Try increasing this, if your PC allows for it 
set_heatmap_subdiv(40)

heatmap(1, sdf(a, b) { 
    radius = 0.2
    thickness = 0.03
    sqrt(a*a + b*b) 
    (radius - thickness) < ^ && ^ < (radius + thickness)
}, [0.5, 0, 0])

heatmap(1, sdf2(a, b) { 
    radius = 0.3
    thickness = 0.03
    sqrt(a*a + b*b) 
    (radius - thickness) < ^ && ^ < (radius + thickness)
}, "#F00")

plot_points(1, 0.5 * [
    [0, 0],
    [1, 0], 
    [-1, 0],
    [0, 1],
    [0, -1],
])
`

    },
    {
        name: "Slider inputs",
        code: `
period = slider("period", 0, 100)
resolution = slider("resolution", 1, 100)

lines = list[]

one_over_res = 1 / resolution
for i in range(0, 100, one_over_res) {
    push(lines, [i, sin(i * period)])
}

plot_lines(1, lines)
        `
    },
    {
        name: "Images",
        code: `
seed = slider("seed", 0, 1000)

// rand_seed(now())
rand_seed(seed)

image([
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
])

`
    },
    {
        name: "Graphs",
        code: `
g = map{}

for i in range(0, 10) {
    adj = list[]
    for j in range(0, 10) {
        push(adj, j)
    }

    g[i] = adj
}

graph(1, g)
`
    },
    {
        name: "Matrices",
        code: `

angle = slider("angle", 0, 2 * PI)

rot_matrix(a) {
    [[cos(a), -sin(a)],
     [sin(a), cos(a)]]
}

A = rot_matrix(angle)

plot_points(1, [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],

    mul(A, [0, 0.5]),
])

`
    },
    {
        name: "3D stuff",
        code: `
xAngle = slider("x", 0, 2 * PI)
yAngle = slider("y", 0, 2 * PI)
zAngle = slider("z", 0, 2 * PI)

X = rot3d_x(xAngle)
Y = rot3d_y(yAngle) // rot3d_y is probably wrong lmao
Z = rot3d_z(zAngle) // rot3d_z is probably wrong too lmao

T = mul(Z, mul(Y, mul(Z, X)))

point_cloud = list[]
for i in range(0, 100) {
    vec = [rand(), rand(), rand(), 1] -0.5
    vec[3]=1
    push(point_cloud, vec)
}
point_cloud = to_vec(point_cloud)

mul(point_cloud, T)
plot_points(1, ^)

x_axis = [[0, 0, 0, 0], [1, 0, 0, 1]]
mul(^, T)
plot_lines(1, ^, [1, 0, 0])

y_axis = [[0, 0, 0, 0], [0, 1, 0, 1]]
mul(^, T)
plot_lines(1, ^, [0, 1, 0])

z_axis = [[0, 0, 0, 0], [0, 0, 1, 1]]
mul(^, T)
plot_lines(1, ^, [0, 0, 1])

        `
    }
]

export function renderApp() {
    const error = imRef<any>();

    imBeginDiv(); {
        imInit() && setAttributes({
            class: [cn.fixed, cnApp.normalFont, cn.absoluteFill]
        });

        const l = imBeginList();
        try {
            if (!error.val) {
                nextListRoot(1);

                const ctx = imState(newGlobalContext);

                const { state } = ctx;

                if (imBeginMemoComputation()
                    .val(state.text)
                    .val(state.autorun)
                    .changed() ||
                    (ctx.reinterpretSignal && !ctx.isDebugging)
                ) {
                    ctx.reinterpretSignal = false;

                    const text = state.text;
                    ctx.lastParseResult = parse(text);
                    if (state.autorun) {
                        ctx.lastInterpreterResult = interpret(ctx.lastParseResult, ctx.lastInterpreterResult);
                    }

                    saveStateDebounced(ctx);
                } endMemo();

                imBeginLayout(ROW | H100); {
                    imBeginLayout(FLEX); {
                        renderAppCodeEditor(ctx);
                    } imEnd();
                    imBeginLayout(FLEX); {
                        imBeginList();
                        if (nextListRoot() && ctx.isDebugging) {
                            const interpretResult = ctx.lastInterpreterResult;
                            assert(interpretResult);
                            renderDebugger(ctx, interpretResult);
                        } else {
                            nextListRoot();
                            renderAppCodeOutput(ctx);
                        }
                        imEndList();
                    } imEnd();
                } imEnd();

                imBeginDiv(); {
                    imInit() && setAttributes({
                        style: "right: 10px; bottom: 10px",
                        class: [cn.absolute],
                    });

                    setInnerText(saveTimeout ? "Saving..." : "Saved");
                } imEnd();
            } else {
                nextListRoot(2);

                imBeginDiv(); {
                    textSpan("An error occured: " + error.val.message);
                } imEnd();
            }
        } catch (e) {
            abortListAndRewindUiStack(l);
            console.error(e);
            error.val = e;
        }
        imEndList();
    } imEnd();

}
