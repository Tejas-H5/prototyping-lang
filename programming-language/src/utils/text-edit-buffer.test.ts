import {
    expectEqual,
    expectNotNull,
    test
} from "./testing";
import {
    newBuff,
    itNew,
    buffInsertAt,
    iterate,
    iterateBackwards,
    itRemove,
    buffToString,
    itGet,
    buffRemoveStartLen,
    itClear
} from "./text-edit-buffer";

test("insertion at 0", () => {
    const buff = newBuff();
    const it = buffInsertAt(buff, 0, "a");

    const text = buffToString(buff);

    expectEqual(text, "a");
    expectEqual(buff.pieces, [{ text: ["a"], numNewlines: 0 }]);
    expectEqual(it!.pieceIdx, 1);
    expectEqual(it!.textIdx, 0);
})


test("insertion after existing insertion", () => {
    const buff = newBuff();
    buffInsertAt(buff, 0, "a");
    const it = buffInsertAt(buff, 1, "b");
    const text = buffToString(buff);

    expectEqual(text, "ab");
    expectEqual(buff.pieces, [{ text: ["a", "b"], numNewlines: 0 }]);
    expectEqual(it!.pieceIdx, 1);
    expectEqual(it!.textIdx, 0);
});

test("insertion before existing insertion", () => {
    const buff = newBuff();
    buffInsertAt(buff, 0, "a");
    const it = buffInsertAt(buff, 0, "b");

    const text = buffToString(buff);

    expectEqual(text, "ba");
    expectEqual(buff.pieces, [{ text: ["b"], numNewlines: 0 }, { text: ["a"], numNewlines: 0 }]);
    expectEqual(it!.pieceIdx, 1);
    expectEqual(it!.textIdx, 0);
});

test("insertion between segment", () => {
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
});


test("Offset by one: insertion after existing insertion", () => {
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
});

test("Offset by one: insertion before existing insertion", () => {
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
});

test("Offset by one: insertion between segment", () => {
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
});


test("Remove one from one", () => {
    const buff = newBuff();
    buffInsertAt(buff, 0, "a");
    const removed = buffRemoveStartLen(buff, 0, 1);
    const text = buffToString(buff);

    expectEqual(text, "");
    expectEqual(buff.pieces, [{ "text": [], numNewlines: 0 }]);
    expectEqual(removed, "a")
});


test("Remove one from the start", () => {
    const buff = newBuff();
    buffInsertAt(buff, 0, "ab");
    const removed = buffRemoveStartLen(buff, 0, 1);
    const text = buffToString(buff);

    expectEqual(text, "b");
    expectEqual(buff.pieces, [{ "text": ["b"], numNewlines: 0 }]);
    expectEqual(removed, "a")
});


test("Remove one from the end", () => {
    const buff = newBuff();
    buffInsertAt(buff, 0, "ab");
    const removed = buffRemoveStartLen(buff, 1, 1);
    const text = buffToString(buff);

    expectEqual(text, "a");
    expectEqual(buff.pieces, [{ "text": ["a"], numNewlines: 0 }]);
    expectEqual(removed, "b")
});


test("Remove one from the end with 3", () => {
    const buff = newBuff();
    buffInsertAt(buff, 0, "abc");
    const removed = buffRemoveStartLen(buff, 2, 1);
    const text = buffToString(buff);

    expectEqual(text, "ab");
    expectEqual(buff.pieces, [{ "text": ["a", "b"], numNewlines: 0 }]);
    expectEqual(removed, "c")
});

test("Remove one from the middle with 3", () => {
    const buff = newBuff();
    // Shouldn't this also split a piece into two???
    // TODO: come back to this
    buffInsertAt(buff, 0, "abc");
    const removed = buffRemoveStartLen(buff, 1, 1);
    const text = buffToString(buff);

    expectEqual(text, "ac");
    expectEqual(buff.pieces, [{ "text": ["a", "c"], numNewlines: 0 }]);
    expectEqual(removed, "b")
});

test("Remove first piece", () => {
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
});


test("Remove middle piece", () => {
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
});

test("Remove last piece", () => {
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
});

test("Remove 0 -> 1", () => {
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
});


test("Remove 1 -> 2", () => {
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
});


test("Iterate forwards", () => {
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
});

test("Iterate forwards from -1", () => {
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

});


test("Iterate backwards", () => {
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
        iterateBackwards(it);
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
});
