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
export const STRING_LITERAL = 13;
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
        case BIN_OP_LESS_THAN: return ">";
        case BIN_OP_LESS_THAN_EQ: return ">=";
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
        case BIN_OP_ASSIGNMENT:
            return 1;
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

type ProgramExpressionAssignment = ProgramExpressionBase & {
    t: typeof T_BINARY_OP;
    op: BinaryOperatorType;
    lhs: ProgramExpression;
    rhs?: ProgramExpression; // undefined when the AST is incomplete.
}

export type ProgramExpression = ProgramExpressionIdentifier
    | ProgramExpressionAssignment
    | ProgramExpressionNumberLiteral
    | ProgramExpressionListLiteral
    | ProgramExpressionStringLiteral;

export type ProgramParseResult = {
    statements: ProgramExpression[];
    errors: DiagnosticInfo[];
    warnings: DiagnosticInfo[];
};

export type DiagnosticInfo = {
    pos: TextPosition;
    problem: string;
};

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

function currentChar(ctx: ParserContext) {
    return ctx.text[ctx.pos.i];
}

function prevChar(ctx: ParserContext): string {
    return ctx.text[ctx.pos.i - 1] ?? " ";
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
        const expr = parseExpressionOrMoveToNextLine(ctx);
        if (expr) {
            result.items.push(expr);
        } else {
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
            const expr = parseExpressionOrMoveToNextLine(ctx);
            if (expr) {
                result.indexers!.push(expr);
            } else {
                return result;
            }

            parseWhitespace(ctx);

            if (currentChar(ctx) !== "]") {
                ctx.parseResult.errors.push({
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

function parseBinaryOperator(ctx: ParserContext): BinaryOperatorType {
    let op: BinaryOperatorType = BIN_OP_INVALID;

    const c1 = currentChar(ctx);
    switch(c1) {
        case "=": op = BIN_OP_ASSIGNMENT; break;
        case "*": op = BIN_OP_MULTIPLY; break;
        case "/": op = BIN_OP_DIVIDE; break;
        case "+": op = BIN_OP_ADD; break;
        case "-": op = BIN_OP_SUBTRACT; break;
        case "<": op = BIN_OP_LESS_THAN; break;
        case ">": op = BIN_OP_GREATER_THAN; break;
        case "&": op = BIN_OP_AND_AND; break;
        case "|": op = BIN_OP_OR_OR; break;
    }

    if (op === BIN_OP_INVALID) {
        return op;
    }

    advance(ctx);
    const c2 = currentChar(ctx);
    switch(c2) {
        case "=": {
            switch (op) {
                case BIN_OP_ASSIGNMENT: op = BIN_OP_IS_EQUAL_TO; break;
                case BIN_OP_LESS_THAN: op = BIN_OP_LESS_THAN_EQ; break;
                case BIN_OP_GREATER_THAN: op = BIN_OP_GREATER_THAN_EQ; break;
                default: op = BIN_OP_INVALID;
            }
        } break;
        case "&": {
            switch (op) {
                case BIN_OP_AND_AND: break;
                default: op = BIN_OP_INVALID;
            }
        } break;
        case "|": {
            switch (op) {
                case BIN_OP_OR_OR: break;
                default: op = BIN_OP_INVALID;
            }
        } break;
    }
    
    return op;
}

// https://www.youtube.com/watch?v=fIPO4G42wYE&t=3750s
// Damn, it works! Funny how I had basically the same design up to the point I referred to this though.
// NOTE: My precedence is the other way around to what they had.
function parseBinaryOperatorIncreasingPrecedence(ctx: ParserContext, lhs: ProgramExpression, maxPrecedence: number): ProgramExpression | undefined {
    const op = parseBinaryOperator(ctx);
    const prec = getBinOpPrecedence(op);
    if (prec === -1) {
        return;
    }

    if (prec >= maxPrecedence) {
        return;
    }

    const start = lhs.slice.start;

    advance(ctx);
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

    const c = currentChar(ctx);
    if (isLetter(c)) {
        res = parseIdentifier(ctx);
    } else if (isDigit(c)) {
        res = parseNumberLiteral(ctx);
    } else if (c === "[") {
        res = parseListLiteral(ctx);
    } else if (c === "\"") {
        res = parseStringLiteral(ctx);
    }

    if (res) {
        while (true) {
            parseWhitespace(ctx);

            const nextRes = parseBinaryOperatorIncreasingPrecedence(ctx, res, maxPrec);
            if (!nextRes) {
                break;
            }

            res = nextRes;
        }
    }

    return res;
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

    ctx.parseResult.errors.push({
        pos: getParserPosition(ctx),
        problem: "Couldn't figure out how to parse this expression."
    });

    // Let's just get to the next line, and continue from there.
    advanceToNextNewLine(ctx);
    advance(ctx);

    return;
}

function advanceToNextNewLine(ctx: ParserContext) {
    while (advance(ctx) && currentChar(ctx) !== "\n") { }
}

function parseStatements(ctx: ParserContext, statements: ProgramExpression[]) {
    let lastLine = -1;
    while (!reachedEnd(ctx)) {
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

export function interpret(program: ProgramParseResult): ProgramOutput | null {
    if (program.statements.length === 0) {
        return null;
    }

    const output: ProgramOutput = {
        program,
    };

    return output;
}

