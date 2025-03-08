import { assert } from "./utils/im-dom-utils";

////////////////////////
// Parser


type TextSlice = {
    fullText: string;
    start: number;
    end: number;
}

type TextPosition = {
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
    }
}

export const BIN_OP_ASSIGNMENT = 1;
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
export const BIN_OP_RANGE_IN = 13;
export const BIN_OP_RANGE_EX = 14;
export const BIN_OP_INVALID = -1;

export type BinaryOperatorType = typeof BIN_OP_ASSIGNMENT
    | typeof BIN_OP_MULTIPLY
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
    | typeof BIN_OP_RANGE_IN
    | typeof BIN_OP_RANGE_EX
    | typeof BIN_OP_INVALID;


export function getBinaryOperatorType(c: string): BinaryOperatorType {
    switch (c) {
    }

    return BIN_OP_INVALID;
}

export function getBinaryOperatorTypeOpString(op: BinaryOperatorType): string {
    switch (op) {
        case BIN_OP_ASSIGNMENT: return "=";
        case BIN_OP_MULTIPLY: return "*";
        case BIN_OP_DIVIDE: return "/";
        case BIN_OP_ADD: return "+";
        case BIN_OP_SUBTRACT: return "-";
        case BIN_OP_IS_EQUAL_TO: return "==";
        case BIN_OP_GREATER_THAN: return ">";
        case BIN_OP_GREATER_THAN_EQ: return ">=";
        case BIN_OP_LESS_THAN: return "<";
        case BIN_OP_LESS_THAN_EQ: return "<=";

        // I just straight up stole these from Odin ...
        case BIN_OP_RANGE_EX: return "..<";
        case BIN_OP_RANGE_IN: return "..=";

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
        case BIN_OP_RANGE_EX:
        case BIN_OP_RANGE_IN:
            return 9;
        case BIN_OP_ASSIGNMENT:
            return 11;
        case BIN_OP_INVALID:
            return -1;
    }
}

const MAX_PRECEDENCE = 100;

export function binOpToString(op: BinaryOperatorType): string {
    switch (op) {
        case BIN_OP_ASSIGNMENT: return "Assignment";
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
        case BIN_OP_RANGE_EX: return "Range (exclusive)";
        case BIN_OP_RANGE_IN: return "Range (inclusive)";
        case BIN_OP_INVALID: return "???";
    }
}


type ProgramExpressionBase = {
    slice: TextSlice;
    pos: TextPosition;
};

// An identifier is just something that refers to a thing in the program.
// It could be a variable name, or varName[i]. It is any lvalue.
type ProgramExpressionIdentifier = ProgramExpressionBase & {
    t: typeof T_IDENTIFIER;
}

type ProgramExpressionPreviousResult = ProgramExpressionBase & {
    t: typeof T_IDENTIFIER_THE_RESULT_FROM_ABOVE;
};

type ProgramExpressionNumberLiteral = ProgramExpressionBase & {
    t: typeof T_NUMBER_LITERAL;
    integerPart: TextSlice;
    decimalPart: TextSlice | null;
    exponentPart: TextSlice | null;
}

type ProgramExpressionListLiteral = ProgramExpressionBase & {
    t: typeof T_LIST_LITERAL | typeof T_VECTOR_LITERAL;
    items: ProgramExpression[];
}

type ProgramExpressionStringLiteral = ProgramExpressionBase & {
    t: typeof T_STRING_LITERAL;
}

type ProgramExpressionTernaryIf = ProgramExpressionBase & {
    t: typeof T_TERNARY_IF;
    query: ProgramExpression;
    trueBranch: ProgramExpression;
    falseBranch: ProgramExpression | undefined;
}

type ProgramExpressionBinaryOperator = ProgramExpressionBase & {
    t: typeof T_BINARY_OP;
    // NOTE: it would be more optimal to just have t encode every binary op as a separate type...
    // I don't care about this right now though
    op: BinaryOperatorType; 
    lhs: ProgramExpression;
    rhs?: ProgramExpression; // undefined when the AST is incomplete.
}

type ProgramExpressionBlock = ProgramExpressionBase & {
    t: typeof T_BLOCK;
    statements: ProgramExpression[];
}

type ProgramExpressionDataIndex = ProgramExpressionBase & {
    t: typeof T_DATA_INDEX_OP;
    lhs: ProgramExpression;
    indexes: ProgramExpression[];
}

type ProgramExpressionFn = ProgramExpressionBase & {
    t: typeof T_FN;
    fnName: ProgramExpressionIdentifier;
    arguments: ProgramExpression[];
    // If this is present, it's a declaration. else, it's a call.
    body: ProgramExpressionBlock | null;
}

type ProgramExpressionRangedFor = ProgramExpressionBase & {
    t: typeof T_RANGE_FOR;
    loopVar: ProgramExpressionIdentifier;
    range: ProgramExpression;
    body: ProgramExpression;
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
    | ProgramExpressionRangedFor;

export type ProgramParseResult = {
    text: string;
    statements: ProgramExpression[];
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
    while (true) {
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

    const trueBranch = parseExpressionOrMoveToNextLine(ctx);
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

    return {
        t: T_STRING_LITERAL,
        slice: newTextSlice(ctx.text, startPos.i, ctx.pos.i),
        pos,
    };
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
        addErrorAtCurrentPosition(
            ctx,
            "For-loops take the format `for {loopVar} in {range-expression} {loop-expression}`. You need to type 'in' here. (Well you don't need to - obviously this parser knew when the previous expression ended, in order to provide this error message in the first place. But still, it makes the code more readable)"
        );
        return undefined;
    }
    for (let i = 0; i < 2; i++) {
        advance(ctx);
    }

    parseWhitespace(ctx);

    const rangeExpr = parseExpression(ctx);
    if (!rangeExpr) {
        addErrorAtCurrentPosition(ctx, "Expected a range expression here. Eg: `for i in 0..<100 { loop expression }`");
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
        range: rangeExpr,
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
    while(true) {
        parseWhitespace(ctx);

        if (closingDelimiterChar && currentChar(ctx) === closingDelimiterChar) {
            advance(ctx);
            break;
        }

        const expr = parseExpressionOrMoveToNextLine(ctx);
        if (expr) {
            expressions.push(expr);
        } else {
            break;
        }

        parseWhitespace(ctx);

        let foundSomeDelimiter = false;
        if (compareCurrent(ctx, delimiter)) {
            for (let i = 0; i < delimiter.length; i++) {
                advance(ctx);
            }

            parseWhitespace(ctx);
            foundSomeDelimiter = true;
        }

        if (closingDelimiterChar && currentChar(ctx) === closingDelimiterChar) {
            advance(ctx);
            break;
        }

        if (!foundSomeDelimiter) {
            if (closingDelimiterChar) {
                addErrorAtCurrentPosition(ctx, `Expected a delimiter ${delimiter} or a closing delimiter ${closingDelimiterChar} here`);
                return undefined;
            } else { 
                addErrorAtCurrentPosition(ctx, `Expected a delimiter ${delimiter} here`);
                return undefined;
            }
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
    }

    result.slice.end = ctx.pos.i;
    return result;
}

function parseNumberLiteral(ctx: ParserContext): ProgramExpressionNumberLiteral {
    assert(canParseNumberLiteral(ctx));
    const pos = getParserPosition(ctx);

    const start = ctx.pos.i;
    while (advance(ctx) && isValidNumberPart(currentChar(ctx))) { }

    const result: ProgramExpressionNumberLiteral = {
        t: T_NUMBER_LITERAL,
        integerPart: newTextSlice(ctx.text, start, ctx.pos.i),
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
        pos,
        decimalPart: null,
        exponentPart: null,
    };

    const decimalPartStart = ctx.pos.i;
    if (
        currentChar(ctx) === "."
        // Here specifically because we need to make sure numbers don't collide with ..< and ..= operators
        && currentChar(ctx, 1) !== "."
        && advance(ctx)
    ) {
        while (isValidNumberPart(currentChar(ctx)) && advance(ctx)) { }
        result.decimalPart = newOptionalTextSlice(ctx.text, decimalPartStart, ctx.pos.i);
        result.slice.end = ctx.pos.i;
    }

    const exponentPartStart = ctx.pos.i;
    if (currentChar(ctx) === "e" && advance(ctx)) {
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

    return result;
}

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
    } else if (result.t === T_IDENTIFIER && currentChar(ctx) === "(") {
        result = {
            t: T_FN,
            slice: newTextSlice(ctx.text, result.slice.start, ctx.pos.i),
            pos,
            fnName: result,
            arguments: [],
            body: null,
        };

        advance(ctx);

        parseExpressionsDelimiterSeparated(ctx, result.arguments, ",", ")");

        parseWhitespace(ctx);

        if (currentChar(ctx) === "{") {
            const block = parseBlock(ctx);
            if (!block) {
                return undefined;
            }

            result.body = block;
        }

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

    return {
        t: T_IDENTIFIER,
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
        pos,
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
            } else {
                op = BIN_OP_ASSIGNMENT; 
            }
            break;
        case "*": op = BIN_OP_MULTIPLY; break;
        case "/": op = BIN_OP_DIVIDE; break;
        case "+": op = BIN_OP_ADD; break;
        case "-": op = BIN_OP_SUBTRACT; break;
        case ".": 
            if (c2 === ".") {
                if (c3 === "<") {
                    op = BIN_OP_RANGE_EX;
                } else if (c3 === "=") {
                    op = BIN_OP_RANGE_IN;
                }
            }
            break;
        case "<": 
            if (c2 === "=") {
                op = BIN_OP_LESS_THAN_EQ;
            } else {
                op = BIN_OP_LESS_THAN;
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

    for (let i = 0; i < getBinaryOperatorTypeOpString(op).length; i++) {
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
    } else if (isDigit(c)) {
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
        c = currentChar(ctx);
        if (c === "?") {
            const ternary = parseTernaryIf(ctx, res);
            if (ternary) {
                res = ternary;
            }
        } else {
            while (true) {
                const nextRes = parseBinaryOperatorIncreasingPrecedence(ctx, res, maxPrec);
                if (!nextRes) {
                    break;
                }

                parseWhitespace(ctx);

                res = nextRes;
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
        errors: [],
        warnings: [],
    };

    const ctx: ParserContext =  { 
        text, 
        parseResult: program, 
        pos: newTextPosition(0, 0, 0), 
    };

    parseStatements(ctx, program.statements);

    return program;
}

////////////////////////
// Interpreter


export const T_RESULT_NUMBER = 1;
export const T_RESULT_STRING = 2;
export const T_RESULT_LIST = 3;
export const T_RESULT_HIGH_PERFORMANCE_MATRIX = 4;
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
    t: typeof T_RESULT_HIGH_PERFORMANCE_MATRIX;
    val: HPMatrixIndex;
}

export type ProgramResultFunctionDeclaration = {
    t: typeof T_RESULT_FN;
    argNames: string[];
    expr: ProgramExpressionFn;
};

type HPMatrix = {
    values: number[];
    shape: number[];
};

type HPMatrixIndex = {
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
    | ProgramResultFunctionDeclaration;

export type ProgramOutput = {
    results: ProgramResult[];
};

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
        case T_RESULT_HIGH_PERFORMANCE_MATRIX: {
            const dimension = output.val.indexes.length;
            const remainingShape = output.val.m.shape.slice(dimension);
            return remainingShape.length === 1 ? `Vector${remainingShape[0]}` : (
                `Matrix${remainingShape.map(s => "" + s).join("x")}`
            );
        }
        case T_RESULT_FN:
            return `Function ${getIdentifierName(output.expr.fnName)}`;
    }
}

type ProgramScope = {
    variables: Map<string, ProgramResult>;
    lastResult: ProgramResult | undefined;
};

function beginScope(state: ProgramState): ProgramScope {
    const scope = { variables: new Map(), lastResult: undefined };
    state.stack.push(scope);
    return scope;
}

function endScope(state: ProgramState)  {
    state.stack.pop();
}

type ProgramState = {
    stack: ProgramScope[];
    results: ProgramResult[];
    error: {
        pos: TextPosition;
        problem: string;
        value?: ProgramResult;
    } | null;
};

function newProgramState(): ProgramState {
    return { 
        stack: [],
        results: [],
        error: null,
    };
}

function setProgramError(state: ProgramState, expr: ProgramExpression, message: string, result? : ProgramResult) {
    // An error was already present
    assert(!state.error);

    state.error = {
        pos: expr.pos,
        problem: message,
        value: result,
    };
}

function getGlobalScope(state: ProgramState): ProgramScope {
    const scope = state.stack[0];
    // Expected there to always be a scope to look at
    assert(scope);
    return scope;
}

function getCurrentScope(state: ProgramState): ProgramScope {
    const scope = state.stack[state.stack.length - 1];
    // Expected there to always be a scope to look at
    assert(scope);
    return scope;
}

function calculateNumberLiteralValue(expr: ProgramExpressionNumberLiteral, state: ProgramState): number | undefined {
    if (state.error) return;

    let num = 0;

    if (expr.decimalPart) {
        const text = getSliceText(expr.decimalPart);
        const decimalVal = parseInt(text) / Math.pow(10, text.length)
        num += decimalVal;
    }

    if (expr.integerPart) {
        const text = getSliceText(expr.integerPart);
        const intVal = parseInt(text);
        num += intVal;
    }

    if (expr.exponentPart) {
        const text = getSliceText(expr.exponentPart);
        const expVal = parseInt(text);
        num *= Math.pow(10, expVal);
    }

    // TODO: error out if the literal is impossible to generate properly
    
    return num;
}


function newNumberResult(val: number): ProgramResultNumber {
    return { t: T_RESULT_NUMBER, val };
}

function interpretNumberLiteral(expr: ProgramExpressionNumberLiteral, state: ProgramState): ProgramResultNumber | undefined {
    if (state.error) return;

    const result = calculateNumberLiteralValue(expr, state);
    if (result === undefined) {
        return;
    }

    return newNumberResult(result);
}

function getIdentifierName(expr: ProgramExpressionIdentifier): string {
    const result = getSliceText(expr.slice);
    return result;
}

function interpretIdentifier(expr: ProgramExpressionIdentifier | ProgramExpressionPreviousResult, state: ProgramState): ProgramResult | undefined {
    if (state.error) return;

    if (expr.t === T_IDENTIFIER_THE_RESULT_FROM_ABOVE) {
        const scope = getCurrentScope(state);
        const lastResult = scope.lastResult;
        if (!lastResult) {
            setProgramError(state, expr, "Can't refer to ^ 'the result above' when we don't have a previous result in this scope");
            return;
        }

        return lastResult;
    }

    let result: ProgramResult | undefined;

    const name = getIdentifierName(expr);
    const currentScope = getCurrentScope(state);
    result = currentScope.variables.get(name);

    if (!result) {
        const globalScope = getGlobalScope(state);
        result = globalScope.variables.get(name);
    }

    if (!result) {
        setProgramError(state, expr, "This identifier hasn't been defined yet");
        return;
    }

    return result;
}


function interpretStringLiteral(expr: ProgramExpressionStringLiteral, state: ProgramState): ProgramResultString | undefined {
    if (state.error) return;

    const text = getSliceText(expr.slice);
    const sb = [];

    let isEscape = false;
    let isValid = true;
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
                    isValid = false;
                    setProgramError(state, expr, "Invalid escape sequence \\" + c);
                    break;
            }
        }
    }

    if (!isValid) {
        return;
    }

    const joined = sb.join("");
    return { t: T_RESULT_STRING, val: joined };
}

function interpretListLiteral(expr: ProgramExpressionListLiteral, state: ProgramState): ProgramResultList | ProgramResultHPMatrix | undefined {
    if (state.error) return;

    if (expr.t === T_LIST_LITERAL) {
        const result: ProgramResult[] = [];

        for (let i = 0; i < expr.items.length; i++) {
            const value = interpretExpression(expr.items[i], state);
            if (!value) {
                return;
            }
        }

        return { t: T_RESULT_LIST, values: result };
    }

    const shape: number[] = [];
    const values: number[] = [];
    let isValid = true;

    // This was more complicated than I thought. We need to check that all the rows and columns are consistent with each other.
    const dfs = (root: ProgramExpressionListLiteral, dimIdx: number) => {
        if (root.t === T_VECTOR_LITERAL) {
            const len = root.items.length;
            if (shape.length === dimIdx) {
                shape.push(len);
            } else {
                if (len !== shape.length) {
                    setProgramError(state, root, "The size or type of this entry is not consistent with the first entry in this vector or matrix");
                    isValid = false;
                    return;
                }
            }
        }

        if (root.items.length > 0) {
            let type = 0;
            let len = 0;
            for (let i = 0; i < root.items.length; i++) {
                const item = root.items[i];

                if (item.t !== T_VECTOR_LITERAL && item.t !== T_NUMBER_LITERAL) {
                    isValid = false;
                    setProgramError(state, item, "Vectors can only contain other vectors, or numbers");
                    return;
                } 

                const itemType = item.t;
                const itemLen = item.t === T_VECTOR_LITERAL ? item.items.length : 1;
                if (i === 0) {
                    type = itemType;
                    len = itemLen;
                } else {
                    if (type !== itemType) {
                        isValid = false;
                        setProgramError(state, item, "This item had a different type to the previous items");
                        return;
                    } else if (len !== itemLen) {
                        isValid = false;
                        setProgramError(state, item, "This vector had a different length to the previous vectors");
                        return;
                    }
                }

                if (item.t === T_NUMBER_LITERAL) {
                    const val = calculateNumberLiteralValue(item, state);
                    if (val === undefined) {
                        isValid = false;
                        return;
                    }
                    values.push(val);
                } else {
                    dfs(item, dimIdx + 1);
                }
            }
        }
    }
    dfs(expr, 0);

    if (!isValid) {
        return;
    }

    // The number of values should have perfectly lined up with the shape, if we haven't set isValid=false.
    // We must have done something wrong here
    assert(getValueCount(shape) !== values.length);

    return {
        t: T_RESULT_HIGH_PERFORMANCE_MATRIX,
        val: { m: { shape, values }, indexes: [] }
    };
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
    expr: ProgramExpressionBinaryOperator, 
    state: ProgramState,
): ProgramResultNumber | ProgramResultRange | undefined {
    let num: number | undefined;
    let range: NumberRange | undefined;

    switch (expr.op) {
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
        case BIN_OP_RANGE_EX: range = { lo: r.val, hi: l.val };  break;
        case BIN_OP_RANGE_IN: range = { lo: r.val, hi: l.val + 1 };  break;
        case BIN_OP_INVALID: 
            // An invalid binary op was parsed, and added to the result tree somehow
            assert(false)
    }

    let result: ProgramResultNumber | ProgramResultRange | undefined;

    if (num) {
        result = newNumberResult(num);
    } else if (range) {
        result = { t: T_RESULT_RANGE, val: range };
    }

    return;
}

function interpretBinaryOp(expr: ProgramExpressionBinaryOperator, state: ProgramState, isTopLevelStatement: boolean): ProgramResult | undefined {
    if (state.error) return;

    if (!expr.rhs) {
        setProgramError(state, expr, "This expression is incomplete, and cannot be evaluated");
        return;
    }

    if (expr.op === BIN_OP_ASSIGNMENT) {
        if (!isTopLevelStatement) {
            setProgramError(state, expr.lhs, "Assignment may only be a top-level operation");
            return;
        }


        if (expr.lhs.t !== T_IDENTIFIER && expr.lhs.t !== T_DATA_INDEX_OP) {
            setProgramError(state, expr.lhs, "Curently, only identifiers, or indexation operations like identifier[index] can be assigned to.");
            return;
        }

        const result = interpretExpression(expr.rhs, state);
        if (!result) {
            return;
        }

        if (expr.lhs.t === T_IDENTIFIER) {
            const identifierName = getIdentifierName(expr.lhs);

            const scope = getCurrentScope(state);
            scope.variables.set(identifierName, result);
            return result;
        } 

        setProgramError(state, expr, "TODO: implement assigning into a list or vector");
        return;
    }

    const r = interpretExpression(expr.lhs, state);
    if (!r) {
        return;
    }

    const l = interpretExpression(expr.rhs, state);
    if (!l) {
        return;
    }

    let result: ProgramResult | undefined;

    if (r.t === T_RESULT_NUMBER) {
        if (l.t === T_RESULT_NUMBER) {
            result = calculateBinaryOpNumberXNumber(l, r, expr, state);
        }
    }

    if (!result) {
        setProgramError(state, expr, `We don't have a way to compute ${programResultTypeString(l)} ${binOpToString(expr.op)} ${programResultTypeString(r)} yet.`);
        return;
    }

    return result;
}

function interpretTernaryIf(expr: ProgramExpressionTernaryIf, state: ProgramState): ProgramResult | undefined {
    if (state.error) return;

    if (!expr.falseBranch) {
        setProgramError(state, expr, `Ternary needs a false path to be valid`);
        return;
    }

    const conditionResult = interpretExpression(expr.query, state);
    if (!conditionResult) {
        return;
    }

    if (conditionResult.t !== T_RESULT_NUMBER) {
        setProgramError(state, expr, `Ternary queries must always evaulate to numbers. 0 -> false, everything else -> true`);
        return;
    }

    let result: ProgramResult | undefined;
    if (conditionResult.val === 0) {
        result = interpretExpression(expr.falseBranch, state);
    } else {
        result = interpretExpression(expr.trueBranch, state);
    }

    return result;
}

function interpretWithScope(statements: ProgramExpression[], state: ProgramState, scope: ProgramScope): ProgramResult | undefined {
    if (state.error) return;

    for (let i = 0; i < statements.length; i++) {
        const expr = statements[i];

        const result = interpretExpression(expr, state, true);
        scope.lastResult = result;

        if (state.error) {
            break;
        }

        // When a result is not returned, an error must always be set
        assert(!!result);
    }

    if (state.error) {
        return;
    }

    const lastResult = scope.lastResult;

    // For the same reason as above
    assert(lastResult);

   return lastResult;
}


function validateBlock(expr: ProgramExpressionBlock, state: ProgramState) {
    const statements = expr.statements;
    if (statements.length === 0) {
        setProgramError(state, expr, "Blocks must always contain at least one statement");
    }
}

function interpretBlock(expr: ProgramExpressionBlock, state: ProgramState): ProgramResult | undefined {
    if (state.error) return;

    // Implementation here

    validateBlock(expr, state);
    if (state.error) {
        return;
    }

    const scope = getCurrentScope(state);
    const result = interpretWithScope(expr.statements, state, scope);

    return result;
}

function interpretRangeFor(expr: ProgramExpressionRangedFor, state: ProgramState): ProgramResult | undefined {
    if (state.error) return;

    const rangeResult = interpretExpression(expr.range, state);
    if (!rangeResult) {
        return;
    }

    if (rangeResult.t !== T_RESULT_RANGE) {
        setProgramError(state, expr, `Result of range expression wasn't a range`, rangeResult);
        return;
    }

    const identifierName = getIdentifierName(expr.loopVar);
    const lo = rangeResult.val.lo;
    const hi = rangeResult.val.hi;

    const scope = beginScope(state);
    const loopVar: ProgramResultNumber = { t: T_RESULT_NUMBER, val: 0 };

    // TODO: think about: should the scope be cleared at the end of every loop?
    // TODO: think about: if this is the right abstraction. Should for-loops actually aggregate all their results as a kind of `map`?
    scope.variables.set(identifierName, loopVar);

    if (lo <= hi) {
        for (let i = lo; i < hi; i++) {
            loopVar.val = i;
            scope.lastResult = interpretExpression(expr, state);
        }
    } else {
        for (let i = lo; i > hi; i--) {
            loopVar.val = i;
            scope.lastResult = interpretExpression(expr, state);
        }
    }

    endScope(state);

    return scope.lastResult;
}

function interpretFunction(expr: ProgramExpressionFn, state: ProgramState): ProgramResult | undefined {
    if (state.error) return;

    const scope = getCurrentScope(state);
    const fnName = getIdentifierName(expr.fnName);

    if (expr.body) {
        // Let's validate as much as we can about this function at declaration time,
        // so that we don't have to wait till they actually call the function to error out

        validateBlock(expr.body, state);
        if (state.error) {
            return;
        }

        const argNames: string[] = [];
        for (let i = 0; i < expr.arguments.length; i++) {
            const arg = expr.arguments[i];

            if (arg.t !== T_IDENTIFIER) {
                setProgramError(state, arg, "A function declaration's arguments list can only be identifiers");
                return;
            }

            const name = getIdentifierName(arg);
            for (const otherName of argNames) {
                if (otherName === name) {
                    setProgramError(state, arg, "This argument name matches the name of a previous argument");
                    return;
                }
            }

            argNames.push(name);
        }

        const result: ProgramResultFunctionDeclaration = { t: T_RESULT_FN, expr, argNames };
        scope.variables.set(fnName, result);
        return result;
    }

    const decl = scope.variables.get(fnName);
    if (!decl) {
        setProgramError(state, expr, "This function hasn't been declared yet");
        return;
    }

    if (decl.t !== T_RESULT_FN) {
        setProgramError(state, expr, "The variable we're referring to isn't a function", decl);
        return;
    }

    if (decl.argNames.length !== expr.arguments.length) {
        setProgramError(state, expr, `Number of arugments in declraration (${decl.expr.arguments.length}) doesn't match the number of arguments provided`, decl);
        return;
    }

    // The way we knew to save this declaration in the first place was by checking
    // for the presence of the body field
    assert(decl.expr.body);

    const fnScope = beginScope(state);
    for (let i = 0; i < decl.argNames.length; i++) {
        const argName = decl.argNames[i];
        const argExpr = expr.arguments[i];
        const result = interpretExpression(argExpr, state);
        if (!result) {
            return;
        }

        // We have allowed someone to define a function with multiple arguments of the same name, which is a bug
        assert(!fnScope.variables.has(argName));

        fnScope.variables.set(argName, result);
    }
    interpretBlock(decl.expr.body, state)
    endScope(state);

    return fnScope.lastResult;
}

function getLength(result: ProgramResult): number | undefined {
    switch(result.t) {
        case T_RESULT_LIST: return result.values.length;
        case T_RESULT_STRING: return result.val.length;
        case T_RESULT_RANGE: return Math.abs(result.val.lo - result.val.hi);
        case T_RESULT_HIGH_PERFORMANCE_MATRIX: {
            const dimension = result.val.indexes.length;
            return result.val.m.shape[dimension];
        };
    }
}

function indexIntoResult(
    result: ProgramResult, idx: number, 
    // These are for error reporting
    state: ProgramState, exprIdx: ProgramExpression, idxExprResult: ProgramResultNumber, len: number
): ProgramResult | undefined {
    // technically, some of these can be done before actually indexing int othe thing, so yeah.

    if (idx % 1) {
        setProgramError(state, exprIdx, "Indexing expressions cannot have a decimal component", idxExprResult);
        return;
    }

    if (idx < 0) {
        setProgramError(state, exprIdx, "Indexing expression was less than zero", idxExprResult);
        return;
    }

    if (idx >= len) {
        setProgramError(state, exprIdx, `Indexing expression ${idx} is out of bounds (${len})`);
        return;
    }

    switch (result.t) {
        case T_RESULT_LIST: return result.values[idx];
        // TODO: consider T_RESULT_CHAR ?
        case T_RESULT_STRING: return { t: T_RESULT_STRING, val: result.val[idx] };
        case T_RESULT_RANGE: {
            const hi = result.val.hi;
            const lo = result.val.lo;

            if (lo <= hi) {
                return { t: T_RESULT_NUMBER, val: lo + idx };
            } 

            return { t: T_RESULT_NUMBER, val: lo - idx };
        } 
        case T_RESULT_HIGH_PERFORMANCE_MATRIX: {
            // TODO: this is completely wrong, and we need to fix this.
            return { 
                t: T_RESULT_HIGH_PERFORMANCE_MATRIX, 
                val: { m: result.val.m, indexes: [...result.val.indexes, idx] }
            };
        };
    }

    // Should have handled everything above
    assert(false);
}

function interpretDataIndexOp(expr: ProgramExpressionDataIndex, state: ProgramState): ProgramResult | undefined {
    if (state.error) return;

    // we somehow parsed a data indexing op without finding any '[' braces or something. 
    assert(expr.indexes.length > 0);

    let result = interpretExpression(expr.lhs, state);
    if (!result) {
        return;
    }

    for (let i = 0; i < expr.indexes.length; i++) {
        if (!result) {
            return;
        }

        const exprIdx = expr.indexes[i];

        const resultLen = getLength(result);
        if (resultLen === undefined) {
            if (i === 0) {
                setProgramError(state, exprIdx, "This expression cannot be indexed", result);
            } else {
                setProgramError(state, exprIdx, "This expression cannot be indexed any further", result);
            }
            return;
        }

        const exprIdxResult = interpretExpression(exprIdx, state);
        if (!exprIdxResult) {
            return;
        }

        if (exprIdxResult.t !== T_RESULT_NUMBER) {
            setProgramError(state, exprIdx, "Indexing expressions must evaluate to numbers");
            return;
        }

        const idx = exprIdxResult.val;

        result = indexIntoResult(result, idx, state, exprIdx, exprIdxResult, resultLen);
        if (!result) {
            return;
        }
    }
}

function interpretExpression(expr: ProgramExpression, state: ProgramState, isTopLevelStatement = false): ProgramResult | undefined {
    if (state.error) return;

    let result: ProgramResult | undefined;

    let typeString = expressionTypeToString(expr);

    switch (expr.t) {
        case T_NUMBER_LITERAL: {
            result = interpretNumberLiteral(expr, state);
        } break;
        case T_STRING_LITERAL: {
            result = interpretStringLiteral(expr, state);
        } break;
        case T_IDENTIFIER:
        case T_IDENTIFIER_THE_RESULT_FROM_ABOVE: {
            result = interpretIdentifier(expr, state);
        } break;
        case T_LIST_LITERAL:
        case T_VECTOR_LITERAL: {
            result = interpretListLiteral(expr, state);
        } break;
        case T_BINARY_OP: {
            result = interpretBinaryOp(expr, state, isTopLevelStatement);
        } break;
        case T_TERNARY_IF: {
            result = interpretTernaryIf(expr, state);
        } break;
        case T_BLOCK: {
            beginScope(state);
            result = interpretBlock(expr, state);
            endScope(state);
        } break;
        case T_RANGE_FOR: {
            result = interpretRangeFor(expr, state);
        } break;
        case T_FN: {
            result = interpretFunction(expr, state);
        } break;
        case T_DATA_INDEX_OP: {
            result = interpretDataIndexOp(expr, state);
        } break;
        default: {
            throw new Error("Unhandled type: " + typeString);
        }
    }

    return result;
}

export function interpret(program: ProgramParseResult): ProgramOutput {
    const output: ProgramOutput = { results: [] };

    const state = newProgramState(); 

    const scope = beginScope(state);
    interpretWithScope(program.statements, state, scope); 

    // no need to end the top-level scope.

    return output;
}

