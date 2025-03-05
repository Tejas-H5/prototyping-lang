import { assert } from "./utils/im-dom-utils";

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
export const T_BINARY_OP = 2;
export const T_NUMBER_LITERAL = 3;
export const T_LIST_LITERAL = 4;
export const T_STRING_LITERAL = 5;
export const T_TERNARY_IF = 6;
export const T_BLOCK = 7;
export const T_RANGE_FOR = 8;

export function expressionTypeToString(expr: ProgramExpression): string {
    switch(expr.t) {
        case T_IDENTIFIER:
            return "Identifier";
        case T_BINARY_OP:
            return "Binary operator";
        case T_NUMBER_LITERAL:
            return "Number literal";
        case T_LIST_LITERAL:
            return "List literal";
        case T_STRING_LITERAL:
            return "String literal";
        case T_TERNARY_IF:
            return "Ternary if";
        case T_BLOCK:
            return "Block";
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
            return 10;
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
};

// An identifier is just something that refers to a thing in the program.
// It could be a variable name, or varName[i]. It is any lvalue.
type ProgramExpressionIdentifier = ProgramExpressionBase & {
    t: typeof T_IDENTIFIER;
    indexers: ProgramExpression[] | null;
}

type ProgramExpressionNumberLiteral = ProgramExpressionBase & {
    t: typeof T_NUMBER_LITERAL;
    integerPart: TextSlice;
    decimalPart: TextSlice | null;
    exponentPart: TextSlice | null;
}

type ProgramExpressionListLiteral = ProgramExpressionBase & {
    t: typeof T_LIST_LITERAL;
    items: ProgramExpression[];
}

type ProgramExpressionStringLiteral = ProgramExpressionBase & {
    t: typeof T_STRING_LITERAL;
}

type ProgramExpressionTernaryIf = ProgramExpressionBase & {
    t: typeof T_TERNARY_IF;
    query: ProgramExpression;
    trueBranch: ProgramExpression;
    falseBranch: ProgramExpression | null;
}

type ProgramExpressionAssignment = ProgramExpressionBase & {
    t: typeof T_BINARY_OP;
    op: BinaryOperatorType;
    lhs: ProgramExpression;
    rhs?: ProgramExpression; // undefined when the AST is incomplete.
}

type ProgramExpressionBlock = ProgramExpressionBase & {
    t: typeof T_BLOCK;
    statements: ProgramExpression[];
}

type ProgramExpressionRangedFor = ProgramExpressionBase & {
    t: typeof T_RANGE_FOR;
    loopVar: ProgramExpressionIdentifier;
    range: ProgramExpression;
    body: ProgramExpression;
};

export type ProgramExpression = ProgramExpressionIdentifier
    | ProgramExpressionAssignment
    | ProgramExpressionNumberLiteral
    | ProgramExpressionListLiteral
    | ProgramExpressionStringLiteral
    | ProgramExpressionTernaryIf
    | ProgramExpressionBlock
    | ProgramExpressionRangedFor;

export type ProgramParseResult = {
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
        query,
        trueBranch,
        falseBranch: null,
    };

    parseWhitespace(ctx);
    if (currentChar(ctx) !== ":") {
        addErrorAtCurrentPosition(ctx, "Expected a colon : here to complete the ternary.");
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
    };
}

function parseBlock(ctx: ParserContext): ProgramExpressionBlock | undefined {
    assert(currentChar(ctx) === "{");
    advance(ctx);

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
        statements
    };
}

function parseRangedFor(ctx: ParserContext): ProgramExpressionRangedFor | undefined {
    assert(compareCurrent(ctx, "for"));

    const start = ctx.pos.i;

    for (let i = 0; i < 3; i++) {
        advance(ctx);
    }

    parseWhitespace(ctx);

    if (!isLetter(currentChar(ctx))) {
        addErrorAtCurrentPosition(ctx, "Expected an identifier to assign the current loop variable to here");
        return undefined;
    }
    const loopVar = parseIdentifier(ctx, false);

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
        loopVar,
        range: rangeExpr,
        body: loopExpr,
    };

    return result;
}

function parseListLiteral(ctx: ParserContext): ProgramExpressionListLiteral | undefined {
    assert(currentChar(ctx) === "[");

    const result: ProgramExpressionListLiteral = {
        t: T_LIST_LITERAL,
        slice: newTextSlice(ctx.text, ctx.pos.i, 0),
        items: [],
    };

    advance(ctx);
    
    while(true) {
        parseWhitespace(ctx);
        const expr = parseExpressionOrMoveToNextLine(ctx);
        if (expr) {
            result.items.push(expr);
        } else {
            break;
        }

        parseWhitespace(ctx);

        let foundSomeDelimiter = false;
        if (currentChar(ctx) === ",") {
            advance(ctx);
            parseWhitespace(ctx);
            foundSomeDelimiter = true;
        }

        if (currentChar(ctx) === "]") {
            advance(ctx);
            break;
        }

        if (!foundSomeDelimiter) {
            addErrorAtCurrentPosition(ctx, "Expected a comma , or a closing square bracket ] here");
            return undefined;
        }
    }

    result.slice.end = ctx.pos.i;
    return result;
}

function parseNumberLiteral(ctx: ParserContext): ProgramExpressionNumberLiteral {
    assert(canParseNumberLiteral(ctx));

    const start = ctx.pos.i;
    while (advance(ctx) && isValidNumberPart(currentChar(ctx))) { }

    const result: ProgramExpressionNumberLiteral = {
        t: T_NUMBER_LITERAL,
        integerPart: newTextSlice(ctx.text, start, ctx.pos.i),
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
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

function parseIdentifier(ctx: ParserContext, parseIndexers = true): ProgramExpressionIdentifier {
    assert(isLetter(currentChar(ctx)));

    const start = ctx.pos.i;
    while (
        isAllowedIdentifierSymbol(currentChar(ctx)) && 
        advance(ctx)
    ) {}

    const result: ProgramExpressionIdentifier = {
        t: T_IDENTIFIER,
        slice: newTextSlice(ctx.text, start, ctx.pos.i),
        indexers: [],
    };

    // only allow one space between x [0]
    if (currentChar(ctx) === " ") {
        advance(ctx);
    }

    if (parseIndexers) {
        if (currentChar(ctx) === "[") {
            while(currentChar(ctx) === "[" && advance(ctx)) {
                const expr = parseExpressionOrMoveToNextLine(ctx);
                if (expr) {
                    result.indexers!.push(expr);
                } else {
                    return result;
                }

                parseWhitespace(ctx);

                if (currentChar(ctx) !== "]") {
                    addErrorAtCurrentPosition(ctx, "Expected a closing square brace ] here");
                    advance(ctx);
                    break;
                }

                advance(ctx);
                result.slice.end = ctx.pos.i;
            }
        }
    }

    return result;
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
    };
}

function parseExpression(ctx: ParserContext, maxPrec: number = MAX_PRECEDENCE): ProgramExpression | undefined {
    if (reachedEnd(ctx)) return undefined;

    assert(!isWhitespace(currentChar(ctx)));

    let res: ProgramExpression | undefined;



    let c = currentChar(ctx);
    if (isLetter(c)) {
        if (compareCurrent(ctx, "for")) {
            res = parseRangedFor(ctx);
        } else {
            res = parseIdentifier(ctx);
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

export type ProgramOutput = {
    program: ProgramParseResult;
};

export function interpret(program: ProgramParseResult): ProgramOutput {
    const output: ProgramOutput = {
        program,
    };

    return output;
}

