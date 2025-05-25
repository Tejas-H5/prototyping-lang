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
    imEnd,
    imEndIf,
    imEndList,
    imIf,
    imInit,
    imBeginList,
    imMemo,
    imStringRef,
    imState,
    nextListRoot,
    setStyle,
    imTry,
    imRef,
    imElse,
    imCatch,
    imEndTry
} from "./utils/im-dom-utils";
import {
    getTestSuites,
    runTest,
    Test,
    TEST_STATUS_NOT_RAN,
    TEST_STATUS_RAN,
    TEST_STATUS_RUNNING,
    TestSuite,
    validateTestSuites
} from "./utils/testing";

// User tests

import "src/utils/text-edit-buffer.test";

function newTestHarnessState(): {
    suites: TestSuite[];
    tests: Test[];
    runAllStaggered: {
        running: boolean;
        idx: number;
    }
} {
    return {
        suites: [],
        tests: [],
        runAllStaggered: {
            running: false,
            idx: 0,
        }
    };
}

export function imTestHarness() {
    const s = imState(newTestHarnessState);

    const errorRef = imRef<any>();

    const l = imTry();
    try {
        if (imInit()) {
            s.suites = getTestSuites();
            s.tests = s.suites.flatMap(s => s.tests);
            for (const suite of s.suites) {
                for (const test of suite.tests) {
                    if (test.status === TEST_STATUS_NOT_RAN) {
                        runTest(test);
                    }
                }
            }
        }

        if (imIf() && !errorRef.val) {
            if (s.runAllStaggered.running) {
                if (s.runAllStaggered.idx >= s.tests.length) {
                    s.runAllStaggered.running = false;
                } else {
                    // Running tests one by one makes it easier to spot which test is causing an infinite loop.
                    const test = s.tests[s.runAllStaggered.idx];
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
                            for (const test of s.tests) {
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
                            for (const test of s.tests) {
                                runTest(test);
                            }
                        }
                    } imEnd();

                    imBeginButton(); {
                        imTextSpan("Validate test suites");

                        if (elementHasMousePress()) {
                            validateTestSuites(s.suites);
                        }
                    } imEnd();
                } imEnd();

                imBeginScrollContainer(COL); {
                    imBeginList();
                    for (const suite of s.suites) {
                        const tests = suite.tests;
                        nextListRoot();

                        imBeginLayout(H3); {
                            const sRef = imStringRef();
                            if (imMemo(suite.functionsBeingTested)) {
                                sRef.text = suite.functionsBeingTested.map(f => f.name).join(", ");
                            }

                            imTextSpan(sRef.text);
                        } imEnd();

                        imBeginLayout(COL); {
                            imBeginList();
                            for (let i = 0; i < tests.length; i++) {
                                const test = tests[i];

                                nextListRoot();
                                imBeginLayout(ROW | GAP | ALIGN_CENTER); {
                                    imBeginLayout(H100 | PADDED); {
                                        let bg = "";
                                        let text = "";
                                        let textCol = "";

                                        if (s.runAllStaggered.running && i > s.runAllStaggered.idx) {
                                            text = "Queued";
                                        } else if (s.runAllStaggered.running && s.runAllStaggered.idx === i) {
                                            text = "Runnin";
                                        } else if (test.status !== TEST_STATUS_RAN) {
                                            text = test.status === TEST_STATUS_NOT_RAN ? "Not ran" :
                                                test.status === TEST_STATUS_RUNNING ? "Running" :
                                                    "";
                                        } else if (test.error === null) {
                                            bg = "#00FF00"
                                            text = "PASSED";
                                        } else {
                                            bg = "#FF0000"
                                            textCol = "#FFFFFF"
                                            text = "FAILED";
                                        }

                                        if (imMemo(bg)) {
                                            setStyle("backgroundColor", bg);
                                        }

                                        if (imMemo(textCol)) {
                                            setStyle("color", textCol);
                                        }

                                        imTextSpan(text);
                                    } imEnd();

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
                    }
                    imEndList();
                } imEnd();

            } imEnd();
        } else {
            imElse();

            imBeginLayout(CODE); {
                imTextSpan(errorRef.val);
            } imEnd();

            imBeginButton(); {
                imTextSpan("Ok");

                if (elementHasMousePress()) {
                    errorRef.val = null;
                }
            } imEnd();
        } imEndIf();
    } catch (e) {
        imCatch(l);

        console.error("An error occured while rendering: ", e);
        errorRef.val = e;
    } imEndTry();
}
