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
    ProgramExpressionUnaryOperator,
    ProgramParseResult, 
    T_ASSIGNMENT, T_BINARY_OP, T_BLOCK, T_DATA_INDEX_OP, T_FN, T_IDENTIFIER, T_IDENTIFIER_THE_RESULT_FROM_ABOVE, T_LIST_LITERAL, T_NUMBER_LITERAL, T_RANGE_FOR, T_STRING_LITERAL, T_TERNARY_IF, T_UNARY_OP, T_VECTOR_LITERAL,
    UNARY_OP_NOT,
    UNARY_OP_PRINT,
    UnaryOperatorType,
    unaryOpToOpString,
    unaryOpToString
} from "./program-parser";
import { assert } from "./utils/im-dom-utils";
import { getSliceValue, Matrix, matrixAddElements, matrixDivideElements, matrixElementsEqual, matrixElementsGreaterThan, matrixElementsGreaterThanOrEqual, matrixElementsLessThan, matrixElementsLessThanOrEqual, matrixLogicalAndElements, matrixLogicalOrElements, matrixMultiplyElements, matrixShapesAreEqual, matrixSubtractElements, newSlice } from "./utils/matrix-math";

export const T_RESULT_NUMBER = 1;
export const T_RESULT_STRING = 2;
export const T_RESULT_LIST = 3;
export const T_RESULT_MATRIX = 4;
export const T_RESULT_RANGE = 5;
export const T_RESULT_FN = 6;

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

export type ProgramResult = ProgramResultNumber
    | ProgramResultRange
    | ProgramResultString
    | ProgramResultList
    | ProgramResultMatrix
    | ProgramResultFunction;

export function programResultTypeString(output: ProgramResult): string {
    switch (output.t) {
        case T_RESULT_NUMBER:
            return "Number";
        case T_RESULT_RANGE:
            return "Range";
        case T_RESULT_STRING:
            return "String";
        case T_RESULT_LIST:
            return "List";
        case T_RESULT_MATRIX: {
            return output.val.shape.length === 1 ? `Vector${output.val.shape[0]}` : (
                `Matrix${output.val.shape.map(s => "" + s).join("x")}`
            );
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
    op: BinaryOperatorType,
): ProgramResultNumber | ProgramResultMatrix | null {
    let val: Matrix | null = null; 

    // TODO:

    return val;
}

function evaluateUnaryOp(result: ProgramInterpretResult, step: ExecutionStep, val: ProgramResult, op: UnaryOperatorType): [ProgramResult | null, string] {
    switch(op) {
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
export type ExecutionStep = {
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
    // Pops the last n things off the stack and into a vector
    vector?: number;
    // Pushes this number to the stack
    number?: number;
    // pushes this string to the stack
    string?: string;

    // jumps the current instruction index to the step specified
    jump?: number;

    // jumps the current instruction index to the step specified, if the last value is false.
    jumpIfFalse?: number;

    // increments the given variable by 1
    incr?: string;

    // decr the given variable by 1
    decr?: string;


    // pops several indexes, uses them to index into a datastructure
    index?: boolean;

    // calls a user function with some number of args.
    call?: { fn: ProgramResultFunction; numArgs: number; };

    // calls a builtin function with some number of args.
    builtinCall?: { fn: BuiltinFunction; expr: ProgramExpressionFn; numArgs: number; };
};

export type ExecutionSteps = {
    name: string;
    steps: ExecutionStep[];
}

export function executionStepToString(step: ExecutionStep) {
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
    if (step.decr !== undefined) {
        return "decrement " + step.decr;
    }
    if (step.index !== undefined) {
        return "index op";
    }
    if (step.call !== undefined) {
        const value = step.call;
        const fn = value.fn;
        const name = fn.expr.fnName.name;
        return ("Call " +  name + "(" + value.numArgs + " args) ");
    }
    if (step.builtinCall !== undefined) {
        const value = step.builtinCall;
        const name = value.fn.name
        return ("[builtin] Call " +  name + "(" + value.numArgs + " args) ");
    }

    return "Unhandled step";
}

function newExecutionStep(expr: ProgramExpression): ExecutionStep {
    return { expr };
}


type ExecutionState = {
    code: ExecutionSteps;
    i: number;
    argsCount: number;
    
    // TODO: replace with an array
    variables: Map<string, number>;
    returnAddress: number;
    nextVarAddress: number;
};

export type ProgramInterpretResult = {
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
    step: ExecutionStep;
    expr: ProgramExpression;
    val: ProgramResult;
}

export type ProgramOutputs = {
    prints: ProgramPrintOutput[];
};


function getExecutionSteps(
    result: ProgramInterpretResult,
    statements: ProgramExpression[],
    steps: ExecutionStep[],
    topLevel: boolean,
) {

    const addError = (expr: ProgramExpression, problem: string) => {
        result.errors.push({ pos: expr.pos, problem });
    }

    const incompleteExpressionError = (expr: ProgramExpression) => {
        addError(expr, "Found an incomplete expression");
    }

    const dfs = (expr: ProgramExpression): boolean => {
        if (result.errors.length > 0) {
            return false;
        }

        const step = newExecutionStep(expr);
        let alreadyPushed = false;
        let noOp = false;

        switch (expr.t) {
            case T_IDENTIFIER: {
                step.load = expr.name;
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
                    dfs(expr.lhs);

                    for (const idxEpr of expr.lhs.indexes) {
                        dfs(idxEpr);
                        steps.push({ expr, index: true });
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
                    dfs(s);
                    steps.push({ expr: s, blockStatementEnd: false });
                }
            } break;
            case T_RANGE_FOR: {
                alreadyPushed = true;
                noOp = true;

                // NOTE: we actually can't generate the correct instructions (in a simple manner)
                // if we don't know whether the range expression is looping upwards or downards, so 
                // I'll have to introduce two new operators that range upwards and downards...

                if (expr.ascending) {
                    dfs(expr.loExpr);
                } else {
                    dfs(expr.hiExpr);
                    steps.push({ expr, number: 1 });
                    steps.push({ expr, binaryOperator: BIN_OP_SUBTRACT });
                }
                steps.push({ expr, set: expr.loopVar.name });

                const loopStartIdx = steps.length;

                steps.push({ expr, load: expr.loopVar.name });
                if (expr.ascending) {
                    dfs(expr.hiExpr);
                    steps.push({ expr, binaryOperator: BIN_OP_LESS_THAN });
                } else {
                    dfs(expr.loExpr);
                    steps.push({ expr, binaryOperator: BIN_OP_GREATER_THAN_EQ });
                }

                const jumpToLoopEndIfFalse = newExecutionStep(expr);
                steps.push(jumpToLoopEndIfFalse);

                steps.push({ expr, clearLastBlockResult: true });

                dfs(expr.body);

                if (expr.ascending) {
                    steps.push({ expr, incr: expr.loopVar.name });
                } else {
                    steps.push({ expr, decr: expr.loopVar.name });
                }

                steps.push({ expr, jump: loopStartIdx });

                const loopEndIdx = steps.length;
                jumpToLoopEndIfFalse.jumpIfFalse = loopEndIdx;
            } break;
            case T_FN: {
                if (expr.body) {
                    // We've already pre-extracted and linearlized every function declaration,
                    // so we don't need to do anything here.
                    noOp = true;
                } else {
                    for (const arg of expr.arguments) {
                        dfs(arg);
                    }

                    const fn = result.functions.get(expr.fnName.name);
                    let isValid = false;
                    if (fn) {
                        if (expr.arguments.length !== fn.expr.arguments.length) {
                            addError(expr, "Expected " + fn.expr.arguments.length + " arguments, got " + expr.arguments.length);
                            return false;
                        }

                        step.call = { fn, numArgs: expr.arguments.length };

                        isValid = true;
                    } else {
                        const fn = getBuiltinFunction(expr.fnName.name);
                        if (fn) {
                            if (expr.arguments.length !== fn.args.length) {
                                addError(expr, "Expected " + fn.args.length + " arguments, got " + expr.arguments.length);
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
                throw new Error("TODO: Implement data indexing");
            } 
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
}

function getLengthHpMatrix(val: Matrix): number {
    return val.shape[0];
}

function getLength(result: ProgramResult): number | undefined {
    switch(result.t) {
        case T_RESULT_LIST: return result.values.length;
        case T_RESULT_STRING: return result.val.length;
        case T_RESULT_RANGE: return Math.abs(result.val.lo - result.val.hi);
        case T_RESULT_MATRIX: return getLengthHpMatrix(result.val);
    }
}

function get(result: ProgramInterpretResult, offset = 0): ProgramResult | null {
    return result.stack[result.stackIdx + offset];
}

function pop(result: ProgramInterpretResult): ProgramResult {
    // At this stage, we shouldn't even generate the instruction if we thought it was going to fail.
    const val = get(result);
    assert(val);
    result.stackIdx--;
    return val;
}


function addError(result: ProgramInterpretResult, step: ExecutionStep, problem: string) {
    result.errors.push({ pos: step.expr.pos, problem });
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

function push(result: ProgramInterpretResult, val: ProgramResult, step: ExecutionStep) {
    result.stackIdx++;
    if (result.stackIdx >= result.stack.length) {
        addError(result, step, "Stack overflow!!!");
        return false;
    }

    // TODO: rewrite in a language with struct value types
    result.stack[result.stackIdx] = { ...val };
}

export function startInterpreting(parseResult: ProgramParseResult): ProgramInterpretResult {
    const result: ProgramInterpretResult = {
        entryPoint: {
            name: "Entry point",
            steps: [],
        },
        errors: [],
        functions: new Map(),

        stack: Array(64).fill(null),
        stackIdx: 0,
        callStack: [],

        outputs: {
            prints: []
        }
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
            getExecutionSteps(result, fn.body.statements, code.steps, false);

            result.functions.set(name, {
                t: T_RESULT_FN,
                code,
                args: fn.argumentNames,
                expr: fn,
            });
        }

        getExecutionSteps(result, parseResult.statements, result.entryPoint.steps, true)
    }

    result.callStack.push({ 
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

function min (a: number, b: number): number {
    return a < b ? a : b;
}

type BuiltinFunctionArgDesc = {
    name: string;
};

type BuiltinFunction = {
    name: string;
    fn: BuiltinFunctionSignature;
    args: BuiltinFunctionArgDesc[];
};
type BuiltinFunctionSignature = (result: ProgramInterpretResult, step: ExecutionStep, ...results: ProgramResult[]) => ProgramResult | undefined;

function newArg(name: string): BuiltinFunctionArgDesc {
    return { name };
}

const builtinFunctions = new Map<string, BuiltinFunction>();

function newBuiltinFunction(
    name: string, 
    args: BuiltinFunctionArgDesc[],
    fn: BuiltinFunctionSignature,
) {
    if (builtinFunctions.has(name)) {
        throw new Error("We already have a function called " + name);
    }

    builtinFunctions.set(name, { name, fn, args });
}

// initialize builtin funcs
{
    newBuiltinFunction("sin", [newArg("t")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.sin(val.val));
        }
    })
    newBuiltinFunction("cos", [newArg("t")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.cos(val.val));
        }
    })
    newBuiltinFunction("tan", [newArg("t")], ( _result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.tan(val.val));
        }
    })
    newBuiltinFunction("asin", [newArg("t")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.asin(val.val));
        }
    })
    newBuiltinFunction("acos", [newArg("t")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.acos(val.val));
        }
    })
    newBuiltinFunction("atan", [newArg("t")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.atan(val.val));
        }
    })
    newBuiltinFunction("atan2", [newArg("y"), newArg("x")], (_result, _step, y, x) => {
        if (y.t === T_RESULT_NUMBER && x.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.atan2(y.val, x.val));
        }
    })
    newBuiltinFunction("abs", [newArg("x")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.abs(val.val));
        }
    })
    newBuiltinFunction("ceil", [newArg("x")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.ceil(val.val));
        }
    })
    newBuiltinFunction("floor", [newArg("x")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.floor(val.val));
        }
    })
    newBuiltinFunction("round", [newArg("x")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.round(val.val));
        }
    })
    newBuiltinFunction("log", [newArg("x")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.log(val.val));
        }
    })
    newBuiltinFunction("max", [newArg("a"), newArg("b")], (_result, _step, a, b) => {
        if (a.t === T_RESULT_NUMBER && b.t === T_RESULT_NUMBER) {
            return newNumberResult(max(a.val, b.val));
        }
    })
    newBuiltinFunction("min", [newArg("a"), newArg("b")], (_result, _step, a, b) => {
        if (a.t === T_RESULT_NUMBER && b.t === T_RESULT_NUMBER) {
            return newNumberResult(min(a.val, b.val));
        }
    })
    newBuiltinFunction("rand", [], () => {
        return newNumberResult(Math.random());
    })
    newBuiltinFunction("pow", [newArg("x"), newArg("n")], (_result, _step, x, n) => {
        if (x.t === T_RESULT_NUMBER && n.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.pow(x.val, n.val));
        }
    })
    newBuiltinFunction("ln", [newArg("x")], (_result, _step, val) => {
        if (val.t === T_RESULT_NUMBER) {
            return newNumberResult(Math.log(val.val));
        }
    })
    newBuiltinFunction("print", [newArg("x")], (result, step, val) => {
        assert(step.builtinCall);

        const innerExpr = step.builtinCall.expr.arguments[0];
        printResult(result, step, innerExpr, val);

        // can't be variadic, because print needs to return something...
        // That's ok, just put the args in a list, lol
        return val;
    })
}


function printResult(result: ProgramInterpretResult, step: ExecutionStep, expr: ProgramExpression, val: ProgramResult) {
    result.outputs.prints.push({
        step,
        expr,
        val: { ...val }
    });
}


function getBuiltinFunction(name: string): BuiltinFunction | undefined {
    return builtinFunctions.get(name);
}

function evaluateBuiltinFunction(
    fn: BuiltinFunction, 
    program: ProgramInterpretResult, 
    step: ExecutionStep
): ProgramResult | undefined {
    // Bob c martin verse 1 chapter 4 - thoust function mustth hath only 3 args at most
    
    switch(fn.args.length) {
        case 0: return fn.fn(program, step);
        case 1: {
            const arg1 = get(program);
            if (arg1) {
                return fn.fn(program, step, arg1);
            }
            addError(program, step, "Expected 1 argument");

        } return;
        case 2: {
            const arg1 = get(program, -1);
            const arg2 = get(program);
            if (arg1 && arg2) {
                return fn.fn(program, step, arg1, arg2);
            }
            addError(program, step, "Expected 2 arguments");
            
        } return;
        case 3: {
            const arg1 = get(program, -2);
            const arg2 = get(program, -1);
            const arg3 = get(program);
            if (arg1 && arg2 && arg3) {
                return fn.fn(program, step, arg1, arg2, arg3);
            }
            addError(program, step, "Expected 3 arguments");
        } return;
    }

    addError(program, step, "Too many arguments...");
}



export function stepProgram(result: ProgramInterpretResult): boolean {
    const call = getCurrentCallstack(result);
    if (!call) {
        return false;
    }

    const steps = call.code.steps;
    if (call.i >= steps.length) {
        if (call.i > steps.length) {
            throw new Error("How did that happen");
        }
        return false;
    }

    const step = steps[call.i];

    // TODO: use a switch here instead
    if (step.load) {
        const s = getVarExecutionState(result, step.load);
        if (!s) {
            addError(result, step, "This variable hasn't been set yet");
            return false;
        }

        const addr = s.variables.get(step.load);
        assert(addr !== undefined);
        const val = result.stack[addr];
        assert(val);

        push(result, val, step);
    } else if (step.loadLastBlockResult) {
        const val = result.stack[call.returnAddress];
        if (!val) {
            addError(result, step, "This block doesn't have any results in it yet");
            return false;
        }
        push(result, val, step);
    } else if (step.set) {
        // NOTE: setting a variable doesn't remove it from the stack, because assignment will return the value that was assigned.
        const val = get(result);
        if (!val) {
            addError(result, step, "Last wn pstep didn't generate any results")
            return false;
        }

        const s = getVarExecutionState(result, step.set);
        if (!s) {
            assert(result.stackIdx === call.nextVarAddress);
            call.variables.set(step.set, result.stackIdx);
            call.nextVarAddress++;
        } else {
            const addr = s.variables.get(step.set)!;
            result.stack[addr] = val;
        }
    } else if (step.binaryOperator) {
        const lhs = pop(result);
        const rhs = pop(result);

        let calcResult: ProgramResult | null = null;

        if (lhs.t === T_RESULT_NUMBER) {
            if (rhs.t == T_RESULT_NUMBER) {
                calcResult = evaluateBinaryOpNumberXNumber(lhs, rhs, step.binaryOperator);
            } else if (rhs.t === T_RESULT_MATRIX) {
                calcResult = evaluateBinaryOpNumberXMatrix(lhs, rhs, step.binaryOperator);
            }
        } else if (lhs.t === T_RESULT_MATRIX) {
            if (rhs.t === T_RESULT_MATRIX) {
                const [res, err] = evaluateBinaryOpMatrixXMatrix(lhs, rhs, step.binaryOperator);
                if (err) {
                    addError(result, step, err);
                    return false;
                }

                calcResult = res;
            }
        }

        if (!calcResult) {
            addError(result, step, `We don't have a way to compute ${programResultTypeString(lhs)} ${binOpToOpString(step.binaryOperator)} ${programResultTypeString(rhs)} yet.`);
            return false;
        }

        push(result, calcResult, step);
    } else if (step.unaryOperator) {
        const val = pop(result);
        const [res, err] = evaluateUnaryOp(result, step, val, step.unaryOperator);
        if (err) {
            addError(result, step, err);
            return false;
        }

        if (!res) {
            addError(result, step, `We don't have a way to compute ${unaryOpToOpString(step.unaryOperator)}${programResultTypeString(val)} yet.`);
            return false;
        }

        push(result, res, step);
    } else if (step.list !== undefined) {
        result.stackIdx -= step.list;
        const list: ProgramResult = { t: T_RESULT_LIST, values: [] };
        for (let i = 0; i < step.list; i++) {
            const val = result.stack[i];
            assert(val);
            list.values.push(val);
        }

        push(result, list, step);
    } else if (step.vector !== undefined) {

        result.stackIdx -= step.vector;

        let innerLen = 0;
        let innerT = 0;
        let innerShape: number[] | undefined;
        const values: number[] = [];

        const len = step.vector;
        for (let i = 0; i < len; i++) {
            const val = result.stack[result.stackIdx + i + 1];
            assert(val);

            if (val.t !== T_RESULT_NUMBER && val.t !== T_RESULT_MATRIX) {
                addError(result, step, "Vectors/Matrices can only contain other vectors/matrices/numbers");
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
                    addError(result, step, "This item had a different type to the previous items in the vector");
                    return false;
                } 

                if (innerLen !== rowLen) {
                    addError(result, step, "This vector had a different length to the previous vectors");
                    return false;
                }
            }
        }

        const newShape = innerShape ? [len, ...innerShape] : [len];

        push(result, {
            t: T_RESULT_MATRIX,
            val: { values: newSlice(values), shape: newShape }
        }, step);
    } else if (step.number !== undefined) {
        push(result, newNumberResult(step.number), step);
    } else if (step.string !== undefined) {
        push(result, { t: T_RESULT_STRING, val: step.string }, step);
    } else if (step.jump !== undefined) {
        assert(step.jump >= 0);
        assert(step.jump < steps.length);
        call.i = step.jump;
        return true;
    } else if (step.jumpIfFalse !== undefined) {
        assert(step.jumpIfFalse >= 0);
        assert(step.jumpIfFalse <= steps.length);

        const val = pop(result,);
        if (val.t !== T_RESULT_NUMBER) {
            // -0 is fine to be `true` imo.
            // (Won't be a problem if we implement this in a real language with integer types);
            addError(result, step, "True/false queries must be numbers. You can get a 0/1 number by using logical ops like ==, <=, etc, but that is not the only way to do so.");
            return false;
        }

        if (val.val === 0) {
            call.i = step.jumpIfFalse;
            return true;
        }
    } else if (step.call) {
        const fn = step.call.fn

        const variables = new Map<string, number>();
        for (let i = 0; i < fn.args.length; i++) {
            const argIdx = result.stackIdx - fn.args.length + i + 1;
            variables.set(fn.args[i].name, argIdx);
        }
        result.stackIdx++;
        result.callStack.push({
            code: fn.code,
            argsCount: fn.args.length,
            i: 0, variables,
            returnAddress: call.nextVarAddress,
            nextVarAddress: call.nextVarAddress + 1,
        });
        call.i++;
        return true;
    } else if (step.builtinCall) {
        const res = evaluateBuiltinFunction(step.builtinCall.fn, result, step);
        if (result.errors.length > 0) {
            return false;
        }
        // Should always push an error if we're returning undefined
        assert(res);

        result.stackIdx -= step.builtinCall.numArgs;
        push(result, res, step);
    } else if (step.blockStatementEnd !== undefined) {
        // need this to clean up after the last 'statement'.
        const val = get(result)
        if (!val) {
            addError(result, step, "This block-level statement didn't return a result");
            return false;
        }

        result.stack[call.returnAddress] = val;
        result.stackIdx = call.nextVarAddress - 1;
    } else if (step.clearLastBlockResult) {
        result.stack[call.returnAddress] = null;
    } else if (step.index) {
        const idxResult = pop(result);

        if (idxResult.t !== T_RESULT_NUMBER) {
            addError(result, step, "Indexers must be numbers");
            return false;
        }

        const idx = idxResult.val;
        if ((idx % 1) !== 0) {
            addError(result, step, "Indexers can't have a decimal component");
            return false;
        }

        if (idx < 0) {
            addError(result, step, "Indexers can't be negative");
            return false;
        }

        const data = pop(result);
        if (data.t === T_RESULT_LIST) {
            if (idx >= data.values.length) {
                addError(result, step, "Index was out of bounds");
                return false;
            }

            push(result, data.values[idx], step);
        }

        if (data.t === T_RESULT_MATRIX) {
            // TODO: implement
            addError(result, step, "I haven't implemented this  yet :/");
            return false;
        }

        addError(result, step, "Can't index this datatype");
        return false;
    } else if (step.incr) {
        const addr = call.variables.get(step.incr);
        assert(addr !== undefined);
        const val = result.stack[addr];
        assert(val);
        assert(val.t === T_RESULT_NUMBER);
        val.val++;
    } else if (step.decr) {
        const addr = call.variables.get(step.decr);
        assert(addr !== undefined);
        const val = result.stack[addr];
        assert(val);
        assert(val.t === T_RESULT_NUMBER);
        val.val--;
    }

    call.i++;
    if (call.code.steps.length === call.i) {
        // this was the thing we last computed
        const val = result.stack[result.stackIdx];

        result.callStack.pop();
        const current = getCurrentCallstack(result);

        // this is the previous call frame's return address
        result.stackIdx = current ? current.returnAddress : 0;
        result.stack[result.stackIdx] = val;
    }
    return result.callStack.length > 0;
}

function newNumberResult(val: number): ProgramResultNumber {
    return { t: T_RESULT_NUMBER, val };
}

export function interpret(parseResult: ProgramParseResult): ProgramInterpretResult {
    const result = startInterpreting(parseResult);
    if (result.errors.length > 0) {
        return result;
    }

    // I've kept it low, because matrix ops and array programming can result in singular iterations
    // actually doing quite a lot of computations.
    let safetyCounter = 0;
    const MAX_ITERATIONS = 10000;
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

    return result;
}
