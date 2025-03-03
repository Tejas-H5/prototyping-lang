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
export const T_ASSIGNMENT = 2;
export const T_NUMBER_LITERAL = 3;
export const T_LIST_LITERAL = 4;

export function expressionTypeToString(expr: ProgramExpression) {
    switch(expr.t) {
        case T_IDENTIFIER:
            return "Identifier";
        case T_ASSIGNMENT:
            return "Assignment";
        case T_NUMBER_LITERAL:
            return "Number literal";
        case T_LIST_LITERAL:
            return "List literal";
    }
    return "???";
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

type ProgramExpressionAssignment = ProgramExpressionBase & {
    t: typeof T_ASSIGNMENT;
    lhs: ProgramExpression;
    rhs?: ProgramExpression; // undefined when the AST is incomplete.
}

export type ProgramExpression = ProgramExpressionIdentifier
    | ProgramExpressionAssignment
    | ProgramExpressionNumberLiteral
    | ProgramExpressionListLiteral;

export type Program = {
    statements: ProgramExpression[];
    errors: ProgramError[];
};

type ProgramError = {
    pos: TextPosition;
    problem: string;
};

type ParserContext = {
    text: string;
    program: Program;
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

function currentChar(ctx: ParserContext) {
    return ctx.text[ctx.pos.i];
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
    while (isWhitespace(currentChar(ctx))) {
        ctx.pos.i++;
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

function parseListLiteral(ctx: ParserContext): ProgramExpressionListLiteral {
    assert(currentChar(ctx) === "[");

    const result: ProgramExpressionListLiteral = {
        t: T_LIST_LITERAL,
        slice: newTextSlice(ctx.text, ctx.pos.i, 0),
        items: [],
    };

    advance(ctx);
    
    while(true) {
        parseWhitespace(ctx);
        if (!parseExpressionOrMoveToNextLine(ctx, result.items)) {
            break;
        }

        parseWhitespace(ctx);

        if (currentChar(ctx) === ",") {
            advance(ctx);
            parseWhitespace(ctx);
        }

        if (currentChar(ctx) === "]") {
            advance(ctx);
            break;
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
    if (currentChar(ctx) === "." && advance(ctx)) {
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

function parseIdentifier(ctx: ParserContext): ProgramExpressionIdentifier {
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

    if (currentChar(ctx) === "[") {
        while(currentChar(ctx) === "[" && advance(ctx)) {
            if (!parseExpressionOrMoveToNextLine(ctx, result.indexers!)) {
                return result;
            }

            parseWhitespace(ctx);

            if (currentChar(ctx) !== "]") {
                ctx.program.errors.push({
                    pos: getParserPosition(ctx),
                    problem: "Expected a closing square brace here",
                });
                advance(ctx);
                break;
            }

            advance(ctx);
            result.slice.end = ctx.pos.i;
        }
    }

    return result;
}

function parseExpression(ctx: ParserContext): ProgramExpression | undefined {
    if (reachedEnd(ctx)) return undefined;

    assert(!isWhitespace(currentChar(ctx)));

    let res: ProgramExpression | undefined;

    const c = currentChar(ctx);
    if (isLetter(c)) {
        res = parseIdentifier(ctx);
    } else if (isDigit(c)) {
        res = parseNumberLiteral(ctx);
    } else if (c === "[") {
        res = parseListLiteral(ctx);
    }

    if (res) {
        parseWhitespace(ctx);
        if (currentChar(ctx) === "=") {
            // This might actually be an assignment.

            const start = res.slice.start;

            advance(ctx);
            const endOfEquals = ctx.pos.i;

            parseWhitespace(ctx);
            const rhs = parseExpression(ctx);

            res = {
                t: T_ASSIGNMENT,
                lhs: res,
                rhs,
                slice: newTextSlice(ctx.text, start, rhs?.slice.end ?? endOfEquals),
            };
        }
    }

    return res;
}

function getParserPosition(ctx: ParserContext): TextPosition {
    return { ...ctx.pos };
}

function parseExpressionOrMoveToNextLine(ctx: ParserContext, expressions: ProgramExpression[])  {
    parseWhitespace(ctx);
    if (reachedEnd(ctx)) {
        return false;
    }

    const statement = parseExpression(ctx);
    if (statement) {
        expressions.push(statement);
        return true;
    } 

    ctx.program.errors.push({
        pos: getParserPosition(ctx),
        problem: "Couldn't figure out how to parse this expression."
    });

    // Let's just get to the next line, and continue from there.
    while (advance(ctx) && currentChar(ctx) !== "\n") { }
    advance(ctx);
    return false;
}

function parseStatements(ctx: ParserContext, statements: ProgramExpression[]) {
    while (!reachedEnd(ctx)) {
        parseExpressionOrMoveToNextLine(ctx, statements);
    }
}

export function parse(text: string): Program {
    const program: Program = {
        statements: [],
        errors: [],
    };

    const ctx: ParserContext =  { 
        text, 
        program, 
        pos: newTextPosition(0, 0, 0), 
    };

    parseStatements(ctx, program.statements);

    return program;
}

export type ProgramOutput = {
    program: Program;
};

export function interpret(program: Program): ProgramOutput | null {
    if (program.statements.length === 0) {
        return null;
    }

    const output: ProgramOutput = {
        program,
    };

    return output;
}

