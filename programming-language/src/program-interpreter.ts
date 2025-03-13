import {
    BIN_OP_ADD, BIN_OP_AND_AND, BIN_OP_DIVIDE, BIN_OP_GREATER_THAN, BIN_OP_GREATER_THAN_EQ, BIN_OP_INVALID, BIN_OP_IS_EQUAL_TO, BIN_OP_LESS_THAN, BIN_OP_LESS_THAN_EQ, BIN_OP_MULTIPLY, BIN_OP_OR_OR, BIN_OP_SUBTRACT,
    BinaryOperatorType, 
    binOpToOpString, 
    binOpToString, 
    DiagnosticInfo, 
    expressionTypeToString, 
    parse, 
    ProgramExpression,
    ProgramExpressionFn,
    ProgramExpressionIdentifier,
    ProgramParseResult, 
    T_ASSIGNMENT, T_BINARY_OP, T_BLOCK, T_DATA_INDEX_OP, T_FN, T_IDENTIFIER, T_IDENTIFIER_THE_RESULT_FROM_ABOVE, T_LIST_LITERAL, T_NUMBER_LITERAL, T_RANGE_FOR, T_STRING_LITERAL, T_TERNARY_IF, T_VECTOR_LITERAL
} from "./program-parser";
import { assert } from "./utils/im-dom-utils";

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

export type ProgramResultHPMatrix = {
    t: typeof T_RESULT_MATRIX;
    val: HPMatrixIndex;
}

export type ProgramResultFunction = {
    t: typeof T_RESULT_FN;
    expr: ProgramExpressionFn;
    code: ExecutionSteps;
    args: ProgramExpressionIdentifier[];
};


export type HPMatrix = {
    values: number[];
    shape: number[];
};

export type HPMatrixIndex = {
    m: HPMatrix;
    indexes: number[];
};

function newHpMatrix(shape: number[]): HPMatrix {
    const numValues = getValueCount(shape);
    return {
        values: Array(numValues).fill(0),
        shape,
    }
}

function getValueCount(shape: number[]) {
    let numValues = 1;
    for (let i = 0; i < shape.length; i++) {
        numValues *= shape[i];
    }
    return numValues;
}

export type ProgramResultList = {
    t: typeof T_RESULT_LIST;
    values: ProgramResult[];
}

export type ProgramResult = ProgramResultNumber
    | ProgramResultRange
    | ProgramResultString
    | ProgramResultList
    | ProgramResultHPMatrix
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
            const dimension = output.val.indexes.length;
            const remainingShape = output.val.m.shape.slice(dimension);
            return remainingShape.length === 1 ? `Vector${remainingShape[0]}` : (
                `Matrix${remainingShape.map(s => "" + s).join("x")}`
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

function calculateBinaryOpNumberXNumber(
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

// Trying a product type isntead of a sum-type, will let u know how I go.
export type ExecutionStep = {
    // which code did we type to generate this thing?
    expr: ProgramExpression;

    // Loads a variable onto the stack
    // TODO: indices instead?
    load?: string;
    // Loads the last computed value in this block onto the stack
    // NOTE: turns out this is a pain to implement, so I'm removing it for now till I get the stack working. then it should be easy to re-add
    // loadPrevious?: boolean;
    // NOTE: same with this. they are related.
    
    // did this top level statement just end?
    // yes if not undefined. true if it was a top-level statement.
    blockStatementEnd?: boolean;

    // Pops the last stack value into the stack, assigns it to a variable, or indexing operation
    set?: string;
    // Pops the last two stack values, applies a binary operator to them
    binaryOperator?: BinaryOperatorType;
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

    // calls a function. this function pops however many things it needs.
    call?: { fnName: string };
};

export type ExecutionSteps = {
    name: string;
    steps: ExecutionStep[];
}

export function stepToString(interpretResult: ProgramInterpretResult, step: ExecutionStep) {
    if (step.load) {
        return ("Load " + step.load);
    }
    // if (step.loadPrevious) {
    //     return ("Load <the last result>");
    // }
    if (step.set) {
        return ("Set " + step.set);
    }
    if (step.binaryOperator) {
        return ("Binary op: " + binOpToOpString(step.binaryOperator) + " (" + binOpToString(step.binaryOperator) + ")");
    }
    if (step.list) {
        return ("List " + step.list);
    }
    if (step.vector) {
        return ("Vector " + step.vector);
    }
    if (step.number) {
        return ("Number " + step.number);
    }
    if (step.string) {
        return ("String " + step.string);
    }
    if (step.jump) {
        const value = step.jump;
        return ("jump to idx=" + value);
    }
    if (step.jumpIfFalse) {
        const value = step.jump;
        return ("jump (if false) to idx=" + value);
    }
    if (step.call) {
        const value = step.call;
        const fn = interpretResult.functions.get(value.fnName);
        return ("Call " + value.fnName + "(" + (fn ? fn.args.length + " args" : "doesn't exist!") + ")");
    }
    if (step.incr) {
        return "increment " + step.incr;
    } 
    if (step.decr) {
        return "decrement " + step.decr;
    }
    if (step.blockStatementEnd !== undefined) {
        return step.blockStatementEnd ? "top level block statement end" : "normal block level statement end";
    }
}

function newExecutionStep(expr: ProgramExpression): ExecutionStep {
    return { expr };
}


type ExecutionState = {
    lastBlockLevelResult: ProgramResult | null;
    code: ExecutionSteps;
    i: number;
    argsCount: number;
    
    // TODO: replace with an array
    variables: Map<string, number>;
    returnAddress: number;
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

    results: ProgramResult[];
}

function getExecutionSteps(
    result: ProgramInterpretResult,
    statements: ProgramExpression[],
    steps: ExecutionStep[],
    topLevel: boolean,
) {

    const incompleteExpressionError = (expr: ProgramExpression) => {
        // TODO: add the actual expression here
        result.errors.push({ pos: expr.pos, problem: "Found an incomplete expression" });
    }

    const dfs = (expr: ProgramExpression) => {
        if (result.errors.length > 0) {
            return;
        }

        const step = newExecutionStep(expr);
        let alreadyPushed = false;
        let noOp = false;

        switch (expr.t) {
            case T_IDENTIFIER: {
                step.load = expr.name;
            } break;
            case T_IDENTIFIER_THE_RESULT_FROM_ABOVE: {
                result.errors.push({ pos: expr.pos, problem: "Ive not implemented it yet..." });
                return;
                // step.loadPrevious = true;
            } break;
            case T_ASSIGNMENT: {
                if (!expr.rhs) {
                    incompleteExpressionError(expr);
                    return;
                }

                if (expr.lhs.t !== T_IDENTIFIER && expr.lhs.t !== T_DATA_INDEX_OP) {
                    result.errors.push({ pos: expr.pos, problem: "This expression currently cannot be assigned to" });
                    return;
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
                    return;
                }

                dfs(expr.rhs);
                dfs(expr.lhs);
                step.binaryOperator = expr.op;
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
                    return;
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

                dfs(expr.loExpr);
                if (!expr.ascending) {
                    steps.push({ expr, number: 1 });
                    steps.push({ expr, binaryOperator: BIN_OP_SUBTRACT });
                }
                steps.push({ expr, set: expr.loopVar.name });

                const loopStartIdx = steps.length;

                steps.push({ expr, load: expr.loopVar.name });
                dfs(expr.hiExpr);
                if (expr.ascending) {
                    steps.push({ expr, binaryOperator: BIN_OP_LESS_THAN });
                } else {
                    steps.push({ expr, binaryOperator: BIN_OP_GREATER_THAN_EQ });
                }

                const jumpToLoopEndIfFalse = newExecutionStep(expr);
                steps.push(jumpToLoopEndIfFalse);

                if (expr.ascending) {
                    steps.push({ expr, incr: expr.loopVar.name });
                } else {
                    steps.push({ expr, decr: expr.loopVar.name });
                }

                dfs(expr.body);

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

                    step.call = { fnName: expr.fnName.name };
                }
            } break;
            case T_DATA_INDEX_OP: {
                throw new Error("TODO: Implement data indexing");
            } break;
            default: {
                throw new Error("Unhandled type: " + expressionTypeToString(expr));
            }
        }

        if (!alreadyPushed && !noOp) {
            steps.push(step);
        }
    }

    for (const s of statements) {
        dfs(s);
        steps.push({ expr: s, blockStatementEnd: topLevel });
    }
}

function getLengthHpMatrix(val: HPMatrixIndex): number {
    const dimension = val.indexes.length;
    return val.m.shape[dimension];
}

function getLength(result: ProgramResult): number | undefined {
    switch(result.t) {
        case T_RESULT_LIST: return result.values.length;
        case T_RESULT_STRING: return result.val.length;
        case T_RESULT_RANGE: return Math.abs(result.val.lo - result.val.hi);
        case T_RESULT_MATRIX: return getLengthHpMatrix(result.val);
    }
}

function get(result: ProgramInterpretResult): ProgramResult | null {
    return result.stack[result.stackIdx];
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
    }

    result.stack[result.stackIdx] = val;
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
        stackIdx: -1,
        callStack: [],
        results: [],
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
        i: 0, lastBlockLevelResult: null, variables: new Map(), 
        returnAddress: -1
    });

    return result;
};

export function getCurrentCallstack(result: ProgramInterpretResult): ExecutionState | undefined {
    return result.callStack[result.callStack.length - 1];
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
    } 
    // else if (step.loadPrevious) {
    //     if (!call.lastBlockLevelResult) {
    //         addError(result, step, "Can't refer to 'the previous result' when this block doesn't have any results yet");
    //         return false;
    //     }
    //
    //     push(result, call.lastBlockLevelResult, step);
    // } 
    else if (step.set) {
        // NOTE: setting a variable doesn't remove it from the stack, because assignment will return the value that was assigned.
        const val = get(result);
        if (!val) {
            addError(result, step, "Last wn pstep didn't generate any results")
            return false;
        }

        const s = getVarExecutionState(result, step.set);
        if (!s) {
            assert(result.stackIdx === call.returnAddress + 1);
            call.variables.set(step.set, result.stackIdx);
            call.returnAddress++;
        } else {
            const addr = s.variables.get(step.set)!;
            result.stack[addr] = val;
        }
    } else if (step.binaryOperator) {
        const rhs = pop(result);
        const lhs = pop(result);

        let calcResult: ProgramResult | null = null;

        if (lhs.t === T_RESULT_NUMBER) {
            if (rhs.t == T_RESULT_NUMBER) {
                calcResult = calculateBinaryOpNumberXNumber(rhs, lhs, step.binaryOperator);
            }
        }

        if (!calcResult) {
            addError(result, step, `We don't have a way to compute ${programResultTypeString(lhs)} ${binOpToOpString(step.binaryOperator)} ${programResultTypeString(rhs)} yet.`);
            return false;
        }

        push(result, calcResult, step);
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
            const val = result.stack[i];
            assert(val);

            if (val.t !== T_RESULT_NUMBER && val.t !== T_RESULT_MATRIX) {
                addError(result, step, "Vectors/Matrices can only contain other vectors/matrices/numbers");
                return false;
            }

            let rowLen;
            if (val.t === T_RESULT_MATRIX) {
                rowLen = getLengthHpMatrix(val.val);

                // TODO: reserve the correct size based on matrix shape. flatmap...
                values.push(...val.val.m.values);
            } else {
                values.push(val.val);
                rowLen = 1;
            }

            if (i === 0) {
                innerLen = rowLen;
                innerT = val.t;
                if (val.t === T_RESULT_MATRIX) {
                    innerShape = val.val.m.shape;
                }
            } else {
                if (innerT !== val.t) {
                    addError(result, step, "This item had a different type to the previous items in the vector");
                } else if (innerLen !== rowLen) {
                    addError(result, step, "This vector had a different length to the previous vectors");
                }
                return false;
            }
        }

        const newShape = innerShape ? [len, ...innerShape] : [len];

        push(result, {
            t: T_RESULT_MATRIX,
            val: { m: { values, shape: newShape }, indexes: [] }
        }, step);
    } else if (step.number !== undefined) {
        push(result, { t: T_RESULT_NUMBER, val: step.number }, step);
    } else if (step.string !== undefined) {
        push(result, { t: T_RESULT_STRING, val: step.string }, step);
    } else if (step.jump !== undefined) {
        assert(step.jump >= 0);
        assert(step.jump < steps.length);
        call.i = step.jump;
        return true;
    } else if (step.jumpIfFalse !== undefined) {
        assert(step.jumpIfFalse >= 0);
        assert(step.jumpIfFalse < steps.length);

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
        const value = step.call;
        const fn = result.functions.get(value.fnName);
        if (!fn) {
            addError(result, step, "Function doesn't exist yet");
            return false;
        }

        const variables = new Map<string, number>();
        for (let i = 0; i < fn.args.length; i++) {
            const argIdx = result.stackIdx - fn.args.length + i + 1;
            variables.set(fn.args[i].name, argIdx);
        }
        result.callStack.push({ 
            code: fn.code, 
            argsCount: fn.args.length,
            i: 0, lastBlockLevelResult: null, variables, 
            // TODO: verify that this is correct, it prob isn't
            returnAddress: call.returnAddress + fn.args.length,
        });
        call.i++;
        return true;
    }
    else if (step.blockStatementEnd !== undefined) {
        // need this to clean up after the last 'statement', actually.
        const val = get(result);
        result.stackIdx = call.returnAddress;
        if (step.blockStatementEnd === true && val) {
            result.results.push({ ...val });
        }
    } 
    else if (step.index) {
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
        const val = result.stack[result.stackIdx + 1];
        result.stackIdx = call.returnAddress - call.argsCount + 1;
        result.stack[result.stackIdx] = val;
        result.callStack.pop();
    }
    return result.callStack.length > 0;
}

export function interpret(parseResult: ProgramParseResult): ProgramInterpretResult {
    const result = startInterpreting(parseResult);
    if (result.errors.length > 0) {
        return result;
    }

    // step through the code...
    while (result.callStack.length > 0) {
        let res = stepProgram(result);
        if (!res) {
            break;
        }
    }

    return result;
}
