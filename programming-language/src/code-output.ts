import { CODE_EXAMPLES } from './examples';
import {
    ALIGN_CENTER,
    imBeginCodeBlock,
    imBeginHeading,
    BOLD,
    CODE,
    COL,
    FIXED,
    FLEX,
    GAP,
    H100,
    H3,
    imBeginAbsoluteLayout,
    imBeginAspectRatio,
    imBeginButton,
    imBeginLayout,
    imBeginScrollContainer,
    imTextSpan,
    imVerticalBar,
    JUSTIFY_CENTER,
    newH3,
    NONE,
    OPAQUE,
    PRE,
    RELATIVE,
    ROW,
    setInset,
    TRANSLUCENT,
    W100,
} from './layout';
import { evaluateFunctionWithinProgramWithArgs, ExecutionSteps, executionStepToString, getCurrentCallstack, newNumberResult, ProgramExecutionStep, ProgramGraphOutput, ProgramImageOutput, ProgramInterpretResult, ProgramOutputs, ProgramPlotOutput, ProgramPrintOutput, ProgramResult, ProgramResultFunction, ProgramResultNumber, programResultTypeString, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MAP, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING } from './program-interpreter';
import {
    binOpToString,
    binOpToOpString as binOpToSymbolString,
    DiagnosticInfo,
    expressionToString,
    expressionTypeToString,
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
} from './program-parser';
import { GlobalContext, rerun, startDebugging } from './state';
import "./styling";
import { cssVars, getCurrentTheme } from './styling';
import { assert } from './utils/assert';
import { deltaTimeSeconds, disableIm, elementHasMousePress, elementHasMouseDown, elementHasMouseHover, enableIm, getCurrentRoot, getImMouse, imArray, imBeginDiv, imBeginEl, imBeginList, imEnd, imEndList, imInit, imMemo, imMemoObjectVals, imPreventScrollEventPropagation, imRef, imState, imStateInline, imTrackSize, nextListSlot, scrollIntoViewVH, setInnerText, setStyle, UIRoot } from './utils/im-dom-utils';
import { clamp, gridSnap, inverseLerp, lerp, max, min } from './utils/math-utils';
import { getSliceValue } from './utils/matrix-math';

export function renderAppCodeOutput(ctx: GlobalContext) {
    imBeginLayout(ROW | GAP); {
        imBeginButton(ctx.state.autoRun); {
            imTextSpan("Autorun");

            if (elementHasMousePress()) {
                ctx.state.autoRun = !ctx.state.autoRun
                if (ctx.state.autoRun) {
                    rerun(ctx);
                }
            }
        } imEnd();

        imBeginButton(); {
            imTextSpan("Start debugging");
            if (elementHasMousePress()) {
                startDebugging(ctx);
            }
        } imEnd();

        imBeginButton(ctx.state.showParserOutput); {
            imTextSpan("Show AST");
            if (elementHasMousePress()) {
                ctx.state.showParserOutput = !ctx.state.showParserOutput;
            }
        } imEnd();


        imBeginButton(ctx.state.showInterpreterOutput); {
            imTextSpan("Show instructions");
            if (elementHasMousePress()) {
                ctx.state.showInterpreterOutput = !ctx.state.showInterpreterOutput;
            }
        } imEnd();
    } imEnd();

    const scrollContainer = imBeginScrollContainer(FLEX); {
        const parseResult = ctx.lastParseResult;

        imBeginList();
        if (nextListSlot() && ctx.state.showParserOutput) {
            imParserOutputs(parseResult);
        }
        imEndList();

        const message = imRef<string>();

        // TODO: better UI for this message
        imBeginDiv(); {
            imTextSpan(message.val ?? "");
        } imEnd();

        imBeginList();
        if (nextListSlot() && ctx.state.showInterpreterOutput) {
            imBeginList();
            if (nextListSlot() && ctx.lastInterpreterResult) {
                const interpretResult = ctx.lastInterpreterResult;

                imBeginDiv(); {
                    imDiagnosticInfo("Interpreting errors", interpretResult.errors, "No interpreting errors");

                    imBeginEl(newH3); {
                        imTextSpan("Instructions");
                    } imEnd();

                    imBeginList(); {
                        nextListSlot();

                        imBeginLayout(ROW | GAP); {
                            imTextSpan(interpretResult.entryPoint.name, H3 | BOLD);

                            imBeginButton(); {
                                imTextSpan("Start debugging");
                                if (elementHasMousePress()) {
                                    startDebugging(ctx);
                                }
                            } imEnd();
                        } imEnd();

                        renderFunctionInstructions(interpretResult, interpretResult.entryPoint);

                        for (const [, fn] of interpretResult.functions) {
                            nextListSlot();

                            imBeginLayout(ROW | GAP); {
                                const fnName = imFunctionName(fn);
                                imTextSpan(fnName, H3 | BOLD);

                                imBeginButton(); {
                                    imTextSpan("Start debugging");
                                } imEnd();
                            } imEnd();

                            renderFunctionInstructions(interpretResult, fn.code);
                        }
                    } imEndList();

                } imEnd();
            } else {
                nextListSlot();
                imBeginLayout(); {
                    imTextSpan("No instructions generated yet");
                } imEnd();
            } imEndList();
        } imEndList();

        imBeginHeading(); {
            imTextSpan("Code output");
        } imEnd();

        imBeginLayout(ROW); {
            imBeginButton(ctx.state.showGroupedOutput); {
                imTextSpan("Grouped");

                if (elementHasMousePress()) {
                    ctx.state.showGroupedOutput = !ctx.state.showGroupedOutput;
                }
            } imEnd();
        } imEnd();

        imBeginList();
        if (nextListSlot() && ctx.lastInterpreterResult) {
            imProgramOutputs(
                ctx, 
                ctx.lastInterpreterResult, 
                ctx.lastInterpreterResult.outputs,
                scrollContainer.root
            );
        } else {
            nextListSlot();
            imBeginLayout(); {
                imTextSpan("Program hasn't been run yet");
            } imEnd();
        }
        imEndList();

        imBeginList();
        if (nextListSlot() && ctx.state.text === "") {
            // NOTE: might not be the best workflow. i.e maybe we want to be able to see the examples while we're writing things.

            imBeginHeading(); {
                imTextSpan("Examples")
            } imEnd();

            imBeginLayout(COL | GAP); {
                imBeginList();
                for (const eg of CODE_EXAMPLES) {
                    nextListSlot();
                    imBeginButton(); {
                        imTextSpan(eg.name);

                        if (elementHasMousePress()) {
                            ctx.state.text = eg.code.trim();
                            ctx.lastLoaded = Date.now();
                        }
                    } imEnd();
                }
                imEndList();
            } imEnd();
        }
        imEndList();
    } imEnd();
}


function imParserOutputs(parseResult: ProgramParseResult | undefined) {
    imBeginList();
    if (nextListSlot() && parseResult) {
        const statements = parseResult.statements;

        imBeginList();
        if (nextListSlot() && statements.length > 0) {

            function renderRow(title: string, type: string, depth: number, code?: string) {
                nextListSlot();
                imBeginDiv(); {
                    setStyle("paddingLeft", (depth * 20) + "px");

                    imTextSpan(title);
                    imTextSpan(" = ");
                    imTextSpan(type);
                    imBeginList();
                    if (code) {
                        nextListSlot();

                        imTextSpan(" ");
                        imTextSpan(code, CODE);
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
                        renderRow(title, typeString, depth, expressionToString(parseResult.text, expr));
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
                        const lhsText = expressionToString(parseResult.text, expr.lhs);
                        const rhsText = expr.rhs ? expressionToString(parseResult.text, expr.rhs) : INCOMPLETE;
                        const opSymbol = binOpToSymbolString(expr.op);
                        const text = `(${lhsText}) ${opSymbol} (${rhsText})`;
                        renderRow(title, binOpToString(expr.op), depth, text);

                        dfs("lhs", expr.lhs, depth + 1);
                        dfs("rhs", expr.rhs, depth + 1);
                    } break;
                    case T_UNARY_OP: {
                        const exprText = expressionToString(parseResult.text, expr.expr);
                        const opSymbol = unaryOpToOpString(expr.op);
                        const text = `${opSymbol}(${exprText})`;
                        renderRow(title, unaryOpToString(expr.op), depth, text);
                        dfs("expr", expr.expr, depth + 1);
                    } break;
                    case T_MAP_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(parseResult.text, expr));

                        for (let i = 0; i < expr.kvPairs.length; i++) {
                            dfs("key[" + i + "]", expr.kvPairs[i][0], depth + 1);
                            dfs("val[" + i + "]", expr.kvPairs[i][1], depth + 1);
                        }
                    } break;
                    case T_LIST_LITERAL:
                    case T_VECTOR_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(parseResult.text, expr));

                        for (let i = 0; i < expr.items.length; i++) {
                            dfs("[" + i + "]", expr.items[i], depth + 1);
                        }
                    } break;
                    case T_NUMBER_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(parseResult.text, expr));
                    } break;
                    case T_STRING_LITERAL: {
                        renderRow(title, typeString, depth, expressionToString(parseResult.text, expr));
                    } break;
                    case T_TERNARY_IF: {
                        const queryText = expressionToString(parseResult.text, expr.query);
                        const trueText = expressionToString(parseResult.text, expr.trueBranch);
                        const falseText = expr.falseBranch ? expressionToString(parseResult.text, expr.falseBranch) : "";
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
            nextListSlot();
            imTextSpan("Nothing parsed yet");
        }
        imEndList();

        imDiagnosticInfo("Errors", parseResult.errors, "No parsing errors!");
        imDiagnosticInfo("Warnings", parseResult.warnings, "No parsing warnings");
    } else {
        nextListSlot();
        imTextSpan("No parse results yet");
    } imEndList();
}

// TODO: display these above the code editor itself. 
function imDiagnosticInfo(heading: string, info: DiagnosticInfo[], emptyText: string) {
    imBeginList();
    if (nextListSlot() && heading) {
        imBeginHeading(); {
            imTextSpan(heading);
        } imEnd();
    } imEndList();

    imBeginList();
    for (const e of info) {
        nextListSlot();
        imBeginDiv(); {
            imTextSpan("Line " + e.pos.line + " Col " + (e.pos.col) + " Tab " + (e.pos.tabs) + " - " + e.problem);
        } imEnd();
    }
    imEndList();

    imBeginList();
    if (nextListSlot() && info.length === 0) {
        imBeginDiv(); {
            imTextSpan(emptyText);
        } imEnd();
    }
    imEndList();
}




export function renderProgramResult(res: ProgramResult) {
    imBeginLayout(ROW | GAP); {
        imBeginList(); {
            nextListSlot(res.t);
            const typeString = programResultTypeString(res)
            imTextSpan(typeString + " ");

            switch (res.t) {
                case T_RESULT_NUMBER:
                    imTextSpan("" + res.val, CODE);
                    break;
                case T_RESULT_STRING:
                    imBeginLayout(COL | GAP); {
                        imTextSpan(res.val, CODE | PRE);
                    } imEnd();
                    break;
                case T_RESULT_LIST:
                    imBeginCodeBlock(0); {
                        imTextSpan("list[", CODE);
                        imBeginCodeBlock(1); {
                            imBeginList();
                            for (let i = 0; i < res.values.length; i++) {
                                nextListSlot();
                                renderProgramResult(res.values[i]);
                            }
                            imEndList();
                        } imEnd();
                        imTextSpan("]", CODE);
                    } imEnd();
                    break;
                case T_RESULT_MAP: {
                    imBeginCodeBlock(0); {
                        imTextSpan("map{", CODE);
                        imBeginCodeBlock(1); {
                            imBeginList();
                            for (const [k, val] of res.map) {
                                nextListSlot();
                                imTextSpan(k + "", CODE);
                                renderProgramResult(val);
                            }
                            imEndList();
                        } imEnd();
                        imTextSpan("}", CODE);
                    } imEnd();
                } break;
                case T_RESULT_MATRIX:
                    let idx = 0;
                    const dfs = (dim: number, isLast: boolean) => {
                        if (dim === res.val.shape.length) {
                            const val = getSliceValue(res.val.values, idx);

                            // assuming everything renders in order, this is the only thing we need to do for this to work.
                            idx++;

                            imTextSpan("" + val);

                            imBeginList();
                            if (nextListSlot() && !isLast) {
                                imTextSpan(", ");
                            }
                            imEndList();

                            return;
                        }

                        imBeginCodeBlock(dim === 0 ? 0 : 1); {
                            imTextSpan("[");
                            imBeginList(); {
                                const len = res.val.shape[dim];
                                for (let i = 0; i < len; i++) {
                                    // This is because when the 'level' of the list changes, the depth itself changes,
                                    // and the components we're rendering at a particular level will change. 
                                    // We need to re-key the list, so that we may render a different kind of component at this position.
                                    const key = (res.val.shape.length - dim) + "-" + i;
                                    nextListSlot(key);
                                    dfs(dim + 1, i === len - 1);
                                }
                            } imEndList();
                            imTextSpan("]");
                        } imEnd();
                    }
                    dfs(0, false);
                    break;
                case T_RESULT_RANGE:
                    imTextSpan("" + res.val.lo, CODE);
                    imTextSpan(" -> ", CODE);
                    imTextSpan("" + res.val.hi, CODE);
                    break;
                case T_RESULT_FN:
                    imTextSpan(res.expr.fnName.name, CODE);
                    break;
                default:
                    throw new Error("Unhandled result type: " + programResultTypeString(res));
            }
        } imEndList();
    } imEnd();
}

function renderExecutionStep(step: ProgramExecutionStep) {
    imTextSpan(executionStepToString(step));
}

export function renderFunctionInstructions(interpretResult: ProgramInterpretResult, { steps }: ExecutionSteps) {
    imBeginLayout(FLEX | COL); {
        const scrollContainer = imBeginScrollContainer(FLEX); {
            let rCurrent: UIRoot<HTMLElement> | undefined;

            imBeginCodeBlock(0); {
                imBeginList();
                if (nextListSlot() && steps.length > 0) {
                    imBeginList();
                    for (let i = 0; i < steps.length; i++) {
                        nextListSlot();

                        const step = steps[i];

                        const call = getCurrentCallstack(interpretResult);
                        const isCurrent = call?.code?.steps === steps
                            && i === call.i;

                        const currentStepDiv = imBeginDiv(); {
                            imTextSpan(i + " | ");

                            renderExecutionStep(step);

                            imBeginList();
                            if (nextListSlot() && isCurrent) {
                                imTextSpan(" <----");
                            }
                            imEndList();
                        } imEnd();

                        if (isCurrent) {
                            rCurrent = currentStepDiv;
                        }
                    }
                    imEndList();
                } else {
                    nextListSlot();
                    imBeginDiv(); {
                        imTextSpan("no instructions present");
                    } imEnd();
                }
                imEndList();
            } imEnd();

            if (rCurrent) {
                scrollIntoViewVH(scrollContainer.root, rCurrent.root, 0.5);
            }
        } imEnd();
    } imEnd();
}


export function imFunctionName(fn: ProgramResultFunction | null) {
    const sb = imArray<string>();

    const fnChanged = imMemo(fn);
    if (fnChanged) {
        sb.length = 0;
        if (!fn) {
            sb.push("Entry point");
        } else {
            sb.push(fn.code.name + "(");
            sb.push("(");
            for (let i = 0; i < fn.args.length; i++) {
                if (i > 0) sb.push(", ");
                sb.push(fn.args[i].name);
            }
            sb.push(")");
        }
    } 

    return sb.toString();
}




type ProgramOutputState = {
    outputToScrollTo: HTMLElement | undefined;
};
function newProgramOutputsState(): ProgramOutputState {
    return  { outputToScrollTo: undefined };
}

function canScrollToThing(ctx: GlobalContext, s: ProgramOutputState, expr: ProgramExpression) {
    return !s.outputToScrollTo &&
        expr.start.i <= ctx.textCursorIdx && ctx.textCursorIdx <= expr.end.i;
}

function imProgramPrintOutput(
    ctx: GlobalContext,
    program: ProgramInterpretResult, 
    s: ProgramOutputState,
    result: ProgramPrintOutput,
) {
    const programText = program.parseResult.text;
    const root = imBeginLayout(ROW | GAP); {
        if (canScrollToThing(ctx, s, result.expr)) {
            s.outputToScrollTo = root.root;
        }

        imVerticalBar();

        imBeginCodeBlock(0); {
            imTextSpan(
                expressionToString(programText, result.expr)
            )
        } imEnd();

        imBeginLayout(FLEX); {
            renderProgramResult(result.val);
        } imEnd();
    } imEnd();
}


export function imProgramOutputs(
    ctx: GlobalContext, 
    program: ProgramInterpretResult, 
    outputs: ProgramOutputs,
    scrollContainer?: HTMLElement,
) {
    const s = imState(newProgramOutputsState);
    s.outputToScrollTo = undefined;
    const programText = program.parseResult.text;

    imBeginLayout(); {
        if (imInit()) {
            setStyle("height", "5px")
        }
    } imEnd();
    imBeginLayout(COL | GAP); {
        imBeginList();
        if (nextListSlot() && ctx.state.showGroupedOutput) {
            imBeginList();
            for (const [step, prints] of outputs.printsGroupedByStep) {
                nextListSlot();

                const localState = imStateInline(() => {
                    return { open: false };
                });

                imBeginLayout(COL | FLEX); {
                    imBeginLayout(ROW | FLEX); {
                        imBeginLayout(CODE); {
                            imTextSpan(expressionToString(programText, step.expr));
                        } imEnd();

                        imBeginLayout(FLEX); imEnd();

                        imBeginButton(); {
                            imTextSpan("(" + prints.length + ")");
                            if (elementHasMousePress()) {
                                localState.open = !localState.open;
                            }
                        } imEnd();
                    } imEnd();

                    imBeginList();
                    if (nextListSlot() && localState.open) {
                        imBeginLayout(); {
                            imBeginList();
                            for (const result of prints) {
                                nextListSlot();

                                renderProgramResult(result.val);
                            }
                            imEndList();
                        } imEnd();
                    }
                    imEndList();
                } imEnd();
            }
            imEndList();
        } else if (nextListSlot()) {
            imBeginList();
            for (const result of outputs.prints) {
                if (!result.visible) continue;
                nextListSlot();
                imProgramPrintOutput(ctx, program, s, result);
            };
            imEndList();
        }
        imEndList();
    } imEnd();
    imBeginLayout(COL | GAP); {
        imBeginList();
        for (const [idx, graph] of outputs.graphs) {
            nextListSlot();

            const root = imBeginLayout(COL | GAP); {
                if (canScrollToThing(ctx, s, graph.expr)) {
                    s.outputToScrollTo = root.root;
                }

                imTextSpan("Graph #" + idx, H3);
            } imEnd();

            imBeginLayout(ROW | GAP); {
                imVerticalBar();

                imBeginLayout(COL | GAP | FLEX); {
                    imBeginCodeBlock(0); {
                        imTextSpan(
                            expressionToString(programText, graph.expr)
                        )
                    } imEnd();

                    beginMaximizeableContainer(graph); {
                        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
                            imBeginLayout(ROW | GAP); {
                                imMaximizeItemButton(ctx, graph);
                            } imEnd();

                            imBeginAspectRatio(window.innerWidth, window.innerHeight); {
                                renderGraph(ctx, graph);
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
        nextListSlot();
        const root = imBeginLayout(ROW | GAP); {
            if (canScrollToThing(ctx, s, image.expr)) {
                s.outputToScrollTo = root.root;
            }

            imVerticalBar();

            imBeginLayout(COL | GAP | FLEX); {
                imBeginCodeBlock(0); {
                    if (imInit()) {
                        setStyle("textOverflow", "ellipsis");
                        setStyle("whiteSpace", "nowrap");
                        setStyle("overflow", "hidden");
                    }

                    setInnerText(
                        expressionToString(programText, image.expr)
                    )
                } imEnd();

                renderImageOutput(ctx, image);
            } imEnd();
        } imEnd();
    };
    imEndList();
    imBeginList();
    if (nextListSlot() && outputs.plots.size > 0) {
        imBeginList();
        for (const plot of outputs.plotsInOrder) {
            nextListSlot();
            const root = imBeginLayout(COL | GAP); {
                for (const line of plot.lines) {
                    if (canScrollToThing(ctx, s, line.expr)) {
                        s.outputToScrollTo = root.root;
                    }
                }
                for (const func of plot.functions) {
                    if (canScrollToThing(ctx, s, func.expr)) {
                        s.outputToScrollTo = root.root;
                    }
                }

                imBeginLayout(COL | GAP); {
                    imTextSpan("Plot #" + plot.idx, H3);
                } imEnd();

                const exprFrequencies = imStateInline(() => new Map<ProgramExpression, number>());

                const outputsChanged = imMemo(outputs);
                if (outputsChanged) {
                    exprFrequencies.clear();
                    for (const line of plot.lines) {
                        const count = exprFrequencies.get(line.expr) ?? 0;
                        exprFrequencies.set(line.expr, count + 1);
                    }
                } 

                imBeginList();
                for (const [expr, count] of exprFrequencies) {
                    nextListSlot();
                    imBeginLayout(ROW | GAP); {
                        imTextSpan(count + "x: ");
                        imTextSpan(expressionToString(programText, expr), CODE);
                    } imEnd();
                }
                imEndList();

                imBeginAspectRatio(window.innerWidth, window.innerHeight); {
                    renderPlot(ctx, plot, program);
                } imEnd();
            } imEnd();
        }
        imEndList();
    } 
    imEndList();

    const scrollContainerChanged = imMemo(scrollContainer);
    const outputToScrollToChanged = imMemo(s.outputToScrollTo);
    if (scrollContainerChanged || outputToScrollToChanged) {
        if (scrollContainer && s.outputToScrollTo) {
            scrollIntoViewVH(scrollContainer, s.outputToScrollTo, 0.5);
        }
    } 
}

function newCanvasElement() {
    return document.createElement("canvas");
}


function renderImageOutput(ctx: GlobalContext, image: ProgramImageOutput) {
    beginMaximizeableContainer(image); {
        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
            imBeginLayout(ROW | GAP); {
                imMaximizeItemButton(ctx, image);
            } imEnd();

            imBeginLayout(FLEX | RELATIVE); {
                imBeginList();
                if (nextListSlot() && (image.width !== 0)) {
                    const plotState = imState(newPlotState);

                    imBeginAspectRatio(window.innerWidth, window.innerHeight); {
                        const [, canvas, width, height, dpi] = imBeginCanvasRenderingContext2D(); {
                            imPlotZoomingAndPanning(plotState, width, height, dpi, ctx.input.keyboard.shiftHeld);

                            const pixelSize = 10;

                            const imageChanged = imMemo(image);
                            const plotStateChanged = imMemoObjectVals(plotState);

                            if (imageChanged) {
                                const minX = 0,
                                    minY = 0,
                                    maxX = image.width * pixelSize,
                                    maxY = image.height * pixelSize;

                                recomputePlotExtent(plotState, minX, maxX, minY, maxY);
                            }

                            disableIm(); 
                            if (imageChanged || plotStateChanged) {
                                canvas.clearRect(0, 0, width, height);

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

                                        canvas.beginPath();
                                        {
                                            canvas.fillStyle = color;
                                            const x0Canvas = getCanvasElementX(plotState, x0);
                                            const y0Canvas = getCanvasElementY(plotState, y0);
                                            const size = getCanvasElementLength(plotState, pixelSize);
                                            drawRectSized(
                                                canvas,
                                                x0Canvas,
                                                y0Canvas,
                                                size,
                                                size
                                            );
                                            canvas.fill();
                                        }
                                        canvas.closePath();
                                    }
                                }

                                drawBoundary(canvas, width, height);
                            } 
                            enableIm();
                        } imEndCanvasRenderingContext2D();
                    } imEnd();
                } else {
                    nextListSlot();
                    imBeginLayout(COL | ALIGN_CENTER | JUSTIFY_CENTER); {
                        imTextSpan("Value was empty");
                    } imEnd();
                }
                imEndList();

            } imEnd();
        } imEnd();
    } imEnd();
}

function imPlotZoomingAndPanning(plot: PlotState, width: number, height: number, dpi: number, shiftHeld: boolean) {
    const isMaximized = plot === currentMaximizedItem;
    const canZoom = elementHasMouseHover() && (shiftHeld || isMaximized);
    plot.canZoom = canZoom;

    if (imInit()) {
        setStyle("cursor", "move");
    }

    plot.width = width;
    plot.height = height;
    plot.dpi = dpi;

    const mouse = getImMouse();

    plot.isPanning = mouse.leftMouseButton && elementHasMouseDown();
    if (plot.isPanning) {
        const dxPlot = getPlotLength(plot, screenToCanvas(plot, mouse.dX));
        const dyPlot = getPlotLength(plot, screenToCanvas(plot, mouse.dY));

        plot.posX -= dxPlot;
        plot.posY -= dyPlot;
    }

    const scrollBlocker = imPreventScrollEventPropagation();
    scrollBlocker.isBlocking = canZoom;
    plot.scrollY = scrollBlocker.scrollY;

    if (canZoom) {
        const scrollY = screenToCanvas(plot, scrollBlocker.scrollY);
        if (scrollY !== 0) {
            // When we zoom in or out, we want the graph-point that the mouse is currently over
            // to remain the same.

            const rect = getCurrentRoot().root.getBoundingClientRect();

            const mouseX = screenToCanvas(plot, mouse.X - rect.left);
            const mouseY = screenToCanvas(plot, mouse.Y - rect.top);
            const mouseXPlot = getPlotX(plot, mouseX);
            const mouseYPlot = getPlotY(plot, mouseY);

            if (scrollY < 0) {
                plot.zoom = plot.zoom * 1.1 * (-scrollY / 100);
            } else {
                plot.zoom = plot.zoom / (1.1 * (scrollY / 100));
            }
            plot.zoom = clamp(plot.zoom, 0.5, 10000000);

            const newMouseX = getCanvasElementX(plot, mouseXPlot);
            const newMouseY = getCanvasElementY(plot, mouseYPlot);

            const mouseDX = newMouseX - mouseX;
            const mouseDY = newMouseY - mouseY;

            const dX = getPlotLength(plot, mouseDX);
            const dY = getPlotLength(plot, mouseDY);

            plot.posX += dX;
            plot.posY += dY;
        }
    }
}

function renderGraph(ctx: GlobalContext, graph: ProgramGraphOutput) {
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

    const graphChanged = imMemo(graph);
    if (graphChanged) {
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
    } 

    imBeginLayout(FLEX | RELATIVE | H100).root; {
        const [_, canvas, width, height, dpi] = imBeginCanvasRenderingContext2D(); {
            imPlotZoomingAndPanning(plotState, width, height, dpi, ctx.input.keyboard.shiftHeld);

            const widthChanged = imMemo(width);
            const heightChanged = imMemo(height);
            const graphChanged = imMemo(graph);
            const plotStateChanged = imMemoObjectVals(plotState);
            disableIm();
            if (widthChanged || heightChanged || graphChanged || plotStateChanged) {
                canvas.clearRect(0, 0, width, height);

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

                const CIRCLE_RADIUS = screenToCanvas(plotState, 0.01);
                const LINE_WIDTH = CIRCLE_RADIUS / 3;

                // draw edges
                canvas.strokeStyle = theme.mg.toString();
                canvas.lineWidth = getCanvasElementLength(plotState, LINE_WIDTH);
                for (const node of s.nodeData.values()) {
                    const x0Canvas = getCanvasElementX(plotState, node.position.x);
                    const y0Canvas = getCanvasElementY(plotState, node.position.y);

                    for (const key of node.adjacencies) {
                        const otherNode = s.nodeData.get(key);
                        if (!otherNode) continue;

                        const x1Canvas = getCanvasElementX(plotState, otherNode.position.x);
                        const y1Canvas = getCanvasElementY(plotState, otherNode.position.y);

                        canvas.beginPath(); {
                            canvas.moveTo(x0Canvas, y0Canvas);
                            canvas.lineTo(x1Canvas, y1Canvas);
                            canvas.stroke();
                        } canvas.closePath();
                    }
                }

                // draw nodes over the edges
                canvas.fillStyle = theme.fg.toString();
                for (const node of s.nodeData.values()) {
                    const xCanvas = getCanvasElementX(plotState, node.position.x);
                    const yCanvas = getCanvasElementY(plotState, node.position.y);
                    const rCanvas = getCanvasElementLength(plotState, CIRCLE_RADIUS);
                    drawCircle(canvas, xCanvas, yCanvas, rCanvas);
                    canvas.fill();
                }

                drawBoundary(canvas, width, height);
            }
            enableIm();
        } imEndCanvasRenderingContext2D();
    } imEnd();
}

let currentMaximizedItem: object | null = null;

type PlotState = {
    autofit: boolean;
    overlay: boolean;
    posX: number;
    posY: number;
    originalExtent: number;
    zoom: number;
    width: number;
    height: number;
    dpi: number;
    maximized: boolean;
    isPanning: boolean;
    canZoom: boolean;
    scrollY: number;
}

function newPlotState(): PlotState {
    return {
        scrollY: 0,
        overlay: true,
        autofit: true,
        posX: 0,
        posY: 0,
        zoom: 1,
        originalExtent: 0,
        width: 0,
        height: 0,
        dpi: 0,
        maximized: false,
        isPanning: false,
        canZoom: false,
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
    return (inverseLerp(x, x0Extent, x1Extent) * getDim(plot));
}


function screenToCanvas(plot: PlotState, val: number): number {
    return val * plot.dpi;
}

function canvasToScreen(plot: PlotState, val: number): number {
    return val / plot.dpi;
}

function getCanvasElementY(plot: PlotState, y: number): number {
    const { posY } = plot;
    const extent = getExtent(plot);
    const y0Extent = posY - extent;
    const y1Extent = posY + extent;

    const dim = getDim(plot);
    const other = getOtherDim(plot);
    const diff = dim - other;

    return (inverseLerp(y, y0Extent, y1Extent) * dim - (diff / 2));
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
    return lerp(y0Extent, y1Extent, (((y) + (diff / 2)) / getDim(plot)));
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

function drawPointAt(ctx: CanvasRenderingContext2D, x: number, y: number, halfSize: number) {
    ctx.beginPath();
    {
        ctx.moveTo(x - halfSize, y - halfSize);
        ctx.lineTo(x - halfSize, y + halfSize);
        ctx.lineTo(x + halfSize, y + halfSize);
        ctx.lineTo(x + halfSize, y - halfSize);
        ctx.lineTo(x - halfSize, y - halfSize);
        ctx.stroke();
    }
    ctx.closePath();
}

function imBeginCanvasRenderingContext2D() {
    // When I set the canvas to the size of it's offset width, this in turn
    // causes the parent to get larger, which causes the canvas to get larger, and so on.
    // This relative -> absolute pattern is being used here to fix this.

    imBeginLayout(RELATIVE | W100 | H100);

    const { size } = imTrackSize();
    const canvasRoot = imBeginEl(newCanvasElement);

    const canvas = canvasRoot.root;
    let ctxRef = imRef<[UIRoot<HTMLCanvasElement>, CanvasRenderingContext2D, number, number, number] | null>();
    if (!ctxRef.val) {
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 2d isn't supported by your browser!!! I'd suggest _not_ plotting anything.");
        }
        ctxRef.val = [canvasRoot, context, 0, 0, 0];

        setStyle("position", "absolute");
        setStyle("top", "0");
        setStyle("left", "0");
    }
    const ctx = ctxRef.val;

    const w = size.width;
    const h = size.height;
    // const sf = window.devicePixelRatio ?? 1;
    const dpi = 2; // TODO: revert
    const wC = imMemo(w);
    const hC = imMemo(h);
    const dpiC = imMemo(dpi);
    if (wC || hC || dpiC) {
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        canvas.width = dpi * w;
        canvas.height = dpi * h;
        ctx[2] = dpi * w;
        ctx[3] = dpi * h;
        ctx[4] = dpi;
    } 

    return ctx;
}

function imEndCanvasRenderingContext2D() {
    imEnd();
    imEnd();
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

    let rootLayoutFlags = GAP | W100 | H100 | COL | JUSTIFY_CENTER;
    if (isMaximized) {
        rootLayoutFlags = rootLayoutFlags | FIXED | TRANSLUCENT;
    }

    imBeginLayout(rootLayoutFlags).root; {
        const isMaximizedC = imMemo(isMaximized);
        if (isMaximizedC) {
            if (isMaximized) {
                setInset("10px");
            } else {
                setInset("");
            }
        } 
    }

}

function imMaximizeItemButton(ctx: GlobalContext, item: object) {
    const isMaximized = currentMaximizedItem === item;

    imBeginButton(isMaximized); {
        imTextSpan(isMaximized ? "minimize" : "maximize");

        if (isMaximized) {
            if (ctx.input.keyboard.escape || (elementHasMousePress())) {
                currentMaximizedItem = null;
            }
        } else {
            if (elementHasMousePress()) {
                currentMaximizedItem = item;
            }
        }
    } imEnd();
}


function renderPlot(ctx: GlobalContext, plot: ProgramPlotOutput, program: ProgramInterpretResult) {
    const isMaximized = plot === currentMaximizedItem;
    const plotState = imState(newPlotState);
    plotState.maximized = isMaximized;

    beginMaximizeableContainer(plot); {
        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
            imBeginLayout(ROW | GAP); {
                imMaximizeItemButton(ctx, plot);

                imBeginButton(plotState.overlay); {
                    setInnerText("Overlays");
                    if (elementHasMousePress()) {
                        plotState.overlay = !plotState.overlay;
                    }
                } imEnd();

                imBeginButton(plotState.autofit); {
                    setInnerText("Autofit");
                    if (elementHasMousePress()) {
                        plotState.autofit = !plotState.autofit;
                    }
                } imEnd();
            } imEnd();

            imBeginLayout(FLEX | RELATIVE).root; {
                const shiftScrollToZoomVal = imRef<number>();

                const problems = imRef<string[]>();
                if (!problems.val) {
                    problems.val = [];
                }

                const [_, canvas, width, height, dpi] = imBeginCanvasRenderingContext2D(); {
                    const mouse = getImMouse();

                    // init canvas 

                    imPlotZoomingAndPanning(plotState, width, height, dpi, ctx.input.keyboard.shiftHeld);

                    if (elementHasMouseHover() && (mouse.scrollWheel !== 0 && !plotState.canZoom)) {
                        shiftScrollToZoomVal.val = 1;
                    }

                    const programChanged = imMemo(program);
                    const autoFitChanged = imMemo(plotState.autofit);
                    const runChanged = programChanged || autoFitChanged;
                    const textChanged = imMemo(program.parseResult.text);
                    if (runChanged || textChanged) {
                        if (plotState.autofit) {
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
                        }
                    }

                    const rows = imRef<number[][]>();
                    if (!rows.val) {
                        rows.val = [];
                    }

                    const plotChanged = imMemo(plot);
                    const plotStateChanged = imMemoObjectVals(plotState);
                    disableIm();
                    if (plotChanged || plotStateChanged) {
                        problems.val.length = 0;

                        const { width, height } = plotState;

                        canvas.clearRect(0, 0, width, height);

                        // draw function heatmaps (if the program had no errors, since we need to evaluate the function in the same program context)
                        if (program.errors.length === 0) {

                            let n = program.outputs.heatmapSubdivisions + 1;
                            if (plotState.isPanning) {
                                // Otherwise, dragging is agonizingly slow
                                // TODO: progressive refinement over multiple frames.
                                // this shit too damn slow, bruh.
                                n = min(n, 21);
                            }

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
                                            const heat = inverseLerp(val, minValue, maxValue);

                                            const evalPointX = centerX + (-(n / 2) + i) * size;
                                            const evalPointY = centerY + (-(n / 2) + j) * size;

                                            const x0 = getCanvasElementX(plotState, evalPointX);
                                            const y0 = getCanvasElementY(plotState, evalPointY);

                                            canvas.fillStyle = color.toCssString(heat);
                                            canvas.beginPath(); {
                                                canvas.rect(x0, y0, sizeScreen, sizeScreen);
                                                canvas.fill();
                                            }
                                            canvas.closePath();
                                        }
                                    }
                                }
                            }
                        }

                        // draw lines
                        {
                            for (const line of plot.lines) {
                                // TODO: labels

                                canvas.strokeStyle = line.color ? line.color.toString() : cssVars.fg;
                                canvas.lineWidth = screenToCanvas(plotState, 2);

                                // draw the actual lines

                                let x0 = line.pointsX[0];
                                let y0 = line.pointsY[0];
                                const x0Plot = getCanvasElementX(plotState, x0);
                                const y0Plot = getCanvasElementY(plotState, y0);
                                if (!line.displayAsPoints) {
                                    canvas.beginPath();
                                    canvas.moveTo(x0Plot, y0Plot);
                                    for (let i = 1; i < line.pointsX.length; i++) {
                                        const x1 = line.pointsX[i];
                                        const y1 = line.pointsY[i];

                                        const x1Plot = getCanvasElementX(plotState, x1);
                                        const y1Plot = getCanvasElementY(plotState, y1);

                                        canvas.lineTo(x1Plot, y1Plot);

                                        x0 = x1; y0 = y1;
                                    }
                                    canvas.stroke();
                                    canvas.closePath();
                                }

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
                                    const theme = getCurrentTheme();
                                    canvas.strokeStyle = theme.fg.toCssString();
                                    canvas.lineWidth = screenToCanvas(plotState, 2);
                                    for (let i = 0; i < line.pointsX.length; i++) {
                                        const x1 = line.pointsX[i];
                                        const y1 = line.pointsY[i];

                                        const x1Plot = getCanvasElementX(plotState, x1);
                                        const y1Plot = getCanvasElementY(plotState, y1);
                                        const r = screenToCanvas(plotState, 5);

                                        drawPointAt(canvas, x1Plot, y1Plot, r);
                                    }
                                }
                            }
                        }

                        // Draw the grid
                        if (plotState.overlay) { 
                            const xMin = getPlotX(plotState, 0);
                            const xMax = getPlotX(plotState, width);
                            const yMin = getPlotY(plotState, 0);
                            const yMax = getPlotY(plotState, height);
                            const padding = screenToCanvas(plotState, 5);

                            const theme = getCurrentTheme();
                            canvas.fillStyle = theme.fg.toCssString();
                            canvas.strokeStyle = theme.fg.toCssString();
                            canvas.font = screenToCanvas(plotState, 0.7) + "em Arial";

                            // draw the extent info
                            {
                                let precision = max(3, Math.ceil(Math.log10(plotState.zoom)));

                                canvas.textAlign = "start";
                                canvas.textBaseline = "middle";
                                canvas.fillText("" + xMin.toPrecision(precision), padding, plotState.height / 2);

                                canvas.textAlign = "end";
                                canvas.textBaseline = "middle";
                                canvas.fillText("" + xMax.toPrecision(precision), plotState.width - padding, plotState.height / 2);

                                canvas.textAlign = "center";
                                canvas.textBaseline = "top";
                                canvas.fillText("" + yMin.toPrecision(precision), plotState.width / 2, padding);

                                canvas.textAlign = "center";
                                canvas.textBaseline = "bottom";
                                canvas.fillText("" + yMax.toPrecision(precision), plotState.width / 2, plotState.height - padding);
                            }

                            // draw the grid
                            canvas.strokeStyle = theme.mg.toCssString();
                            canvas.lineWidth = screenToCanvas(plotState, 1);
                            {
                                const extent = getExtent(plotState);
                                const gridFractalLevel = Math.floor(Math.log10(extent));
                                const gridLargeSpacing = Math.pow(10, gridFractalLevel)

                                let spacing = gridLargeSpacing;
                                let spacingEl = getCanvasElementLength(plotState, spacing);

                                let safety = 0;

                                canvas.beginPath();
                                let x = getCanvasElementX(plotState, gridSnap(getPlotX(plotState, 0), spacing));
                                for (; x < width; x += spacingEl) {
                                    if (safety++>1000) {
                                        throw new Error("Bruh");
                                    }
                                    canvas.moveTo(x, 0);
                                    canvas.lineTo(x, height);
                                } 
                                let y = getCanvasElementY(plotState, gridSnap(getPlotY(plotState, 0), spacing));
                                for (; y < height; y += spacingEl) {
                                    if (safety++>1000) {
                                        throw new Error("Bruh");
                                    }
                                    canvas.moveTo(0, y);
                                    canvas.lineTo(width, y);
                                }
                                canvas.closePath();
                                canvas.stroke();
                            }
                        }

                        drawBoundary(canvas, width, height);
                    }
                    enableIm();
                } imEndCanvasRenderingContext2D();

                if (shiftScrollToZoomVal.val !== null) {
                    const dt = deltaTimeSeconds();
                    shiftScrollToZoomVal.val -= dt;
                    if (shiftScrollToZoomVal.val < 0) {
                        shiftScrollToZoomVal.val = null;
                    }
                }

                imBeginAbsoluteLayout(0, 5, NONE, NONE, 5); {
                    const tChanged = imMemo(shiftScrollToZoomVal.val);
                    if (tChanged) {
                        setStyle("opacity", (shiftScrollToZoomVal.val ?? 0) + "");
                    } 
                    imTextSpan("Shift + scroll to zoom");
                } imEnd();

                imBeginList();
                for (const prob of problems.val) {
                    nextListSlot();
                    imBeginLayout(); {
                        imTextSpan("Problem: " + prob);
                    } imEnd();
                }
                imEndList();
            } imEnd();
        } imEnd();
    } imEnd();
}
