import { assert } from "./utils/im-dom-utils";

////////////////////////
// Parser


export type TextSlice = {
    fullText: string;
    start: number;
    end: number;
}

export type TextPosition = {
    i: number;
    line: number;
    col: number;
};

function newTextPosition(i: number, line: number, col: number): TextPosition {
    return { i, line, col };
}

export const T_IDENTIFIER = 1;
export const T_IDENTIFIER_THE_RESULT_FROM_ABOVE = 2;

export const T_BINARY_OP = 3;

export const T_NUMBER_LITERAL = 4;
export const T_LIST_LITERAL = 5;
export const T_VECTOR_LITERAL = 6;
export const T_STRING_LITERAL = 7;
export const T_TERNARY_IF = 8;
export const T_BLOCK = 9;
export const T_DATA_INDEX_OP = 10;
export const T_FN = 11;
export const T_RANGE_FOR = 12;
export const T_ASSIGNMENT = 13;

export function expressionTypeToString(expr: ProgramExpression): string {
    switch(expr.t) {
        case T_IDENTIFIER:
            return "Identifier";
        case T_IDENTIFIER_THE_RESULT_FROM_ABOVE:
            return "(result from above)";
        case T_BINARY_OP:
            return "Binary operator";
        case T_NUMBER_LITERAL:
            return "Number literal";
        case T_LIST_LITERAL:
            return "List literal";
        case T_VECTOR_LITERAL:
            return "Matrix literal";
        case T_STRING_LITERAL:
            return "String literal";
        case T_TERNARY_IF:
            return "Ternary if";
        case T_BLOCK:
            return "Block";
        case T_FN:
            return expr.body ? "Function declaration" : "Function call";
        case T_DATA_INDEX_OP:
            return "Indexing op";
        case T_RANGE_FOR:
            return "Range-for loop";
        case T_ASSIGNMENT:
            return "Assignment";
    }
}

export const BIN_OP_MULTIPLY = 2;
export const BIN_OP_DIVIDE = 3;
export const BIN_OP_ADD = 4;
export const BIN_OP_SUBTRACT = 5;
export const BIN_OP_IS_EQUAL_TO = 6;
export const BIN_OP_LESS_THAN = 7;
export const BIN_OP_LESS_THAN_EQ = 8;
export const BIN_OP_GREATER_THAN = 9;
export const BIN_OP_GREATER_THAN_EQ = 10;
export const BIN_OP_AND_AND = 11;
export const BIN_OP_OR_OR = 12;
export const BIN_OP_INVALID = -1;

export type BinaryOperatorType = typeof BIN_OP_MULTIPLY
    | typeof BIN_OP_DIVIDE
    | typeof BIN_OP_ADD
    | typeof BIN_OP_SUBTRACT
    | typeof BIN_OP_IS_EQUAL_TO
    | typeof BIN_OP_LESS_THAN
    | typeof BIN_OP_LESS_THAN_EQ
    | typeof BIN_OP_GREATER_THAN
    | typeof BIN_OP_GREATER_THAN_EQ
    | typeof BIN_OP_AND_AND
    | typeof BIN_OP_OR_OR
    | typeof BIN_OP_INVALID;


export function getBinaryOperatorType(c: string): BinaryOperatorType {
    switch (c) {
    }

    return BIN_OP_INVALID;
}

export function binOpToOpString(op: BinaryOperatorType): string {
    switch (op) {
        case BIN_OP_MULTIPLY: return "*";
        case BIN_OP_DIVIDE: return "/";
        case BIN_OP_ADD: return "+";
        case BIN_OP_SUBTRACT: return "-";
        case BIN_OP_IS_EQUAL_TO: return "==";
        case BIN_OP_GREATER_THAN: return ">";
        case BIN_OP_GREATER_THAN_EQ: return ">=";
        case BIN_OP_LESS_THAN: return "<";
        case BIN_OP_LESS_THAN_EQ: return "<=";

        case BIN_OP_AND_AND: return "&&";
        case BIN_OP_OR_OR: return "||";
        case BIN_OP_INVALID: return "???";
    }
}

export function isUnreachable(t: never): never {
    throw new Error("This code is unreachable!");
}

// This precedence table is the gift that keeps giving. thank you j blow, very cool.
function getBinOpPrecedence(op: BinaryOperatorType): number {
    switch (op) {
        case BIN_OP_IS_EQUAL_TO: 
        case BIN_OP_GREATER_THAN: 
        case BIN_OP_GREATER_THAN_EQ: 
        case BIN_OP_LESS_THAN: 
        case BIN_OP_LESS_THAN_EQ: 
            return 2;
        case BIN_OP_AND_AND:
            return 3;
        case BIN_OP_OR_OR:
            return 4;
        case BIN_OP_MULTIPLY:
        case BIN_OP_DIVIDE:
            return 7;
        case BIN_OP_ADD:
        case BIN_OP_SUBTRACT:
            return 8;
        case BIN_OP_INVALID:
            return -1;
    }
}
const TERNARY_PRECEDENCE = 20;

const MAX_PRECEDENCE = 100;

export function binOpToString(op: BinaryOperatorType): string {
    switch (op) {
        case BIN_OP_MULTIPLY: return "Multiply";
        case BIN_OP_DIVIDE: return "Divide";
        case BIN_OP_ADD: return "Add";
        case BIN_OP_SUBTRACT: return "Subtract";
        case BIN_OP_IS_EQUAL_TO: return "Is equal to";
        case BIN_OP_LESS_THAN: return "Is less than";
        case BIN_OP_LESS_THAN_EQ: return "Is less than or equal to";
        case BIN_OP_GREATER_THAN: return "Is greater than";
        case BIN_OP_GREATER_THAN_EQ: return "Is greater than or equal to";
        case BIN_OP_AND_AND: return "And";
        case BIN_OP_OR_OR: return "Or";
        case BIN_OP_INVALID: return "???";
    }
}


export type ProgramExpressionBase = {
    slice: TextSlice;
    pos: TextPosition;
};

// An identifier is just something that refers to a thing in the program.
// It could be a variable name, or varName[i]. It is any lvalue.
export type ProgramExpressionIdentifier = ProgramExpressionBase & {
    t: typeof T_IDENTIFIER;
    name: string;
}

export type ProgramExpressionPreviousResult = ProgramExpressionBase & {
    t: typeof T_IDENTIFIER_THE_RESULT_FROM_ABOVE;
};

export type ProgramExpressionNumberLiteral = ProgramExpressionBase & {
    t: typeof T_NUMBER_LITERAL;
    integerPart: TextSlice;
    decimalPart: TextSlice | null;
    exponentPart: TextSlice | null;
    isNegative: boolean;
    val: number;
}

export type ProgramExpressionListLiteral = ProgramExpressionBase & {
    t: typeof T_LIST_LITERAL | typeof T_VECTOR_LITERAL;
    items: ProgramExpression[];
}

export type ProgramExpressionStringLiteral = ProgramExpressionBase & {
    t: typeof T_STRING_LITERAL;
    val: string;
}

export type ProgramExpressionTernaryIf = ProgramExpressionBase & {
    t: typeof T_TERNARY_IF;
    query: ProgramExpression;
    trueBranch: ProgramExpression;
    falseBranch: ProgramExpression | undefined;
}

export type ProgramExpressionBinaryOperator = ProgramExpressionBase & {
    t: typeof T_BINARY_OP;
    // NOTE: it would be more optimal to just have t encode every binary op as a separate type...
    // I don't care about this right now though
    op: BinaryOperatorType; 
    lhs: ProgramExpression;
    rhs?: ProgramExpression; 
}

export type ProgramExpressionBlock = ProgramExpressionBase & {
    t: typeof T_BLOCK;
    statements: ProgramExpression[];
}

export type ProgramExpressionDataIndex = ProgramExpressionBase & {
    t: typeof T_DATA_INDEX_OP;
    lhs: ProgramExpression;
    indexes: ProgramExpression[];
}

export type ProgramExpressionFn = ProgramExpressionBase & {
    t: typeof T_FN;
    fnName: ProgramExpressionIdentifier;
    arguments: ProgramExpression[];
    // If these are present, it's a declaration. else, it's a call.
    body: ProgramExpressionBlock | null;
    argumentNames: ProgramExpressionIdentifier[] | null;
}

export type ProgramExpressionRangedFor = ProgramExpressionBase & {
    t: typeof T_RANGE_FOR;
    loopVar: ProgramExpressionIdentifier;
    ascending: boolean;
    loExpr: ProgramExpression;
    hiExpr: ProgramExpression;
    body: ProgramExpression;
};

export type ProgramExpressionAssignment = ProgramExpressionBase & {
    t: typeof T_ASSIGNMENT;
    lhs: ProgramExpression;
    rhs?: ProgramExpression; 
};

export type ProgramExpression = ProgramExpressionIdentifier
    | ProgramExpressionPreviousResult
    | ProgramExpressionBinaryOperator
    | ProgramExpressionNumberLiteral
    | ProgramExpressionListLiteral
    | ProgramExpressionStringLiteral
    | ProgramExpressionTernaryIf
    | ProgramExpressionBlock
    | ProgramExpressionDataIndex
    | ProgramExpressionFn
    | ProgramExpressionRangedFor
    | ProgramExpressionAssignment;

export type ProgramParseResult = {
    text: string;
    statements: ProgramExpression[];
    functions: Map<string, ProgramExpressionFn>;
    errors: DiagnosticInfo[];
    warnings: DiagnosticInfo[];
};

export type DiagnosticInfo = {
    pos: TextPosition;
    problem: string;
};

// Not sure why I called it parser context and not just 'Parser'. 
// Must be a residual in my mind of my last implementation.
type ParserContext = {
    text: string;
    parseResult: ProgramParseResult;
    pos: TextPosition;
}

function newOptionalTextSlice(text: string, start: number, end: number): TextSlice | null {
    if (start === end) {
        return null;
    }

    return newTextSlice(text, start, end);
}

function newTextSlice(text: string, start: number, end: number): TextSlice {
    return {
        start,
        end,
        fullText: text,
    };
}

export function getSliceText(slice: TextSlice) {
    // DEV: you forgot to set the span correctly
    assert(slice.end >= slice.start);

    return slice.fullText.substring(slice.start, slice.end);
}

// Thankyou Trevor https://stackoverflow.com/questions/1496826/check-if-a-single-character-is-a-whitespace
function isWhitespace(c: string) {
    return (
        c === " " ||
        c === "\n" ||
        c === "\t" ||
        c === "\r" ||
        c === "\f" ||
        c === "\v" ||
        c === "\u00a0" ||
        c === "\u1680" ||
        c === "\u2000" ||
        c === "\u200a" ||
        c === "\u2028" ||
        c === "\u2029" ||
        c === "\u202f" ||
        c === "\u205f" ||
        c === "\u3000" ||
        c === "\ufeff"
    );
}

function isDigit(c: string) {
    const code = c.charCodeAt(0);
    // ASCII codes for '0' and '9'
    return code >= 48 && code <= 57; 
}

function isLetter(c: string) {
    return c.toUpperCase() != c.toLowerCase() || (c.codePointAt(0) ?? 0) > 127 || c === "_";
}

function currentChar(ctx: ParserContext, offset = 0) {
    return ctx.text[ctx.pos.i + offset] ?? "";
}

function compareCurrent(ctx: ParserContext, str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        const pos = ctx.pos.i + i;
        if (pos >= ctx.text.length) {
            return false;
        }

        if (ctx.text[pos] !== str[i]) {
            return false;
        }
    }

    return true;
}

function reachedEnd(ctx: ParserContext) {
    return ctx.pos.i >= ctx.text.length;
}

function advance(ctx: ParserContext) {
    ctx.pos.i++;
    if (currentChar(ctx) === "\n") {
        ctx.pos.line++;
        ctx.pos.col = 0;
    } else {
        ctx.pos.col++;
    }


    return !reachedEnd(ctx);
}

function parseWhitespace(ctx: ParserContext) {
    while (!reachedEnd(ctx)) {
        const c = currentChar(ctx);
        if (isWhitespace(c)) {
            advance(ctx);
            continue;
        }

        // Comments can be considered whitespace.
        if (compareCurrent(ctx, "//")) {
            advanceToNextNewLine(ctx);
            advance(ctx);
            continue;
        }

        break;
    }
}

function isAllowedIdentifierSymbol(char: string) {
    return isLetter(char) || isDigit(char) || (
        char === "_"
    );
}

function canParseNumberLiteral(ctx: ParserContext) {
    const c = currentChar(ctx);
    return c === "-" || c === "+" || isDigit(c);
}

function isValidNumberPart(c: string) {
    return isDigit(c) || c === "_";
}

function parseTernaryIf(ctx: ParserContext, query: ProgramExpression): ProgramExpressionTernaryIf | undefined {
    assert(currentChar(ctx) === "?");
    const pos = getParserPosition(ctx);

    advance(ctx);
    parseWhitespace(ctx);

    const start = query.slice.start

    const trueBranch = parseExpression(ctx);
    if (!trueBranch) {
        return undefined;
    }

    const res: ProgramExpressionTernaryIf = {
        t: T_TERNARY_IF,
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
        pos,
        query,
        trueBranch,
        falseBranch: undefined,
    };

    parseWhitespace(ctx);
    if (currentChar(ctx) !== ":") {
        addErrorAtCurrentPosition(ctx, "Expected a colon : here to start the false path of the ternary");
    } else {
        advance(ctx);
    }

    parseWhitespace(ctx);

    const falseBranch = parseExpression(ctx);
    if (falseBranch) {
        res.falseBranch = falseBranch;
        res.slice.end = ctx.pos.i;
    }

    return res;
}


// TODO: This is a very basic string literal that could be vastly improved. current problems include:
// - opening a " connects directly to the start of another string. JavaScript ` has this problem as well, lmao.
// - I want the indentation in a string to be relative to the current indentation of the code, not to the
//      start of the line. Something like the Java """ strings would be good here
// - need some form of interpolation, since that is always nice to have.
function parseStringLiteral(ctx: ParserContext): ProgramExpressionStringLiteral | undefined {
    assert(currentChar(ctx) === "\"");
    const pos = getParserPosition(ctx);

    const startPos = getParserPosition(ctx);

    let closed = false;
    while (!reachedEnd(ctx)) {
        advance(ctx);

        const c = currentChar(ctx);
        if (c === "\\") {
            advance(ctx);
        } else if (c === "\"") {
            closed = true;
            advance(ctx);
            break;
        }
    }

    // There's a good chance we'll go off the edge of the document when 
    // we've opened up a string literal. It's best we just reset to the end of the
    // line we started on, so we can still parse the rest of the stuff correctly (hopefully);

    if (!closed) {
        ctx.pos = startPos;
        advanceToNextNewLine(ctx);
        return;
    }


    const result: ProgramExpressionStringLiteral = {
        t: T_STRING_LITERAL,
        slice: newTextSlice(ctx.text, startPos.i, ctx.pos.i),
        pos,
        val: "",
    };

    const [val, error] = computeStringForStringLiteral(result);
    if (!val) {
        addErrorAtCurrentPosition(ctx, error);
        return;
    }

    result.val = val;
    return result;
}

function computeStringForStringLiteral(expr: ProgramExpressionStringLiteral): [string | undefined, string] {
    const text = getSliceText(expr.slice);
    const sb = [];

    let isEscape = false;
    let errorMessage = "";
    for (const c of text) {
        if (c === "\\") {
            isEscape = true;
            continue;
        }

        if (!isEscape) {
            sb.push(c);
        } else {
            switch(c) {
                case "n":
                    sb.push("\n");
                    break;
                case "r":
                    sb.push("\r");
                    break;
                case "b":
                    sb.push("\b");
                    break;
                case "t":
                    sb.push("\t");
                    break;
                case "n":
                    sb.push("\n");
                    break;
                case "\\":
                    sb.push("\\");
                    break;
                default:
                    errorMessage = "Invalid escape sequence \\" + c;
                    break;
            }
        }
    }

    if (!errorMessage) {
        return [undefined, errorMessage]
    }

    const result = sb.join("");
    return [result, ""];
}


function parseBlock(ctx: ParserContext): ProgramExpressionBlock | undefined {
    assert(currentChar(ctx) === "{");
    advance(ctx);
    const pos = getParserPosition(ctx);

    const start = ctx.pos.i;

    const statements: ProgramExpression[] = [];
    parseStatements(ctx, statements, "}");

    if (currentChar(ctx) !== "}") {
        addErrorAtCurrentPosition(ctx, "Expected a closing curly brace } here");
        return;
    }

    advance(ctx);

    return {
        t: T_BLOCK,
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
        pos,
        statements
    };
}

function parseRangedFor(ctx: ParserContext): ProgramExpressionRangedFor | undefined {
    assert(compareCurrent(ctx, "for"));
    const pos = getParserPosition(ctx);

    const start = ctx.pos.i;

    for (let i = 0; i < 3; i++) {
        advance(ctx);
    }

    parseWhitespace(ctx);

    if (!isLetter(currentChar(ctx))) {
        addErrorAtCurrentPosition(ctx, "Expected an identifier to assign the current loop variable to here");
        return undefined;
    }
    const loopVar = parseIdentifier(ctx);

    parseWhitespace(ctx);

    if (!compareCurrent(ctx, "in")) {
        addErrorAtCurrentPosition(ctx, `Expected the ranged for-loop keyword "in" here`);
        return undefined;
    }
    for (let i = 0; i < 2; i++) {
        advance(ctx);
    }

    parseWhitespace(ctx);

    const loExpr = parseExpression(ctx);
    if (!loExpr) {
        addErrorAtCurrentPosition(ctx, `Expected the lower portion of the range-expression here`);
        return undefined;
    }

    parseWhitespace(ctx);
    const ascending = compareCurrent(ctx, "->");
    const descending = compareCurrent(ctx, "<-");
    if (!ascending && !descending) {
        addErrorAtCurrentPosition(ctx, `Expected the ranged for-loop operator <- or -> here (we need to know which way to loop at parse time for reasons...)`);
        return undefined;
    }
    for (let i = 0; i < 2; i++) {
        advance(ctx);
    }

    parseWhitespace(ctx);
    const hiExpr = parseExpression(ctx);
    if (!hiExpr) {
        addErrorAtCurrentPosition(ctx, `Expected the higher portion of the range-expression here`);
        return undefined;
    }

    parseWhitespace(ctx);
    if (currentChar(ctx) !== "{") {
        addErrorAtCurrentPosition(ctx, "Expected a block here for the loop body. E.g `for i in 0..<100 { log(i) }`");
        return undefined;
    }

    const loopExpr = parseBlock(ctx);
    if (!loopExpr) {
        return undefined;
    }

    const result: ProgramExpressionRangedFor = {
        t: T_RANGE_FOR,
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
        pos,
        loopVar,
        loExpr,
        ascending,
        hiExpr,
        body: loopExpr,
    };

    return result;
}

function parseExpressionsDelimiterSeparated(
    ctx: ParserContext, 
    expressions: ProgramExpression[], 
    delimiter: string, 
    closingDelimiterChar: string,
) {
    assert(delimiter.length === 1);
    assert(closingDelimiterChar.length === 1);

    let foundClosingDelimiter = false;

    while(!reachedEnd(ctx)) {
        parseWhitespace(ctx);

        const expr = parseExpression(ctx);
        if (expr) {
            expressions.push(expr);

            parseWhitespace(ctx);
        } 

        let foundDelimiter = false;
        if (compareCurrent(ctx, delimiter)) {
            if (!expr) {
                addErrorAtCurrentPosition(ctx, `Found a delimiter ${delimiter} before an actual expression`);
                return undefined;
            }

            foundDelimiter = true;

            advance(ctx);

            parseWhitespace(ctx);
        }

        if (currentChar(ctx) === closingDelimiterChar) {
            foundClosingDelimiter = true;
            advance(ctx);
            break;
        }

        if (!expr) {
            addErrorAtCurrentPosition(ctx, `Expected a closing delmiter ${closingDelimiterChar} here.`);
            return undefined;
        }

        if (!foundDelimiter) {
            addErrorAtCurrentPosition(ctx, `Expected a delimiter ${delimiter} here.`);
            return undefined;
        }
    }
}

function parseListLiteral(ctx: ParserContext): ProgramExpressionListLiteral | undefined {
    assert(currentChar(ctx) === "[");
    const pos = getParserPosition(ctx);

    const result: ProgramExpressionListLiteral = {
        t: T_VECTOR_LITERAL,
        slice: newTextSlice(ctx.text, ctx.pos.i, 0),
        pos,
        items: [],
    };

    advance(ctx);

    parseExpressionsDelimiterSeparated(ctx, result.items, "," ,"]");

    if (currentChar(ctx) === "L") {
        result.t = T_LIST_LITERAL;
        advance(ctx);
    }

    result.slice.end = ctx.pos.i;
    return result;
}

function parseNumberLiteral(ctx: ParserContext): ProgramExpressionNumberLiteral {
    assert(canParseNumberLiteral(ctx));
    const pos = getParserPosition(ctx);

    let isNegative = false;
    if (currentChar(ctx) === "+") {
        advance(ctx);
    } else if (currentChar(ctx) === "-") {
        isNegative = true;
        advance(ctx);
    }

    const start = ctx.pos.i;
    while (advance(ctx) && isValidNumberPart(currentChar(ctx))) { }

    const result: ProgramExpressionNumberLiteral = {
        t: T_NUMBER_LITERAL,
        integerPart: newTextSlice(ctx.text, start, ctx.pos.i),
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
        pos,
        decimalPart: null,
        exponentPart: null,
        isNegative,
        val: 0,
    };

    if (
        currentChar(ctx) === "."
        // Here specifically because we need to make sure numbers don't collide with ..< and ..= operators
        && currentChar(ctx, 1) !== "."
        && advance(ctx)
    ) {
        const decimalPartStart = ctx.pos.i;
        while (isValidNumberPart(currentChar(ctx)) && advance(ctx)) { }
        result.decimalPart = newOptionalTextSlice(ctx.text, decimalPartStart, ctx.pos.i);
        result.slice.end = ctx.pos.i;
    }

    if (currentChar(ctx) === "e" && advance(ctx)) {
        const exponentPartStart = ctx.pos.i;
        const c = currentChar(ctx);
        if (c === "+" || c === "-") {
            if (!advance(ctx)) {
                return result;
            }
        }

        while (isValidNumberPart(currentChar(ctx)) && advance(ctx)) { }
        result.exponentPart = newOptionalTextSlice(ctx.text, exponentPartStart, ctx.pos.i);
        result.slice.end = ctx.pos.i;
    }

    result.val = computeNumberForNumberExpression(result);

    return result;
}

function computeNumberForNumberExpression(expr: ProgramExpressionNumberLiteral): number {
    let result = 0;

    if (expr.decimalPart) {
        const text = getSliceText(expr.decimalPart).replace(/_/g, "");
        const decimalVal = parseInt(text) / Math.pow(10, text.length)
        result += decimalVal;
    }

    if (expr.integerPart) {
        const text = getSliceText(expr.integerPart).replace(/_/g, "");
        const intVal = parseInt(text);
        result += intVal;
    }

    if (expr.exponentPart) {
        const text = getSliceText(expr.exponentPart).replace(/_/g, "");
        const expVal = parseInt(text);
        result *= Math.pow(10, expVal);
    }

    if (expr.isNegative) {
        result = -result;
    }

    // TODO: return undefined if the literal is impossible to generate properly

    return result;
}

// Parses quite a lot of stuff, actually.
// - function declarations/calls
// - indexaction ops (we gotta move this actually)
// - assignment (used to be done with precedence, but then I had a whole
// bunch of code everywhere checking that it was only happening as a 'block level' statement. also makes the
// stack frame stuff easier to implement when we make it it's own thing like this
function parseIdentifierAndFollowOns(ctx: ParserContext): ProgramExpression | undefined {
    const pos = getParserPosition(ctx);
    let result: ProgramExpression = parseIdentifierOrPreviousResultOp(ctx);

    parseWhitespace(ctx);

    if (currentChar(ctx) === "[") {
        // TODO: move this to be for any expression
        result = {
            t: T_DATA_INDEX_OP,
            slice: newTextSlice(ctx.text, result.slice.start, ctx.pos.i),
            pos,
            lhs: result,
            indexes: [],
        };

        while (currentChar(ctx) === "[" && advance(ctx)) {
            const expr = parseExpressionOrMoveToNextLine(ctx);
            if (expr) {
                result.indexes.push(expr);
            } else {
                return result;
            }

            parseWhitespace(ctx);

            if (currentChar(ctx) !== "]") {
                addErrorAtCurrentPosition(ctx, "Expected a closing square brace ] here");
                break;
            }

            advance(ctx);

            parseWhitespace(ctx);
        }

        result.slice.end = ctx.pos.i;
    }

    if (result.t === T_IDENTIFIER && currentChar(ctx) === "(") {
        result = {
            t: T_FN,
            slice: newTextSlice(ctx.text, result.slice.start, ctx.pos.i),
            pos,
            fnName: result,
            arguments: [],
            body: null,
            argumentNames: null,
        };

        advance(ctx);

        parseExpressionsDelimiterSeparated(ctx, result.arguments, ",", ")");

        parseWhitespace(ctx);

        if (currentChar(ctx) === "{") {
            ctx.parseResult.functions.set(result.fnName.name, result);

            const argNames: ProgramExpressionIdentifier[] = [];
            for (let i = 0; i < result.arguments.length; i++) {
                const arg = result.arguments[i];

                if (arg.t !== T_IDENTIFIER) {
                    addErrorAtPosition(ctx, arg.pos, "A function declaration's arguments list can only be identifiers");
                    return;
                }

                const name = arg.name;
                for (const otherName of argNames) {
                    if (otherName.name === name) {
                        addErrorAtPosition(ctx, arg.pos, "This argument name matches the name of a previous argument");
                        return;
                    }
                }

                argNames.push(arg);
            }

            result.argumentNames = argNames;

            const block = parseBlock(ctx);

            if (!block) {
                return undefined;
            }

            result.body = block;
        }

        result.slice.end = ctx.pos.i;
    } else if (currentChar(ctx) === "=" && currentChar(ctx, 1) !== "=") {
        advance(ctx);
        parseWhitespace(ctx);

        // TODO: move this to be for any expression
        result = {
            t: T_ASSIGNMENT,
            slice: newTextSlice(ctx.text, result.slice.start, ctx.pos.i),
            pos,
            lhs: result,
            rhs: undefined,
        };

        const rhs = parseExpression(ctx);
        if (!rhs) {
            addErrorAtPosition(ctx, getParserPosition(ctx), "Assignment expression is incomplete");
            return result;
        }

        result.rhs = rhs;
        result.slice.end = ctx.pos.i;
    }

    return result;
}

function parseIdentifierOrPreviousResultOp(ctx: ParserContext): ProgramExpressionIdentifier | ProgramExpressionPreviousResult {
    const c = currentChar(ctx);
    const pos = getParserPosition(ctx);

    // Sometimes, someone might message something into the chat, and then rather than typing
    // "I agree" or something, I'll type "^" - shorthand for (this right here :upwards finger:). 
    // We can actually just add this to the programming language.
    // I actually can't think of real usecases - this is just an idea that follows on nicely from the two properties
    // we have in this language:
    //  - we don't have any 'early returns'
    //  - the result of a 'block' is just the last thing in that block
    if (c === "^") {
        advance(ctx);
        return {
            t: T_IDENTIFIER_THE_RESULT_FROM_ABOVE,
            slice: newTextSlice(ctx.text, ctx.pos.i - 1, ctx.pos.i),
            pos,
        };
    }

    return parseIdentifier(ctx);
}

function parseIdentifier(ctx: ParserContext): ProgramExpressionIdentifier  {
    assert(isLetter(currentChar(ctx)));
    const pos = getParserPosition(ctx);

    const start = ctx.pos.i;
    while (
        isAllowedIdentifierSymbol(currentChar(ctx)) && 
        advance(ctx)
    ) {}

    const slice = newTextSlice(ctx.text, start, ctx.pos.i);

    const name = getSliceText(slice);

    return {
        t: T_IDENTIFIER,
        slice,
        pos,
        name,
    };
}

function parseBinaryOperator(ctx: ParserContext): BinaryOperatorType {
    let op: BinaryOperatorType = BIN_OP_INVALID;

    const c = currentChar(ctx);
    const c2 = currentChar(ctx, 1);
    const c3 = currentChar(ctx, 2);
    switch(c) {
        case "=": 
            if (c2 === "=") {
                op = BIN_OP_IS_EQUAL_TO;
            }
            break;
        case "*": op = BIN_OP_MULTIPLY; break;
        case "/": op = BIN_OP_DIVIDE; break;
        case "+": op = BIN_OP_ADD; break;
        case "-": 
            // Avoid conflicting with "->"
            if (c2 !== ">" && c2 !== "<") {
                op = BIN_OP_SUBTRACT; 
            }
            break;
        case "<": 
            // Avoid conflicting with "<-"
            if (c2 !== "-") {
                if (c2 === "=") {
                    op = BIN_OP_LESS_THAN_EQ;
                } else {
                    op = BIN_OP_LESS_THAN;
                }
            }
            break;
        case ">": 
            if (c2 === "=") {
                op = BIN_OP_GREATER_THAN_EQ;
            } else {
                op = BIN_OP_GREATER_THAN;
            }
            break;
        case "&": 
            if (c2 === "&") {
                op = BIN_OP_AND_AND; 
            }
            break;
        case "|":  {
            if (c2 === "|") {
                op = BIN_OP_OR_OR;
            }
            break;
        }
    }

    return op;
}

// https://www.youtube.com/watch?v=fIPO4G42wYE&t=3750s
// Damn, it works! Funny how I had basically the same design up to the point I referred to this though.
// NOTE: My precedence is the other way around to what they had.
function parseBinaryOperatorIncreasingPrecedence(ctx: ParserContext, lhs: ProgramExpression, maxPrecedence: number): ProgramExpression | undefined {
    assert(!isWhitespace(currentChar(ctx)));
    const pos = getParserPosition(ctx);

    const op = parseBinaryOperator(ctx);
    const prec = getBinOpPrecedence(op);
    if (prec === -1) {
        return;
    }

    if (prec >= maxPrecedence) {
        return;
    }

    for (let i = 0; i < binOpToOpString(op).length; i++) {
        advance(ctx);
    }

    const start = lhs.slice.start;
    const endOfLhs = ctx.pos.i;

    parseWhitespace(ctx);
    const rhs = parseExpression(ctx, prec);

    return {
        t: T_BINARY_OP,
        op,
        lhs: lhs,
        rhs,
        slice: newTextSlice(ctx.text, start, rhs?.slice?.end ?? endOfLhs),
        pos,
    };
}

function parseExpression(ctx: ParserContext, maxPrec: number = MAX_PRECEDENCE): ProgramExpression | undefined {
    if (reachedEnd(ctx)) return undefined;

    assert(!isWhitespace(currentChar(ctx)));

    let res: ProgramExpression | undefined;

    let c = currentChar(ctx);
    if (isLetter(c) || c === "^") {
        if (compareCurrent(ctx, "for")) {
            res = parseRangedFor(ctx);
        } else {
            res = parseIdentifierAndFollowOns(ctx);
        }
    } else if (canParseNumberLiteral(ctx)) {
        res = parseNumberLiteral(ctx);
    } else if (c === "[") {
        res = parseListLiteral(ctx);
    } else if (c === "{") {
        res = parseBlock(ctx);
    } else if (c === "(") {
        advance(ctx);
        parseWhitespace(ctx);
        res = parseExpressionOrMoveToNextLine(ctx);
        if (res) {
            parseWhitespace(ctx);

            if (currentChar(ctx) !== ")") {
                // TODO: figure out why col is 1 higher than it should be
                addErrorAtCurrentPosition(ctx, "Expected a closing paren ) here");
            } else {
                advance(ctx);
            }
        }
    } else if (c === "\"") {
        res = parseStringLiteral(ctx);
    }

    if (res) {
        parseWhitespace(ctx);

        while (true) {
            const nextRes = parseBinaryOperatorIncreasingPrecedence(ctx, res, maxPrec);
            if (!nextRes) {
                break;
            }

            parseWhitespace(ctx);

            res = nextRes;
        }
    }

    if (res) {
        parseWhitespace(ctx);
        const c = currentChar(ctx);
        if (c === "?" && TERNARY_PRECEDENCE < maxPrec) {
            const ternary = parseTernaryIf(ctx, res);
            if (ternary) {
                res = ternary;
            }
        }
    }

    return res;
}

function addErrorAtCurrentPosition(ctx: ParserContext, error: string) {
    ctx.parseResult.errors.push({
        pos: getParserPosition(ctx),
        problem: error
    });
}

function addErrorAtPosition(ctx: ParserContext, pos: TextPosition, error: string) {
    ctx.parseResult.errors.push({
        pos,
        problem: error
    });
}

function getParserPosition(ctx: ParserContext): TextPosition {
    return { ...ctx.pos };
}

function parseExpressionOrMoveToNextLine(ctx: ParserContext): ProgramExpression | undefined {
    parseWhitespace(ctx);
    if (reachedEnd(ctx)) {
        return;
    }

    const statement = parseExpression(ctx);
    if (statement) {
        return statement;
    } 

    addErrorAtCurrentPosition(ctx, "Couldn't figure out how to parse this expression.");

    // Let's just get to the next line, and continue from there.
    advanceToNextNewLine(ctx);
    advance(ctx);

    return;
}

function advanceToNextNewLine(ctx: ParserContext) {
    while (advance(ctx) && currentChar(ctx) !== "\n") { }
}

function parseStatements(ctx: ParserContext, statements: ProgramExpression[], closingCurlyBrace = "") {
    let lastLine = -1;
    while (true) {
        if (reachedEnd(ctx)) {
            break;
        }

        parseWhitespace(ctx);
        if (closingCurlyBrace && currentChar(ctx) === closingCurlyBrace) {
            break;
        }

        const thisLine = ctx.pos.line;

        const expr = parseExpressionOrMoveToNextLine(ctx);
        if (expr) {

            if (thisLine === lastLine) {
                ctx.parseResult.warnings.push({
                    pos: getParserPosition(ctx),
                    problem: "You've put multiple statements on the same line, which may be hard to read."
                });
            }
            lastLine = thisLine;

            statements.push(expr);
        }
    }
}

export function parse(text: string): ProgramParseResult {
    const program: ProgramParseResult = {
        text,
        statements: [],
        functions: new Map(),
        errors: [],
        warnings: [],
    };

    const ctx: ParserContext = {
        text,
        parseResult: program,
        pos: newTextPosition(0, 0, 0),
    };

    parseStatements(ctx, program.statements);

    // dont bother popping the global stack frame

    if (program.errors) {
        return program;
    }

    return program;
}

