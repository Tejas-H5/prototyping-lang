import { assert } from "./assert";

export type TestSuite<T> = {
    name: string;
    ctxFn: () => T;
    tests: Test<T>[];
};

export type Test<T> = {
    code: (ctx: T) => void | Promise<void>;
    name: string;
    status: TestStatus;
    error: any;
    suite?: TestSuite<T>;
};

export const TEST_STATUS_NOT_RAN = 0;
export const TEST_STATUS_RUNNING = 1;
export const TEST_STATUS_RAN = 2;

export type TestStatus = 
    typeof TEST_STATUS_NOT_RAN |
    typeof TEST_STATUS_RUNNING |
    typeof TEST_STATUS_RAN;

let testsLocked = false;
const currentTestSuites: TestSuite<unknown>[] = [];

export function testSuite<T>(name: string, ctxFn: () => T, tests: Test<T>[]) {
    if (testsLocked) {
        throw new Error("cant add more tests at this point");
    }

    const suite: TestSuite<T> = {
        name,
        ctxFn,
        tests
    };

    for (const test of tests) {
        assert(!test.suite);
        test.suite = suite;
    }

    currentTestSuites.push(suite as TestSuite<unknown>);
}

export function newTest<T>(name: string, code: (ctx: T) => void): Test<T> {
    return {
        name,
        code,
        status: TEST_STATUS_NOT_RAN,
        error: null
    };
}

export function getTestSuites() {
    testsLocked = true;

    return currentTestSuites;
}

export function runTest<T>(test: Test<T>, debug = false) {
    assert(!!test.suite);

    if (test.status === TEST_STATUS_RUNNING) {
        // TODO: terminate this test, and rerun it. I don't know how to terminate a test that has a while (true) {} in it though.
        console.warn("This test is already running");
        return;
    }

    let isPromise = false;
    test.status = TEST_STATUS_RUNNING;
    test.error = null;

    try {
        const ctx = test.suite.ctxFn();

        if (debug) {
            debugger;
        }

        // Step into this function call to debug your test
        const res = test.code(ctx);

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

export function powerSetTests<T>(firstTests: Test<T>[], secondTests: Test<T>[]): Test<T>[] {
    const powerSet: Test<T>[] = [];

    for (const tj of secondTests) {
        for (const ti of firstTests) {
            powerSet.push(newTest(`(${ti.name}) x (${tj.name})`, (ctx) => {
                ti.code(ctx);
                tj.code(ctx);
            }));
        }
    }

    return powerSet;
}

export function forEachRange(n: number, len: number, fn: (pos: number, len: number) => void) {
    assert(len <= n);
    for (let l = 1; l <= len; l++) {
        for (let i = 0; i < n - l + 1; i++) {
            fn(i, l);
        }
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
