import { assert, newStyleElement } from "./utils/im-dom-utils";

type TextSlice = {
    text: string;
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

export function expressionTypeToString(expr: ProgramExpression) {
    switch(expr.t) {
        case T_IDENTIFIER:
            return "Identifier";
        case T_ASSIGNMENT:
            return "Assignment";
        case T_NUMBER_LITERAL:
            return "Number literal";
    }
    return "???";
}

type ProgramExpressionBase = {
    span: TextSlice;
};

type ProgramExpressionIdentifier = ProgramExpressionBase & {
    t: typeof T_IDENTIFIER;
}

type ProgramExpressionNumberLiteral = ProgramExpressionBase & {
    t: typeof T_NUMBER_LITERAL;
    integerPart: TextSlice;
    decimalPart?: TextSlice;
    exponentPart?: TextSlice;
}

type ProgramExpressionAssignment = ProgramExpressionBase & {
    t: typeof T_ASSIGNMENT;
    lhs: ProgramExpression;
    rhs?: ProgramExpression; // undefined when the AST is incomplete.
}

export type ProgramExpression = ProgramExpressionIdentifier
    | ProgramExpressionAssignment
    | ProgramExpressionNumberLiteral;

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

function newOptionalTextSpan(text: string, start: number, end: number): TextSlice | undefined {
    if (start === end) {
        return undefined;
    }
}

function newTextSpan(text: string, start: number, end: number): TextSlice {
    return {
        start,
        end,
        text: text.substring(start, end)
    };
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

function parseNumberLiteral(ctx: ParserContext): ProgramExpressionNumberLiteral {
    assert(canParseNumberLiteral(ctx));

    const start = ctx.pos.i;
    while (advance(ctx) && isValidNumberPart(currentChar(ctx))) { }

    const result: ProgramExpressionNumberLiteral = {
        t: T_NUMBER_LITERAL,
        integerPart: newTextSpan(ctx.text, start, ctx.pos.i),
        span: newTextSpan(ctx.text, start, ctx.pos.i),
        decimalPart: undefined,
        exponentPart: undefined,
    };

    const decimalPartStart = ctx.pos.i;
    if (currentChar(ctx) === "." && advance(ctx)) {
        while (isValidNumberPart(currentChar(ctx)) && advance(ctx)) { }
        result.decimalPart = newOptionalTextSpan(ctx.text, decimalPartStart, ctx.pos.i);
        result.span.end = ctx.pos.i;
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
        result.exponentPart = newOptionalTextSpan(ctx.text, exponentPartStart, ctx.pos.i);
        result.span.end = ctx.pos.i;
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

    return {
        t: T_IDENTIFIER,
        span: newTextSpan(ctx.text, start, ctx.pos.i)
    }
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
    }

    if (res) {
        parseWhitespace(ctx);
        if (currentChar(ctx) === "=") {
            // This might actually be an assignment.

            const start = res.span.start;

            advance(ctx);
            const endOfEquals = ctx.pos.i;

            parseWhitespace(ctx);
            const rhs = parseExpression(ctx);

            res = {
                t: T_ASSIGNMENT,
                lhs: res,
                rhs,
                span: newTextSpan(ctx.text, start, rhs?.span.end ?? endOfEquals),
            };
        }
    }

    return res;
}

function getParserPosition(ctx: ParserContext): TextPosition {
    return { ...ctx.pos };
}

function parseStatements(ctx: ParserContext, statements: ProgramExpression[]) {
    while (true) {
        parseWhitespace(ctx);
        if (reachedEnd(ctx)) {
            break;
        }

        const statement = parseExpression(ctx);
        if (statement) {
            statements.push(statement);
        } else {
            // NOTE: the program 
            ctx.program.errors.push({
                pos: getParserPosition(ctx),
                problem: "Couldn't figure out how to parse this expression."
            });

            // Let's just get to the next line, and continue from there.
            while(advance(ctx) && currentChar(ctx) !== "\n") {}
            advance(ctx);
        }
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

