import {
    ALIGN_CENTER,
    beginCodeBlock,
    beginHeading,
    BOLD,
    CODE,
    COL,
    FIXED,
    FLEX,
    GAP,
    H1,
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
    W100
} from './layout';
import { evaluateFunctionWithinProgramWithArgs, ExecutionSteps, executionStepToString, getCurrentCallstack, newNumberResult, ProgramExecutionStep, ProgramGraphOutput, ProgramImageOutput, ProgramInterpretResult, ProgramOutputs, ProgramPlotOutput, ProgramResult, ProgramResultFunction, ProgramResultNumber, programResultTypeString, T_RESULT_FN, T_RESULT_LIST, T_RESULT_MAP, T_RESULT_MATRIX, T_RESULT_NUMBER, T_RESULT_RANGE, T_RESULT_STRING } from './program-interpreter';
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
import { assert, deltaTimeSeconds, elementHasMouseClick, elementHasMouseDown, elementHasMouseHover, getCurrentRoot, getKeys, getMouse, imBeginDiv, imBeginEl, imBeginList, imBeginMemo, imEnd, imEndList, imEndMemo, imInit, imPreventScrollEventPropagation, imRef, imSb, imSetVal, imState, imStateInline, imTrackSize, imVal, isShiftPressed, nextListRoot, scrollIntoViewVH, setInnerText, setStyle, SizeState, UIRoot } from './utils/im-dom-utils';
import { clamp, gridSnap, inverseLerp, lerp, max, min } from './utils/math-utils';
import { getSliceValue } from './utils/matrix-math';



export function renderAppCodeOutput(ctx: GlobalContext) {
    imBeginLayout(ROW | GAP); {
        imBeginButton(ctx.state.autoRun); {
            imTextSpan("Autorun");

            if (elementHasMouseClick()) {
                ctx.state.autoRun = !ctx.state.autoRun
                if (ctx.state.autoRun) {
                    rerun(ctx);
                }
            }
        } imEnd();

        imBeginButton(); {
            imTextSpan("Start debugging");
            if (elementHasMouseClick()) {
                startDebugging(ctx);
            }
        } imEnd();

        imBeginButton(ctx.state.showParserOutput); {
            imTextSpan("Show AST");
            if (elementHasMouseClick()) {
                ctx.state.showParserOutput = !ctx.state.showParserOutput;
            }
        } imEnd();


        imBeginButton(ctx.state.showInterpreterOutput); {
            imTextSpan("Show instructions");
            if (elementHasMouseClick()) {
                ctx.state.showInterpreterOutput = !ctx.state.showInterpreterOutput;
            }
        } imEnd();
    } imEnd();

    const scrollContainer = imBeginScrollContainer(FLEX); {
        const parseResult = ctx.lastParseResult;

        imBeginList();
        if (nextListRoot() && ctx.state.showParserOutput) {
            imParserOutputs(parseResult);
        }
        imEndList();

        const message = imRef<string>();

        // TODO: better UI for this message
        imBeginDiv(); {
            imTextSpan(message.val ?? "");
        } imEnd();

        imBeginList();
        if (nextListRoot() && ctx.state.showInterpreterOutput) {
            imBeginList();
            if (nextListRoot() && ctx.lastInterpreterResult) {
                const interpretResult = ctx.lastInterpreterResult;

                imBeginDiv(); {
                    imDiagnosticInfo("Interpreting errors", interpretResult.errors, "No interpreting errors");

                    imBeginEl(newH3); {
                        imTextSpan("Instructions");
                    } imEnd();

                    imBeginList(); {
                        nextListRoot();

                        imBeginLayout(ROW | GAP); {
                            imTextSpan(interpretResult.entryPoint.name, H3 | BOLD);

                            imBeginButton(); {
                                imTextSpan("Start debugging");
                                if (elementHasMouseClick()) {
                                    startDebugging(ctx);
                                }
                            } imEnd();
                        } imEnd();

                        renderFunctionInstructions(interpretResult, interpretResult.entryPoint);

                        for (const [, fn] of interpretResult.functions) {
                            nextListRoot();

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
                nextListRoot();
                imBeginLayout(); {
                    imTextSpan("No instructions generated yet");
                } imEnd();
            } imEndList();
        } imEndList();

        beginHeading(); {
            imTextSpan("Code output");
        } imEnd();

        imBeginList();
        if (nextListRoot() && ctx.lastInterpreterResult) {
            imProgramOutputs(
                ctx, 
                ctx.lastInterpreterResult, 
                ctx.lastInterpreterResult.outputs,
                scrollContainer.root
            );
        } else {
            nextListRoot();
            imBeginLayout(); {
                imTextSpan("Program hasn't been run yet");
            } imEnd();
        }
        imEndList();

        imBeginList();
        if (nextListRoot() && ctx.state.text === "") {
            // NOTE: might not be the best workflow. i.e maybe we want to be able to see the examples while we're writing things.

            beginHeading(); {
                imTextSpan("Examples")
            } imEnd();

            imBeginLayout(COL | GAP); {
                imBeginList();
                for (const eg of codeExamples) {
                    nextListRoot();
                    imBeginButton(); {
                        imTextSpan(eg.name);

                        if (elementHasMouseClick()) {
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
    if (nextListRoot() && parseResult) {
        const statements = parseResult.statements;

        imBeginList();
        if (nextListRoot() && statements.length > 0) {

            function renderRow(title: string, type: string, depth: number, code?: string) {
                nextListRoot();
                imBeginDiv(); {
                    setStyle("paddingLeft", (depth * 20) + "px");

                    imTextSpan(title);
                    imTextSpan(" = ");
                    imTextSpan(type);
                    imBeginList();
                    if (code) {
                        nextListRoot();

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
            nextListRoot();
            imTextSpan("Nothing parsed yet");
        }
        imEndList();

        imDiagnosticInfo("Errors", parseResult.errors, "No parsing errors!");
        imDiagnosticInfo("Warnings", parseResult.warnings, "No parsing warnings");
    } else {
        nextListRoot();
        imTextSpan("No parse results yet");
    } imEndList();
}

// TODO: display these above the code editor itself. 
function imDiagnosticInfo(heading: string, info: DiagnosticInfo[], emptyText: string) {
    imBeginList();
    if (nextListRoot() && heading) {
        beginHeading(); {
            imTextSpan(heading);
        } imEnd();
    } imEndList();

    imBeginList();
    for (const e of info) {
        nextListRoot();
        imBeginDiv(); {
            imTextSpan("Line " + e.pos.line + " Col " + (e.pos.col) + " Tab " + (e.pos.tabs) + " - " + e.problem);
        } imEnd();
    }
    imEndList();

    imBeginList();
    if (nextListRoot() && info.length === 0) {
        imBeginDiv(); {
            imTextSpan(emptyText);
        } imEnd();
    }
    imEndList();
}




export function renderProgramResult(res: ProgramResult) {
    imBeginDiv(); {
        imBeginLayout(COL | GAP); {
            imBeginList(); {
                nextListRoot(res.t);
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
                        beginCodeBlock(0); {
                            imTextSpan("list[", CODE);
                            beginCodeBlock(1); {
                                imBeginList();
                                for (let i = 0; i < res.values.length; i++) {
                                    nextListRoot();
                                    renderProgramResult(res.values[i]);
                                }
                                imEndList();
                            } imEnd();
                            imTextSpan("]", CODE);
                        } imEnd();
                        break;
                    case T_RESULT_MAP: {
                        beginCodeBlock(0); {
                            imTextSpan("map{", CODE);
                            beginCodeBlock(1); {
                                imBeginList();
                                for (const [k, val] of res.map) {
                                    nextListRoot();
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
                                if (nextListRoot() && !isLast) {
                                    imTextSpan(", ");
                                }
                                imEndList();

                                return;
                            }

                            beginCodeBlock(dim === 0 ? 0 : 1); {
                                imTextSpan("[");
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
    } imEnd();
}

function renderExecutionStep(step: ProgramExecutionStep) {
    imTextSpan(executionStepToString(step));
}

export function renderFunctionInstructions(interpretResult: ProgramInterpretResult, { steps }: ExecutionSteps) {
    imBeginLayout(FLEX | COL); {
        const scrollContainer = imBeginScrollContainer(FLEX); {
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
                            imTextSpan(i + " | ");

                            renderExecutionStep(step);

                            imBeginList();
                            if (nextListRoot() && isCurrent) {
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
                    nextListRoot();
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
    const sb = imSb();

    if (imBeginMemo().val(fn).changed()) {
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
    } imEndMemo();

    return sb.toString();
}




type ProgramOutputState = {
    currentThingToScrollTo: HTMLElement | undefined;
};
function newProgramOutputsState(): ProgramOutputState {
    return  {
        currentThingToScrollTo: undefined
    };
}

function canScrollToThing(ctx: GlobalContext, s: ProgramOutputState, expr: ProgramExpression) {
    return !s.currentThingToScrollTo &&
        expr.start.i <= ctx.textCursorIdx && ctx.textCursorIdx <= expr.end.i;
}


export function imProgramOutputs(
    ctx: GlobalContext, 
    program: ProgramInterpretResult, 
    outputs: ProgramOutputs,
    scrollContainer?: HTMLElement,
) {
    const s = imState(newProgramOutputsState);
    s.currentThingToScrollTo = undefined;
    const programText = program.parseResult.text;

    imBeginLayout(); {
        if (imInit()) {
            setStyle("height", "5px")
        }
    } imEnd();
    imBeginList();
    for (const result of outputs.prints) {
        nextListRoot();
        const root = imBeginLayout(ROW | GAP); {
            if (canScrollToThing(ctx, s, result.expr)) {
                s.currentThingToScrollTo = root.root;
            }

            imVerticalBar();

            imBeginLayout(COL | GAP); {
                beginCodeBlock(0); {
                    imTextSpan(
                        expressionToString(programText, result.expr)
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

            const root = imBeginLayout(COL | GAP); {
                if (canScrollToThing(ctx, s, graph.expr)) {
                    s.currentThingToScrollTo = root.root;
                }

                imTextSpan("Graph #" + idx, H3);
            } imEnd();

            imBeginLayout(ROW | GAP); {
                imVerticalBar();

                imBeginLayout(COL | GAP | FLEX); {
                    beginCodeBlock(0); {
                        imTextSpan(
                            expressionToString(programText, graph.expr)
                        )
                    } imEnd();

                    beginMaximizeableContainer(graph); {
                        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
                            imBeginLayout(ROW | GAP); {
                                imMaximizeItemButton(graph);
                            } imEnd();

                            imBeginAspectRatio(16, 9); {
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
        const root = imBeginLayout(ROW | GAP); {
            if (canScrollToThing(ctx, s, image.expr)) {
                s.currentThingToScrollTo = root.root;
            }

            imVerticalBar();

            imBeginLayout(COL | GAP | FLEX); {
                beginCodeBlock(0); {
                    if (imInit()) {
                        setStyle("textOverflow", "ellipsis");
                        setStyle("whiteSpace", "nowrap");
                        setStyle("overflow", "hidden");
                    }

                    setInnerText(
                        expressionToString(programText, image.expr)
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
            const root = imBeginLayout(COL | GAP); {
                for (const line of plot.lines) {
                    if (canScrollToThing(ctx, s, line.expr)) {
                        s.currentThingToScrollTo = root.root;
                    }
                }
                for (const func of plot.functions) {
                    if (canScrollToThing(ctx, s, func.expr)) {
                        s.currentThingToScrollTo = root.root;
                    }
                }

                imBeginLayout(COL | GAP); {
                    imTextSpan("Plot #" + idx, H3);
                } imEnd();

                const exprFrequencies = imStateInline(() => new Map<ProgramExpression, number>());

                if (!imBeginMemo().val(outputs).changed()) {
                    exprFrequencies.clear();
                    for (const line of plot.lines) {
                        const count = exprFrequencies.get(line.expr) ?? 0;
                        exprFrequencies.set(line.expr, count + 1);
                    }
                } imEndMemo();

                imBeginList();
                for (const [expr, count] of exprFrequencies) {
                    nextListRoot();
                    imBeginLayout(ROW | GAP); {
                        imTextSpan(count + "x: ");
                        imTextSpan(expressionToString(programText, expr), CODE);
                    } imEnd();
                }
                imEndList();

                imBeginAspectRatio(16, 9).root; {
                    renderPlot(plot, program);
                } imEnd();
            } imEnd();
        }
        imEndList();
    } else {
        nextListRoot();
        imTextSpan("No results yet");
    }
    imEndList();

    if (imBeginMemo()
        .val(scrollContainer)
        .val(s.currentThingToScrollTo)
        .changed()
    ) {
        if (scrollContainer && s.currentThingToScrollTo) {
            scrollIntoViewVH(scrollContainer, s.currentThingToScrollTo, 0.5);
        }
    } imEndMemo();
}

function newCanvasElement() {
    return document.createElement("canvas");
}


function renderImageOutput(image: ProgramImageOutput) {
    beginMaximizeableContainer(image); {
        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
            imBeginLayout(ROW | GAP); {
                imMaximizeItemButton(image);
            } imEnd();

            imBeginLayout(FLEX | RELATIVE); {
                imBeginList();
                if (nextListRoot() && (image.width !== 0)) {
                    const plotState = imState(newPlotState);

                    const [_, ctx, width, height] = imBeginCanvasRenderingContext2D(); {
                        imPlotZoomingAndPanning(plotState, width, height);

                        const pixelSize = 10;

                        if (imBeginMemo().val(image).changed()) {
                            const minX = 0,
                                minY = 0,
                                maxX = image.width * pixelSize,
                                maxY = image.height * pixelSize;

                            recomputePlotExtent(plotState, minX, maxX, minY, maxY);
                        } imEndMemo();

                        if (imBeginMemo().val(image).objectVals(plotState).changed()) {
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
                        } imEndMemo();
                    } imEndCanvasRenderingContext2D();
                } else {
                    nextListRoot();
                    imBeginLayout(COL | ALIGN_CENTER | JUSTIFY_CENTER); {
                        imTextSpan("Value was empty");
                    } imEnd();
                }
                imEndList();

            } imEnd();
        } imEnd();
    } imEnd();
}

function imPlotZoomingAndPanning(plotState: PlotState, width: number, height: number) {
    const isMaximized = plotState === currentMaximizedItem;
    const canZoom = elementHasMouseHover() && (isShiftPressed() || isMaximized);
    plotState.canZoom = canZoom;

    if (imInit()) {
        setStyle("cursor", "move");
    }

    plotState.width = width;
    plotState.height = height;

    const mouse = getMouse();

    plotState.isPanning = mouse.leftMouseButton && elementHasMouseDown();
    if (plotState.isPanning) {
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

            if (mouse.scrollY < 0) {
                plotState.zoom = plotState.zoom * 1.1 * (-mouse.scrollY / 100);
            } else {
                plotState.zoom = plotState.zoom / (1.1 * (mouse.scrollY / 100));
            }
            plotState.zoom = clamp(plotState.zoom, 0.5, 10000000);

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

    if (imBeginMemo().val(graph).changed()) {
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
    } imEndMemo();

    imBeginLayout(FLEX | RELATIVE | H100).root; {
        const [_, ctx, width, height] = imBeginCanvasRenderingContext2D(); {
            imPlotZoomingAndPanning(plotState, width, height);

            if (imBeginMemo().val(width).val(height).val(graph).objectVals(plotState).changed()) {
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
            } imEndMemo();
        } imEndCanvasRenderingContext2D();
    } imEnd();
}

let currentMaximizedItem: object | null = null;

type PlotState = {
    overlay: boolean;
    posX: number;
    posY: number;
    originalExtent: number;
    zoom: number;
    width: number;
    height: number;
    maximized: boolean;
    isPanning: boolean;
    canZoom: boolean;
}

function newPlotState(): PlotState {
    return {
        overlay: false,
        posX: 0,
        posY: 0,
        zoom: 1,
        originalExtent: 0,
        width: 0,
        height: 0,
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

function imBeginCanvasRenderingContext2D() {
    // When I set the canvas to the size of it's offset width, this in turn
    // causes the parent to get larger, which causes the canvas to get larger, and so on.
    // This relative -> absolute pattern is being used here to fix this.

    imBeginLayout(RELATIVE | W100 | H100);

    const { rect } = imTrackSize();
    const canvasRoot = imBeginEl(newCanvasElement);

    const canvas = canvasRoot.root;
    let ctx = imVal<[UIRoot<HTMLCanvasElement>, CanvasRenderingContext2D, number, number] | null>(null);
    if (!ctx) {
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 2d isn't supported by your browser!!! I'd suggest _not_ plotting anything. Or updaing your browser");
        }
        ctx = imSetVal([canvasRoot, context, 0, 0]);

        setStyle("position", "absolute");
        setStyle("top", "0");
        setStyle("left", "0");
    }

    const w = rect.width;
    const h = rect.height;
    if (imBeginMemo().val(w).val(h).changed()) {
        canvas.width = w;
        canvas.height = h;
        ctx[2] = w;
        ctx[3] = h;
    } imEndMemo();

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
        if (imBeginMemo().val(isMaximized).changed()) {
            if (isMaximized) {
                setInset("10px");
            } else {
                setInset("");
            }
        } imEndMemo();
    }

}

function imMaximizeItemButton(item: object) {
    const isMaximized = currentMaximizedItem === item;

    imBeginButton(isMaximized); {
        imTextSpan(isMaximized ? "minimize" : "maximize");

        const keys = getKeys();

        if (isMaximized) {
            if (
                keys.escPressed ||
                (elementHasMouseClick())
            ) {
                currentMaximizedItem = null;
            }
        } else {
            if (elementHasMouseClick()) {
                currentMaximizedItem = item;
            }
        }
    } imEnd();
}


function renderPlot(plot: ProgramPlotOutput, program: ProgramInterpretResult) {
    const isMaximized = plot === currentMaximizedItem;
    const plotState = imState(newPlotState);
    plotState.maximized = isMaximized;

    beginMaximizeableContainer(plot); {
        imBeginLayout(COL | OPAQUE | FLEX | GAP); {
            imBeginLayout(ROW | GAP); {
                imMaximizeItemButton(plot);

                imBeginButton(plotState.overlay); {
                    setInnerText("Overlays");
                    if (elementHasMouseClick()) {
                        plotState.overlay = !plotState.overlay;
                    }
                } imEnd();
            } imEnd();

            imBeginLayout(FLEX | RELATIVE).root; {
                const shiftScrollToZoomVal = imRef<number>();

                const problems = imRef<string[]>();
                if (!problems.val) {
                    problems.val = [];
                }

                const [_, ctx, width, height] = imBeginCanvasRenderingContext2D(); {
                    const mouse = getMouse();

                    // init canvas 

                    if (elementHasMouseHover() && (mouse.scrollY !== 0 && !plotState.canZoom)) {
                        shiftScrollToZoomVal.val = 1;
                    }

                    imPlotZoomingAndPanning(plotState, width, height);

                    if (imBeginMemo()
                        .val(program.parseResult.text)
                        .val(width)
                        .val(height)
                        .changed()
                    ) {
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
                    } imEndMemo();



                    const rows = imRef<number[][]>();
                    if (!rows.val) {
                        rows.val = [];
                    }

                    if (imBeginMemo().val(plot).objectVals(plotState).changed()) {
                        problems.val.length = 0;

                        const { width, height } = plotState;

                        ctx.clearRect(0, 0, width, height);

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

                        // Draw the grid
                        if (true || plotState.overlay) { // TODO: gate
                            const xMin = getPlotX(plotState, 0);
                            const xMax = getPlotX(plotState, width);
                            const yMin = getPlotY(plotState, 0);
                            const yMax = getPlotY(plotState, height);
                            const padding = 5;

                            const theme = getCurrentTheme();
                            ctx.fillStyle = theme.fg.toCssString();
                            ctx.strokeStyle = theme.fg.toCssString();
                            ctx.font = "0.7em Arial";

                            // draw the extent info
                            {
                                let precision = max(3, Math.ceil(Math.log10(plotState.zoom)));

                                ctx.textAlign = "start";
                                ctx.textBaseline = "middle";
                                ctx.fillText("" + xMin.toPrecision(precision), padding, plotState.height / 2);

                                ctx.textAlign = "end";
                                ctx.textBaseline = "middle";
                                ctx.fillText("" + xMax.toPrecision(precision), plotState.width - padding, plotState.height / 2);

                                ctx.textAlign = "center";
                                ctx.textBaseline = "top";
                                ctx.fillText("" + yMin.toPrecision(precision), plotState.width / 2, padding);

                                ctx.textAlign = "center";
                                ctx.textBaseline = "bottom";
                                ctx.fillText("" + yMax.toPrecision(precision), plotState.width / 2, plotState.height - padding);
                            }

                            // draw the grid
                            ctx.strokeStyle = theme.mg.toCssString();
                            ctx.lineWidth = 1;
                            {
                                const extent = getExtent(plotState);
                                const gridFractalLevel = Math.floor(Math.log10(extent));
                                const gridLargeSpacing = Math.pow(10, gridFractalLevel)

                                let spacing = gridLargeSpacing;
                                let spacingEl = getCanvasElementLength(plotState, spacing);

                                let safety = 0;

                                ctx.beginPath();
                                let x = getCanvasElementX(plotState, gridSnap(getPlotX(plotState, 0), spacing));
                                for (; x < width; x += spacingEl) {
                                    if (safety++>1000) {
                                        throw new Error("Bruh");
                                    }
                                    ctx.moveTo(x, 0);
                                    ctx.lineTo(x, height);
                                } 
                                let y = getCanvasElementY(plotState, gridSnap(getPlotY(plotState, 0), spacing));
                                for (; y < height; y += spacingEl) {
                                    if (safety++>1000) {
                                        throw new Error("Bruh");
                                    }
                                    ctx.moveTo(0, y);
                                    ctx.lineTo(width, y);
                                }
                                ctx.closePath();
                                ctx.stroke();
                            }
                        }

                        drawBoundary(ctx, width, height);
                    } imEndMemo();
                } imEndCanvasRenderingContext2D();

                if (shiftScrollToZoomVal.val !== null) {
                    const dt = deltaTimeSeconds();
                    shiftScrollToZoomVal.val -= dt;
                    if (shiftScrollToZoomVal.val < 0) {
                        shiftScrollToZoomVal.val = null;
                    }
                }

                imBeginList();
                if (nextListRoot() && shiftScrollToZoomVal.val !== 0) {
                    imBeginAbsoluteLayout(0, 5, NONE, NONE, 5); {
                        setStyle("opacity", shiftScrollToZoomVal.val + "");
                        imTextSpan("Shift + scroll to zoom");
                    } imEnd();
                } imEndList();

                imBeginList();
                for (const prob of problems.val) {
                    nextListRoot();
                    imBeginLayout(); {
                        imTextSpan("Problem: " + prob);
                    } imEnd();
                }
                imEndList();
            } imEnd();
        } imEnd();
    } imEnd();
}

type CodeExample = {
    name: string;
    code: string;
}

// TODO: improve examples to be simpler and to demonstrate individual concepts. 
// right now, I'm just using this mechanism to save and load various scenarios.
const codeExamples: CodeExample[] = [
    {
        name: "Large text",
        code: 
        `as;f;askdf;lasdfkdjfajd;ak;jf\n`.repeat(40),
    },
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

// try this
output_here()

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
Y = rot3d_y(yAngle)
Z = rot3d_z(zAngle)

// Alternatively, you can do this:

// sinX = sin(xAngle)
// sinY = sin(yAngle)
// sinZ = sin(zAngle)
//
// cosX = cos(xAngle)
// cosY = cos(yAngle)
// cosZ = cos(zAngle)
//
// X =  [
//     [1,  0,  0, 0],
//     [0, cosX, -sinX, 0],
//     [0, sinX, cosX,  0],
//     [0,  0,  0, 1],
// ]
//
// Y = [
//     [cosY,  0,  -sinY, 0],
//     [0,    1, 0, 0],
//     [sinY, 0, cosY,  0],
//     [0,  0,  0, 1],
// ]
//
// Z = [
//     [cosZ, -sinZ, 0, 0],
//     [sinZ, cosZ,  0, 0],
//     [0,  0,  1, 0],
//     [0,  0,  0, 1],
// ]

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
