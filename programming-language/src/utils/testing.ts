type Test = {
    code: () => void | Promise<void>;
    name: string;
    status: TestStatus;
    error: any;
}

export const TEST_STATUS_NOT_RAN = 0;
export const TEST_STATUS_RUNNING = 1;
export const TEST_STATUS_RAN = 2;

export type TestStatus = 
    typeof TEST_STATUS_NOT_RAN |
    typeof TEST_STATUS_RUNNING |
    typeof TEST_STATUS_RAN;

let testsLocked = false;
const tests: Test[] = [];

/**
 * Pushes a test to the list of tests.
 *
 * ```ts
 * test("sum", () => expect(1 + 1 === 2,  "1 + 1 === 2"))
 * ```
 *
 * You can start the name of a test with 'debug' to run the `debugger` statement for this test automatically.
 * This is useful for when you're working on a test that you know will have an infinite loop, and you aren't able
 * to manually place the breakpoint yourself for whatever reason, i.e that code isn't in the dev tools sources or
 * there is a bug in the dev-tools where breakpoints are only hit the second time they are placed, etc.
 *
 * ```ts
 * test("debug sum", () => expect(1 + 1 === 2,  "1 + 1 === 2"))
 * ```
 *
 */
export function test(name: string, code: () => void) {
    if (testsLocked) return;

    tests.push({
        name,
        code,
        status: TEST_STATUS_NOT_RAN,
        error: null,
    });
}

export function getTests() {
    testsLocked = true;
    return tests;
}

export function runTest(test: Test, debug = false) {
    if (test.status === TEST_STATUS_RUNNING) {
        // TODO: terminate this test, and rerun it. I don't know how to terminate a test that has a while (true) {} in it though.
        console.warn("This test is already running");
        return;
    }

    let isPromise = false;
    test.status = TEST_STATUS_RUNNING;
    test.error = null;

    try {
        if (debug) {
            debugger;
        }

        // Step into this function call to debug your test
        const res = test.code();

        if (res instanceof Promise) {
            isPromise = true;
            res.catch(e => test.error = e)
               .finally(() => test.status = TEST_STATUS_RAN);
        }
    } catch (e) {
        if (!isPromise) {
            test.error = e;
        } else {
            throw e;
        }
    } finally {
        if (!isPromise) {
            test.status = TEST_STATUS_RAN;
        }
    }
}

// If you know how to use the debugger, you just don't need an error message.
export function expectation(condition: boolean, i: number): asserts  condition {
    if (!condition) {
        throw new Error(`Expectation ${i} not met!`);
    }
}

export function expectEqual<T>(a: T, b: T, message?: string) {
    if (!deepEquals(a, b)) {
        console.error("Results weren't deep equal: ", a, b, message);
        let errorMessage = "Results weren't deep equal - \ngot:    " + JSON.stringify(a) + " \nwanted: " + JSON.stringify(b);
        if (message) {
            errorMessage += " - " + message;
        }
        throw new Error(errorMessage);
    }
}

type DeepEqualsResult = {
    result: boolean;
    error?: string;
};

export function deepEquals<T>(
    a: T,
    b: T,
    nSquaredMapAndSetCompare = false
): boolean {
    if (a === b) return true;

    // Strict-equals would have worked if these were the case.
    if (typeof a !== "object" || typeof b !== "object") return false;
    if (a === null || b === null) return false;

    if (Array.isArray(a)) {
        if (!Array.isArray(b)) return false
        for (let i = 0; i < a.length; i++) {
            if (!deepEquals(a[i], b[i])) return false;
        }
        return true;
    }

    if (a instanceof Set) {
        if (!(b instanceof Set)) return false;
        if (a.size !== b.size) return false;
        if ([...a].every(b.has)) return true;
        
        if (nSquaredMapAndSetCompare) {
            return deepCompareArraysAnyOrder([...a], [...b]);
        }

        return false;
    }

    if (a instanceof Map) {
        if (!(b instanceof Map)) return false;
        if (a.size !==  b.size) return false;
        
        let allMatched = true;
        for (const [k, aVal] of a) {
            if (b.has(k)) {
                const bVal = b.get(k);
                if (!deepEquals(aVal, bVal)) {
                    allMatched = false;
                    break;
                }
            }
        }

        if (allMatched) return true;

        if (nSquaredMapAndSetCompare) {
            return deepCompareArraysAnyOrder([...a], [...b]);
        }

        return false;
    }

    // a is just an object
    for (const k in a) {
        if (!(k in b)) return false;
        if (!deepEquals(a[k], b[k])) return false;
    }
    return true;
}

function deepCompareArraysAnyOrder<T>(a: T[], b: T[]) {
    for (let i = 0; i < b.length; i++) {
        let anyEqual = false;
        for (let j = 0; j < b.length; j++) {
            if (deepEquals(a[i], b[j])) {
                anyEqual = true;
                break;
            }
        }
        if (!anyEqual) return false;
    }
    return true;
}

export function expectNotNull<T>(val: T | null | undefined, message?: string): asserts val is T {
    if (!val) {
        let errorMessage = "Result was unexpectedly " + val;
        if (message) errorMessage += " - " + message;
        throw new Error(errorMessage);
    }
}
