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
export const BIN_OP_RANGE_IN = 13;
export const BIN_OP_RANGE_EX = 14;
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
    | typeof BIN_OP_RANGE_IN
    | typeof BIN_OP_RANGE_EX
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
        case BIN_OP_RANGE_EX: return "Range (exclusive)";
        case BIN_OP_RANGE_IN: return "Range (inclusive)";
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

    // an offset from the current stack index. if undefined, it wasn't defined yet.
    // This is an optimization that is supposed to speed up identifier lookup - 
    // rather than looking up a name in a hashmap, we just access an array index.
    stackOffset?: StackFrameBlockOffset;
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
    range: ProgramExpression;
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
    stack: StackFrame[];
};


type StackFrameBlock = {
    nextAvailableSlot: number;
    variables: Map<string, number>;
}

type StackFrame = {
    blocks: StackFrameBlock[];
};

type StackFrameBlockOffset = {
    global: boolean;
    offset: number;
};

function newStackFrameBlock(lastSlot: number): StackFrameBlock {
    return {
        variables: new Map(),
        nextAvailableSlot: lastSlot,
    };
}

function pushStackFrameBlock(program: ProgramParseResult): StackFrameBlock {
    const sf = getCurrentStackFrame(program);
    const cb = getCurrentStackFrameBlock(program);
    const block = newStackFrameBlock(cb.nextAvailableSlot); 

    sf.blocks.push(block);
    return block;
}

function popStackFrameBlock(program: ProgramParseResult) {
    const sf = getCurrentStackFrame(program);
    sf.blocks.pop();
}

// NOTE: The parser and interpreter both need to be in agreement about what kinds of 
// expressions will push a new stack frame to the stack. Otherwise, this won't work...
function pushStackFrame(program: ProgramParseResult): StackFrame {
    const sf: StackFrame = { 
        blocks: [newStackFrameBlock(
            // reserving slot 0  for the per-block 'last result'
            1
        )],
    };
    program.stack.push(sf);
    return sf;
}

function popStackFrame(program: ProgramParseResult) {
    const sf = getCurrentStackFrame(program);
    assert(sf.blocks.length === 1);
    program.stack.pop();
}

function getCurrentStackFrame(program: ProgramParseResult) {
    assert(program.stack.length > 0);
    return program.stack[program.stack.length - 1];
}

function getCurrentStackFrameBlock(program: ProgramParseResult) {
    const sf = getCurrentStackFrame(program);
    const block = sf.blocks[sf.blocks.length - 1];
    assert(block);
    return block;
}

function getGlobalStackFrameBlock(program: ProgramParseResult) {
    assert(program.stack.length > 0);
    const sfb = program.stack[0].blocks[0];
    assert(sfb);
    return sfb;
}

function getIdentifierStackFrameOffset(program: ProgramParseResult, name: string): StackFrameBlockOffset | undefined {
    const sf = getCurrentStackFrame(program);
    for (const b of sf.blocks) {
        const offset = b.variables.get(name);
        if (offset !== undefined) {
            return { global: false, offset };
        }
    }

    const globalSfBlock = getGlobalStackFrameBlock(program);
    const offset = globalSfBlock.variables.get(name);
    if (offset !== undefined) {
        return { global: true, offset };
    }

    return undefined;
}

function putIdentifierInCurrentStackFrame(program: ProgramParseResult, name: string, overwrite: boolean, mustBeNew: boolean): StackFrameBlockOffset {
    const currentSf = getCurrentStackFrameBlock(program);
    const sfOffset = currentSf.nextAvailableSlot;
    currentSf.nextAvailableSlot++;

    if (!overwrite && currentSf.variables.has(name)) {
        if (mustBeNew) {
            throw new Error("Can't overwrite existing variables");
        }

        return { global: false, offset: currentSf.variables.get(name)! };
    }

    currentSf.variables.set(name, sfOffset);

    return { global: false, offset: sfOffset };
}

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
            `For-loops here look like "for <loopVar> in <rangeExpression> { <statements> }". For example, "for i in 0..<100 { x = x + i }"`
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

    pushStackFrameBlock(ctx.parseResult);

    loopVar.stackOffset = putIdentifierInCurrentStackFrame(ctx.parseResult, loopVar.name, false, true);

    const loopExpr = parseBlock(ctx);
    if (!loopExpr) {
        return undefined;
    }

    popStackFrameBlock(ctx.parseResult);

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

            pushStackFrame(ctx.parseResult);

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
                arg.stackOffset = putIdentifierInCurrentStackFrame(ctx.parseResult, name, false, true);
            }

            result.argumentNames = argNames;

            const block = parseBlock(ctx);
            popStackFrame(ctx.parseResult);

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

        if (result.lhs.t === T_IDENTIFIER) {
            const offset = getIdentifierStackFrameOffset(ctx.parseResult, result.lhs.name);
            if (!offset) {
                result.lhs.stackOffset = putIdentifierInCurrentStackFrame(ctx.parseResult, result.lhs.name, true, false);
            }
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

    const stackOffset = getIdentifierStackFrameOffset(ctx.parseResult, name);

    return {
        t: T_IDENTIFIER,
        slice,
        pos,
        name,
        stackOffset
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
        pushStackFrameBlock(ctx.parseResult);
        res = parseBlock(ctx);
        popStackFrameBlock(ctx.parseResult);
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

        stack: [],
    };

    const ctx: ParserContext = {
        text,
        parseResult: program,
        pos: newTextPosition(0, 0, 0),
    };

    pushStackFrame(program);
    parseStatements(ctx, program.statements);

    // dont bother popping the global stack frame

    if (program.errors) {
        return program;
    }

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
    expr: ProgramExpressionFn;
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
    | ProgramResultFunctionDeclaration;

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
            return `Function`;
    }
}

function beginScope(state: ProgramOutputState) {
    state.stackIdxStack.push(state.stackIdx);
    state.stackIdx += state.stackIdxMaxOffset + 1;
    state.stackIdxMaxOffset = 0;

    // reserve space for "the result above"
    assignAtStackPos(state, state.stackIdx, null);
}

function endScope(state: ProgramOutputState)  {
    const previousStackIdx = getPreviousStackIdx(state);;
    state.stackIdxStack.pop();
    const delta = state.stackIdx - previousStackIdx;
    state.stackIdx = previousStackIdx;
    state.stackIdxMaxOffset = delta - 1;
}

function getPreviousStackIdx(state: ProgramOutputState): number {
    assert(state.stackIdxStack.length > 0);
    return state.stackIdxStack[state.stackIdxStack.length - 1];
}

export type ProgramOutputState = {
    stack: (ProgramResult | null)[];
    stackIdxStack: number[];
    stackIdx: number;
    stackIdxMaxOffset: number;

    functions: Map<string, ProgramExpressionFn>;

    results: ProgramResult[];
    error: {
        pos: TextPosition;
        problem: string;
        value?: ProgramResult;
    } | null;
};

function newProgramState(parserResult: ProgramParseResult): ProgramOutputState {
    return { 
        functions: parserResult.functions,
        stack: [],
        stackIdx: 0,
        stackIdxMaxOffset: 0,
        stackIdxStack: [],
        results: [],
        error: null,
    };
}

function setProgramError(state: ProgramOutputState, expr: ProgramExpression, message: string, result? : ProgramResult) {
    // An error was already present
    assert(!state.error);

    state.error = {
        pos: expr.pos,
        problem: message,
        value: result,
    };
}


function newNumberResult(val: number): ProgramResultNumber {
    return { t: T_RESULT_NUMBER, val };
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

function interpretIdentifier(expr: ProgramExpressionIdentifier | ProgramExpressionPreviousResult, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    if (expr.t === T_IDENTIFIER_THE_RESULT_FROM_ABOVE) {
        const result = getLastResult(state);
        if (!result) {
            setProgramError(state, expr, "Can't refer to ^ 'the result above' when we don't have a previous result in this scope");
            return null;
        }

        return result;
    }


    if (!expr.stackOffset) {
        setProgramError(state, expr, "This identifier hasn't been defined yet");
        return null;
    }

    const varIdx = getVariableStackIndex(state, expr.stackOffset);
    const result = state.stack[varIdx];

    if (!result) {
        setProgramError(state, expr, "This identifier hasn't been assigned yet");
        return null;
    }

    return result;
}

function getVariableStackIndex(state: ProgramOutputState, offset: StackFrameBlockOffset): number {
    let idx;
    if (offset.global) {
        idx = offset.offset;
    } else {
        idx = state.stackIdx + offset.offset;
    }
    return idx;
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

function interpretStringLiteral(expr: ProgramExpressionStringLiteral, state: ProgramOutputState): ProgramResultString | null {
    if (state.error) return null;

    return { t: T_RESULT_STRING, val: expr.val };
}

function interpretListLiteral(expr: ProgramExpressionListLiteral, state: ProgramOutputState): ProgramResultList | ProgramResultHPMatrix | null {
    if (state.error) return null;

    const resultList: ProgramResult[] = Array(expr.items.length);

    for (let i = 0; i < expr.items.length; i++) {
        const value = interpretExpression(expr.items[i], state);
        if (!value) {
            return null;
        }

        resultList[i] = value;
    }

    if (expr.t === T_LIST_LITERAL) {
        return { t: T_RESULT_LIST, values: resultList };
    }

    // Vectors/matricies need extra validation.

    assert(expr.t === T_VECTOR_LITERAL);

    let innerLen = 0;
    let innerT = 0;
    let innerShape: number[] | undefined;
    const values: number[] = [];
    for (let i = 0; i < resultList.length; i++) {
        const result = resultList[i];

        if (result.t !== T_RESULT_NUMBER && result.t !== T_RESULT_HIGH_PERFORMANCE_MATRIX) {
            setProgramError(state, expr.items[i], "Vectors/Matrices can only contain other vectors/matrices/numbers", result);
            return null;
        }

        let rowLen;
        if (result.t === T_RESULT_HIGH_PERFORMANCE_MATRIX) {
            rowLen = getLengthHpMatrix(result.val);

            // TODO: reserve the correct size based on matrix shape. flatmap...
            values.push(...result.val.m.values);
        } else {
            values.push(result.val);
            rowLen = 1;
        }

        if (i === 0) {
            innerLen = rowLen;
            innerT = result.t;
            if (result.t === T_RESULT_HIGH_PERFORMANCE_MATRIX) {
                innerShape = result.val.m.shape;
            }
        } else {
            if (innerT !== result.t) {
                setProgramError(state, expr.items[i], "This item had a different type to the previous items in the vector", result);
                return null;
            } else if (innerLen !== rowLen) {
                setProgramError(state, expr.items[i], "This vector had a different length to the previous vectors", result);
                return null;
            }
        }
    }

    const len = resultList.length;
    const newShape = innerShape ? [len, ...innerShape] : [len];

    return {
        t: T_RESULT_HIGH_PERFORMANCE_MATRIX,
        val: { m: { values, shape: newShape }, indexes: [],
        }
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
    state: ProgramOutputState,
): ProgramResultNumber | ProgramResultRange | null {
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

    let result: ProgramResultNumber | ProgramResultRange | null = null;

    if (num !== undefined) {
        result = newNumberResult(num);
    } else if (range) {
        result = { t: T_RESULT_RANGE, val: range };
    }

    return result;
}

function interpretAssignment(expr: ProgramExpressionAssignment, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    if (!expr.rhs) {
        setProgramError(state, expr, "This assignment is incomplete, and cannot be evaluated");
        return null;
    }

    if (expr.lhs.t !== T_DATA_INDEX_OP && expr.lhs.t !== T_IDENTIFIER) {
        setProgramError(state, expr, "Can't assign to an expression of this type");
        return null;
    }

    if (expr.lhs.t === T_DATA_INDEX_OP) {
        // TODO: Implmement
        setProgramError(state, expr, "Assigning to an index hasn't been implemented yet");
        return null;
    }

    const rhs = interpretExpression(expr.rhs, state);
    if (!rhs) {
        return null;
    }

    assignIdentifier(state, expr.lhs, rhs);
    if (state.error) {
        return null;
    }

    return rhs;
}

function setLastResult(state: ProgramOutputState, value: ProgramResult | null) {
    state.stack[state.stackIdx] = value;
}

function getLastResult(state: ProgramOutputState): ProgramResult | null {
    return state.stack[state.stackIdx];
}

function assignIdentifier(state: ProgramOutputState, identifier: ProgramExpressionIdentifier, value: ProgramResult) {
    if (!identifier.stackOffset) {
        // TODO: move to parse state somehow
        setProgramError(state, identifier, "The stack offset couldn't be determined at parse-time...");
        return;
    }

    const varIdx = getVariableStackIndex(state, identifier.stackOffset);
    assignAtStackPos(state, varIdx, value);
}

function max(a: number, b: number): number {
    return a > b ? a : b;
}

function assignAtStackPos(state: ProgramOutputState, varIdx: number, value: ProgramResult | null) {
    resizeStack(state, varIdx);

    state.stack[varIdx] = value;
    state.stackIdxMaxOffset = max(state.stackIdxMaxOffset, varIdx - state.stackIdx);
}

function resizeStack(state: ProgramOutputState, varIdx: number) {
    // TODO: figure out how big a function's stack size is at parse time, instead of dynamically allocating like this
    while (varIdx >= state.stack.length) {
        state.stack.push(null);
    }
}


function interpretBinaryOp(expr: ProgramExpressionBinaryOperator, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    if (!expr.rhs) {
        setProgramError(state, expr, "This expression is incomplete, and cannot be evaluated");
        return null;
    }


    const r = interpretExpression(expr.rhs, state);
    if (!r) {
        return null;
    }

    const l = interpretExpression(expr.lhs, state);
    if (!l) {
        return null;
    }

    let result: ProgramResult | null = null;

    if (r.t === T_RESULT_NUMBER) {
        if (l.t === T_RESULT_NUMBER) {
            result = calculateBinaryOpNumberXNumber(l, r, expr, state);
        }
    }

    if (!result) {
        setProgramError(state, expr, `We don't have a way to compute ${programResultTypeString(l)} ${binOpToOpString(expr.op)} ${programResultTypeString(r)} yet.`);
        return null;
    }

    return result;
}

function interpretTernaryIf(expr: ProgramExpressionTernaryIf, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    if (!expr.falseBranch) {
        setProgramError(state, expr, `Ternary needs a false path to be valid`);
        return null;
    }

    const conditionResult = interpretExpression(expr.query, state);
    if (!conditionResult) {
        return null;
    }

    if (conditionResult.t !== T_RESULT_NUMBER) {
        setProgramError(state, expr, `Ternary queries must always evaulate to numbers. 0 -> false, everything else -> true`);
        return null;
    }

    let result: ProgramResult | null;
    if (conditionResult.val === 0) {
        result = interpretExpression(expr.falseBranch, state);
    } else {
        result = interpretExpression(expr.trueBranch, state);
    }

    return result;
}

function interpretWithinCurrentScope(statements: ProgramExpression[], state: ProgramOutputState, isTopLevel: boolean): ProgramResult | null {
    if (state.error) return null;

    for (let i = 0; i < statements.length; i++) {
        const expr = statements[i];

        const result = interpretExpression(expr, state, true);
        setLastResult(state, result);

        if (state.error) {
            break;
        }

        // When a result is not returned, an error must always be set
        assert(!!result);

        if (isTopLevel) {
            state.results.push(result);
        }
    }

    if (state.error) {
        return null;
    }

    return getLastResult(state);
}


function validateBlock(expr: ProgramExpressionBlock, state: ProgramOutputState) {
    const statements = expr.statements;
    if (statements.length === 0) {
        // TODO: figure out how to remove this error. Why cant I just do {}, ya know
        setProgramError(state, expr, "Blocks must always contain at least one statement");
    }
}

function interpretBlock(expr: ProgramExpressionBlock, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    // Implementation here

    validateBlock(expr, state);
    if (state.error) {
        return null;
    }

    const result = interpretWithinCurrentScope(expr.statements, state, false);

    return result;
}

function interpretRangeFor(expr: ProgramExpressionRangedFor, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    const rangeResult = interpretExpression(expr.range, state);
    if (!rangeResult) {
        return null;
    }

    if (rangeResult.t !== T_RESULT_RANGE) {
        setProgramError(state, expr, `Result of range expression wasn't a range`, rangeResult);
        return null;
    }

    const lo = rangeResult.val.lo;
    const hi = rangeResult.val.hi;

    const loopVar: ProgramResultNumber = { t: T_RESULT_NUMBER, val: 0 };
    assignIdentifier(state, expr.loopVar, loopVar);

    // TODO: think about: if this is the right abstraction. Should for-loops actually aggregate all their results as a kind of `map`?

    if (lo <= hi) {
        for (let i = lo; i < hi; i++) {
            loopVar.val = i;
            const result = interpretExpression(expr.body, state);
            setLastResult(state, result);
        }
    } else {
        for (let i = lo; i > hi; i--) {
            loopVar.val = i;
            const result = interpretExpression(expr.body, state);
            setLastResult(state, result);
        }
    }

    const lastResult = getLastResult(state);

    return lastResult;
}

function interpretFunction(expr: ProgramExpressionFn, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    if (expr.body) {
        assert(state.functions.get(expr.fnName.name) === expr);
        return { t: T_RESULT_FN, expr };
    }

    const decl = state.functions.get(expr.fnName.name);
    if (!decl) {
        setProgramError(state, expr, "This function hasn't been declared yet");
        return null;
    }

    // The way we knew to save this declaration in the first place was by checking
    // for the presence of the body field
    assert(decl.body);
    assert(decl.argumentNames);

    if (decl.argumentNames.length !== expr.arguments.length) {
        setProgramError(state, expr, `Number of arugments in declraration (${decl.arguments.length}) doesn't match the number of arguments provided`,
            { t: T_RESULT_FN, expr: decl }
        );
        return null;
    }


    const initialMaxOffset = state.stackIdxMaxOffset;
    // reserve space for 'last result'
    state.stackIdxMaxOffset++;
    // put the function arguments into this stack frame
    for (let i = 0; i < decl.argumentNames.length; i++) {
        const argExpr = expr.arguments[i];

        // We still need to interpret this while being in the current scope
        const result = interpretExpression(argExpr, state);
        if (!result) {
            return null;
        }

        // we can add variables onto the 'next' scope before actually starting it
        // by extending our current stack frame by 1 each time, and then resetting it before we begin the next scope
        state.stackIdxMaxOffset++;
        state.stack[state.stackIdx + state.stackIdxMaxOffset] = result;
    }

    state.stackIdxMaxOffset = initialMaxOffset;
    beginScope(state);

    interpretBlock(decl.body, state)

    const lastResult = getLastResult(state);
    endScope(state);

    return lastResult;
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
        case T_RESULT_HIGH_PERFORMANCE_MATRIX: return getLengthHpMatrix(result.val);
    }
}

function indexIntoResult(
    result: ProgramResult, idx: number, 
    // These are for error reporting
    state: ProgramOutputState, exprIdx: ProgramExpression, idxExprResult: ProgramResultNumber, len: number
): ProgramResult | null {
    // technically, some of these can be done before actually indexing int othe thing, so yeah.

    if (idx % 1) {
        setProgramError(state, exprIdx, "Indexing expressions cannot have a decimal component", idxExprResult);
        return null;
    }

    if (idx < 0) {
        setProgramError(state, exprIdx, "Indexing expression was less than zero", idxExprResult);
        return null;
    }

    if (idx >= len) {
        setProgramError(state, exprIdx, `Indexing expression ${idx} is out of bounds (${len})`);
        return null;
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

function interpretDataIndexOp(expr: ProgramExpressionDataIndex, state: ProgramOutputState): ProgramResult | null {
    if (state.error) return null;

    // we somehow parsed a data indexing op without finding any '[' braces or something. 
    assert(expr.indexes.length > 0);

    let result = interpretExpression(expr.lhs, state);
    if (!result) {
        return null;
    }

    for (let i = 0; i < expr.indexes.length; i++) {
        if (!result) {
            return null;
        }

        const exprIdx = expr.indexes[i];

        const resultLen = getLength(result);
        if (resultLen === undefined) {
            if (i === 0) {
                setProgramError(state, exprIdx, "This expression cannot be indexed", result);
            } else {
                setProgramError(state, exprIdx, "This expression cannot be indexed any further", result);
            }
            return null;
        }

        const exprIdxResult = interpretExpression(exprIdx, state);
        if (!exprIdxResult) {
            return null;
        }

        if (exprIdxResult.t !== T_RESULT_NUMBER) {
            setProgramError(state, exprIdx, "Indexing expressions must evaluate to numbers");
            return null;
        }

        const idx = exprIdxResult.val;

        result = indexIntoResult(result, idx, state, exprIdx, exprIdxResult, resultLen);
        if (!result) {
            return null;
        }
    }

    return null;
}

function interpretNumberLiteral(expr: ProgramExpressionNumberLiteral, state: ProgramOutputState): ProgramResultNumber | null {
    if (state.error) return null;

    return newNumberResult(expr.val);
}

function interpretExpression(expr: ProgramExpression, state: ProgramOutputState, isBlockLevelStatement: boolean = false): ProgramResult | null {
    if (state.error) return null;

    let result: ProgramResult | null = null;

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
            result = interpretBinaryOp(expr, state);
        } break;
        case T_TERNARY_IF: {
            result = interpretTernaryIf(expr, state);
        } break;
        case T_BLOCK: {
            // Blocks no longer need their own scope - 
            // the parse-stage will re-use addresses in the current function's stack frame 
            // as needed. This way, blocks may access other variables in the same stack frame,
            // instead of attempting to search up the stack frames or something like that.
            result = interpretBlock(expr, state);
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
        case T_ASSIGNMENT: {
            result = interpretAssignment(expr, state);
        } break;
        default: {
            let typeString = expressionTypeToString(expr);
            throw new Error("Unhandled type (Interpreter): " + typeString);
        }
    }

    return result;
}

export function interpret(parseResult: ProgramParseResult): ProgramOutputState {
    const state = newProgramState(parseResult); 

    if (parseResult.errors.length > 0) {
        state.error = parseResult.errors[0];
        return state;
    }

    beginScope(state);
    interpretWithinCurrentScope(parseResult.statements, state, true); 

    // no need to end the top-level scope.

    return state;
}

