import { filterInPlace } from "./array-utils";
import { assert } from "./assert";

// You'll want to namespace-import this. The names were all getting way too long.

// NOTE: This is quite complicated, and we have to convert it to a string anyway, since we're parsing
// and rerunning the program for every keystroke.
type Piece = {
    text: string[];
    numNewlines: number;
};

// NOTE: modifying this structure outside of the API is done at your own peril
export type Buffer = {
    pieces: Piece[];

    // permanent cursors
    _cursors: Iterator[];

    // transient cursors
    _tempCursors: Iterator[];
    _isEditing: boolean;

    _modified: boolean;
    _text: string;
};

export function beginEditing(b: Buffer) {
    assert(!b._isEditing);
    b._isEditing = true;
}

export function endEditing(b: Buffer) {
    b._isEditing = false;
    b._tempCursors.length = 0;
}

export function buffGetLen(b: Buffer): number {
    let len = 0;
    for (let i = 0; i < b.pieces.length; i++) {
        const piece = b.pieces[i];
        len += piece.text.length;
    }

    return len;
}

// NOTE: use sparingly
export function itGetPos(it: Iterator): number {
    const b = it.buff;
    let pos = 0;

    for (let i = 0; i < it.pieceIdx; i++) {
        const piece = b.pieces[i];
        pos += piece.text.length;
    }

    if (it.pieceIdx < b.pieces.length) {
        pos += it.textIdx;
    } else {
        pos += 1;
    }

    return pos;
}

export function buffInsertAt(b: Buffer, pos: number, text: string): Iterator | undefined {
    if (text === "") return;

    const it = itNewTemp(b);
    for (let i = 0; i < pos; i++) {
        iterate(it);
    }
    itInsert(it, text);

    return it;
}

export function itInsert(it: Iterator, text: string): boolean {
    if (text === "") return false;

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
    return true;
}

export function buffRemoveAt(b: Buffer, pos: number, num: number): string {
    const start = itNewTemp(b);
    for (let i = 0; i < pos; i++) {
        iterate(start);
    }

    const end = itNewTemp(b);
    itCopy(end, start);
    for (let i = 0; i < num; i++) {
        iterate(end);
    }

    const removed = itGetTextBetween(start, end);
    if (!removed) {
        return "";
    }

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

function isValidAndNonZeroRange(start: Iterator, end: Iterator) {
    if (itEquals(start, end)) return false;
    if (itBefore(end, start)) return false;
    if (!itGet(start)) return false;
    if (!itGet(end) && !itIsAtEnd(end)) return false;
    return true;
}

export function itRemove(start: Iterator, end: Iterator): boolean {
    if (!isValidAndNonZeroRange(start, end)) return false;

    const b = start.buff;
    b._modified = true;

    if (!itIsZero(start)) {
        itBisect(start);
    }
    itBisect(end);

    const pieceIdxFrom = start.pieceIdx;
    const numDeleted = end.pieceIdx - start.pieceIdx;
    b.pieces.splice(pieceIdxFrom, numDeleted)

    // Update cursors for remove
    {
        // We need to copy these, as they too are items in one of these cursor arrays
        // TODO: optimize
        const start1 = { ...start };
        const end1 = { ...end };

        filterInPlace(b._cursors, c => {
            if (itBefore(end1, c) || itEquals(end1, c)) {
                c.pieceIdx -= numDeleted;
                return true;
            }

            return itBefore(c, start1);
        });

        // NOTE: this is just a copy-paste from above
        filterInPlace(b._tempCursors, c => {
            if (itBefore(end1, c) || itEquals(end1, c)) {
                c.pieceIdx -= numDeleted;
                return true;
            }

            return itBefore(c, start1);
        });
    }


    return true;
}

export function itGetTextBetween(start: Iterator, end: Iterator) {
    if (!isValidAndNonZeroRange(start, end)) return;

    assert(start.buff === end.buff);

    const text: string[] = [];

    const { pieceIdx, textIdx } = start;

    while (!itEquals(end, start)) {
        const char = itGet(start);

        if (!char) break;
        text.push(char);

        if (!iterate(start)) break;
    }

    itCopyValues(start, pieceIdx, textIdx);

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

function updateCursorsForBisect(b: Buffer, pieceIdx: number, textIdx: number) {
    for (let i = 0; i < b._cursors.length; i++) {
        const c = b._cursors[i];
        if (c.pieceIdx < pieceIdx) continue;
        if (c.pieceIdx === pieceIdx) {
            if (c.textIdx < textIdx) continue;
            c.textIdx -= textIdx;
        }
        c.pieceIdx += 1;
    }

    // NOTE: just edit the above, and copy-paste here
    for (let i = 0; i < b._tempCursors.length; i++) {
        const c = b._tempCursors[i];
        if (c.pieceIdx < pieceIdx) continue;
        if (c.pieceIdx === pieceIdx) {
            if (c.textIdx < textIdx) continue;
            c.textIdx -= textIdx;
        }
        c.pieceIdx += 1;
    }
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

    if (itIsClear(it)) itZero(it);

    const { pieceIdx, textIdx } = it;

    // We are at the start, middle or end of a piece. 
    // We either need to insert onto the end of this piece, the previous piece, or 
    // split the current piece into two and push onto the left piece.
    
    if (textIdx === 0) {
        if (pieceIdx === 0) {
            // we are at the start, abd we don't want to call unshift on the piece text itself.
            // instead, let's just insert a new piece here, and start appending to that.
            const piece = { text: [], numNewlines: 0 };
            b.pieces.unshift(piece);
            updateCursorsForBisect(b, pieceIdx, textIdx);
        } else {
            // Do nothing. we are at the start of a piece.
            // We may even be at pieceIdx === buff.pieces.length.
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
        updateCursorsForBisect(b, pieceIdx, textIdx);
    }
}

function recomputeLineCount(piece: Piece) {
    piece.numNewlines = 0;
    for (let i = 0; i < piece.text.length; i++) {
        if (piece.text[i] === "\n") piece.numNewlines++;
    }
}

export function newBuff(): Buffer {
    return {
        pieces: [],
        _cursors: [],
        _tempCursors: [],
        _isEditing: false,

        _modified: false,
        _text: ""
    };
}

export type Iterator = {
    buff: Buffer;
    pieceIdx: number;
    textIdx: number;
};

/** Creates a permanent cursor that won't be cleaned up ever */
export function itNewPermanent(buff: Buffer): Iterator {
    const it: Iterator = { buff, pieceIdx: 0, textIdx: 0 };
    buff._cursors.push(it);
    return it;
}

/** Creates a temporary cursor that gets cleaned up when we finish editing */
export function itNewTemp(buff: Buffer): Iterator {
    assert(buff._isEditing);
    const it: Iterator = { buff, pieceIdx: 0, textIdx: 0 };
    buff._tempCursors.push(it);
    return it;
}

export function itNewTempFrom(it: Iterator, offset = 0) {
    const copy = itNewTemp(it.buff);
    copy.pieceIdx = it.pieceIdx;
    copy.textIdx = it.textIdx;

    for (let i = 0; i < offset; i++) {
        iterate(copy);
    }

    for (let i = 0; i > offset; i--) {
        iterateBackwards(copy);
    }

    return copy;
}

export function itCopy(dst: Iterator, src: Iterator) {
    assert(src.buff === dst.buff);

    dst.pieceIdx = src.pieceIdx;
    dst.textIdx = src.textIdx;
}

export function itCopyValues(dst: Iterator, pieceIdx: number, textIdx: number) {
    dst.pieceIdx = pieceIdx;
    dst.textIdx = textIdx;
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

export function itIsClear(it: Iterator) {
    return it.pieceIdx === -1;
}

export function itIsZero(it: Iterator) {
    return it.pieceIdx <= 0 && it.textIdx <= 0;
}

/** Returns true if we actually moved */
export function iterate(it: Iterator): boolean {
    const b = it.buff;

    if (itIsClear(it)) {
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

    assert(it.textIdx < piece.text.length);

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


export function iterateBackwards(it: Iterator): boolean {
    if (itIsZero(it)) return false;

    return iterateBackwardsUnclamped(it);
}

/** 
 * Returns true if we actually moved.
 * NOTE: we can actually iterate backwards from 0,0 to pieceIdx=-1,textIdx-1.
 */
export function iterateBackwardsUnclamped(it: Iterator): boolean {
    if (itIsClear(it)) return false;

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

