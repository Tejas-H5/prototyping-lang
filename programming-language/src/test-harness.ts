import {
    ALIGN_CENTER,
    CODE,
    COL,
    FIXED,
    GAP,
    H100,
    H3,
    imBeginButton,
    imBeginLayout,
    imBeginScrollContainer,
    imTextSpan,
    OPAQUE,
    PADDED,
    PRE,
    RELATIVE,
    ROW,
    W100
} from "./layout";
import {
    elementHasMousePress,
    imElse,
    imElseIf,
    imEnd,
    imEndIf,
    imEndList,
    imIf,
    imInit,
    imList,
    imState,
    nextListRoot,
    setStyle
} from "./utils/im-dom-utils";
import {
    getTests,
    runTest,
    TEST_STATUS_NOT_RAN,
    TEST_STATUS_RAN,
    TEST_STATUS_RUNNING
} from "./utils/testing";

// User tests

import "src/utils/text-edit-buffer.test";

function newTestHarnessState() {
    return {
        runAllStaggered: {
            running: false,
            idx: 0,
        }
    };
}

export function imTestHarness() {
    const s = imState(newTestHarnessState);

    if (imInit()) {
        const tests = getTests();
        for (const test of tests) {
            if (test.status === TEST_STATUS_NOT_RAN) {
                runTest(test);
            }
        }
    }

    if (s.runAllStaggered.running) {
        const tests = getTests();
        if (s.runAllStaggered.idx >= tests.length) {
            s.runAllStaggered.running = false;
        } else {
            // Running tests one by one makes it easier to spot which test is causing an infinite loop.
            const test = tests[s.runAllStaggered.idx];
            s.runAllStaggered.idx++;
            runTest(test);
        }
    }

    imBeginLayout(FIXED | RELATIVE | OPAQUE | W100 | H100); {
        imBeginLayout(ROW | GAP); {
            imBeginLayout(H3); {
                imTextSpan("Tests");
            } imEnd();

            imBeginButton(); {
                imTextSpan("Run failed");

                if (elementHasMousePress()) {
                    const tests = getTests();
                    for (const test of tests) {
                        if (test.error !== null) runTest(test);
                    }
                }
            } imEnd();

            imBeginButton(); {
                imTextSpan("Run all staggered");

                if (elementHasMousePress()) {
                    s.runAllStaggered.running = true;
                    s.runAllStaggered.idx = 0;
                }
            } imEnd();

            imBeginButton(); {
                imTextSpan("Run all");

                if (elementHasMousePress()) {
                    const tests = getTests();
                    for (const test of tests) {
                        runTest(test);
                    }
                }
            } imEnd();
        } imEnd();
        imBeginScrollContainer(COL); {
            imList();
            const tests = getTests();
            for (let i = 0; i < tests.length; i++) {
                const test = tests[i];

                nextListRoot();
                imBeginLayout(ROW | GAP | ALIGN_CENTER); {
                    if (imIf() && s.runAllStaggered.running && i > s.runAllStaggered.idx) {
                        imTextSpan("Queued");
                    } else if (imElseIf() && s.runAllStaggered.running && s.runAllStaggered.idx === i) {
                        imTextSpan("Running");
                    } else if (imElseIf() && test.status !== TEST_STATUS_RAN) {
                        imTextSpan(
                            test.status === TEST_STATUS_NOT_RAN ? "Not ran" : 
                            test.status === TEST_STATUS_RUNNING ? "Running" :
                            ""
                        );
                    } else if (imElseIf() && test.error === null) {
                        imBeginLayout(); {
                            if (imInit()) {
                                setStyle("backgroundColor", "#00FF00");
                            }

                            imBeginLayout(H100 | PADDED); {
                                imTextSpan("PASSED");
                            } imEnd();
                        } imEnd();
                    } else {
                        imElse();

                        imBeginLayout(); {
                            if (imInit()) {
                                setStyle("backgroundColor", "#FF0000");
                                setStyle("color", "#FFFFFF");
                            }

                            imTextSpan("FAILED");
                        } imEnd();
                    } imEndIf();

                    imBeginButton(); {
                        imTextSpan("Debug");

                        if (elementHasMousePress()) {
                            runTest(test, true);
                        }
                    } imEnd();

                    imBeginButton(); {
                        imTextSpan("Rerun");

                        if (elementHasMousePress()) {
                            runTest(test);
                        }
                    } imEnd();

                    imTextSpan(test.name);

                    if (imIf() && test.error) {
                        imBeginLayout(CODE | PRE); {
                            imTextSpan(test.error);
                        } imEnd();
                    } imEndIf();
                } imEnd();
            }
            imEndList();
        } imEnd();
    } imEnd();
}
