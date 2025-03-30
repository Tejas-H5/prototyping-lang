import { CssColor, newColor, newColorFromHexOrUndefined } from "src/utils/colour";
import { assert } from "src/utils/im-dom-utils";
import { copyMatrix, getMatrixRow, getMatrixRowLength, getMatrixValue, getSliceValue, isIndexInSliceBounds, Matrix, matrixAddElements, matrixDivideElements, matrixElementsEqual, matrixElementsGreaterThan, matrixElementsGreaterThanOrEqual, matrixElementsLessThan, matrixElementsLessThanOrEqual, matrixIsRank2, matrixLogicalAndElements, matrixLogicalOrElements, matrixMul, matrixMultiplyElements, matrixShapesAreEqual, matrixSubtractElements, matrixZeroes, newSlice, orthographicMatrix3D, perspectiveMatrix3D, rotationMatrix2D, rotationMatrix3DX, rotationMatrix3DY, rotationMatrix3DZ, rotationMatrixTranslate2D, rotationMatrixTranslate3D, scaleMatrix2D, scaleMatrix3D, setSliceValue, sliceToArray, subMatrixShapeEqualsRowShape, transposeMatrix } from "src/utils/matrix-math";
import {
    BIN_OP_ADD, BIN_OP_AND_AND, BIN_OP_DIVIDE, BIN_OP_GREATER_THAN, BIN_OP_GREATER_THAN_EQ, BIN_OP_INVALID, BIN_OP_IS_EQUAL_TO, BIN_OP_LESS_THAN, BIN_OP_LESS_THAN_EQ, BIN_OP_MULTIPLY, BIN_OP_OR_OR, BIN_OP_SUBTRACT,
    BinaryOperatorType,
    binOpToOpString,
    binOpToString,
    DiagnosticInfo,
    expressionTypeToString,
    ProgramExpression,
    ProgramExpressionFn,
    ProgramExpressionIdentifier,
    ProgramParseResult,
    T_ASSIGNMENT, T_BINARY_OP, T_BLOCK, T_DATA_INDEX_OP, T_FN, T_IDENTIFIER, T_IDENTIFIER_THE_RESULT_FROM_ABOVE, T_LIST_LITERAL, T_NUMBER_LITERAL, T_RANGE_FOR, T_STRING_LITERAL, T_TERNARY_IF, T_UNARY_OP, T_VECTOR_LITERAL, T_MAP_LITERAL,
    TextPosition,
    UNARY_OP_NOT,
    UNARY_OP_PRINT,
    UnaryOperatorType,
    unaryOpToOpString,
    unaryOpToString
} from "./program-parser";
import { clamp, inverseLerp } from "./utils/math-utils";
import { getNextRng, newRandomNumberGenerator, RandomNumberGenerator, seedRng } from "./utils/random";

export const T_RESULT_NUMBER = 1;
export const T_RESULT_STRING = 2;
export const T_RESULT_LIST = 3;
export const T_RESULT_MATRIX = 4;
export const T_RESULT_RANGE = 5;
export const T_RESULT_FN = 6;
export const T_RESULT_MAP = 7;

export type ProgramResultNumber = {
    t: typeof T_RESULT_NUMBER;
    val: number;
}

export type ProgramResultRange = {
    t: typeof T_RESULT_RANGE;
    val: NumberRange;
}

export type ProgramResultString = {
    t: typeof T_RESULT_STRING;
    val: string;
}

export type ProgramResultMatrix = {
    t: typeof T_RESULT_MATRIX;
    val: Matrix;
}

export type ProgramResultFunction = {
    t: typeof T_RESULT_FN;
    expr: ProgramExpressionFn;
    code: ExecutionSteps;
    args: ProgramExpressionIdentifier[];
};


export type ProgramResultList = {
    t: typeof T_RESULT_LIST;
    values: ProgramResult[];
}

export type ProgramResultMap = {
    t: typeof T_RESULT_MAP;
    map: Map<string | number, ProgramResult>;
}

export type ProgramResult = ProgramResultNumber
    | ProgramResultRange
    | ProgramResultString
    | ProgramResultList
    | ProgramResultMap
    | ProgramResultMatrix
    | ProgramResultFunction;

export function programResultTypeString(output: ProgramResult): string {
    switch (output.t) {
        case T_RESULT_MATRIX: {
            return getMatrixTypeFromShape(output.val.shape);
        }
    }

    return programResultTypeStringFromType(output.t);
}

export function getMatrixTypeFromShape(shape: number[]): string {
    return shape.length === 1 ? `Vector${shape[0]}` : (
        `Matrix${shape.map(s => "" + s).join("x")}`
    );
}

export function programResultTypeStringFromType(t: ProgramResult["t"]): string {
    switch (t) {
        case T_RESULT_NUMBER:
            return "Number";
        case T_RESULT_RANGE:
            return "Range";
        case T_RESULT_STRING:
            return "String";
        case T_RESULT_LIST:
            return "List";
        case T_RESULT_MAP:
            return "Map";
        case T_RESULT_MATRIX: {
            return "Matrix";
        }
        case T_RESULT_FN:
            return `Function`;
    }
}

// NOTE: this range needs to be exclusive, because lo is not necessarily < hi, 
// so we can't represent a zero-length range otherwise
type NumberRange = {
    lo: number;
    hi: number;
};

function evaluateBinaryOpNumberXNumber(
    l: ProgramResultNumber,
    r: ProgramResultNumber,
    op: BinaryOperatorType,
): ProgramResultNumber | ProgramResultRange | null {
    let num: number | undefined;
    let range: NumberRange | undefined;

    switch (op) {
        case BIN_OP_MULTIPLY: num = l.val * r.val; break;
        case BIN_OP_DIVIDE: num = r.val / l.val; break;
        case BIN_OP_ADD: num = r.val + l.val; break;
        case BIN_OP_SUBTRACT: num = r.val - l.val; break;
        case BIN_OP_IS_EQUAL_TO: num = (r.val === l.val) ? 1 : 0; break;
        case BIN_OP_LESS_THAN: num = (r.val < l.val) ? 1 : 0; break;
        case BIN_OP_LESS_THAN_EQ: num = (r.val <= l.val) ? 1 : 0; break;
        case BIN_OP_GREATER_THAN: num = (r.val > l.val) ? 1 : 0; break;
        case BIN_OP_GREATER_THAN_EQ: num = (r.val >= l.val) ? 1 : 0; break;
        case BIN_OP_AND_AND: num = (r.val && l.val) ? 1 : 0; break;
        case BIN_OP_OR_OR: num = (r.val || l.val) ? 1 : 0; break;
        case BIN_OP_INVALID:
            // An invalid binary op was parsed, and added to the result tree somehow
            assert(false)
    }

    let result: ProgramResultNumber | ProgramResultRange | null = null;

    if (num !== undefined) {
        result = { t: T_RESULT_NUMBER, val: num };
    } else if (range) {
        result = { t: T_RESULT_RANGE, val: range };
    }

    return result;
}

function evaluateBinaryOpMatrixXMatrix(
    l: ProgramResultMatrix,
    r: ProgramResultMatrix,
    op: BinaryOperatorType,
): [ProgramResultNumber | ProgramResultMatrix | null, string] {

    let isBool = false;
    let bool = false;
    let val: Matrix | null = null;
    let err: string;

    switch (op) {
        case BIN_OP_MULTIPLY:
            [val, err] = matrixMultiplyElements(l.val, r.val);
            break;
        case BIN_OP_DIVIDE:
            [val, err] = matrixDivideElements(l.val, r.val);
            break;
        case BIN_OP_ADD:
            [val, err] = matrixAddElements(l.val, r.val);
            break;
        case BIN_OP_SUBTRACT:
            [val, err] = matrixSubtractElements(l.val, r.val);
            break;
        case BIN_OP_IS_EQUAL_TO:
            isBool = true;
            [bool, err] = matrixElementsEqual(l.val, r.val);
            break;
        case BIN_OP_LESS_THAN:
            isBool = true;
            [bool, err] = matrixElementsLessThan(l.val, r.val);
            break;
        case BIN_OP_LESS_THAN_EQ:
            isBool = true;
            [bool, err] = matrixElementsLessThanOrEqual(l.val, r.val);
            break;
        case BIN_OP_GREATER_THAN:
            isBool = true;
            [bool, err] = matrixElementsGreaterThan(l.val, r.val);
            break;
        case BIN_OP_GREATER_THAN_EQ:
            isBool = true;
            [bool, err] = matrixElementsGreaterThanOrEqual(l.val, r.val);
            break;
        case BIN_OP_AND_AND:
            [val, err] = matrixLogicalAndElements(l.val, r.val);
            break;
        case BIN_OP_OR_OR:
            [val, err] = matrixLogicalOrElements(l.val, r.val);
            break;
        case BIN_OP_INVALID:
            // An invalid binary op was parsed, and added to the result tree somehow
            assert(false)
    }

    if (isBool) {
        return [newNumberResult(bool ? 1 : 0), ""];
    }

    if (val) {
        return [{ t: T_RESULT_MATRIX, val }, ""];
    }

    if (err) {
        return [null, err];
    }

    return [null, ""];
}

function evaluateBinaryOpNumberXMatrix(
    l: ProgramResultNumber,
    r: ProgramResultMatrix,
    numWasLhs: boolean,
    op: BinaryOperatorType,
): ProgramResultMatrix | null {

    const num = l.val;
    const rCopy = copyMatrix(r.val);

    switch (op) {
        case BIN_OP_MULTIPLY: {
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x * num);
            }
        } break;
        case BIN_OP_DIVIDE: {
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x / num);
            }
        } break;
        case BIN_OP_ADD: {
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x * num);
            }
        } break;
        case BIN_OP_SUBTRACT:
            if (numWasLhs) {
                // NOTE: this case is just copy-paste
                for (let i = 0; i < rCopy.values.length; i++) {
                    const x = getSliceValue(rCopy.values, i);
                    setSliceValue(rCopy.values, i, num - x);
                }
            } else {
                // NOTE: this case is just copy-paste
                for (let i = 0; i < rCopy.values.length; i++) {
                    const x = getSliceValue(rCopy.values, i);
                    setSliceValue(rCopy.values, i, x - num);
                }
            }
            break;
        case BIN_OP_IS_EQUAL_TO:
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x === num ? 1 : 0);
            }
            break;
        case BIN_OP_LESS_THAN: {
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x < num ? 1 : 0);
            }
        } break;
        case BIN_OP_LESS_THAN_EQ: {
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x <= num ? 1 : 0);
            }
        } break;
        case BIN_OP_GREATER_THAN:
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x > num ? 1 : 0);
            }
            break;
        case BIN_OP_GREATER_THAN_EQ:
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x >= num ? 1 : 0);
            }
            break;
        case BIN_OP_AND_AND: {
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x && num ? 1 : 0);
            }
        } break;
        case BIN_OP_OR_OR: {
            // NOTE: this case is just copy-paste
            for (let i = 0; i < rCopy.values.length; i++) {
                const x = getSliceValue(rCopy.values, i);
                setSliceValue(rCopy.values, i, x || num ? 1 : 0);
            }
        } break;
        case BIN_OP_INVALID:
            // An invalid binary op was parsed, and added to the result tree somehow
            assert(false)
    }

    return { t: T_RESULT_MATRIX, val: rCopy };
}

function evaluateBinaryOpNumberXList(
    l: ProgramResultNumber,
    r: ProgramResultList,
    numWasLhs: boolean,
    program: ProgramInterpretResult,
    step: ProgramExecutionStep,
): ProgramResultList | null {

    const result = Array(r.values.length);
    if (numWasLhs) {
        for (let i = 0; i < r.values.length; i++) {
            const ithResult = evaluateBinaryOperatorNumber(l, r.values[i], program, step);
            if (!ithResult) {
                return null;
            }

            result[i] = ithResult;
        }
    } else {
        for (let i = 0; i < r.values.length; i++) {
            const ithResult = evaluateBinaryOperatorNumber(r.values[i], l, program, step);
            if (!ithResult) {
                return null;
            }

            result[i] = ithResult;
        }
    }

    return { t: T_RESULT_LIST, values: result }
}

function evaluateUnaryOp(result: ProgramInterpretResult, step: ProgramExecutionStep, val: ProgramResult, op: UnaryOperatorType): [ProgramResult | null, string] {
    switch (op) {
        case UNARY_OP_NOT: {
            if (val.t === T_RESULT_NUMBER) {
                return [newNumberResult(val.val === 0 ? 1 : 0), ""];
            }
        } break;
        case UNARY_OP_PRINT: {
            printResult(result, step, step.expr, val);
            return [val, ""];
        }
    }

    return [null, ""];
}

// Trying a product type isntead of a sum-type, will let u know how I go.
// TODO: compress this type using the encoding pattern instead of booleans. It could be a LOT smaller.
export type ProgramExecutionStep = {
    // which code did we type to generate this thing?
    expr: ProgramExpression;

    // Loads a variable onto the stack
    // TODO: indices instead?
    load?: string;

    // loads the last block result onto the stack. complains if it doesn't exist.
    loadLastBlockResult?: boolean;

    // Loads the last computed value in this block onto the stack
    // NOTE: turns out this is a pain to implement, so I'm removing it for now till I get the stack working. then it should be easy to re-add
    // loadPrevious?: boolean;
    // NOTE: same with this. they are related.

    // did this top level statement just end?
    // yes if not undefined. true if it was a top-level statement.
    blockStatementEnd?: boolean;

    // Should we clear the current block statement?
    // (prevents leaking implementation details of for-loops)
    clearLastBlockResult?: boolean;

    // Pops the last stack value into the stack, assigns it to a variable, or indexing operation
    set?: string;
    // Pops the last two stack values, applies a binary operator to them
    binaryOperator?: BinaryOperatorType;
    // pops the last value, applies a unary operator
    unaryOperator?: UnaryOperatorType;
    // Pops the last n things off the stack and into a list
    list?: number;
    // Pops the last 2n kv pairs off the stack and into a map
    map?: number;
    // Pops the last n things off the stack and into a vector
    vector?: number;
    // Pushes this number to the stack
    number?: number;
    // pushes this string to the stack
    string?: string;
    // pushes a function to the stack
    fn?: ProgramResultFunction;
    // pushes a builtin function to the stack
    builtinFn?: BuiltinFunction;

    // jumps the current instruction index to the step specified
    jump?: number;

    // jumps the current instruction index to the step specified, if the last value is false.
    jumpIfFalse?: number;

    // increments the given variable by tha last thing on the stack.
    incr?: string;

    // pops several indexes, uses them to index into a datastructure
    index?: boolean;

    // pops the last three (matrx, index, value) and assigns matrix[index] = value;
    // the behaviour depends on the type of `value`. The op might fail if the matricies are the wrong size.
    // [1, 2, 3][0] = [2] -> [2, 2, 3]
    // [[1, 2, 3]][0] = [2, 2, 2] -> [[2, 2, 2]]
    indexAssignment?: boolean;

    // calls a user function with some number of args.
    call?: { fn: ProgramResultFunction; numArgs: number; };

    // calls a builtin function with some number of args.
    builtinCall?: { fn: BuiltinFunction; expr: ProgramExpressionFn; numArgs: number; };
};

export type ExecutionSteps = {
    name: string;
    steps: ProgramExecutionStep[];
}

export function executionStepToString(step: ProgramExecutionStep) {
    if (step.load !== undefined) {
        return ("Load " + step.load);
    }
    if (step.loadLastBlockResult !== undefined) {
        return "Load last block result";
    }
    if (step.blockStatementEnd !== undefined) {
        return step.blockStatementEnd ? "end block <top level>" : "end block";
    }
    if (step.clearLastBlockResult !== undefined) {
        return "Clear last block result";
    }
    if (step.set !== undefined) {
        return ("Set " + step.set);
    }
    if (step.binaryOperator !== undefined) {
        return ("Binary op: " + binOpToOpString(step.binaryOperator) + " (" + binOpToString(step.binaryOperator) + ")");
    }
    if (step.unaryOperator !== undefined) {
        return ("Unary op: " + unaryOpToOpString(step.unaryOperator) + " (" + unaryOpToString(step.unaryOperator) + ")");
    }
    if (step.list !== undefined) {
        return ("List " + step.list);
    }
    if (step.map !== undefined) {
        return ("Map " + step.map);
    }
    if (step.vector !== undefined) {
        return ("Vector " + step.vector);
    }
    if (step.number !== undefined) {
        return ("Number " + step.number);
    }
    if (step.string !== undefined) {
        return ("String " + step.string);
    }
    if (step.jump !== undefined) {
        return ("jump to idx=" + step.jump);
    }
    if (step.jumpIfFalse !== undefined) {
        return ("jump (if false) to idx=" + step.jumpIfFalse);
    }
    if (step.incr !== undefined) {
        return "increment " + step.incr;
    }
    if (step.index !== undefined) {
        return "index op";
    }
    if (step.call !== undefined) {
        const value = step.call;
        const fn = value.fn;
        const name = fn.expr.fnName.name;
        return ("Call " + name + "(" + value.numArgs + " args) ");
    }
    if (step.builtinCall !== undefined) {
        const value = step.builtinCall;
        const name = value.fn.name
        return ("[builtin] Call " + name + "(" + value.numArgs + " args) ");
    }
    if (step.fn) {
        return "User function: " + step.fn.expr.fnName.name;
    }

    return "Unhandled step";
}

function newExecutionStep(expr: ProgramExpression): ProgramExecutionStep {
    return { expr };
}


type ExecutionState = {
    code: ExecutionSteps;
    i: number;
    argsCount: number;
    fn: ProgramResultFunction | null;

    // TODO: replace with an array
    variables: Map<string, number>;
    returnAddress: number;
    nextVarAddress: number;
};

export type ProgramInterpretResult = {
    parseResult: ProgramParseResult;
    rng: RandomNumberGenerator;

    isDebugging: boolean;

    errors: DiagnosticInfo[];

    // Writing it like this instead should allow us to step through the program one step at a time,
    // so that we can see what's going on and fix bugs easier. 
    entryPoint: ExecutionSteps;

    // TODO: replace with array
    functions: Map<string, ProgramResultFunction>;

    // Not how a real program does it. But I dont care (but everythign else is 100% accurate, right?)
    stack: (ProgramResult | null)[];
    stackIdx: number;
    callStack: ExecutionState[];

    outputs: ProgramOutputs;
}

export type ProgramPrintOutput = {
    step: ProgramExecutionStep;
    expr: ProgramExpression;
    val: ProgramResult;
}

export type ProgramPlotOutputLine = {
    expr: ProgramExpression;
    pointsX: number[];
    pointsY: number[];
    color: CssColor | undefined;
    label: string | undefined;
    displayAsPoints: boolean;
}

export type ProgramImageOutput = {
    pixels: number[];
    // true -> pixels are [rgbrgbrgbrgb]
    // false -> pixels are [vvvvvvvv] (grayscale);
    rgb: boolean;
    width: number;
    height: number;
    step: ProgramExecutionStep;
    expr: ProgramExpression;
}

export type ProgramPlotOutput = {
    lines: ProgramPlotOutputLine[];
    functions: ProgramPlotOutputHeatmapFunction[];
}

export type ProgramGraphOutput = {
    expr: ProgramExpression;
    graph: Map<string | number, (string | number)[]>;
};

export type ProgramPlotOutputHeatmapFunction = {
    step: ProgramExecutionStep;
    fn: ProgramResultFunction;
    color: CssColor | undefined;
}

type ProgramUiInputBase = {
    name: string;
    fromThisRun: boolean;
};

export const UI_INPUT_SLIDER = 1;

export type ProgramUiInputSlider = ProgramUiInputBase & {
    t: typeof UI_INPUT_SLIDER;
    start: number;
    end: number;
    value: number;
    step: number | null;
}

export type ProgramUiInput = ProgramUiInputSlider;

export type ProgramOutputs = {
    prints: ProgramPrintOutput[];
    images: ProgramImageOutput[];
    graphs: Map<number, ProgramGraphOutput>;
    plots: Map<number, ProgramPlotOutput>;
    uiInputs: Map<string, ProgramUiInput>;
    heatmapSubdivisions: number;
};


const builtinNumberConstants = new Map<string, ProgramResultNumber>();
builtinNumberConstants.set("PI", newNumberResult(Math.PI))
builtinNumberConstants.set("E", newNumberResult(Math.E))

function getExecutionSteps(
    result: ProgramInterpretResult,
    statements: ProgramExpression[],
    steps: ProgramExecutionStep[],
    topLevel: boolean,
) {

    const addError = (expr: ProgramExpression, problem: string) => {
        result.errors.push({ pos: expr.pos, problem });
    }

    const incompleteExpressionError = (expr: ProgramExpression) => {
        addError(expr, "Found an incomplete expression");
    }

    // This method should never 'error', since only valid parse-trees should be generated.
    // it's return value indicates whether this was a no-op or not.
    const dfs = (expr: ProgramExpression): boolean => {
        if (result.errors.length > 0) {
            return false;
        }

        const step = newExecutionStep(expr);
        let alreadyPushed = false;
        let noOp = false;

        switch (expr.t) {
            case T_IDENTIFIER: {
                const numberConstant = builtinNumberConstants.get(expr.name);
                if (numberConstant) {
                    step.number = numberConstant.val;
                } else {
                    step.load = expr.name;
                }
            } break;
            case T_IDENTIFIER_THE_RESULT_FROM_ABOVE: {
                step.loadLastBlockResult = true;
            } break;
            case T_ASSIGNMENT: {
                if (!expr.rhs) {
                    incompleteExpressionError(expr);
                    return !noOp;
                }

                if (expr.lhs.t !== T_IDENTIFIER && expr.lhs.t !== T_DATA_INDEX_OP) {
                    addError(expr, "This expression currently cannot be assigned to");
                    return !noOp;
                }

                if (expr.lhs.t === T_DATA_INDEX_OP) {
                    noOp = true;

                    dfs(expr.lhs.lhs);

                    // Should have been checked at parse-time
                    assert(expr.lhs.indexes.length > 0);

                    // index into the matrix, except for the very last index. we'll need to actually assign to that one.
                    for (let i = 0 ; i < expr.lhs.indexes.length; i++) { 
                        const idxExpr = expr.lhs.indexes[i];
                        dfs(idxExpr);

                        if (i === expr.lhs.indexes.length - 1) {
                            dfs(expr.rhs);
                            steps.push({ expr, indexAssignment: true });
                        } else {
                            steps.push({ expr, index: true });
                        }
                    }
                } else if (expr.lhs.t === T_IDENTIFIER) {
                    dfs(expr.rhs);
                    step.set = expr.lhs.name;
                }
            } break;
            case T_BINARY_OP: {
                if (!expr.rhs) {
                    incompleteExpressionError(expr);
                    return !noOp;
                }

                dfs(expr.lhs);
                dfs(expr.rhs);
                step.binaryOperator = expr.op;
            } break;
            case T_UNARY_OP: {
                dfs(expr.expr);
                step.unaryOperator = expr.op;
            } break;
            case T_VECTOR_LITERAL:
            case T_LIST_LITERAL: {
                for (const item of expr.items) {
                    dfs(item);
                }
                if (expr.t === T_VECTOR_LITERAL) {
                    step.vector = expr.items.length;
                } else {
                    step.list = expr.items.length;
                }
            } break;
            case T_NUMBER_LITERAL: {
                step.number = expr.val;
            } break;
            case T_STRING_LITERAL: {
                step.string = expr.val;
            } break;
            case T_TERNARY_IF: {
                if (!expr.falseBranch) {
                    incompleteExpressionError(expr);
                    return !noOp;
                }

                alreadyPushed = true;
                noOp = true;

                dfs(expr.query);

                const stepJumpIfFalse = newExecutionStep(expr);
                steps.push(stepJumpIfFalse);

                dfs(expr.trueBranch);

                const jumpToEnd = newExecutionStep(expr);
                steps.push(jumpToEnd);

                const falseStartIdx = steps.length;
                stepJumpIfFalse.jumpIfFalse = falseStartIdx;

                dfs(expr.falseBranch);

                const endIdx = steps.length;
                jumpToEnd.jump = endIdx;
            } break;
            case T_BLOCK: {
                noOp = true;
                for (const s of expr.statements) {
                    if (dfs(s)) {
                        steps.push({ expr: s, blockStatementEnd: false });
                    }
                }
            } break;
            case T_RANGE_FOR: {
                alreadyPushed = true;
                noOp = true;

                // NOTE: we actually can't generate the correct instructions (in a simple manner)
                // if we don't know whether the range expression is looping upwards or downards, so 
                // I'll have to introduce two new operators that range upwards and downards...

                const rangeExpr = expr.rangeExpr;
                if (
                    rangeExpr.t !== T_FN
                    || (rangeExpr.fnName.name !== "range" && rangeExpr.fnName.name !== "rrange")
                ) {
                    addError(expr, "Currently, only range or rrange (reverse range) can be used as arguments to a ranged for-loop");
                    return false;
                }

                if (rangeExpr.arguments.length !== 2 && rangeExpr.arguments.length !== 3) {
                    addError(expr, "range or rrange expect 2 (start, end) or 3 (start, end, step) arguments");
                    return false;
                }

                const ascending = rangeExpr.fnName.name === "range";
                const loExpr = rangeExpr.arguments[0];
                const hiExpr = rangeExpr.arguments[1];

                const stepExpr: ProgramExpression | undefined = rangeExpr.arguments[2];

                dfs(loExpr);
                steps.push({ expr, set: expr.loopVar.name });

                const loopStartIdx = steps.length;

                steps.push({ expr, load: expr.loopVar.name });
                dfs(hiExpr);
                if (ascending) {
                    steps.push({ expr, binaryOperator: BIN_OP_LESS_THAN });
                } else {
                    steps.push({ expr, binaryOperator: BIN_OP_GREATER_THAN });
                }

                const jumpToLoopEndIfFalse = newExecutionStep(expr);
                steps.push(jumpToLoopEndIfFalse);

                steps.push({ expr, clearLastBlockResult: true });

                dfs(expr.body);


                if (stepExpr) {
                    dfs(stepExpr);
                } else {
                    if (ascending) {
                        steps.push({ expr, number: 1 });
                    } else {
                        steps.push({ expr, number: -1 });
                    }
                }

                steps.push({ expr, incr: expr.loopVar.name });

                steps.push({ expr, blockStatementEnd: true });

                steps.push({ expr, jump: loopStartIdx });

                const loopEndIdx = steps.length;
                jumpToLoopEndIfFalse.jumpIfFalse = loopEndIdx;
            } break;
            case T_FN: {
                if (expr.body) {
                    const fn = result.functions.get(expr.fnName.name);

                    // We've already pre-extracted and linearlized every function declaration,
                    // so it's got to exist.
                    assert(fn);

                    step.fn = fn;
                } else {
                    for (const arg of expr.arguments) {
                        dfs(arg);
                    }

                    const fn = result.functions.get(expr.fnName.name);
                    let isValid = false;
                    if (fn) {
                        // The errors are worse if we report 'too few arguments'. I'd rather see which type I was supposed to input, even though I
                        // haven't input all the args.
                        // We might want to bring it back if we add static types.
                        // We must at least assert we don't have too many though.
                        if (expr.arguments.length > fn.expr.arguments.length) {
                            addError(expr, "Too many arguments for your function.");
                            return false;
                        }

                        step.call = { fn, numArgs: expr.arguments.length };

                        isValid = true;
                    } else {
                        const fn = getBuiltinFunction(expr.fnName.name);
                        if (fn) {
                            // The errors are worse if we report 'too few arguments'. I'd rather see which type I was supposed to input, even though I
                            // haven't input all the args.
                            // We might want to bring it back if we add static types.
                            // We must at least assert we don't have too many though.
                            if (
                                // expr.arguments.length < fn.minArgs || 
                                expr.arguments.length > fn.args.length
                            ) {
                                if (fn.minArgs !== fn.args.length) {
                                    addError(expr, "Expected between " + fn.minArgs + " to " + fn.args.length + " arguments, got " + expr.arguments.length);
                                } else {
                                    addError(expr, "Expected " + fn.args.length + " arguments, got " + expr.arguments.length);
                                }
                                return false;
                            }

                            step.builtinCall = { fn, numArgs: expr.arguments.length, expr };
                            isValid = true;
                        }
                    }

                    if (!isValid) {
                        addError(expr, "Couldn't resolve this function");
                        return !noOp;
                    }
                }
            } break;
            case T_DATA_INDEX_OP: {
                dfs(expr.lhs);

                noOp = true;
                for (const indexExpr of expr.indexes) {
                    dfs(indexExpr);
                    steps.push({ expr: indexExpr, index: true });
                }
            } break;
            case T_MAP_LITERAL:{
                for (const [k, v] of expr.kvPairs) {
                    dfs(k);
                    dfs(v);
                }
                step.map = expr.kvPairs.length;
            } break;
            default: {
                throw new Error("Unhandled type: " + expressionTypeToString(expr));
            }
        }

        if (!alreadyPushed && !noOp) {
            steps.push(step);
        }

        return !noOp;
    }

    for (const s of statements) {
        if (dfs(s)) {
            steps.push({ expr: s, blockStatementEnd: topLevel });
        }
    }

    return true;
}

function getLengthHpMatrix(val: Matrix): number {
    return val.shape[0];
}

function gtLength(result: ProgramResult): number | undefined {
    switch (result.t) {
        case T_RESULT_LIST: return result.values.length;
        case T_RESULT_STRING: return result.val.length;
        case T_RESULT_RANGE: return Math.abs(result.val.lo - result.val.hi);
        case T_RESULT_MATRIX: return getLengthHpMatrix(result.val);
    }
}

function get(result: ProgramInterpretResult, offset = 0): ProgramResult | null {
    return result.stack[result.stackIdx + offset] ?? null;
}

function pop(result: ProgramInterpretResult): ProgramResult {
    // At this stage, we shouldn't even generate the instruction if we thought it was going to fail.
    const val = get(result);
    assert(val);
    result.stackIdx--;
    return val;
}


function addError(result: ProgramInterpretResult, step: ProgramExecutionStep, problem: string, betterPos: TextPosition | null = null) {
    result.errors.push({ pos: betterPos ?? step.expr.pos, problem });
}

function getVarExecutionState(result: ProgramInterpretResult, name: string): ExecutionState | null {
    const current = result.callStack[result.callStack.length - 1];
    if (current.variables.has(name)) {
        return current;
    }

    const global = result.callStack[0];
    if (global.variables.has(name)) {
        return global;
    }

    return null;
}

function push(result: ProgramInterpretResult, val: ProgramResult, step: ProgramExecutionStep) {
    result.stackIdx++;
    if (result.stackIdx >= result.stack.length) {
        addError(result, step, "Stack overflow!!!");
        return false;
    }

    // TODO: rewrite in a language with struct value types
    result.stack[result.stackIdx] = { ...val };
}

export function startInterpreting(
    parseResult: ProgramParseResult, 
    isDebugging: boolean,
    previousProgramResult: ProgramInterpretResult | undefined
): ProgramInterpretResult {
    const outputs: ProgramOutputs = {
        prints: [],
        images: [],
        graphs: new Map(),
        plots: new Map(),
        uiInputs: new Map(),
        heatmapSubdivisions: 20,
    };
    if (previousProgramResult) {
        for (const input of previousProgramResult.outputs.uiInputs.values()) {
            outputs.uiInputs.set(input.name, { ...input, fromThisRun: false });
        }
    }

    const rng = newRandomNumberGenerator();
    seedRng(rng, 0);

    const result: ProgramInterpretResult = {
        rng,
        parseResult,
        isDebugging,
        entryPoint: {
            name: "Entry point",
            steps: [],
        },
        errors: [],
        functions: new Map(),

        stack: Array(1024).fill(null),
        stackIdx: 0,
        callStack: [],

        outputs,
    };

    if (parseResult.errors.length > 0) {
        result.errors.push(...parseResult.errors);
    }

    // linearlize the tree, so we can actually step through things one at a time
    {
        // we need to lineralize functions ahead of time, so that recursion will work.
        for (const [name, fn] of parseResult.functions) {
            // Otherwise, there was no reason for the parse-result to give us this
            assert(fn.body);
            assert(fn.argumentNames);

            const code: ExecutionSteps = {
                name: fn.fnName.name,
                steps: [],
            };
            if (!getExecutionSteps(result, fn.body.statements, code.steps, false)) {
            return result;
            }

            result.functions.set(name, {
                t: T_RESULT_FN,
                code,
                args: fn.argumentNames,
                expr: fn,
            });
        }

        if (!getExecutionSteps(result, parseResult.statements, result.entryPoint.steps, true)) {
            return result;
        }
    }

    result.callStack.push({
        fn: null,
        code: result.entryPoint,
        argsCount: 0,
        i: 0, variables: new Map(),
        returnAddress: 0,
        nextVarAddress: 1,
    });

    return result;
};

export function getCurrentCallstack(result: ProgramInterpretResult): ExecutionState | undefined {
    return result.callStack[result.callStack.length - 1];
}


function max(a: number, b: number): number {
    return a > b ? a : b;
}

function min(a: number, b: number): number {
    return a < b ? a : b;
}

type BuiltinFunctionArgDesc = {
    name: string;
    expr: ProgramExpression | undefined;
    type: ProgramResult["t"][];
    optional: boolean;
};

type BuiltinFunction = {
    name: string;
    fn: BuiltinFunctionSignature;
    args: BuiltinFunctionArgDesc[];
    minArgs: number;
};
type BuiltinFunctionSignature = (result: ProgramInterpretResult, step: ProgramExecutionStep, ...results: (ProgramResult | null)[]) => ProgramResult | undefined;

function newArg(name: string, type: ProgramResult["t"][], optional = false, expr?: ProgramExpression): BuiltinFunctionArgDesc {
    return { name, type, optional, expr };
}

const ZERO_VEC2 = matrixZeroes([2]);
const ZERO_VEC3 = matrixZeroes([3]);
const ZERO_VEC4 = matrixZeroes([4]);

const builtinFunctions = new Map<string, BuiltinFunction>();

export function getBuiltinFunctionsMap() {
    return builtinFunctions;
}

// initialize builtin funcs
{
    function newBuiltinFunction(
        name: string,
        args: BuiltinFunctionArgDesc[],
        fn: BuiltinFunctionSignature,
    ) {
        if (builtinFunctions.has(name)) {
            throw new Error("We already have a function called " + name);
        }

        let minArgs = 0;
        for (const arg of args) {
            if (!arg.optional) {
                minArgs += 1;
            }
        }

        builtinFunctions.set(name, { name, fn, args, minArgs });
    }

    function validateColor(
        program: ProgramInterpretResult, step: ProgramExecutionStep,
        colorRes: ProgramResult
    ): CssColor | undefined {
        let color: CssColor | undefined;

        assert(colorRes.t === T_RESULT_STRING || colorRes.t === T_RESULT_MATRIX);
        if (colorRes.t === T_RESULT_STRING) {
            color = newColorFromHexOrUndefined(colorRes.val);
            if (!color) {
                addError(program, step, "hex colours are of the from #RRGGBB or #RGB. You can alternatively use a [r, g, b] vector as a color.");
                return;
            }
        } else if (colorRes.t === T_RESULT_MATRIX) {
            if (matrixShapesAreEqual(colorRes.val, ZERO_VEC3)) {
                color = newColor(
                    getSliceValue(colorRes.val.values, 0),
                    getSliceValue(colorRes.val.values, 1),
                    getSliceValue(colorRes.val.values, 2),
                    1
                );
            } else if (matrixShapesAreEqual(colorRes.val, ZERO_VEC4)) {
                color = newColor(
                    getSliceValue(colorRes.val.values, 0),
                    getSliceValue(colorRes.val.values, 1),
                    getSliceValue(colorRes.val.values, 2),
                    getSliceValue(colorRes.val.values, 3),
                );
            } else {
                addError(program, step, "Vector colors must be a Vector3 or Vector4. You can alternatively use a \"#RGB\" string color.");
                return;
            }
        }

        return color;
    }


    function builtinPlotLines(
        program: ProgramInterpretResult, step: ProgramExecutionStep,
        plotIdx: ProgramResult | null,
        lines: ProgramResult | null,
        colorMaybe: ProgramResult | null,
        labelMaybe: ProgramResult | null,
        displayAsPoints: boolean,
    ) {
        let label: string | undefined;
        if (labelMaybe) {
            assert(labelMaybe.t === T_RESULT_STRING);
            label = labelMaybe.val;
        }

        let color: CssColor | undefined;
        if (colorMaybe) {
            color = validateColor(program, step, colorMaybe);
            if (!color) {
                return;
            }
            assert(colorMaybe.t === T_RESULT_STRING || colorMaybe.t === T_RESULT_MATRIX);
            if (colorMaybe.t === T_RESULT_STRING) {
                color = newColorFromHexOrUndefined(colorMaybe.val);
            } else if (colorMaybe.t === T_RESULT_MATRIX) {
                if (matrixShapesAreEqual(colorMaybe.val, ZERO_VEC3)) {
                    color = newColor(
                        getSliceValue(colorMaybe.val.values, 0),
                        getSliceValue(colorMaybe.val.values, 1),
                        getSliceValue(colorMaybe.val.values, 2),
                        1
                    );
                } else if (matrixShapesAreEqual(colorMaybe.val, ZERO_VEC4)) {
                    color = newColor(
                        getSliceValue(colorMaybe.val.values, 0),
                        getSliceValue(colorMaybe.val.values, 1),
                        getSliceValue(colorMaybe.val.values, 2),
                        getSliceValue(colorMaybe.val.values, 3),
                    );
                } else {
                    addError(program, step, "Vector colors must be a Vector3 or Vector4");
                    return;
                }
            }
        }

        assert(plotIdx?.t === T_RESULT_NUMBER);
        const idx = plotIdx.val;


        assert(lines?.t === T_RESULT_LIST || lines?.t === T_RESULT_MATRIX);

        const pointsX: number[] = [];
        const pointsY: number[] = [];

        if (lines.t === T_RESULT_LIST) {
            for (let i = 0; i < lines.values.length; i++) {
                const val = lines.values[i];
                if (val.t !== T_RESULT_MATRIX) {
                    // if only we could get the position of this value's expression.
                    // probably if we made a static type system, it would be easier to report this error in the right place.
                    addError(program, step, "Expected every element in a list must be a vector");
                    return;
                }

                if (val.val.shape[0] < 2) {
                    addError(program, step, "Expected every element in a list must atl least be a vector2");
                    return;
                }

                pointsX.push(getSliceValue(val.val.values, 0));
                pointsY.push(getSliceValue(val.val.values, 1));
            }
        } else if (lines.t === T_RESULT_MATRIX) {
            const mat = lines.val;
            if (!matrixIsRank2(mat)) {
                addError(program, step, "Only matrices of rank 2 may be plotted");
                return;
            }

            const m = mat.shape[0];
            const n = mat.shape[1];

            if (n >= 2) {
                for (let i = 0; i < m; i++) {
                    const x = getMatrixValue(mat, i, 0);
                    const y = getMatrixValue(mat, i, 1);

                    pointsX.push(x);
                    pointsY.push(y);
                }
            }  else {
                addError(program, step, "Can't plot a matrix with fewer than 2 columns");
                return;
            }
        }

        assert(pointsY.length === pointsX.length);

        const plot = getOrAddNewPlot(program, idx);

        plot.lines.push({
            expr: step.expr,
            color,
            label,
            pointsX,
            pointsY,
            displayAsPoints
        });

        return lines;
    }

    newBuiltinFunction("sin", [newArg("t", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.sin(val.val));
    })
    newBuiltinFunction("cos", [newArg("t", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.cos(val.val));
    })
    newBuiltinFunction("tan", [newArg("t", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.tan(val.val));
    })
    newBuiltinFunction("asin", [newArg("t", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.asin(val.val));
    })
    newBuiltinFunction("acos", [newArg("t", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.acos(val.val));
    })
    newBuiltinFunction("atan", [newArg("t", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.atan(val.val));
    })
    newBuiltinFunction("atan2", [newArg("y", [T_RESULT_NUMBER]), newArg("x", [T_RESULT_NUMBER])], (_result, _step, y, x) => {
        assert(x?.t === T_RESULT_NUMBER);
        assert(y?.t === T_RESULT_NUMBER);

        return newNumberResult(Math.atan2(y.val, x.val));
    })
    newBuiltinFunction("abs", [newArg("x", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.abs(val.val));
    })
    newBuiltinFunction("ceil", [newArg("x", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.ceil(val.val));
    })
    newBuiltinFunction("floor", [newArg("x", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.floor(val.val));
    })
    newBuiltinFunction("round", [newArg("x", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.round(val.val));
    })
    newBuiltinFunction("log", [newArg("x", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.log(val.val));
    })
    newBuiltinFunction("max", [newArg("a", [T_RESULT_NUMBER]), newArg("b", [T_RESULT_NUMBER])], (_result, _step, a, b) => {
        assert(a?.t === T_RESULT_NUMBER);
        assert(b?.t === T_RESULT_NUMBER);
        return newNumberResult(max(a.val, b.val));
    })
    newBuiltinFunction("min", [newArg("a", [T_RESULT_NUMBER]), newArg("b", [T_RESULT_NUMBER])], (_result, _step, a, b) => {
        assert(a?.t === T_RESULT_NUMBER);
        assert(b?.t === T_RESULT_NUMBER);

        return newNumberResult(min(a.val, b.val));
    })
    newBuiltinFunction("rand", [], (result) => {
        return newNumberResult(getNextRng(result.rng));
    })
    newBuiltinFunction("pow", [newArg("x", [T_RESULT_NUMBER]), newArg("n", [T_RESULT_NUMBER])], (_result, _step, x, n) => {
        assert(x?.t === T_RESULT_NUMBER);
        assert(n?.t === T_RESULT_NUMBER);

        return newNumberResult(Math.pow(x.val, n.val));
    })
    newBuiltinFunction("sqrt", [newArg("x", [T_RESULT_NUMBER])], (_result, _step, x) => {
        assert(x?.t === T_RESULT_NUMBER);

        return newNumberResult(Math.sqrt(x.val));
    })
    newBuiltinFunction("ln", [newArg("x", [T_RESULT_NUMBER])], (_result, _step, val) => {
        assert(val?.t === T_RESULT_NUMBER);
        return newNumberResult(Math.log(val.val));
    })
    newBuiltinFunction("print", [newArg("x", [])], (result, step, val) => {
        if (!val) return;

        assert(step.builtinCall);

        const innerExpr = step.builtinCall.expr.arguments[0];
        printResult(result, step, innerExpr, val);

        // can't be variadic, because print needs to return something...
        // That's ok, just put the args in a list, lol
        return val;
    });
    newBuiltinFunction(
        "set_heatmap_subdiv",
        [
            newArg("resolution", [T_RESULT_NUMBER]),
        ],
        (result, _step, resolution) => {
            assert(resolution?.t === T_RESULT_NUMBER);

            result.outputs.heatmapSubdivisions = max(0, min(200, Math.round(resolution.val)));

            return resolution;
        });
    newBuiltinFunction(
        "heatmap",
        [
            newArg("idx", [T_RESULT_NUMBER]),
            newArg("fn", [T_RESULT_FN]),
            newArg("hexColor", [T_RESULT_STRING, T_RESULT_MATRIX], true),
        ],
        (program, step, idx, fn, colorMaybe) => {
            assert(idx?.t === T_RESULT_NUMBER);
            assert(fn?.t === T_RESULT_FN);

            let color: CssColor | undefined;
            if (colorMaybe) {
                color = validateColor(program, step, colorMaybe);
                if (!color) {
                    return;
                }
            }

            const plot = getOrAddNewPlot(program, idx.val);
            plot.functions.push({ step, fn, color });

            // can't be variadic, because print needs to return something...
            // That's ok, just put the args in a list, lol
            return fn;
        });
    newBuiltinFunction(
        "plot_lines",
        [
            newArg("idx", [T_RESULT_NUMBER]),
            newArg("line", [T_RESULT_LIST, T_RESULT_MATRIX]),
            newArg("hexColor", [T_RESULT_STRING, T_RESULT_MATRIX], true),
            newArg("label", [T_RESULT_STRING], true),
        ],
        (result, step, plotIdx, lines, colorMaybe, labelMaybe) => {
            return builtinPlotLines(result, step, plotIdx, lines, colorMaybe, labelMaybe, false);
        }
    );
    newBuiltinFunction(
        "plot_points",
        [
            newArg("idx", [T_RESULT_NUMBER]),
            newArg("line", [T_RESULT_LIST, T_RESULT_MATRIX]),
            newArg("hexColor", [T_RESULT_STRING, T_RESULT_MATRIX], true),
            newArg("label", [T_RESULT_STRING], true),
        ],
        (result, step, plotIdx, lines, colorMaybe, labelMaybe) => {
            return builtinPlotLines(result, step, plotIdx, lines, colorMaybe, labelMaybe, true);
        }
    );
    newBuiltinFunction(
        "image",
        [
            newArg("vec", [T_RESULT_MATRIX]),
        ],
        (program, step, vec) => {
            assert(vec?.t === T_RESULT_MATRIX);

            let result: ProgramImageOutput | undefined = undefined;

            const dim = vec.val.shape.length;
            if (dim !== 1 && dim !== 2 && dim !== 3) {
                addError(program, step, "We can only generate images from matrices that are 1,2 or 3d." + vec.val.shape.length + ")");
                return;
            }

            if (vec.val.values.length === 0) {
                result = {
                    rgb: false,
                    pixels: [],
                    width: 0,
                    height: 0,
                    step, expr: step.expr
                };
            } else if (
                vec.val.shape.length === 1 ||
                vec.val.shape.length === 2
            ) {
                // if 1d: greyscale line
                let width, height;
                if (vec.val.shape.length === 1) {
                    width = vec.val.shape[0];
                    height = 1;
                } else {
                    width = vec.val.shape[1];
                    height = vec.val.shape[0];
                }

                let n = width * height;
                const pixels: number[] = Array(n);

                let minVal = getSliceValue(vec.val.values, 0);
                let maxVal = minVal;
                for (let i = 1; i < n; i++) {
                    const val = getSliceValue(vec.val.values, i);
                    minVal = min(val, minVal);
                    maxVal = max(val, maxVal);
                }

                for (let i = 0; i < n; i++) {
                    const val = getSliceValue(vec.val.values, i);
                    const pixelVal = inverseLerp(minVal, maxVal, val);
                    pixels[i] = pixelVal;
                }

                result = {
                    pixels,
                    rgb: false,
                    width,
                    height,
                    step,
                    expr: step.expr,
                };
            } else if (vec.val.shape.length === 3) {
                // if 3d: use the third channel as an RGB channel
                const width = vec.val.shape[1];
                const height = vec.val.shape[0];

                let n = width * height * 3;
                const pixels: number[] = Array(n);

                let rMinVal = getSliceValue(vec.val.values, 0);
                let rMaxVal = rMinVal;
                let gMinVal = getSliceValue(vec.val.values, 1);
                let gMaxVal = rMinVal;
                let bMinVal = getSliceValue(vec.val.values, 2);
                let bMaxVal = rMinVal;
                for (let i = 3; i < n; i += 3) {
                    const rVal = getSliceValue(vec.val.values, i);
                    rMinVal = min(rVal, rMinVal);
                    rMaxVal = max(rVal, rMaxVal);

                    const gVal = getSliceValue(vec.val.values, i);
                    gMinVal = min(gVal, gMinVal);
                    gMaxVal = max(gVal, gMaxVal);

                    const bVal = getSliceValue(vec.val.values, i);
                    bMinVal = min(bVal, bMinVal);
                    bMaxVal = max(bVal, bMaxVal);
                }

                for (let i = 0; i < n; i += 3) {
                    const rVal = getSliceValue(vec.val.values, i + 0);
                    const rPixelVal = inverseLerp(rMinVal, rMaxVal, rVal);
                    pixels[i + 0] = rPixelVal;

                    const gVal = getSliceValue(vec.val.values, i + 1);
                    const gPixelVal = inverseLerp(gMinVal, gMaxVal, gVal);
                    pixels[i + 1] = gPixelVal;

                    const bVal = getSliceValue(vec.val.values, i + 2);
                    const bPixelVal = inverseLerp(bMinVal, bMaxVal, bVal);
                    pixels[i + 2] = bPixelVal;
                }

                result = {
                    pixels,
                    rgb: true,
                    width,
                    height,
                    step,
                    expr: step.expr,
                };
            }


            assert(result);
            program.outputs.images.push(result);

            return vec;
        }
    );
    // TODO: cool operator that does this?
    newBuiltinFunction("push", [newArg("list", [T_RESULT_LIST]), newArg("item", [])], (result, step, list, item) => {
        if (!list) return;

        assert(list.t === T_RESULT_LIST);
        assert(item);
        list.values.push(item);

        return list;
    });
    newBuiltinFunction(
        "slider", 
        [
            newArg("name", [T_RESULT_STRING]), 
            newArg("start", [T_RESULT_NUMBER]), 
            newArg("end", [T_RESULT_NUMBER]), 
            newArg("step", [T_RESULT_NUMBER], true), 
        ], 
        (result, step, name, start, end, sliderStep) => {
            assert(name?.t === T_RESULT_STRING);
            assert(start?.t === T_RESULT_NUMBER);
            assert(end?.t === T_RESULT_NUMBER);
            if (sliderStep) {
                assert(sliderStep.t === T_RESULT_NUMBER);
            }

            let input = result.outputs.uiInputs.get(name.val);
            if (!input || input.t !== UI_INPUT_SLIDER) {
                input = { 
                    t: UI_INPUT_SLIDER, 
                    name: name.val, 
                    fromThisRun: true, 
                    start: start.val, 
                    end: end.val, 
                    value: start.val, 
                    step: null 
                }
                result.outputs.uiInputs.set(input.name, input);
            }

            input.start = start.val;
            input.end = end.val;
            input.value = clamp(input.value, start.val, end.val);
            input.step = sliderStep ? sliderStep.val : null;
            input.fromThisRun = true;

            return newNumberResult(input.value);
        }
    );
    newBuiltinFunction("range", [], (result, step) => {
        addError(result, step, "'range' is invalid outside of ranged for-loops. Try range_vec or range_list");
        return undefined;
    });

    const RANGE_UPPER_LIMIT = 100000;

    function evaluateRange(
        result: ProgramInterpretResult, execStep: ProgramExecutionStep, 
        start: ProgramResult, end: ProgramResult, step: ProgramResult | null, reverseRange: boolean
    ): number[] | null {
        assert(start?.t === T_RESULT_NUMBER);
        assert(end?.t === T_RESULT_NUMBER);

        const startVal = start.val;
        const endVal = end.val;

        let stepVal = 1;
        if (step) {
            assert(step.t === T_RESULT_NUMBER);
            stepVal = step.val;
        }

        const nums: number[] = [];
        if (reverseRange) {
            for (let i = startVal; i > endVal; i += stepVal) {
                if (nums.length > RANGE_UPPER_LIMIT) {
                    addError(result, execStep, "range function hit the safety counter of " + RANGE_UPPER_LIMIT + " items max");
                    return null
                }
                nums.push(i);
            }
        } else {
            for (let i = startVal; i < endVal; i += stepVal) {
                if (nums.length > RANGE_UPPER_LIMIT) {
                    addError(result, execStep, "range function hit the safety counter of " + RANGE_UPPER_LIMIT + " items max");
                    return null
                }
                nums.push(i);
            }
        }
        return nums;
    }

    newBuiltinFunction(
        "range_vec", 
        [
            newArg("start", [T_RESULT_NUMBER]),
            newArg("end", [T_RESULT_NUMBER]),
            newArg("step", [T_RESULT_NUMBER], true),
        ], 
        (result, step, start, end, rangeStep) => {
            const nums = evaluateRange(result, step, start!, end!, rangeStep, false);
            if (!nums) {
                return;
            }

            return {
                t: T_RESULT_MATRIX,
                val: {
                    values: newSlice(nums),
                    shape: [nums.length],
                }
            };
        }
    );
    newBuiltinFunction(
        "range_list", 
        [
            newArg("start", [T_RESULT_NUMBER]),
            newArg("end", [T_RESULT_NUMBER]),
            newArg("step", [T_RESULT_NUMBER], true),
        ], 
        (result, step, start, end, rangeStep) => {
            const nums = evaluateRange(result, step, start!, end!, rangeStep, false);
            if (!nums) {
                return;
            }

            if (nums === null) {
                addError(result, step, "range function hit the safety counter of " + RANGE_UPPER_LIMIT + " items max");
                return;
            }

            return {
                t: T_RESULT_LIST,
                values: nums.map(newNumberResult),
            };
        }
    );
    newBuiltinFunction("rrange", [], (result, step) => {
        addError(result, step, "'rrange' is invalid outside of ranged for-loops. Try rrange_vec or rrange_list");
        return undefined;
    });
    newBuiltinFunction(
        "rrange_vec", 
        [
            newArg("start", [T_RESULT_NUMBER]),
            newArg("end", [T_RESULT_NUMBER]),
            newArg("step", [T_RESULT_NUMBER], true),
        ], 
        (result, step, start, end, rangeStep) => {
            const nums = evaluateRange(result, step, start!, end!, rangeStep, true);
            if (!nums) {
                return;
            }

            return {
                t: T_RESULT_MATRIX,
                val: {
                    values: newSlice(nums),
                    shape: [nums.length],
                }
            };
        }
    );
    newBuiltinFunction(
        "rrange_list", 
        [
            newArg("start", [T_RESULT_NUMBER]),
            newArg("end", [T_RESULT_NUMBER]),
            newArg("step", [T_RESULT_NUMBER], true),
        ], 
        (result, step, start, end, rangeStep) => {
            const nums = evaluateRange(result, step, start!, end!, rangeStep, true);
            if (!nums) {
                return;
            }

            if (nums === null) {
                addError(result, step, "range function hit the safety counter of " + RANGE_UPPER_LIMIT + " items max");
                return;
            }

            return {
                t: T_RESULT_LIST,
                values: nums.map(newNumberResult),
            };
        }
    );
    newBuiltinFunction(
        "graph", [
            newArg("idx", [T_RESULT_NUMBER]),
            newArg("graphMap", [T_RESULT_MAP]),
        ], 
        (result, step, idx, graphMap) => {
            assert(idx?.t === T_RESULT_NUMBER);
            assert(graphMap?.t === T_RESULT_MAP);

            let graph = result.outputs.graphs.get(idx.val);

            if (!graph) {
                graph = {
                    expr: step.expr,
                    graph: new Map(),
                };
                result.outputs.graphs.set(idx.val, graph);
            }

            // TODO: support matrix representation for graphs, i.e
            //    A B C
            //  A 0 1 1
            //  B 1 0 1
            //  C 1 1 0 
            //
            // Looks something like:
            //
            //  A <=> B, C 
            //  B <=> A, C
            //  C <=> A, B
            //
            //  There is a 1 when things are connected. It could also be weighs, it could also be directional, i.e non-symetric matrix

            for (const [k, v] of graphMap.map) {
                if (v.t !== T_RESULT_LIST) {
                    addError(result, step, "Map values be lists, but we got " + programResultTypeString(v));
                    return graphMap;
                }

                for (const val of v.values) {
                    if (val.t !== T_RESULT_STRING && val.t !== T_RESULT_NUMBER) {
                        addError(result, step, "Elements inside the edge list must be of type <string/number>. We may add more types in the future.");
                        return graphMap;
                    }

                    const entries = graph.graph.get(k) ?? [];
                    entries.push(val.val);
                    graph.graph.set(k, entries);
                }
            }

            return graphMap;
        }
    );
    newBuiltinFunction(
        "zeroes", [
        newArg("shape", [T_RESULT_MATRIX]),
    ],
        (result, step, shape) => {
            assert(shape?.t === T_RESULT_MATRIX);
            const mat = matrixZeroes(sliceToArray(shape.val.values));
            return { t: T_RESULT_MATRIX, val: mat };
        }
    );

    function toMatrixAlias(name: string) {
        newBuiltinFunction(
            name, [
            newArg("list", [T_RESULT_LIST]),
        ],
            (result, step, list) => {
                assert(list?.t === T_RESULT_LIST);

                const mat: Matrix = matrixZeroes([]);

                const values: number[] = [];

                for (let i = 0; i < list.values.length; i++) {
                    const vec = list.values[i];
                    if (vec.t !== T_RESULT_MATRIX) {
                        addError(result, step, "Only lists ");
                        return;
                    }

                    if (i === 0) {
                        mat.shape = [...vec.val.shape];
                    } else {
                        if (!matrixShapesAreEqual(vec.val, mat)) {
                            addError(result, step, "Only lists ");
                            return;
                        }
                    }

                    for (let i = 0; i < vec.val.values.length; i++) {
                        const val = getSliceValue(vec.val.values, i);
                        values.push(val);
                    }
                }

                mat.values = newSlice(values);
                mat.shape.unshift(list.values.length);

                return { t: T_RESULT_MATRIX, val: mat };
            }
        )
    }

    toMatrixAlias("to_vec");
    toMatrixAlias("to_mat");

    newBuiltinFunction(
        "mul", [
        newArg("mat_a", [T_RESULT_MATRIX]),
        newArg("mat_b", [T_RESULT_MATRIX]),
    ],
        (result, step, a, b) => {
            assert(a?.t === T_RESULT_MATRIX);
            assert(b?.t === T_RESULT_MATRIX);
            const [val, err] = matrixMul(a.val, b.val);

            if (err || val === null) {
                addError(result, step, err ?? "Couldn't multiply the matrices for some unkown reason (???)");
                return;
            }

            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "translate2d", [
        newArg("x", [T_RESULT_NUMBER]),
        newArg("y", [T_RESULT_NUMBER]),
    ],
        (result, step, x, y) => {
            assert(x?.t === T_RESULT_NUMBER);
            assert(y?.t === T_RESULT_NUMBER);
            const val = rotationMatrixTranslate2D(x.val, y.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "translate3d", [
        newArg("x", [T_RESULT_NUMBER]),
        newArg("y", [T_RESULT_NUMBER]),
        newArg("z", [T_RESULT_NUMBER]),
    ],
        (result, step, x, y, z) => {
            assert(x?.t === T_RESULT_NUMBER);
            assert(y?.t === T_RESULT_NUMBER);
            assert(z?.t === T_RESULT_NUMBER);
            const val = rotationMatrixTranslate3D(x.val, y.val, z.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "scale2d", [
        newArg("x", [T_RESULT_NUMBER]),
        newArg("y", [T_RESULT_NUMBER]),
    ],
        (result, step, x, y) => {
            assert(x?.t === T_RESULT_NUMBER);
            assert(y?.t === T_RESULT_NUMBER);
            const val = scaleMatrix2D(x.val, y.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "scale3d", [
        newArg("x", [T_RESULT_NUMBER]),
        newArg("y", [T_RESULT_NUMBER]),
        newArg("z", [T_RESULT_NUMBER]),
    ],
        (result, step, x, y, z) => {
            assert(x?.t === T_RESULT_NUMBER);
            assert(y?.t === T_RESULT_NUMBER);
            assert(z?.t === T_RESULT_NUMBER);
            const val = scaleMatrix3D(x.val, y.val, z.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "perspective3d", [
        newArg("fov", [T_RESULT_NUMBER]),
        newArg("near", [T_RESULT_NUMBER]),
        newArg("far", [T_RESULT_NUMBER]),
    ],
        (result, step, fov, near, far) => {
            assert(fov?.t === T_RESULT_NUMBER);
            assert(near?.t === T_RESULT_NUMBER);
            assert(far?.t === T_RESULT_NUMBER);
            const val = perspectiveMatrix3D(fov.val, near.val, far.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "ortho3d", [],
        (result, step, fov, near, far) => {
            assert(fov?.t === T_RESULT_NUMBER);
            assert(near?.t === T_RESULT_NUMBER);
            assert(far?.t === T_RESULT_NUMBER);
            const val = orthographicMatrix3D();
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "rot2d", [
        newArg("angle", [T_RESULT_NUMBER]),
    ],
        (result, step, angle) => {
            assert(angle?.t === T_RESULT_NUMBER);
            const val = rotationMatrix2D(angle.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "rot3d_x", [
        newArg("angle", [T_RESULT_NUMBER]),
    ],
        (result, step, angle) => {
            assert(angle?.t === T_RESULT_NUMBER);
            const val = rotationMatrix3DX(angle.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "rot3d_y", [
        newArg("angle", [T_RESULT_NUMBER]),
    ],
        (result, step, angle) => {
            assert(angle?.t === T_RESULT_NUMBER);
            const val = rotationMatrix3DY(angle.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "rot3d_z", [
        newArg("angle", [T_RESULT_NUMBER]),
    ],
        (result, step, angle) => {
            assert(angle?.t === T_RESULT_NUMBER);
            const val = rotationMatrix3DZ(angle.val);
            return { t: T_RESULT_MATRIX, val };
        }
    );
    newBuiltinFunction(
        "transpose", [
        newArg("matrix", [T_RESULT_MATRIX]),
    ],
        (result, step, matrix) => {
            assert(matrix?.t === T_RESULT_MATRIX);
            const [val, err] = transposeMatrix(matrix.val);
            if (err || val === null) {
                addError(result, step, err);
                return;
            }
            return { t: T_RESULT_MATRIX, val };
        }
    );
}

function getOrAddNewPlot(result: ProgramInterpretResult, idx: number): ProgramPlotOutput {
    let plot = result.outputs.plots.get(idx);
    if (!plot) {
        plot = {
            lines: [],
            functions: [],
        };
        result.outputs.plots.set(idx, plot);
    }
    return plot;
}


function printResult(result: ProgramInterpretResult, step: ProgramExecutionStep, expr: ProgramExpression, val: ProgramResult) {
    result.outputs.prints.push({
        step,
        expr,
        val: { ...val }
    });
}

function getBuiltinFunction(name: string): BuiltinFunction | undefined {
    return builtinFunctions.get(name);
}

function evaluateBuiltinFunctionCall(
    program: ProgramInterpretResult,
    step: ProgramExecutionStep,
): ProgramResult | undefined {
    assert(step.builtinCall);
    const fn = step.builtinCall.fn;
    const numArgsInputted = step.builtinCall.numArgs;
    const expr = step.builtinCall.expr;

    assert(step.builtinCall);

    let numArgsToPull = numArgsInputted;
    if (numArgsToPull < fn.minArgs) {
        numArgsToPull = fn.minArgs;
    }

    function getArg(program: ProgramInterpretResult, step: ProgramExecutionStep, i: number): ProgramResult | null {
        assert(step.builtinCall);
        const argExpr: ProgramExpression | undefined = expr.arguments[i];

        if (program.errors.length > 0) {
            return null;
        }

        const res = get(program, -numArgsInputted + 1 + i);
        const typeInfo = fn.args[i];

        if (typeInfo.type.length > 0) {
            if (
                (!res && !typeInfo.optional) ||
                (res && !typeInfo.type.includes(res.t))
            ) {
                let expectedType;
                if (typeInfo.type.length === 1) {
                    expectedType = programResultTypeStringFromType(typeInfo.type[0]);
                } else {
                    expectedType = "one of " + typeInfo.type.map(programResultTypeStringFromType).join(" or ");
                }

                if (typeInfo.optional) {
                    expectedType += " or nothing";
                }

                const gotType = (res ? programResultTypeStringFromType(res.t) : "nothing");

                addError(program, step, "Expected " + expectedType + " for " + typeInfo.name + ", got " + gotType, argExpr?.pos);
                return null;
            }
        }

        return res;
    }

    switch (numArgsToPull) {
        case 0: return fn.fn(program, step);
        case 1: {
            const arg1 = getArg(program, step, 0);
            if (program.errors.length === 0) {
                return fn.fn(program, step, arg1);
            }
        } break;
        case 2: {
            const arg1 = getArg(program, step, 0);
            const arg2 = getArg(program, step, 1);
            if (program.errors.length === 0) {
                return fn.fn(program, step, arg1, arg2);
            }
        } break;
        case 3: {
            const arg1 = getArg(program, step, 0);
            const arg2 = getArg(program, step, 1);
            const arg3 = getArg(program, step, 2);
            if (program.errors.length === 0) {
                return fn.fn(program, step, arg1, arg2, arg3);
            }
        } break;
        case 4: {
            const arg1 = getArg(program, step, 0);
            const arg2 = getArg(program, step, 1);
            const arg3 = getArg(program, step, 2);
            const arg4 = getArg(program, step, 3);
            if (program.errors.length === 0) {
                return fn.fn(program, step, arg1, arg2, arg3, arg4);
            }
        } break;
        case 5: {
            const arg1 = getArg(program, step, 0);
            const arg2 = getArg(program, step, 1);
            const arg3 = getArg(program, step, 2);
            const arg4 = getArg(program, step, 3);
            const arg5 = getArg(program, step, 4);
            if (program.errors.length === 0) {
                return fn.fn(program, step, arg1, arg2, arg3, arg4, arg5);
            }
        } break;
    }

    if (program.errors.length === 0) {
        addError(program, step, "Too many arguments...");
    }
}

function pushFunctionCallFrame(
    program: ProgramInterpretResult,
    fn: ProgramResultFunction,
    numArgs: number
) {
    assert(numArgs <= fn.args.length);
    const variables = new Map<string, number>();
    for (let i = 0; i < numArgs; i++) {
        const argIdx = program.stackIdx - numArgs + i + 1;
        variables.set(fn.args[i].name, argIdx);
    }

    program.stackIdx += 1;

    let returnAddress = program.stackIdx;
    let nextVarAddress = returnAddress + 1;

    program.callStack.push({
        fn,
        code: fn.code,
        argsCount: fn.args.length,
        i: 0, variables,
        returnAddress,
        nextVarAddress,
    });
}

export function startEvaluatingFunctionWithingProgramWithArgs(
    program: ProgramInterpretResult,
    step: ProgramExecutionStep,    // the step to report the error against
    fn: ProgramResultFunction,
    args: ProgramResult[],
): boolean {
    if (program.isDebugging) {
        // Don't attempt to 'interpret rest of program' if we're currently stepping through that program. lmao.
        return false;
    }


    for (const arg of args) {
        push(program, arg, step);
    }


    pushFunctionCallFrame(program, fn, args.length);

    return true;
}

export function evaluateFunctionWithinProgramWithArgs(
    program: ProgramInterpretResult,
    step: ProgramExecutionStep,    // the step to report the error against
    fn: ProgramResultFunction,
    args: ProgramResult[],
): ProgramResult | null {
    if (!startEvaluatingFunctionWithingProgramWithArgs(program, step, fn, args)) {
        return null
    }

    interpretRestOfProgram(program);

    blockStatementEnd(program, step);

    return program.stack[0];
}

function evaluateBinaryOperatorNumber(lhs: ProgramResult, rhs: ProgramResult, program: ProgramInterpretResult, step: ProgramExecutionStep): ProgramResult | null {
    assert(step.binaryOperator !== undefined);

    let result: ProgramResult | null = null;

    if (lhs.t === T_RESULT_NUMBER && rhs.t == T_RESULT_NUMBER) {
        result = evaluateBinaryOpNumberXNumber(lhs, rhs, step.binaryOperator);
    } else if (lhs.t === T_RESULT_NUMBER && rhs.t === T_RESULT_MATRIX) {
        result = evaluateBinaryOpNumberXMatrix(lhs, rhs, true, step.binaryOperator);
    } else if (rhs.t === T_RESULT_NUMBER && lhs.t === T_RESULT_MATRIX) {
        result = evaluateBinaryOpNumberXMatrix(rhs, lhs, false, step.binaryOperator);
    } else if (lhs.t === T_RESULT_NUMBER && rhs.t === T_RESULT_LIST) {
        result = evaluateBinaryOpNumberXList(lhs, rhs, true, program, step);
    } else if (rhs.t === T_RESULT_NUMBER && lhs.t === T_RESULT_LIST) {
        result = evaluateBinaryOpNumberXList(rhs, lhs, false, program, step);
    } else if (lhs.t === T_RESULT_MATRIX) {
        if (rhs.t === T_RESULT_MATRIX) {
            const [res, err] = evaluateBinaryOpMatrixXMatrix(lhs, rhs, step.binaryOperator);
            if (err) {
                addError(program, step, err);
            } else {
                result = res;
            }
        }
    }

    return result;
}

function blockStatementEnd(program: ProgramInterpretResult, step: ProgramExecutionStep) {
    const call = getCurrentCallstack(program);
    if (!call) {
        return;
    }

    const val = get(program)
    if (!val) {
        addError(program, step, "This block-level statement didn't return a result");
        return false;
    }

    program.stack[call.returnAddress] = val;
    program.stackIdx = call.nextVarAddress - 1;
}

function validateMapKey(
    program: ProgramInterpretResult,
    step: ProgramExecutionStep,
    idxResult: ProgramResult,
): number | string | null {
    if (idxResult.t !== T_RESULT_NUMBER && idxResult.t !== T_RESULT_STRING) {
        addError(program, step, "Map keys must be numbers or strings for now");
        return null;
    }

    return idxResult.val;
}

function validateIndex(
    program: ProgramInterpretResult,
    step: ProgramExecutionStep,
    idxResult: ProgramResult,
): number | null {
    if (idxResult.t !== T_RESULT_NUMBER) {
        addError(program, step, "Indexers must be numbers");
        return null;
    }

    const idx = idxResult.val;
    if ((idx % 1) !== 0) {
        addError(program, step, "Indexers can't have a decimal component");
        return null;
    }

    if (idx < 0) {
        addError(program, step, "Indexers can't be negative");
        return null;
    }

    return idx;
}

export function stepProgram(program: ProgramInterpretResult): boolean {
    const call = getCurrentCallstack(program);
    if (!call) {
        return false;
    }

    const steps = call.code.steps;
    if (call.i >= steps.length) {
        call.i = steps.length;
        return false;
    }

    const step = steps[call.i];

    let nextCallI = call.i + 1;

    // TODO: use a switch here instead
    if (step.load) {
        const varName = step.load;

        const fn = getBuiltinFunction(varName);
        if (fn) {
            // TODO: implement this
            addError(program, step, "We don't have a way to load a builtin function as a variable yet");
            return false;
        }

        const userFn = program.functions.get(varName);
        let resultToPush: ProgramResult | undefined;

        if (userFn) {
            resultToPush = userFn;
        } else {
            const s = getVarExecutionState(program, varName);
            if (!s) {
                addError(program, step, "This variable hasn't been set yet");
                return false;
            }

            const addr = s.variables.get(varName);
            assert(addr !== undefined);
            const val = program.stack[addr];
            assert(val);

            resultToPush = val;
        }

        push(program, resultToPush, step);
    } else if (step.loadLastBlockResult) {
        const val = program.stack[call.returnAddress];
        if (!val) {
            addError(program, step, "This block doesn't have any results in it yet");
            return false;
        }
        push(program, val, step);
    } else if (step.set) {
        // NOTE: setting a variable doesn't remove it from the stack, because assignment will return the value that was assigned.
        const val = get(program);
        if (!val) {
            addError(program, step, "Last wn pstep didn't generate any results")
            return false;
        }

        const s = getVarExecutionState(program, step.set);
        if (!s) {
            if (program.stackIdx !== call.nextVarAddress) {
                addError(program, step, "Nothing was computed to assign");
                return false;
            }
            call.variables.set(step.set, program.stackIdx);
            call.nextVarAddress++;
        } else {
            const addr = s.variables.get(step.set)!;
            program.stack[addr] = val;
        }
    } else if (step.binaryOperator) {
        const lhs = pop(program);
        const rhs = pop(program);

        let calcResult: ProgramResult | null = null;

        calcResult = evaluateBinaryOperatorNumber(lhs, rhs, program, step);

        if (!calcResult) {
            if (program.errors.length === 0) {
                addError(program, step, `We don't have a way to compute ${programResultTypeString(lhs)} ${binOpToOpString(step.binaryOperator)} ${programResultTypeString(rhs)} yet.`);
            }
            return false;
        }

        push(program, calcResult, step);
    } else if (step.unaryOperator) {
        const val = pop(program);
        const [res, err] = evaluateUnaryOp(program, step, val, step.unaryOperator);
        if (err) {
            addError(program, step, err);
            return false;
        }

        if (!res) {
            addError(program, step, `We don't have a way to compute ${unaryOpToOpString(step.unaryOperator)}${programResultTypeString(val)} yet.`);
            return false;
        }

        push(program, res, step);
    } else if (step.list !== undefined) {
        program.stackIdx -= step.list;

        const list: ProgramResult = { t: T_RESULT_LIST, values: [] };
        for (let i = 0; i < step.list; i++) {
            const val = program.stack[program.stackIdx + i + 1];
            assert(val);
            list.values.push(val);
        }

        push(program, list, step);
    } else if (step.map !== undefined) {
        program.stackIdx -= step.map * 2;

        const map: ProgramResult = { t: T_RESULT_MAP, map: new Map() };
        for (let i = 0; i < step.map; i++) {
            const mapKey = program.stack[program.stackIdx + 2 * i + 1];
            const mapVal = program.stack[program.stackIdx + 2 * i + 2];

            assert(mapKey);
            assert(mapVal);

            const key = validateMapKey(program, step, mapKey);
            if (key === null) {
                return false;
            }

            map.map.set(key, mapVal);
        }

        push(program, map, step);
    } else if (step.vector !== undefined) {

        program.stackIdx -= step.vector;

        let innerLen = 0;
        let innerT = 0;
        let innerShape: number[] | undefined;
        const values: number[] = [];

        const len = step.vector;
        for (let i = 0; i < len; i++) {
            const val = program.stack[program.stackIdx + i + 1];
            assert(val);

            if (val.t !== T_RESULT_NUMBER && val.t !== T_RESULT_MATRIX) {
                addError(program, step, "Vectors/Matrices can only contain other vectors/matrices/numbers. You can create a List instead, by prepending 'list', like list[1,2,\"3\"]");
                return false;
            }

            let rowLen;
            if (val.t === T_RESULT_MATRIX) {
                rowLen = getLengthHpMatrix(val.val);

                // TODO: reserve the correct size based on matrix shape. flatmap...
                for (let i = 0; i < val.val.values.length; i++) {
                    values.push(getSliceValue(val.val.values, i));
                }
            } else {
                values.push(val.val);
                rowLen = 1;
            }

            if (i === 0) {
                innerLen = rowLen;
                innerT = val.t;
                if (val.t === T_RESULT_MATRIX) {
                    innerShape = val.val.shape;
                }
            } else {
                if (innerT !== val.t) {
                    addError(program, step, "The items inside this vector/matrix have inconsistent types");
                    return false;
                }

                if (innerLen !== rowLen) {
                    addError(program, step, "The items inside this vector/matrix have inconsistent lengths");
                    return false;
                }
            }
        }

        const newShape = innerShape ? [len, ...innerShape] : [len];

        push(program, {
            t: T_RESULT_MATRIX,
            val: { values: newSlice(values), shape: newShape }
        }, step);
    } else if (step.number !== undefined) {
        push(program, newNumberResult(step.number), step);
    } else if (step.string !== undefined) {
        push(program, { t: T_RESULT_STRING, val: step.string }, step);
    } else if (step.jump !== undefined) {
        assert(step.jump >= 0);
        assert(step.jump < steps.length);
        nextCallI = step.jump;
    } else if (step.jumpIfFalse !== undefined) {
        assert(step.jumpIfFalse >= 0);
        assert(step.jumpIfFalse <= steps.length);

        const val = pop(program,);
        if (val.t !== T_RESULT_NUMBER) {
            // -0 is fine to be `true` imo.
            // (Won't be a problem if we implement this in a real language with integer types);
            addError(program, step, "True/false queries must be numbers. You can get a 0/1 number by using logical ops like ==, <=, etc, but that is not the only way to do so.");
            return false;
        }

        if (val.val === 0) {
            nextCallI = step.jumpIfFalse;
            call.i = step.jumpIfFalse;
        }
    } else if (step.call) {
        const numArgs = step.call.numArgs;
        pushFunctionCallFrame(program, step.call.fn, numArgs);
        call.i++;
        return true;
    } else if (step.builtinCall) {
        const res = evaluateBuiltinFunctionCall(program, step);
        if (program.errors.length > 0) {
            return false;
        }
        // Should always push an error if we're returning undefined
        assert(res);

        program.stackIdx -= step.builtinCall.numArgs;
        push(program, res, step);
    } else if (step.blockStatementEnd !== undefined) {
        // need this to clean up after the last 'statement'.
        blockStatementEnd(program, step);
    } else if (step.clearLastBlockResult) {
        program.stack[call.returnAddress] = null;
    } else if (step.index) {
        const idxResult = pop(program);
        const data = pop(program);

        let isValid = false;

        if (data.t === T_RESULT_LIST || data.t === T_RESULT_MATRIX) {
            const idx = validateIndex(program, step, idxResult);
            if (idx === null) {
                return false;
            }

            if (data.t === T_RESULT_LIST) {
                if (idx >= data.values.length) {
                    addError(program, step, "Index was out of bounds");
                    return false;
                }

                push(program, data.values[idx], step);
                isValid = true;
            } else if (data.t === T_RESULT_MATRIX) {
                if (data.val.shape.length === 1) {
                    if (!isIndexInSliceBounds(data.val.values, idx)) {
                        addError(program, step, "Index was out of bounds");
                        return false;
                    }

                    const value = getSliceValue(data.val.values, idx);
                    push(program, newNumberResult(value), step);
                    isValid = true;
                } else {
                    const subMatrix = getMatrixRow(data.val, idx);
                    if (!subMatrix) {
                        addError(program, step, "Index was out of bounds");
                        return false;
                    }

                    push(program, { t: T_RESULT_MATRIX, val: subMatrix }, step);
                    isValid = true;
                }
            }
        } else if (data.t === T_RESULT_MAP) {
            const key = validateMapKey(program, step, idxResult);
            if (key === null) {
                return false;
            }

            const val = data.map.get(key);
            if (val === undefined) {
                addError(program, step, `Key ${val} wasn't present in the map`);
                return false;
            }

            push(program, val, step);
            isValid = true;
        }

        if (!isValid) {
            addError(program, step, "Can't index this datatype");
            return false;
        }
    } else if (step.incr) {
        const stepVal = pop(program);
        if (stepVal.t !== T_RESULT_NUMBER) {
            addError(program, step, "Can't increment by non-numerical values");
            return false;
        }

        const addr = call.variables.get(step.incr);
        assert(addr !== undefined);
        const val = program.stack[addr];
        assert(val);
        assert(val.t === T_RESULT_NUMBER);
        val.val += stepVal.val;
    } else if (step.fn) {
        push(program, step.fn, step);
    } else if (step.indexAssignment) {
        const rhsResult = pop(program);
        const idxResult = pop(program);
        const lhsToAssign = pop(program);

        let isValid = false;

        if (lhsToAssign.t === T_RESULT_LIST || lhsToAssign.t === T_RESULT_MATRIX) {
            const idx = validateIndex(program, step, idxResult);
            if (idx === null) {
                return false;
            }

            if (lhsToAssign.t === T_RESULT_LIST) {
                if (idx < 0 || idx >= lhsToAssign.values.length) {
                    addError(program, step, "Index was out of bounds: " + "list(" + lhsToAssign.values.length + ")[" + idx + "]")
                    return false;
                }
                lhsToAssign.values[idx] = rhsResult;
                isValid = true;
            } else if (lhsToAssign.t === T_RESULT_MATRIX) {
                if (lhsToAssign.val.shape.length === 1) {
                    if (rhsResult.t !== T_RESULT_NUMBER) {
                        addError(program, step, "Can only assign numbers into " + programResultTypeString(lhsToAssign));
                        return false;
                    }
                    setSliceValue(lhsToAssign.val.values, idx, rhsResult.val);
                    isValid = true;
                } else {
                    if (rhsResult.t !== T_RESULT_MATRIX) {
                        addError(program, step, "Can only assign vectors into " + programResultTypeString(lhsToAssign));
                        return false;
                    }

                    if (!subMatrixShapeEqualsRowShape(lhsToAssign.val, rhsResult.val)) {
                        addError(program, step,
                            "Can only assign " +
                            getMatrixTypeFromShape(lhsToAssign.val.shape.slice(1)) +
                            " into " + programResultTypeString(lhsToAssign)
                        );
                        return false;
                    }

                    const rowLen = getMatrixRowLength(lhsToAssign.val);
                    for (let i = 0; i < rowLen; i++) {
                        const val = getSliceValue(rhsResult.val.values, i);
                        setSliceValue(lhsToAssign.val.values, i, val);
                    }
                    isValid = true;
                }
            }
        } else if (lhsToAssign.t === T_RESULT_MAP) {
            const key = validateMapKey(program, step, idxResult);
            if (key === null) {
                return false;
            }

            lhsToAssign.map.set(key, rhsResult);
            isValid = true;
        }

        if (!isValid) {
            addError(program, step, "Can't assign to a value of type " + programResultTypeString(lhsToAssign))
            return false;
        }

        push(program, rhsResult, step);
    }

    call.i = nextCallI;
    if (call.code.steps.length === call.i && program.callStack.length > 1) {
        // this was the thing we last computed
        const returnAddress = call.returnAddress;
        const val = program.stack[returnAddress];

        program.callStack.pop();
        const current = getCurrentCallstack(program);

        // this is the current call frame's return address
        program.stackIdx = current ? (returnAddress - 1) : 0;
        program.stack[program.stackIdx] = val;
    }
    return program.callStack.length > 0;
}

export function newNumberResult(val: number): ProgramResultNumber {
    return { t: T_RESULT_NUMBER, val };
}

function interpretRestOfProgram(result: ProgramInterpretResult) {
    // I've kept it low, because matrix ops and array programming can result in singular iterations
    // actually doing quite a lot of computations.
    let safetyCounter = 0;
    const MAX_ITERATIONS = 1000 * 1000
    while (result.callStack.length > 0) {
        safetyCounter++;
        if (safetyCounter >= MAX_ITERATIONS) {
            // prevent infinite loops
            break;
        }
        let res = stepProgram(result);
        if (!res) {
            break;
        }
    }

    if (safetyCounter === MAX_ITERATIONS) {
        const call = getCurrentCallstack(result);
        assert(call);
        const step = call.code.steps[call.i];

        // Could do the funniest thing here - "Log in and purchase a premium account to unlock more iterations"

        // TODO: allow user to override or disable this.
        addError(result, step, "The program terminated here, because it reached the maximum number of iterations (" + MAX_ITERATIONS + ")");
    }
}

export function interpret(
    parseResult: ProgramParseResult, 
    previousProgramResult: ProgramInterpretResult | undefined
): ProgramInterpretResult {
    const result = startInterpreting(parseResult, false, previousProgramResult);
    if (result.errors.length > 0) {
        return result;
    }

    interpretRestOfProgram(result);

    for (const input of result.outputs.uiInputs.values()) {
        if (!input.fromThisRun) {
            result.outputs.uiInputs.delete(input.name);
        }
    }

    return result;
}
