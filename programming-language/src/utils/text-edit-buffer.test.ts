import {
    expectEqual,
    expectNotNull,
    newTest,
    testSuite,
} from "./testing";
import {
    newBuff,
    itNew,
    buffInsertAt,
    iterate,
    iterateBackwards,
    buffToString,
    itGet,
    buffRemoveStartLen,
    itClear,
    itInsert,
    iterateBackwardsUnclamped
} from "./text-edit-buffer";


testSuite([
    itInsert,
    buffInsertAt, 
    buffRemoveStartLen,
    iterate,
    iterateBackwards
], [
    newTest("insertion at -1", () => {
        const buff = newBuff();
        const it = itNew(buff);
        itClear(it);
        itInsert(it, "a");

        const text = buffToString(buff);

        expectEqual(text, "a");
        expectEqual(buff.pieces, [{ text: ["a"], numNewlines: 0 }]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("insertion at 0", () => {
        const buff = newBuff();
        const it = buffInsertAt(buff, 0, "a");

        const text = buffToString(buff);

        expectEqual(text, "a");
        expectEqual(buff.pieces, [{ text: ["a"], numNewlines: 0 }]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("insertion after existing insertion", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, "a");
        const it = buffInsertAt(buff, 1, "b");
        const text = buffToString(buff);

        expectEqual(text, "ab");
        expectEqual(buff.pieces, [{ text: ["a", "b"], numNewlines: 0 }]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("insertion before existing insertion", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, "a");
        const it = buffInsertAt(buff, 0, "b");

        const text = buffToString(buff);

        expectEqual(text, "ba");
        expectEqual(buff.pieces, [{ text: ["b"], numNewlines: 0 }, { text: ["a"], numNewlines: 0 }]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("insertion between segment", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, "ac");
        const it = buffInsertAt(buff, 1, "b");
        const text = buffToString(buff);

        expectEqual(text, "abc");
        expectEqual(buff.pieces, [
            { text: ["a", "b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("Offset by one: insertion after existing insertion", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, " a");
        const it = buffInsertAt(buff, 2, "b");
        const text = buffToString(buff);
        expectEqual(text, " ab");
        expectEqual(buff.pieces, [
            { text: [" ", "a", "b"], numNewlines: 0 },
        ]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("Offset by one: insertion before existing insertion", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, " a");
        const it = buffInsertAt(buff, 1, "b");
        const text = buffToString(buff);

        expectEqual(text, " ba");
        expectEqual(buff.pieces, [
            { text: [" ", "b"], numNewlines: 0 },
            { text: ["a"], numNewlines: 0 },
        ]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("Offset by one: insertion between segment", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, " ac");
        const it = buffInsertAt(buff, 2, "b");
        const text = buffToString(buff);

        expectEqual(text, " abc");
        expectEqual(buff.pieces, [
            { text: [" ", "a", "b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ]);
        expectEqual(it!.pieceIdx, 1);
        expectEqual(it!.textIdx, 0);
    }),
    newTest("Remove one from one", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, "a");
        const removed = buffRemoveStartLen(buff, 0, 1);
        const text = buffToString(buff);

        expectEqual(text, "");
        expectEqual(buff.pieces, [{ "text": [], numNewlines: 0 }]);
        expectEqual(removed, "a")
    }),
    newTest("Remove one from the start", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, "ab");
        const removed = buffRemoveStartLen(buff, 0, 1);
        const text = buffToString(buff);

        expectEqual(text, "b");
        expectEqual(buff.pieces, [{ "text": ["b"], numNewlines: 0 }]);
        expectEqual(removed, "a")
    }),
    newTest("Remove one from the end", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, "ab");
        const removed = buffRemoveStartLen(buff, 1, 1);
        const text = buffToString(buff);

        expectEqual(text, "a");
        expectEqual(buff.pieces, [{ "text": ["a"], numNewlines: 0 }]);
        expectEqual(removed, "b")
    }),
    newTest("Remove one from the end with 3", () => {
        const buff = newBuff();
        buffInsertAt(buff, 0, "abc");
        const removed = buffRemoveStartLen(buff, 2, 1);
        const text = buffToString(buff);

        expectEqual(text, "ab");
        expectEqual(buff.pieces, [{ "text": ["a", "b"], numNewlines: 0 }]);
        expectEqual(removed, "c")
    }),
    newTest("Remove one from the middle with 3", () => {
        const buff = newBuff();
        // Shouldn't this also split a piece into two???
        // TODO: come back to this
        buffInsertAt(buff, 0, "abc");
        const removed = buffRemoveStartLen(buff, 1, 1);
        const text = buffToString(buff);

        expectEqual(text, "ac");
        expectEqual(buff.pieces, [{ "text": ["a", "c"], numNewlines: 0 }]);
        expectEqual(removed, "b")
    }),
    newTest("Remove first piece", () => {
        const buff = newBuff();
        buff._modified = true;
        buff.pieces = [
            { text: ["a"], numNewlines: 0 },
            { text: ["b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ];
        const removed = buffRemoveStartLen(buff, 0, 1);
        const text = buffToString(buff);

        expectEqual(text, "bc");
        expectEqual(buff.pieces, [
            { text: ["b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ]);
        expectEqual(removed, "a")
    }),
    newTest("Remove middle piece", () => {
        const buff = newBuff();
        buff._modified = true;
        buff.pieces = [
            { text: ["a"], numNewlines: 0 },
            { text: ["b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ];

        const removed = buffRemoveStartLen(buff, 1, 1);
        const text = buffToString(buff);

        expectEqual(text, "ac");
        expectEqual(buff.pieces, [
            { text: ["a"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ]);
        expectEqual(removed, "b")
    }),
    newTest("Remove last piece", () => {
        const buff = newBuff();
        buff._modified = true;
        buff.pieces = [
            { text: ["a"], numNewlines: 0 },
            { text: ["b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ];
        const removed = buffRemoveStartLen(buff, 2, 1);
        const text = buffToString(buff);

        expectEqual(text, "ab");
        expectEqual(buff.pieces, [
            { text: ["a"], numNewlines: 0 },
            { text: ["b"], numNewlines: 0 },
        ]);
        expectEqual(removed, "c");
    }),
    newTest("Remove 0 -> 1", () => {
        const buff = newBuff();
        buff._modified = true;
        buff.pieces = [
            { text: ["a"], numNewlines: 0 },
            { text: ["b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ];
        const removed = buffRemoveStartLen(buff, 0, 2);
        const text = buffToString(buff);

        expectEqual(text, "c");
        expectEqual(buff.pieces, [
            { text: ["c"], numNewlines: 0 },
        ]);
        expectEqual(removed, "ab");
    }),
    newTest("Remove 1 -> 2", () => {
        const buff = newBuff();
        buff._modified = true;
        buff.pieces = [
            { text: ["a"], numNewlines: 0 },
            { text: ["b"], numNewlines: 0 },
            { text: ["c"], numNewlines: 0 },
        ];
        const removed = buffRemoveStartLen(buff, 1, 2);
        const text = buffToString(buff);

        expectEqual(text, "a");
        expectEqual(buff.pieces, [
            { text: ["a"], numNewlines: 0 },
        ]);
        expectEqual(removed, "bc");
    }),
    newTest("Iterate forwards", () => {
        const buff = newBuff();
        buff.pieces = [
            { text: "abc \n".split(""), numNewlines: 0 },
            { text: "d e\n".split(""), numNewlines: 0 },
            { text: " ".split(""), numNewlines: 0 },
            { text: "d ".split(""), numNewlines: 0 },
        ];
        buff._modified = true;

        const expectedText = "abc \nd e\n d ";
        expectEqual(buffToString(buff), expectedText);

        const it = itNew(buff);
        const chars: string[] = [];
        for (let i = 0; i <= expectedText.length; i++) {
            const char = itGet(it);
            iterate(it);
            if (i !== expectedText.length) {
                expectNotNull(char, "" + i);
                chars.push(char);
            } else {
                expectEqual(char, undefined);
            }
        }

        const text = chars.join("");
        expectEqual(text, expectedText);
    }),
    newTest("Iterate forwards from -1", () => {
        const buff = newBuff();
        buff.pieces = [
            { text: ["a"], numNewlines: 0 },
        ];
        buff._modified = true;

        const it = itNew(buff);
        itClear(it);
        expectEqual(it, { buff, pieceIdx: -1, textIdx: -1 });

        iterate(it);
        expectEqual(it, { buff, pieceIdx: 0, textIdx: 0 });

    }),

    newTest("Iterate backwards", () => {
        const buff = newBuff();
        buff.pieces = [
            { text: "abc \n".split(""), numNewlines: 0 },
            { text: "d e\n".split(""), numNewlines: 0 },
            { text: " ".split(""), numNewlines: 0 },
            { text: "d ".split(""), numNewlines: 0 },
        ];
        buff._modified = true;

        const expectedText = "abc \nd e\n d ";
        expectEqual(buffToString(buff), expectedText);

        const it = itNew(buff);
        for (let i = 0; i < expectedText.length; i++) {
            iterate(it); // assumed working
        }

        const chars: string[] = [];
        for (let i = 0; i <= expectedText.length; i++) {
            const result = iterateBackwards(it);
            const char = itGet(it);
            if (i === expectedText.length) {
                expectEqual(result, false);
                expectEqual(char, "a");
            } else {
                expectNotNull(char, "" + i);
                chars.push(char);
            }
        }

        const text = chars.join("");
        expectEqual(text, [...expectedText].reverse().join(""));
    }),
    newTest("Iterate backwards unclamped", () => {
        const buff = newBuff();
        buff.pieces = [
            { text: "abc \n".split(""), numNewlines: 0 },
            { text: "d e\n".split(""), numNewlines: 0 },
            { text: " ".split(""), numNewlines: 0 },
            { text: "d ".split(""), numNewlines: 0 },
        ];
        buff._modified = true;

        const expectedText = "abc \nd e\n d ";
        expectEqual(buffToString(buff), expectedText);

        const it = itNew(buff);
        for (let i = 0; i < expectedText.length; i++) {
            iterate(it); // assumed working
        }

        const chars: string[] = [];
        for (let i = 0; i <= expectedText.length; i++) {
            iterateBackwardsUnclamped(it);
            const char = itGet(it);
            if (i === expectedText.length) {
                expectEqual(char, undefined);
            } else {
                expectNotNull(char, "" + i);
                chars.push(char);
            }
        }

        const text = chars.join("");
        expectEqual(text, [...expectedText].reverse().join(""));
    }),
]);
