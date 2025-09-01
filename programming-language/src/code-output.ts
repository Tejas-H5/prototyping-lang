import { imButton, imButtonIsClicked } from './app-components/im-button';
import { imCode } from './app-styling';
import {
    BLOCK,
    COL,
    imAbsolute,
    imAlign,
    imAspectRatio,
    imBg,
    imFixed,
    imFlex,
    imGap,
    imJustify,
    imLayout,
    imLayoutEnd,
    imPadding,
    imPre,
    imRelative,
    imSize,
    INLINE,
    NA,
    PERCENT,
    PX,
    ROW,
    START
} from './components/core/layout';
import { imLine, LINE_VERTICAL } from './components/im-line';
import { imScrollContainerBegin, imScrollContainerEnd, newScrollContainer } from './components/scroll-container';
import { CODE_EXAMPLES } from './examples';
import {
    evaluateFunctionWithinProgramWithArgs,
    ExecutionSteps,
    executionStepToString,
    getCurrentCallstack,
    newNumberResult,
    ProgramExecutionStep,
    ProgramGraphOutput,
    ProgramImageOutput,
    ProgramInterpretResult,
    ProgramOutputs,
    ProgramPlotOutput,
    ProgramPrintOutput,
    ProgramResult,
    ProgramResultFunction,
    ProgramResultNumber,
    programResultTypeString,
    T_RESULT_FN,
    T_RESULT_LIST,
    T_RESULT_MAP,
    T_RESULT_MATRIX,
    T_RESULT_NUMBER,
    T_RESULT_RANGE,
    T_RESULT_STRING
} from './program-interpreter';
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
    TextPosition,
    unaryOpToOpString,
    unaryOpToString
} from './program-parser';
import { GlobalContext, mutateState, rerun, startDebugging } from './state';
import "./styling";
import { cssVars, getCurrentTheme } from './styling';
import { assert } from './utils/assert';
import { scrollIntoViewVH } from './utils/dom-utils';
import {
    getDeltaTimeSeconds,
    ImCache,
    imFor,
    imForEnd,
    imGet,
    imIf,
    imIfElse,
    imIfEnd,
    imKeyedBegin,
    imKeyedEnd,
    imMemo,
    imSet,
    imState,
    imSwitch,
    imSwitchEnd,
    inlineTypeId,
    isFirstishRender
} from './utils/im-core';
import {
    EL_CANVAS,
    EL_H3,
    elGet,
    elHasMousePress,
    elHasMouseOver,
    elSetStyle,
    getGlobalEventSystem,
    imEl,
    imElEnd,
    imPreventScrollEventPropagation,
    imStr,
    imStrFmt,
    imTrackSize
} from './utils/im-dom';
import { clamp, gridSnap, inverseLerp, lerp, max, min } from './utils/math-utils';
import { getSliceValue } from './utils/matrix-math';

export function imAppCodeOutput(c: ImCache, ctx: GlobalContext) {
    imLayout(c, ROW); imGap(c, 5, PX); {
        imLayout(c, BLOCK); imButton(c, ctx.state.autoRun); {
            imStr(c, "Autorun");

            if (elHasMousePress(c)) {
                ctx.state.autoRun = !ctx.state.autoRun
                mutateState(ctx.state);

                if (ctx.state.autoRun) {
                    rerun(ctx);
                }
            }
        } imLayoutEnd(c);

        if (imButtonIsClicked(c, "Start debugging")) {
            startDebugging(ctx);
        }

        imLayout(c, BLOCK); imButton(c, ctx.state.showParserOutput); {
            imStr(c, "Show AST");
            if (elHasMousePress(c)) {
                ctx.state.showParserOutput = !ctx.state.showParserOutput;
                mutateState(ctx.state);
            }
        } imLayoutEnd(c);


        imLayout(c, BLOCK); imButton(c, ctx.state.showInterpreterOutput); {
            imStr(c, "Show instructions");
            if (elHasMousePress(c)) {
                ctx.state.showInterpreterOutput = !ctx.state.showInterpreterOutput;
                mutateState(ctx.state);
            }
        } imLayoutEnd(c);
    } imLayoutEnd(c);

    const sc = imState(c, newScrollContainer);
    const scrollContainer = imScrollContainerBegin(c, sc); {
        const parseResult = ctx.lastParseResult;

        if (imIf(c) && ctx.state.showParserOutput) {
            imParserOutputs(c, parseResult);
        } imIfEnd(c);

        let message; message = imGet(c, inlineTypeId(imAppCodeOutput));
        if (!message) message = imSet(c, { val: "" });

        // TODO: better UI for this message
        imLayout(c, BLOCK); { 
            imStr(c, message.val ?? "");
        } imLayoutEnd(c);

        if (imIf(c) && ctx.state.showInterpreterOutput) {
            if (imIf(c) && ctx.lastInterpreterResult) {
                const interpretResult = ctx.lastInterpreterResult;

                imLayout(c, BLOCK); {
                    imDiagnosticInfo(c, "Interpreting errors", interpretResult.errors, "No interpreting errors");

                    imEl(c, EL_H3); imStr(c, "Instructions"); imElEnd(c, EL_H3);

                    imLayout(c, ROW); imGap(c, 5, PX); {
                        imEl(c, EL_H3); imStr(c, interpretResult.entryPoint.name); imElEnd(c, EL_H3);

                        imLayout(c, ROW); imButton(c); {
                            imStr(c, "Start debugging");
                            if (elHasMousePress(c)) {
                                startDebugging(ctx);
                            }
                        } imLayoutEnd(c);
                    } imLayoutEnd(c);

                    imFunctionInstructions(c, interpretResult, interpretResult.entryPoint);

                    imFor(c); for (const [, fn] of interpretResult.functions) {
                        imLayout(c, ROW); imGap(c, 5, PX); {
                            imEl(c, EL_H3); imStrFmt(c, fn, getFunctionName); imElEnd(c, EL_H3);

                            imLayout(c, ROW); imButton(c); {
                                imStr(c, "Start debugging");
                                if (elHasMousePress(c)) {
                                    startDebugging(ctx);
                                }
                            } imLayoutEnd(c);
                        } imLayoutEnd(c);

                        imFunctionInstructions(c, interpretResult, fn.code);
                    } imForEnd(c);
                } imLayoutEnd(c);
            } else {
                imIfEnd(c);
                imLayout(c, BLOCK); {
                    imStr(c, "No instructions generated yet");
                } imLayoutEnd(c);
            } imIfEnd(c);
        } imIfEnd(c);

        imEl(c, EL_H3); imStr(c, "Code output"); imElEnd(c, EL_H3);

        imLayout(c, ROW); imButton(c, ctx.state.showGroupedOutput); {
            imStr(c, "Grouped");

            if (elHasMousePress(c)) {
                ctx.state.showGroupedOutput = !ctx.state.showGroupedOutput;
                mutateState(ctx.state);
            }
        } imLayoutEnd(c);

        if (imIf(c) && ctx.lastInterpreterResult) {
            imProgramOutputs(
                c,
                ctx, 
                ctx.lastInterpreterResult, 
                ctx.lastInterpreterResult.outputs,
                scrollContainer,
            );
        } else {
            imIfElse(c);
            imLayout(c, BLOCK); {
                imStr(c, "Program hasn't been run yet");
            } imLayoutEnd(c);
        } imIfEnd(c);

        if (imIf(c) && ctx.state.text === "") {
            // NOTE: might not be the best workflow. i.e maybe we want to be able to see the examples while we're writing things.

            imEl(c, EL_H3); imStr(c, "Examples"); imElEnd(c, EL_H3);

            imLayout(c, COL); imGap(c, 5, PX); {
                imFor(c); for (const eg of CODE_EXAMPLES) {
                    imLayout(c, BLOCK); imButton(c); {
                        imStr(c, eg.name);

                        if (elHasMousePress(c)) {
                            ctx.state.text = eg.code.trim();
                            mutateState(ctx.state);
                            ctx.lastLoaded = Date.now();
                        }
                    } imLayoutEnd(c);
                } imForEnd(c);
            } imLayoutEnd(c);
        } imIfEnd(c);
    } imScrollContainerEnd(c);
}

function imParserOutputRow(
    c: ImCache,
    result: ProgramParseResult,
    expr: ProgramExpression,
    title: string,
    type: string,
    depth: number,
    code?: string
) {
    imLayout(c, BLOCK); {
        imStr(c, title);
        imStr(c, " = ");
        imStr(c, type);

        if (imIf(c) && code) {
            imStr(c, " ");
            imLayout(c, INLINE); imCode(c); imStr(c, code); imLayoutEnd(c);
        } else {
            imIfElse(c);

            imStr(c, "(");
            // TODO: click on button that takes us there in the editor
            // imStr(c, "start="); imStrFmt(c, expr.start, textPositionToString);
            // imStr(c, ", end="); imStrFmt(c, expr.end, textPositionToString);
            imStr(c, "start="); imStr(c, expr.start.i);
            imStr(c, ", end="); imStr(c, expr.end.i);
            imStr(c, ")");
        } imIfEnd(c);
    } imLayoutEnd(c);
}


function imRecursiveParserOutputExpressionState() {
    return {
        isExpanded: false,
        showPos: false,
    };
}

function imRecursiveParserOutputExpression(
    c: ImCache,
    parseResult: ProgramParseResult,
    title: string, 
    expr: ProgramExpression | undefined, 
    depth: number,
) {
    if (!expr) {
        return;
    }

    const s = imState(c, imRecursiveParserOutputExpressionState);

    const exprChanged = imMemo(c, expr);
    const showPosChanged = imMemo(c, s.showPos);

    let code = imGet(c, String);
    if (code === undefined || exprChanged || showPosChanged) {
        if (
            expr.children.length === 0 || 
            // When showing position info, we should just show the entire expression, for easier debugging
            s.showPos
        ) {
            code = expressionToString(parseResult.text, expr);
        } else {
            code = expressionToString(parseResult.text, expr).substring(0, 20);
        }

        imSet(c, code);
    }
    
    let typeString = expressionTypeToString(expr);

    imLayout(c, BLOCK); imAlign(c, START); {
        if (imMemo(c, depth)) elSetStyle(c, "paddingLeft", (depth * 20) + "px");

        imLayout(c, ROW); imGap(c, 5, PX); {
            if (imIf(c) && expr.children.length > 0) {
                imLayout(c, BLOCK); imButton(c, s.isExpanded); {
                    imStr(c, s.isExpanded ? "v" : ">");
                    if (elHasMousePress(c)) {
                        s.isExpanded = !s.isExpanded;
                    }
                } imLayoutEnd(c);
            } imIfEnd(c);

            imLayout(c, BLOCK); imButton(c, s.showPos); {
                imStr(c, "pos");
                if (elHasMousePress(c)) {
                    s.showPos = !s.showPos;
                }
            } imLayoutEnd(c);

            imParserOutputRow(c, parseResult, expr, title, typeString, depth, code);
        } imLayoutEnd(c);

        if (imIf(c) && s.showPos) {
            imLayout(c, BLOCK); {
                imStr(c, "Start="); imStrFmt(c, expr.start, textPositionToString);
            } imLayoutEnd(c);
            imLayout(c, BLOCK); {
                imStr(c, "End="); imStrFmt(c, expr.end, textPositionToString);
            } imLayoutEnd(c);
        } imIfEnd(c);

        if (imIf(c) && s.isExpanded) {
            imLayout(c, BLOCK); imPadding(c, 5, PX, 5, PX, 5, PX, 5, PX); {
                switch (expr.t) {
                    case T_IDENTIFIER: {
                    } break;
                    case T_IDENTIFIER_THE_RESULT_FROM_ABOVE: {
                    } break;
                    case T_ASSIGNMENT: {
                        imRecursiveParserOutputExpression(c, parseResult, "lhs", expr.lhs, depth + 1);
                        imRecursiveParserOutputExpression(c, parseResult, "rhs", expr.rhs, depth + 1);
                    } break;
                    case T_BINARY_OP: {
                        imRecursiveParserOutputExpression(c, parseResult, "lhs", expr.lhs, depth + 1);
                        imRecursiveParserOutputExpression(c, parseResult, "rhs", expr.rhs, depth + 1);
                    } break;
                    case T_UNARY_OP: {
                        imRecursiveParserOutputExpression(c, parseResult, "expr", expr.expr, depth + 1);
                    } break;
                    case T_MAP_LITERAL: {
                        for (let i = 0; i < expr.kvPairs.length; i++) {
                            imRecursiveParserOutputExpression(c, parseResult, "key[" + i + "]", expr.kvPairs[i][0], depth + 1);
                            imRecursiveParserOutputExpression(c, parseResult, "val[" + i + "]", expr.kvPairs[i][1], depth + 1);
                        }
                    } break;
                    case T_LIST_LITERAL:
                    case T_VECTOR_LITERAL: {
                        for (let i = 0; i < expr.items.length; i++) {
                            imRecursiveParserOutputExpression(c, parseResult, "[" + i + "]", expr.items[i], depth + 1);
                        }
                    } break;
                    case T_NUMBER_LITERAL: {
                    } break;
                    case T_STRING_LITERAL: {
                    } break;
                    case T_TERNARY_IF: {
                        imRecursiveParserOutputExpression(c, parseResult, "query", expr.query, depth + 1);
                        imRecursiveParserOutputExpression(c, parseResult, "trueBranch", expr.trueBranch, depth + 1);
                        if (expr.falseBranch) {
                            imRecursiveParserOutputExpression(c, parseResult, "falseBranch", expr.falseBranch, depth + 1);
                        }
                    } break;
                    case T_BLOCK: {
                        for (let i = 0; i < expr.statements.length; i++) {
                            imRecursiveParserOutputExpression(c, parseResult, "s" + i, expr.statements[i], depth + 1);
                        }
                    } break;
                    case T_RANGE_FOR: {
                        imRecursiveParserOutputExpression(c, parseResult, "loop var", expr.loopVar, depth + 1);
                        imRecursiveParserOutputExpression(c, parseResult, "range expr", expr.rangeExpr, depth + 1);
                        imRecursiveParserOutputExpression(c, parseResult, "loop body", expr.body, depth + 1);
                    } break;
                    case T_FN: {
                        imRecursiveParserOutputExpression(c, parseResult, "name", expr.fnName, depth + 1);
                        for (let i = 0; i < expr.arguments.length; i++) {
                            imRecursiveParserOutputExpression(c, parseResult, "arg" + i, expr.arguments[i], depth + 1);
                        }
                        if (expr.body) {
                            imRecursiveParserOutputExpression(c, parseResult, "body", expr.body, depth + 1);
                        }
                    } break;
                    case T_DATA_INDEX_OP: {
                        imRecursiveParserOutputExpression(c, parseResult, "var", expr.lhs, depth + 1);
                        for (let i = 0; i < expr.indexes.length; i++) {
                            imRecursiveParserOutputExpression(c, parseResult, "[" + i + "]", expr.indexes[i], depth + 1);
                        }
                    } break;
                    default: {
                        throw new Error("Unhandled type (parse view): " + typeString);
                    }
                }
            } imLayoutEnd(c);
        } imIfEnd(c);
    } imLayoutEnd(c);
}

const INCOMPLETE = " <Incomplete!> ";

function imParserOutputs(c: ImCache, parseResult: ProgramParseResult | undefined) {
    if (imIf(c) && parseResult) {
        const statements = parseResult.statements;

        if (imIf(c) && statements.length > 0) {
            imLayout(c, COL); imGap(c, 5, PX); {
                imFor(c); for (let i = 0; i < statements.length; i++) {
                    const statement = statements[i];
                    imRecursiveParserOutputExpression(
                        c,
                        parseResult,
                        "Statement " + (i + 1),
                        statement,
                        0
                    );
                } imForEnd(c);
            } imLayoutEnd(c);
        } else {
            imIfElse(c);
            imStr(c, "Nothing parsed yet");
        } imIfEnd(c);

        imDiagnosticInfo(c, "Errors", parseResult.errors, "No parsing errors!");
        imDiagnosticInfo(c, "Warnings", parseResult.warnings, "No parsing warnings");
    } else {
        imIfElse(c);
        imStr(c, "No parse results yet");
    } imIfEnd(c);
}

// TODO: display these above the code editor itself. 
function imDiagnosticInfo(c: ImCache, heading: string, info: DiagnosticInfo[], emptyText: string) {
    if (imIf(c) && heading) {
        imEl(c, EL_H3); imStr(c, heading); imElEnd(c, EL_H3);
    } imIfEnd(c);

    imFor(c); for (const e of info) {
        imLayout(c, BLOCK); {
            imStrFmt(c, e.pos, textPositionToString);
            imStr(c, " - " + e.problem);
        } imLayoutEnd(c);
    } imForEnd(c);

    if (imIf(c) && info.length === 0) {
        imLayout(c, BLOCK); {
            imStr(c, emptyText);
        } imLayoutEnd(c);
    } imIfEnd(c);
}

function textPositionToString(pos: TextPosition): string {
    return "Line " + pos.line + "|Col " + pos.col + "+" + pos.tabs + "tabs" + "|idx " + pos.i;
}

export function imProgramResult(c: ImCache, res: ProgramResult) {
    imLayout(c, ROW); imGap(c, 5, PX); {
        const typeString = programResultTypeString(res)
        imStr(c, typeString + " ");

        imSwitch(c, res.t); switch (res.t) {
            case T_RESULT_NUMBER: {
                imLayout(c, INLINE); imCode(c); imStr(c, "" + res.val); imLayoutEnd(c);
            } break;
            case T_RESULT_STRING: {
                imLayout(c, COL); imGap(c, 5, PX); imPre(c); imCode(c); {
                    imStr(c, res.val);
                } imLayoutEnd(c);
            } break;
            case T_RESULT_LIST: {
                imLayout(c, BLOCK); imCode(c); {
                    imLayout(c, BLOCK); imCode(c, 1); imStr(c, "list["); imLayoutEnd(c);
                    imLayout(c, BLOCK); imCode(c, 1); {
                        imFor(c); for (let i = 0; i < res.values.length; i++) {
                            imProgramResult(c, res.values[i]);
                        } imForEnd(c);
                    } imLayoutEnd(c);
                    imLayout(c, BLOCK); imCode(c, 1); imStr(c, "]"); imLayoutEnd(c);
                } imLayoutEnd(c);
            } break;
            case T_RESULT_MAP: {
                imLayout(c, BLOCK); imCode(c, 0); {
                    imLayout(c, BLOCK); imCode(c, 1); imStr(c, "map{"); imLayoutEnd(c);
                    imLayout(c, BLOCK); imCode(c, 1); {
                        imFor(c); for (const [k, val] of res.map) {
                            imStr(c, k + "");
                            imProgramResult(c, val);
                        } imForEnd(c);
                    } imLayoutEnd(c);
                    imLayout(c, BLOCK); imCode(c, 1); imStr(c, "}"); imLayoutEnd(c);
                } imLayoutEnd(c);
            } break;
            case T_RESULT_MATRIX: {
                let idx = 0;
                const dfs = (dim: number, isLast: boolean) => {
                    if (dim === res.val.shape.length) {
                        const val = getSliceValue(res.val.values, idx);

                        // assuming everything renders in order, this is the only thing we need to do for this to work.
                        idx++;

                        imStr(c, "" + val);

                        if (imIf(c) && !isLast) {
                            imStr(c, ", ");
                        } imIfEnd(c);

                        return;
                    }

                    imLayout(c, BLOCK); imCode(c, dim === 0 ? 0 : 1); {
                        imLayout(c, BLOCK); imCode(c, 1); imStr(c, "["); imLayoutEnd(c);
                        const len = res.val.shape[dim];
                        imFor(c); for (let i = 0; i < len; i++) {
                            // This is because when the 'level' of the list changes, the depth itself changes,
                            // and the components we're rendering at a particular level will change. 
                            // We need to re-key the list, so that we may render a different kind of component at this position.
                            const key = (res.val.shape.length - dim) + "-" + i;
                            imKeyedBegin(c, key); {
                                dfs(dim + 1, i === len - 1);
                            } imKeyedEnd(c);
                        } imForEnd(c);
                        imLayout(c, BLOCK); imCode(c, 1); imStr(c, "]"); imLayoutEnd(c);
                    } imLayoutEnd(c);
                }
                dfs(0, false);
            } break;
            case T_RESULT_RANGE: {
                imLayout(c, INLINE); imCode(c); {
                    imStr(c, "" + res.val.lo);
                    imStr(c, " -> ");
                    imStr(c, "" + res.val.hi);
                } imLayoutEnd(c);
            } break;
            case T_RESULT_FN: {
                imLayout(c, INLINE); imCode(c); {
                    imStr(c, res.expr.fnName.name);
                } imLayoutEnd(c);
            } break;
            default:
                throw new Error("Unhandled result type: " + programResultTypeString(res));
        } imSwitchEnd(c);
    } imLayoutEnd(c);
}

function imExecutionStep(c: ImCache, step: ProgramExecutionStep) {
    imStrFmt(c, step, executionStepToString);
}

export function imFunctionInstructions(
    c: ImCache,
    interpretResult: ProgramInterpretResult,
    { steps }: ExecutionSteps
) {
    const sc = imState(c, newScrollContainer);

    const scrollContainer = imScrollContainerBegin(c, sc); {
        let rCurrent: HTMLElement | undefined;

        imLayout(c, BLOCK); imCode(c); {
            if (imIf(c) && steps.length > 0) {
                imFor(c); for (let i = 0; i < steps.length; i++) {
                    const step = steps[i];

                    const call = getCurrentCallstack(interpretResult);
                    const isCurrent = call?.code?.steps === steps
                        && i === call.i;

                    const currentStepDiv = imLayout(c, BLOCK); {
                        imStr(c, i + " | ");

                        imExecutionStep(c, step);

                        if (imIf(c) && isCurrent) {
                            imStr(c, " <----");
                        } imIfEnd(c);
                    } imLayoutEnd(c);

                    if (isCurrent) {
                        rCurrent = currentStepDiv;
                    }
                } imForEnd(c);
            } else {
                imIfEnd(c);
                imLayout(c, BLOCK); {
                    imStr(c, "no instructions present");
                } imLayoutEnd(c);
            } imIfEnd(c);
        } imLayoutEnd(c);

        if (rCurrent) {
            scrollIntoViewVH(scrollContainer, rCurrent, 0.5);
        }
    } imLayoutEnd(c);
}

export function getFunctionName(fn: ProgramResultFunction | null) {
    let name;

    if (!fn) {
        name = "Entry point";
    } else {
        name = fn.code.name + "("
            + fn.args.map(a =>a.name).join(", ")
            + ")";
    }

    return name;
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
    c: ImCache,
    ctx: GlobalContext,
    program: ProgramInterpretResult, 
    s: ProgramOutputState,
    result: ProgramPrintOutput,
) {
    const programText = program.parseResult.text;
    const root = imLayout(c, ROW); imGap(c, 5, PX); {
        if (canScrollToThing(ctx, s, result.expr)) {
            s.outputToScrollTo = root;
        }

        imLine(c, LINE_VERTICAL, 1);

        imLayout(c, BLOCK); imCode(c); {
            imStr(
                c,
                expressionToString(programText, result.expr)
            )
        } imLayoutEnd(c);

        imLayout(c, BLOCK); imFlex(c); {
            imProgramResult(c, result.val);
        } imLayoutEnd(c);
    } imLayoutEnd(c);
}

export function imProgramOutputs(
    c: ImCache,
    ctx: GlobalContext, 
    program: ProgramInterpretResult, 
    outputs: ProgramOutputs,
    scrollContainer?: HTMLElement,
) {
    const s = imState(c, newProgramOutputsState);
    s.outputToScrollTo = undefined;
    const programText = program.parseResult.text;

    imLayout(c, BLOCK); imSize(c, 0, NA, 5, PX); imLayoutEnd(c);

    imLayout(c, COL); imGap(c, 5, PX); {
        if (imIf(c) && ctx.state.showGroupedOutput) {
            imFor(c); for (const [step, prints] of outputs.printsGroupedByStep) {
                let localState; localState = imGet(c, inlineTypeId(imProgramOutputs));
                if (!localState) localState = imSet(c, { open: false });

                imLayout(c, COL); imFlex(c); {
                    imLayout(c, ROW); imFlex(c); {
                        imLayout(c, BLOCK); {
                            imStr(c, expressionToString(programText, step.expr));
                        } imLayoutEnd(c);

                        imLayout(c, BLOCK); imFlex(c); imLayoutEnd(c);

                        imLayout(c, BLOCK); imButton(c); {
                            imStr(c, "(" + prints.length + ")");
                            if (elHasMousePress(c)) {
                                localState.open = !localState.open;
                            }
                        } imLayoutEnd(c);
                    } imLayoutEnd(c);

                    if (imIf(c) && localState.open) {
                        imLayout(c, BLOCK); {
                            imFor(c); for (const result of prints) {
                                imProgramResult(c, result.val);
                            } imForEnd(c);
                        } imLayoutEnd(c);
                    } imIfEnd(c);
                } imLayoutEnd(c);
            } imForEnd(c);
        } else {
            imIfElse(c);

            imFor(c); for (const result of outputs.prints) {
                if (!result.visible) continue;
                imProgramPrintOutput(c, ctx, program, s, result);
            } imForEnd(c);
        } imIfEnd(c);
    } imLayoutEnd(c);
    imLayout(c, COL); imGap(c, 5, PX); {
        imFor(c); for (const [idx, graph] of outputs.graphs) {
            const root = imLayout(c, COL); imGap(c, 5, PX); {
                if (canScrollToThing(ctx, s, graph.expr)) {
                    s.outputToScrollTo = root;
                }

                imEl(c, EL_H3); imStr(c, "Graph #" + idx); imElEnd(c, EL_H3);
            } imIfEnd(c);

            imLayout(c, ROW); imGap(c, 5, PX); {
                imLine(c, LINE_VERTICAL);

                imLayout(c, COL); imGap(c, 5, PX); imFlex(c); {
                    imLayout(c, BLOCK); imCode(c); imCode(c); {
                        imStr(
                            c,
                            expressionToString(programText, graph.expr)
                        )
                    } imLayoutEnd(c);

                    imMaximizeableContainerBegin(c, graph); {
                        imLayout(c, COL); imBg(c, cssVars.bg); imGap(c, 5, PX); {
                            imLayout(c, ROW); imGap(c, 5, PX); {
                                imMaximizeItemButton(c, ctx, graph);
                            } imLayoutEnd(c);

                            imLayout(c, COL); imAspectRatio(c, window.innerWidth, window.innerHeight); {
                                imGraph(c, ctx, graph);
                            } imLayoutEnd(c);
                        } imLayoutEnd(c);
                    } imMaximizeableContainerEnd(c);
                } imLayoutEnd(c);
            } imLayoutEnd(c);
        }; imForEnd(c);
    } imLayoutEnd(c);
    imFor(c); for (const image of outputs.images) {
        const root = imLayout(c, ROW); imGap(c, 5, PX); {
            if (canScrollToThing(ctx, s, image.expr)) {
                s.outputToScrollTo = root;
            }

            imLine(c, LINE_VERTICAL, 1);

            imLayout(c, COL); imFlex(c); imGap(c, 5, PX); {
                imLayout(c, BLOCK); imCode(c); {
                    if (isFirstishRender(c)) {
                        elSetStyle(c, "textOverflow", "ellipsis");
                        elSetStyle(c, "whiteSpace", "nowrap");
                        elSetStyle(c, "overflow", "hidden");
                    }

                    imStr(
                        c, 
                        expressionToString(programText, image.expr)
                    );
                } imLayoutEnd(c);

                imImageOutput(c, ctx, image);
            } imLayoutEnd(c);
        } imLayoutEnd(c);
    }; imForEnd(c);
    if (imIf(c) && outputs.plots.size > 0) {
        imFor(c); for (const plot of outputs.plotsInOrder) {
            const root = imLayout(c, COL); imGap(c, 5, PX); {
                for (const line of plot.lines) {
                    if (canScrollToThing(ctx, s, line.expr)) {
                        s.outputToScrollTo = root;
                    }
                }
                for (const func of plot.functions) {
                    if (canScrollToThing(ctx, s, func.expr)) {
                        s.outputToScrollTo = root;
                    }
                }

                imLayout(c, COL); imGap(c, 5, PX); {
                    imEl(c, EL_H3); imStr(c, "Plot #" + plot.idx); imElEnd(c, EL_H3);
                } imLayoutEnd(c); 

                let exprFrequencies; exprFrequencies = imGet(c, inlineTypeId(Map));
                if (!exprFrequencies) exprFrequencies = imSet(c, new Map<ProgramExpression, number>());

                const outputsChanged = imMemo(c, outputs);
                if (outputsChanged) {
                    exprFrequencies.clear();
                    for (const line of plot.lines) {
                        const count = exprFrequencies.get(line.expr) ?? 0;
                        exprFrequencies.set(line.expr, count + 1);
                    }
                } 

                imFor(c); for (const [expr, count] of exprFrequencies) {
                    imLayout(c, ROW); imGap(c, 5, PX); {
                        imStr(c, count + "x: ");
                        imLayout(c, INLINE); imCode(c); {
                            imStr(c, expressionToString(programText, expr));
                        } imLayoutEnd(c); 
                    } imLayoutEnd(c); 
                } imForEnd(c);

                imLayout(c, COL); imAspectRatio(c, window.innerWidth, window.innerHeight); {
                    imPlot(c, ctx, plot, program);
                } imLayoutEnd(c); 
            } imLayoutEnd(c); 
        } imForEnd(c);
    } imIfEnd(c);

    const scrollContainerChanged  = imMemo(c, scrollContainer);
    const outputToScrollToChanged = imMemo(c, s.outputToScrollTo);
    if (scrollContainerChanged || outputToScrollToChanged) {
        if (scrollContainer && s.outputToScrollTo) {
            scrollIntoViewVH(scrollContainer, s.outputToScrollTo, 0.5);
        }
    } 
}

function imImageOutput(c: ImCache, ctx: GlobalContext, image: ProgramImageOutput) {
    imMaximizeableContainerBegin(c, image); {
        imLayout(c, COL); imBg(c, cssVars.bg); imGap(c, 5, PX); {
            imLayout(c, ROW); imGap(c, 5, PX); {
                imMaximizeItemButton(c, ctx, image);
            } imLayoutEnd(c);

            imLayout(c, BLOCK); imFlex(c); imRelative(c); {
                if (imIf(c) && image.width !== 0) {
                    const plotState = imState(c, newPlotState);

                    imLayout(c, COL); imAspectRatio(c, window.innerWidth, window.innerHeight); {
                        const [, canvas, width, height, dpi] = imBeginCanvasRenderingContext2D(c); {
                            imPlotZoomingAndPanning(
                                c, 
                                plotState,
                                width,
                                height,
                                dpi,
                                ctx.input.keyboard.shiftHeld
                            );

                            const pixelSize = 10;

                            const imageChanged = imMemo(c, image);
                            const plotStateChanged = imMemo(c, plotState.version);

                            if (imageChanged) {
                                const minX = 0,
                                    minY = 0,
                                    maxX = image.width * pixelSize,
                                    maxY = image.height * pixelSize;

                                recomputePlotExtent(plotState, minX, maxX, minY, maxY);
                            }

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
                        } imEndCanvasRenderingContext2D(c);
                    } imLayoutEnd(c);
                } else {
                    imIfElse(c);
                    imLayout(c, COL); imAlign(c); imJustify(c); {
                        imStr(c, "Value was empty");
                    } imLayoutEnd(c);
                } imIfEnd(c);
            } imLayoutEnd(c);
        } imLayoutEnd(c);
    } imMaximizeableContainerEnd(c);
}

function imPlotZoomingAndPanning(
    c: ImCache,
    plot: PlotState,
    width: number,
    height: number,
    dpi: number,
    shiftHeld: boolean
) {
    let mutated = false;

    const isMaximized = plot === currentMaximizedItem;
    const canZoom = elHasMouseOver(c) && (shiftHeld || isMaximized);
    if (plot.canZoom !== canZoom) {
        plot.canZoom = canZoom;
        mutated = true;
    }

    if (isFirstishRender(c)) {
        elSetStyle(c, "cursor", "move");
    }

    if (plot.width !== width || plot.height !== height || plot.dpi !== dpi) {
        plot.width = width;
        plot.height = height;
        plot.dpi = dpi;
        mutated = true;
    }

    const { mouse } = getGlobalEventSystem();

    if (mouse.leftMouseButton && elHasMouseOver(c)) {
        plot.isPanning = true;
        mutated = true;
    } else if (!mouse.leftMouseButton) {
        plot.isPanning = false;
        mutated = true;
    }

    if (plot.isPanning) {
        const dxPlot = getPlotLength(plot, screenToCanvas(plot, mouse.dX));
        const dyPlot = getPlotLength(plot, screenToCanvas(plot, mouse.dY));

        plot.posX -= dxPlot;
        plot.posY -= dyPlot;
        mutated = true;
    }

    const scrollBlocker = imPreventScrollEventPropagation(c);
    scrollBlocker.isBlocking = canZoom;
    if (plot.scrollY !== scrollBlocker.scrollY) {
        plot.scrollY = scrollBlocker.scrollY;
        mutated = true;
    }

    if (canZoom) {
        const scrollY = screenToCanvas(plot, scrollBlocker.scrollY);
        if (scrollY !== 0) {
            // When we zoom in or out, we want the graph-point that the mouse is currently over
            // to remain the same.

            const rect = elGet(c).getBoundingClientRect();

            const mouseX = screenToCanvas(plot, mouse.X - rect.left);
            const mouseY = screenToCanvas(plot, mouse.Y - rect.top);
            const mouseXPlot = getPlotX(plot, mouseX);
            const mouseYPlot = getPlotY(plot, mouseY);

            let newZoom = plot.zoom;
            if (scrollY < 0) {
                newZoom = plot.zoom * 1.1 * (-scrollY / 100);
            } else {
                newZoom = plot.zoom / (1.1 * (scrollY / 100));
            }
            newZoom = clamp(newZoom, 0.5, 10000000);

            if (newZoom !== plot.zoom) {
                plot.zoom = newZoom;
                mutated = true;
            }

            const newMouseX = getCanvasElementX(plot, mouseXPlot);
            const newMouseY = getCanvasElementY(plot, mouseYPlot);

            const mouseDX = newMouseX - mouseX;
            const mouseDY = newMouseY - mouseY;

            const dX = getPlotLength(plot, mouseDX);
            const dY = getPlotLength(plot, mouseDY);
            if (Math.abs(dX) + Math.abs(dY) > 0) {
                plot.posX += dX;
                plot.posY += dY;
                mutated = true;
            }
        }
    }

    if (mutated) {
        plot.version++;
    }
}


function imGraph(c: ImCache, ctx: GlobalContext, graph: ProgramGraphOutput) {
    const plotState = imState(c, newPlotState);

    let s; s = imGet(c, inlineTypeId(imGraph));
    if (!s) s = imSet(c, {
        nodeData: new Map<string | number, {
            position: { x: number, y: number };
            adjacencies: (string | number)[];
        }>(),
    });

    const graphChanged = imMemo(c, graph);
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

    imLayout(c, BLOCK); imFlex(c); imRelative(c); imSize(c, 0, NA, 100, PERCENT); {
        const [_, canvas, width, height, dpi] = imBeginCanvasRenderingContext2D(c); {
            imPlotZoomingAndPanning(c, plotState, width, height, dpi, ctx.input.keyboard.shiftHeld);

            const widthChanged     = imMemo(c, width);
            const heightChanged    = imMemo(c, height);
            const graphChanged     = imMemo(c, graph);
            const plotStateChanged = imMemo(c, plotState.version);

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
        } imEndCanvasRenderingContext2D(c);
    } imLayoutEnd(c);
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
    // bump this whenever you mutate
    version: number;
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
        version: 0,
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

type ImCanvasRenderingContext = [
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    dpi: number
];

function imBeginCanvasRenderingContext2D(c: ImCache): ImCanvasRenderingContext {
    // When I set the canvas to the size of it's offset width, this in turn
    // causes the parent to get larger, which causes the canvas to get larger, and so on.
    // This relative -> absolute pattern is being used here to fix this.

    imLayout(c, BLOCK); imRelative(c); imSize(c, 100, PERCENT, 100, PERCENT);
    const { size } = imTrackSize(c);

    const canvas = imEl(c, EL_CANVAS).root;

    let ctx = imGet(c, imBeginCanvasRenderingContext2D);
    if (!ctx) {
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 2d isn't supported by your browser!!! I'd suggest _not_ plotting anything.");
        }

        elSetStyle(c, "position", "absolute");
        elSetStyle(c, "top", "0");
        elSetStyle(c, "left", "0");

        ctx = imSet(c, [canvas, context, 0, 0, 0]);
    }

    const w = size.width;
    const h = size.height;
    // const sf = window.devicePixelRatio ?? 1;
    const dpi = 2; // TODO: revert
    const wC   = imMemo(c, w);
    const hC   = imMemo(c, h);
    const dpiC = imMemo(c, dpi);
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

function imEndCanvasRenderingContext2D(c: ImCache) {
    imElEnd(c, EL_CANVAS);
    imLayoutEnd(c);
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

function imMaximizeableContainerBegin(c: ImCache, item: object) {
    const isMaximized = item === currentMaximizedItem;
    const unit = isMaximized ? PX : NA;

    // NOTE: A shortcoming of our styling system now, is that we can't conditionally call these. sad. 
    // TODO: fix.
    imLayout(c, COL); imGap(c, 5, PX); imFlex(c); imJustify(c); 
    imBg(c, isMaximized ? cssVars.translucent : "");
    imFixed(c, 0, unit, 0, unit, 0, unit, 0, unit); 
    imPadding(c, 10, unit, 10, unit, 10, unit, 10, unit); {

    } // imLayoutEnd(c);
}

function imMaximizeableContainerEnd(c: ImCache) {
    imLayoutEnd(c);
}

function imMaximizeItemButton(c: ImCache, ctx: GlobalContext, item: object) {
    const isMaximized = currentMaximizedItem === item;

    if (imButtonIsClicked(c, isMaximized ? "minimize" : "maximize")) {
        if (isMaximized) {
            currentMaximizedItem = null;
        } else {
            currentMaximizedItem = item;
        }
    }

    if (ctx.input.keyboard.escape) {
        currentMaximizedItem = null;
    }
}


function imPlot(c: ImCache, ctx: GlobalContext, plot: ProgramPlotOutput, program: ProgramInterpretResult) {
    const isMaximized = plot === currentMaximizedItem;
    const plotState = imState(c, newPlotState);
    plotState.maximized = isMaximized;

    imMaximizeableContainerBegin(c, plot); {
        imLayout(c, COL); imBg(c, cssVars.bg); imFlex(c); imGap(c, 5, PX); {
            imLayout(c, ROW); imGap(c, 5, PX); {
                imMaximizeItemButton(c, ctx, plot);

                if (imButtonIsClicked(c, "Overlays", plotState.overlay)) {
                    plotState.overlay = !plotState.overlay;
                }

                if (imButtonIsClicked(c, "Autofit", plotState.autofit)) {
                    plotState.autofit = !plotState.autofit;
                }
            } imLayoutEnd(c);

            let state; state = imGet(c, inlineTypeId(imGet));
            if (!state) state = imSet(c, {
                shiftScrollToZoom: 0,
                problems: [] as string[],
                rows: [] as number[][],
            }); 

            imLayout(c, COL); imFlex(c); imRelative(c); {
                const [_, canvas, width, height, dpi] = imBeginCanvasRenderingContext2D(c); {
                    const mouse = getGlobalEventSystem().mouse;

                    // init canvas 
                    imPlotZoomingAndPanning(
                        c, 
                        plotState,
                        width,
                        height,
                        dpi,
                        ctx.input.keyboard.shiftHeld
                    );

                    if (elHasMouseOver(c) && (mouse.scrollWheel !== 0 && !plotState.canZoom)) {
                        state.shiftScrollToZoom = 1;
                    }

                    const programChanged = imMemo(c, program);
                    const autoFitChanged = imMemo(c, plotState.autofit);
                    const runChanged = programChanged || autoFitChanged;
                    const textChanged = imMemo(c, program.parseResult.text);
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

                    const plotChanged = imMemo(c, plot);
                    const plotStateChanged = imMemo(c, plotState.version);
                    if (plotChanged || plotStateChanged) {
                        state.problems.length = 0;

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
                                    state.problems.push("Can't render heatmaps while we're debugging - the program stack is still in use. ");
                                    break;
                                }

                                state.rows.length = 0

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
                                            state.problems.push("result for " + i + ", " + j + " didn't return anything");
                                            break outer;
                                        }
                                        if (program.errors.length > 0) {
                                            // TODO: display the error
                                            state.problems.push("Encountered an error in the program");
                                            break outer;
                                        }
                                        if (result.t !== T_RESULT_NUMBER) {
                                            state.problems.push("result for " + i + ", " + j + " wasn't a number");
                                            break outer;
                                        }

                                        const res = result.val;
                                        row[j] = res;

                                        minValue = min(minValue, res);
                                        maxValue = max(maxValue, res);
                                    }

                                    state.rows.push(row);
                                }

                                if (state.problems.length === 0) {
                                    const theme = getCurrentTheme();
                                    const color = output.color ?? theme.fg;

                                    for (let i = 0; i < n; i++) {
                                        for (let j = 0; j < n; j++) {
                                            const val = state.rows[i][j];
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
                } imEndCanvasRenderingContext2D(c);

                if (state.shiftScrollToZoom !== null) {
                    const dt = getDeltaTimeSeconds(c);
                    state.shiftScrollToZoom -= dt;
                    if (state.shiftScrollToZoom < 0) {
                        state.shiftScrollToZoom = -1;
                    }
                }

                imLayout(c, BLOCK); imAbsolute(c, 5, PX, 0, PX, 0, NA, 0, PX); {
                    if (isFirstishRender(c)) {
                        elSetStyle(c, "zIndex", "1000");
                    }

                    if (imMemo(c, state.shiftScrollToZoom)) {
                        elSetStyle(c, "opacity", (state.shiftScrollToZoom ?? 0) + "");
                    } 
                    imStr(c, "Shift + scroll to zoom");
                } imLayoutEnd(c);

                imFor(c); for (const prob of state.problems) {
                    imLayout(c, BLOCK); {
                        imStr(c, "Problem: " + prob);
                    } imLayoutEnd(c);
                } imForEnd(c);
            } imLayoutEnd(c);
        } imLayoutEnd(c);
    } imMaximizeableContainerEnd(c);
}
