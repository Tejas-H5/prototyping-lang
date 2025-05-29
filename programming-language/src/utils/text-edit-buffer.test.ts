import {
    expectEqual,
    expectNotNull,
    newTest,
    powerSetTests,
    Test,
    testSuite,
    forEachRange,
} from "./testing";
import {
    newBuff,
    buffInsertAt,
    iterate,
    iterateBackwards,
    buffToString,
    itGet,
    buffRemoveAt,
    itClear,
    itInsert,
    iterateBackwardsUnclamped,
    endEditing,
    beginEditing,
    itNewPermanent,
    Buffer,
    itNewTemp,
    itNewTempFrom,
    itRemove,
    itBisect
} from "./text-edit-buffer";

function generateInsertionTests() {
    const expectedText = "abc";

    // Each insertion pattern may result in a different internal representation. 
    // they should all represent the text "abc".
    return [
        newTest("insertion one by one at the end", (buff: Buffer) => {
            buffInsertAt(buff, 0, "a");
            buffInsertAt(buff, 1, "b");
            buffInsertAt(buff, 2, "c");

            expectEqual(buffToString(buff), expectedText);
        }),
        newTest("insertion one by one at the start", (buff: Buffer) => {
            buffInsertAt(buff, 0, "c");
            buffInsertAt(buff, 0, "b");
            buffInsertAt(buff, 0, "a");

            expectEqual(buffToString(buff), expectedText);
        }),
        newTest("insertion one by one zig zag 1", (buff: Buffer) => {
            buffInsertAt(buff, 0, "b");
            buffInsertAt(buff, 0, "a");
            buffInsertAt(buff, 2, "c");

            expectEqual(buffToString(buff), expectedText);
        }),
        newTest("insertion one by one zig zag 2", (buff: Buffer) => {
            buffInsertAt(buff, 0, "b");
            buffInsertAt(buff, 1, "c");
            buffInsertAt(buff, 0, "a");

            expectEqual(buffToString(buff), expectedText);
        }),
    ];
}

function generateInsertAndRemoveTests() {
    const expectedText = "abc";
    const insertionTests = generateInsertionTests();

    // There are also quite a lot of ways to remove text, each resulting in a different
    // internal representation.
    const postInsertRemovalTests: Test<Buffer>[] = [];

    const n = expectedText.length;
    forEachRange(n, n, (pos, windowSize) => {
        const testName = `remove ${windowSize} at ${pos}`;
        const expectedRemoval = expectedText.substring(pos, pos + windowSize);
        postInsertRemovalTests.push(newTest(testName, (buff) => {
            const removed = buffRemoveAt(buff, pos, windowSize);
            expectEqual(expectedRemoval, removed);
            expectEqual(buffToString(buff), expectedText.substring(0, pos) + expectedText.substring(pos + windowSize));
        }));
    });

    return [
        // insertion tests
        ...insertionTests,
        // removal tests
        ...powerSetTests(insertionTests, postInsertRemovalTests),
    ];
}

function generateCursorMovingTests(): Test<Buffer>[] {
    const tests: Test<Buffer>[] = [];

    const expectedText = "abc";
    for (let pos = 0; pos < 3;  pos++) {
        const char = expectedText[pos];

        tests.push(
            newTest(`Cursors stay on their character when inserting before | pos ${pos}`, (buff: Buffer) => {
                const it0 = itNewTemp(buff);
                const it1 = itNewPermanent(buff);
                for (let i = 0; i < pos; i++) {
                    iterate(it0);
                    iterate(it1);
                }

                expectEqual(itGet(it0), char);
                expectEqual(itGet(it1), char);

                buffInsertAt(buff, pos, "#");

                expectEqual(itGet(it0), char);
                expectEqual(itGet(it1), char);
            })
        );

        tests.push(
            newTest(`Cursors stay on their character when inserting on | pos ${pos}`, (buff: Buffer) => {
                const it0 = itNewTemp(buff);
                const it1 = itNewPermanent(buff);
                for (let i = 0; i < pos; i++) {
                    iterate(it0);
                    iterate(it1);
                }

                expectEqual(itGet(it0), char);
                expectEqual(itGet(it1), char);

                buffInsertAt(buff, pos, "#");

                expectEqual(itGet(it0), char);
                expectEqual(itGet(it1), char);
            })
        );

        tests.push(
            newTest(`Cursors stay on their character when inserting after | pos ${pos}`, (buff: Buffer) => {
                const it0 = itNewTemp(buff);
                const it1 = itNewPermanent(buff);
                for (let i = 0; i < pos; i++) {
                    iterate(it0);
                    iterate(it1);
                }

                expectEqual(itGet(it0), char);
                expectEqual(itGet(it1), char);

                buffInsertAt(buff, pos, "#");

                expectEqual(itGet(it0), char);
                expectEqual(itGet(it1), char);
            })
        );
    }

    return tests;
}


testSuite("Text edit buffer", () => {
    const buff = newBuff();
    beginEditing(buff);
    return buff;
}, [
    newTest(`Bisect test`, (buff: Buffer) => {
        // NOTE: This tests the internals of the thing. don't have too many such tests
        const it0 = itNewTemp(buff);
        iterate(it0);
        itBisect(it0);
        expectEqual(it0.textIdx, 0);
        expectEqual(it0.pieceIdx, 1);
    }),
    ...generateInsertAndRemoveTests(),
    ...powerSetTests(generateInsertionTests(), generateCursorMovingTests()),
    ...powerSetTests(generateInsertionTests(), [
        newTest(`Multi-insert`, (buff: Buffer) => {
            const it0 = itNewTemp(buff);
            const it1 = itNewTemp(buff);
            iterate(it1);

            itInsert(it0, "//");
            itInsert(it1, "//");

            const result = buffToString(buff);
            expectEqual(result, "//a//bc");
        }),
        newTest(`Multi-insert at the end`, (buff: Buffer) => {
            const it0 = itNewTemp(buff);
            iterate(it0);
            const it1 = itNewTemp(buff);
            iterate(it1);
            iterate(it1);

            itInsert(it0, "//");
            itInsert(it1, "//");

            const result = buffToString(buff);
            expectEqual(result, "a//b//c");
        }),
        newTest(`Multi-remove`, (buff: Buffer) => {
            const it0 = itNewTemp(buff);
            const it0End = itNewTempFrom(it0);
            iterate(it0End);

            const it1 = itNewTemp(buff);
            iterate(it1);
            const it1End = itNewTempFrom(it1);
            iterate(it1End);

            itRemove(it0, it0End);
            itRemove(it1, it1End);

            const result = buffToString(buff);
            expectEqual(result, "c");
        }),
        newTest(`Multi-remove at end`, (buff: Buffer) => {
            const it0 = itNewTemp(buff);
            iterate(it0);
            const it0End = itNewTempFrom(it0);
            iterate(it0End);

            const it1 = itNewTemp(buff);
            iterate(it1);
            iterate(it1);
            const it1End = itNewTempFrom(it1);
            iterate(it1End);

            itRemove(it0, it0End);
            itRemove(it1, it1End);

            const result = buffToString(buff);
            expectEqual(result, "a");
        }),
    ]),
]);
