import { assert } from "./assert";

// You'll want to namespace-import this. The names were all getting way too long.

// NOTE: This is quite complicated, and we have to convert it to a string anyway, since we're parsing
// and rerunning the program for every keystroke.
type Piece = {
    text: string[];
    numNewlines: number;
};

export type Buffer = {
    pieces: Piece[];
    _modified: boolean;
    _text: string;
};

export function buffGetLen(b: Buffer): number {
    let len = 0;
    for (let i = 0; i < b.pieces.length; i++) {
        const piece = b.pieces[i];
        len += piece.text.length;
    }

    return len;
}

export function buffInsertAt(
    b: Buffer,
    pos: number,
    text: string
): Iterator | undefined {
    if (text === "") return;

    const it = itNew(b);
    for (let i = 0; i < pos; i++) {
        iterate(it);
    }
    itInsert(it, text);

    return it;
}

export function itInsert(
    it: Iterator,
    text: string
) {
    if (text === "") return;

    const b = it.buff;

    itBisect(it);

    const{ pieceIdx } = it;

    assert(pieceIdx > 0);
    const piece = b.pieces[pieceIdx - 1];

    for (const c of text) {
        piece.text.push(c);
    }

    recomputeLineCount(piece);

    b._modified = true;
}


export function buffRemoveStartLen(b: Buffer, pos: number, num: number) {
    const start = itNew(b);
    for (let i = 0; i < pos; i++) {
        iterate(start);
    }

    const end = itFrom(start);
    for (let i = 0; i < num; i++) {
        iterate(end);
    }

    const removed = itGetTextBetween(start, end);
    if (!removed) return "";

    itRemove(start, end);

    return removed;
}

export function itEquals(
    a: Iterator,
    b: Iterator,
) {
    assert(a.buff === b.buff);
    return a.pieceIdx === b.pieceIdx && a.textIdx === b.textIdx;
}

function isValidStartEnd(start: Iterator, end: Iterator) {
    if (itEquals(start, end)) return false;
    if (itBefore(end, start)) return false;
    if (!itGet(start)) return false;
    if (!itGet(end) && !itIsAtEnd(end)) return false;
    return true;
}

export function itRemove(start: Iterator, end: Iterator) {
    if (!isValidStartEnd(start, end)) return;

    const b = start.buff;

    if (start.pieceIdx === end.pieceIdx) {
        assert(start.pieceIdx < b.pieces.length);
        const piece = b.pieces[start.pieceIdx];

        if (start.textIdx === 0 && end.textIdx === piece.text.length) {
            b.pieces.splice(start.pieceIdx, 1);
            return;
        } 

        piece.text.splice(start.textIdx, end.textIdx - start.textIdx);
        return;
    }

    const startPiece = b.pieces[start.pieceIdx]; assert(startPiece);

    const deleteStartPiece = start.textIdx === 0;
    let deleteEndPiece = false;
    if (end.pieceIdx !== b.pieces.length) {
        const endPiece = b.pieces[end.pieceIdx]; assert(endPiece);
        deleteEndPiece = end.textIdx === endPiece.text.length;
    }

    let deletePiecesFrom = start.pieceIdx;
    let deletePiecesTo = end.pieceIdx;

    if (!deleteStartPiece) {
        deletePiecesFrom++;
        startPiece.text.length = start.textIdx;
    }

    if (!deleteEndPiece) {
        deletePiecesTo--;
        if (end.pieceIdx !== b.pieces.length) {
            const endPiece = b.pieces[end.pieceIdx]; assert(endPiece);
            endPiece.text.splice(0, end.textIdx);
        }
    }

    b.pieces.splice(deletePiecesFrom, deletePiecesTo - deletePiecesFrom + 1);
}

export function itGetTextBetween(start: Iterator, end: Iterator) {
    if (!isValidStartEnd(start, end)) return;

    assert(start.buff === end.buff);

    const text: string[] = [];

    const it = itFrom(start);
    while (!itEquals(end, it)) {
        const char = itGet(it);
        iterate(it)

        if (!char) break;
        text.push(char);
    }

    return text.join("");
}

export function buffToString(b: Buffer) {
    if (!b._modified) return b._text;

    const sb: string[] = [];

    for (let i = 0; i < b.pieces.length; i++) {
        const text = b.pieces[i].text;
        for (let j = 0; j < text.length; j++) {
            const c = text[j];
            sb.push(c);
        }
    }

    b._text = sb.join("");
    b._modified = false;
    return b._text;
}

/**
 * Bisects the datastructure where this iterator is, such that it is now pointing at the end
 * of the current segment. This allows us to insert things into this piece without invalidating 
 * cursors on any other pieces. 
 *
 * any of the other cursors.
 *
 * Before:  ...][texttexttexttext][...
 *                  ^ cursor
 *
 * After:   ...][text][texttexttext][...
 *                     ^ cursor
 *
 * The reason why we put our cursor at the start of the _next_ piece, is that it is actually invalid
 * for an iterator to fall off the end of one piece and not be on the next piece.
 */
export function itBisect(it: Iterator) {
    const b = it.buff;
    let { pieceIdx, textIdx } = it;

    // We are at the start, middle or end of a piece. 
    // We either need to insert onto the end of this piece, the previous piece, or 
    // split the current piece into two and push onto the left piece.
    
    if (textIdx === 0) {
        if (pieceIdx === 0) {
            // we are at the start, abd we don't want to call unshift on the piece text itself.
            // instead, let's just insert a new piece here, and start appending to that.
            const piece = { text: [], numNewlines: 0 };
            textIdx = 0;
            pieceIdx = 1;
            b.pieces.unshift(piece);
        } else {
            // Do nothing. we are at the start of a piece.
        }
    } else {
        // This can only be the case when textIdx === 0, which is handled above.
        assert(pieceIdx !== b.pieces.length);

        // we are in the middle of some other piece. We need to split it into two, such that 
        // we can just insert onto the end of `piece`
        
        const piece = b.pieces[pieceIdx];
        const nextPieceText = piece.text.slice(textIdx);

        piece.text.length = textIdx;
        recomputeLineCount(piece);

        const nextPiece: Piece = { text: nextPieceText, numNewlines: 0 };
        recomputeLineCount(nextPiece);

        b.pieces.splice(pieceIdx + 1, 0, nextPiece);
        pieceIdx = pieceIdx + 1;
        textIdx = 0;
    }

    it.pieceIdx = pieceIdx;
    it.textIdx = textIdx;
}

/**
 * creating a bisection for every iterator will put each iterator on it's own piece,
 * so that we can insert at all of them at once.
 * This code assumes that each iterator is in a different place.
 */
export function itBisectAll(iterators: Iterator[]) {
    for (const it of iterators) {
        itBisect(it);
    }
}

function recomputeLineCount(piece: Piece) {
    piece.numNewlines = 0;
    for (let i = 0; i < piece.text.length; i++) {
        if (piece.text[i] === "\n") piece.numNewlines++;
    }
}

export function newBuff(): Buffer {
    return { pieces: [], _modified: false, _text: "" };
}

export type Iterator = {
    buff: Buffer;
    pieceIdx: number;
    textIdx: number;
};


export function itNew(buff: Buffer): Iterator {
    return { buff, pieceIdx: 0, textIdx: 0 };
}

export function itFrom(a: Iterator): Iterator {
    return { ...a };
}

export function itCopy(
    dst: Iterator,
    src: Iterator,
) {
    assert(src.buff === dst.buff);

    dst.pieceIdx = src.pieceIdx;
    dst.textIdx = src.textIdx;
}

export function itBefore(a: Iterator, b: Iterator) {
    if (a.pieceIdx < b.pieceIdx) return true;
    if (a.pieceIdx === b.pieceIdx) return a.textIdx < b.textIdx;
    return false;
}

export function itMin(src: Iterator, a: Iterator, b: Iterator) {
    const min = itBefore(a, b) ? a : b;
    src.pieceIdx = min.pieceIdx;
    src.textIdx = min.textIdx;
}

export function itMax(src: Iterator, a: Iterator, b: Iterator) {
    const min = itBefore(a, b) ? b : a;
    src.pieceIdx = min.pieceIdx;
    src.textIdx = min.textIdx;
}

export function itClear(it: Iterator) {
    it.pieceIdx = -1;
    it.textIdx = -1;
}

export function itZero(it: Iterator) {
    it.pieceIdx = 0;
    it.textIdx = 0;
}

export function itIsAtEnd(a: Iterator) {
    const b = a.buff;
    if (a.pieceIdx === b.pieces.length - 1) {
        const finalPiece = b.pieces[a.pieceIdx];
        return a.textIdx === finalPiece.text.length;
    }

    if (a.pieceIdx === b.pieces.length) {
        assert(a.textIdx === 0);
        return true;
    }

    return false;
}

export function itEnd(it: Iterator) {
    const b = it.buff;
    if (b.pieces.length > 0) {
        it.pieceIdx = b.pieces.length - 1;
        it.textIdx = b.pieces[it.pieceIdx].text.length - 1;
    }
}

/** Returns true if we actually moved */
export function iterate(it: Iterator): boolean {
    const b = it.buff;

    if (it.pieceIdx === -1) {
        itZero(it);
        return true;
    }

    if (it.pieceIdx >= b.pieces.length) return false;
    let piece = b.pieces[it.pieceIdx];

    if (it.textIdx === piece.text.length) return false;

    it.textIdx++;
    if (it.textIdx === piece.text.length) {
        it.textIdx = 0;
        it.pieceIdx++;
    }

    return true;
}

export function itGet(it: Iterator): string | undefined {
    const pieceIdx = it.pieceIdx;
    const textIdx = it.textIdx;
    const b = it.buff;
    if (pieceIdx < 0 || pieceIdx >= b.pieces.length) return undefined;
    const piece = b.pieces[pieceIdx];
    if (textIdx < 0 || textIdx >= piece.text.length) return undefined;
    return piece.text[textIdx];
}

/** Returns true if we actually moved */
export function iterateBackwards(it: Iterator): boolean {
    if (it.pieceIdx === -1) return false;

    const b = it.buff;
    if (it.textIdx === 0) {
        if (it.pieceIdx > 0) {
            it.pieceIdx--;
            const piece = b.pieces[it.pieceIdx]; assert(piece);

            // invalid for zero-length text on a piece.
            assert(piece.text.length > 0);
            it.textIdx = piece.text.length - 1;
        } else {
            it.pieceIdx = -1;
            it.textIdx = -1;
        }
    } else {
        it.textIdx--;
    }

    return true;
}

export function buffGetLineCol(
    it: Iterator,
    pos: number
): [number, number] {
    it.pieceIdx = 0;
    it.textIdx = 0;

    // TODO: make it more efficient.

    let line = 0;
    let col = 0;
    let i = 0;
    while (itGet(it) && i < pos) {
        const char = itGet(it);
        iterate(it);
        i++;
        if (char === "\n") {
            line++;
            col = 0;
        } else {
            col++;
        }
    }

    return [line, col];
}


export function iterateToLineCol(
    it: Iterator,
    line: number,
    col: number,
    clampExcessiveCol = true
): number {
    // TODO: make it more efficient.

    let l = 0, c = 0, i = 0;
    while (itGet(it)) {
        const char = itGet(it);
        iterate(it);

        if (l === line && c === col) {
            return i;
        }

        i++;
        if (char === "\n") {
            if (l === line && clampExcessiveCol) {
                // Don't just increment past the line we want!!!
                return i;
            }

            l++;
            c = 0;
        } else {
            c++;
        }
    }

    return i;
}

export function itQuery(it: Iterator, query: string) {
    const { textIdx, pieceIdx } = it;

    let i = 0;
    while (itGet(it) === query[i]) {
        iterate(it);
        i++;
    }

    const matched = i === query.length;

    it.textIdx = textIdx;
    it.pieceIdx = pieceIdx;

    return matched;
}
