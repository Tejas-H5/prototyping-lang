import { imButton, imButtonIsClicked } from "./app-components/im-button";
import { imCode } from "./app-styling";
import { BLOCK, COL, imAlign, imBg, imFixed, imGap, imLayout, imLayoutEnd, imPadding, imPre, imRelative, imSize, NA, PERCENT, PX, ROW } from "./components/core/layout";
import { imScrollContainerBegin, imScrollContainerEnd, newScrollContainer } from "./components/scroll-container";
import { cssVars } from "./styling";
import { ImCache, imFor, imForEnd, imIf, imIfElse, imIfEnd, imMemo, imState, imTry, imTryCatch, imTryEnd, isFirstishRender } from "./utils/im-core";
import { EL_H3, elHasMousePress, elSetStyle, imEl, imElEnd, imStr } from "./utils/im-dom";
import {
    getTestSuites,
    runTest,
    Test,
    TEST_STATUS_NOT_RAN,
    TEST_STATUS_RAN,
    TEST_STATUS_RUNNING,
    TestSuite,
} from "./utils/testing";

// User tests

import "src/utils/text-edit-buffer.test";

function newTestHarnessState(): {
    suites: TestSuite<any>[];
    tests: Test<any>[];
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

export function imTestHarness(c: ImCache) {
    const s = imState(c, newTestHarnessState);

    const tryState = imTry(c); try {
        if (isFirstishRender(c)) {
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

        if (imIf(c) && tryState.err) {
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

            imLayout(c, BLOCK); imRelative(c); imBg(c, cssVars.bg); 
            imFixed(c, 0, PX, 0, PX, 0, PX, 0, PX); {
                imLayout(c, ROW); imGap(c, 5, PX); {
                    imEl(c, EL_H3); imStr(c, "Tests"); imElEnd(c, EL_H3);

                    if (imButtonIsClicked(c, "Run failed")) {
                        for (const test of s.tests) {
                            if (test.error !== null) runTest(test);
                        }
                    }

                    if (imButtonIsClicked(c, "Run all staggered")) {
                        s.runAllStaggered.running = true;
                        s.runAllStaggered.idx = 0;
                    }

                    if (imButtonIsClicked(c, "Run all")) {
                        for (const test of s.tests) {
                            runTest(test);
                        }
                    }
                } imLayoutEnd(c);


                const sc = imState(c, newScrollContainer);
                imScrollContainerBegin(c, sc); {
                    imFor(c); for (const suite of s.suites) {
                        const tests = suite.tests;

                        imEl(c, EL_H3); imStr(c, suite.name); imElEnd(c, EL_H3); 

                        imLayout(c, COL); {
                            imFor(c); for (let i = 0; i < tests.length; i++) {
                                const test = tests[i];

                                imLayout(c, ROW);  imGap(c, 5, PX); imAlign(c); {
                                    imLayout(c, BLOCK); imSize(c, 0, NA, 100, PERCENT); imPadding(c, 10, PX, 10, PX, 10, PX, 10, PX); {
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

                                        if (imMemo(c, bg)) {
                                            elSetStyle(c, "backgroundColor", bg);
                                        }

                                        if (imMemo(c,textCol)) {
                                            elSetStyle(c, "color", textCol);
                                        }

                                        imStr(c, text);
                                    } imLayoutEnd(c);

                                    imLayout(c, BLOCK); imButton(c); {
                                        imStr(c, "Debug");

                                        if (elHasMousePress(c)) {
                                            runTest(test, true);
                                        }
                                    } imLayoutEnd(c);

                                    imLayout(c, BLOCK); imButton(c); {
                                        imStr(c, "Rerun");

                                        if (elHasMousePress(c)) {
                                            runTest(test);
                                        }
                                    } imLayoutEnd(c);

                                    imStr(c, test.name);

                                    if (imIf(c) && test.error) {
                                        imLayout(c, BLOCK); imCode(c); imPre(c); {
                                            imStr(c, test.error);
                                        } imLayoutEnd(c);
                                    } imIfEnd(c);
                                } imLayoutEnd(c);
                            } imForEnd(c);
                        } imLayoutEnd(c);
                    } imForEnd(c);
                } imScrollContainerEnd(c);
            } imLayoutEnd(c);
        } else {
            imIfElse(c);

            imLayout(c, BLOCK); imCode(c); {
                imStr(c, tryState.err);
            } imLayoutEnd(c);

            imLayout(c, BLOCK); imButton(c); {
                imStr(c, "Ok");

                if (elHasMousePress(c)) {
                    tryState.recover();
                }
            } imLayoutEnd(c);
        } imIfEnd(c);
    } catch (e) {
        imTryCatch(c, tryState, e);
        console.error("An error occured while rendering: ", e);
    } imTryEnd(c, tryState);
}
