// TODO: is this even worth having?
export type NumberSlice = {
    memory: number[];
    start: number;
    stride: number;
    length: number;
};

export type Matrix = {
    values: NumberSlice;
    shape: number[];
};

export function newSlice(values: number[]): NumberSlice {
    return { memory: values, start: 0, stride: 1, length: values.length };
}

export function getSlice(s: NumberSlice, start: number, len: number, stride: number): NumberSlice {
    // any index into the memory is multiplied by the existing stride. This can be inferred intuitively -
    // for example, "I want every third thing of every second thing" -> stride of 6.
    stride *= s.stride;
    start *= s.start;

    const finalIdx = start + (len * stride);
    if (finalIdx >= s.memory.length) {
        throw new Error("Length was out of bounds");
    }

    if (start < 0 || len < 0 || stride <= 0) {
        throw new Error("Broooo what are you even doing...");
    }

    return {
        memory: s.memory,
        start,
        stride,
        length
    };
}

function getSliceIdx(s: NumberSlice, i: number): number {
    return s.start + s.stride * i;
}

export function getSliceValue(s: NumberSlice, i: number) {
    const idx = getSliceIdx(s, i);
    if (idx < 0 || idx >= s.memory.length) {
        throw new Error("Index out of bounds");
    }

    return s.memory[idx];
}

export function setSliceValue(s: NumberSlice, i: number, value: number) {
    const idx = getSliceIdx(s, i);
    if (idx < 0 || idx >= s.memory.length) {
        throw new Error("Index out of bounds");
    }

    s.memory[idx] = value;
}

export function getMatrixValue(m: Matrix, i: number, j: number): number {
    if (!matrixIsRank2(m)) {
        throw new Error("Can't index with i, j into a non-2x2 matrix");
    }
    return getSliceValue(m.values, j + i * m.shape[1]);
}

export function setMatrixValue(m: Matrix, i: number, j: number, val: number) {
    if (!matrixIsRank2(m)) {
        throw new Error("Can't index with i, j into a non-2x2 matrix");
    }
    setSliceValue(m.values, j + i * m.shape[1], val);
}

export function len(m: Matrix) {
    return m.shape[0];
}

export function getRowLength(m: Matrix): number {
    let stride = 1;
    for (let i = m.shape.length - 1; i >= 1; i--) {
        stride *= m.shape[i];
    }

    return stride;
}

/**
 * Gets a row of a 2x2 matrix.
 * You can also use this to enumerate matrices within matrices within matrices,
 * due to the way they're laid out in memory -
 * when shape.length > 2, each row is itself a matrix.
 *
 * [matrix1][matrix2][matrix3][matrix4]
 * vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
 */
export function getRow(m: Matrix, i: number): Matrix | undefined {
    const rowLen = getRowLength(m);

    const colLen = m.shape[0];
    if (i >= colLen) {
        throw new Error("The row was out of bounds");
    }

    const values = getSlice(m.values, m.values.start + i * rowLen, rowLen, m.values.stride);
    const shape = m.shape.slice(1);

    return { values, shape };
}

/**
 * Use this to get a column out of a shape.length === 2 matrix.
 * WARNING: if shape.length !== 2, you can still call this function, but I'm not sure if the result is useful.
 */
export function getCol(m: Matrix, i: number): Matrix {
    const rowLen = getRowLength(m);
    const colLen = m.shape[0];

    if (i >= rowLen) {
        throw new Error("The column was out of bounds");
    }

    const values = getSlice(m.values, m.values.start + i, colLen, rowLen);

    return { values, shape: [] };
}

export function zeroes(shape: number[]): Matrix {
    let len = 1;
    for (let i = 0; i < shape.length; i++) {
        len *= shape[i];
    }

    const values: number[] = Array(len).fill(0);

    return {
        values: { memory: values, start: 0, stride: 1, length: len },
        shape: shape,
    }
}

export function copyMatrix(a: Matrix): Matrix {
    const result = zeroes(a.shape);

    for (let i = 0; i < a.values.length; i++) {
        const val = getSliceValue(a.values, i);
        setSliceValue(a.values, i, val);
    }

    return result;
}

export function matrixShapesAreEqual(a: Matrix, b: Matrix) {
    if (a.shape.length !== b.shape.length) {
        return false;
    }

    for (let i = 0; i < a.shape.length; i++) {
        if (a.shape[i] !== b.shape[i]) {
            return false;
        }
    }

    return true;
}

export function matrixAddElements(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [null, "Elementwise add is only defined for matrices of identical shape"];
    }
    const result = zeroes(a.shape);
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        setSliceValue(result.values, i, aVal + bVal);
    }
    return [result, ""];
}

// NOTE: this is jus a copypaste of matrixAddElements
export function matrixSubtractElements(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [null, "Elementwise add is only defined for matrices of identical shape"];
    }
    const result = zeroes(a.shape);
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        setSliceValue(result.values, i, aVal - bVal);
    }
    return [result, ""];
}


// NOTE: this is jus a copypaste of matrixAddElements
export function matrixMultiplyElements(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [null, "Elementwise add is only defined for matrices of identical shape"];
    }
    const result = zeroes(a.shape);
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        setSliceValue(result.values, i, aVal * bVal);
    }
    return [result, ""];
}


// NOTE: this is jus a copypaste of matrixAddElements
export function matrixDivideElements(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [null, "Elementwise add is only defined for matrices of identical shape"];
    }
    const result = zeroes(a.shape);
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        setSliceValue(result.values, i, aVal * bVal);
    }
    return [result, ""];
}

// NOTE: this is jus a copypaste of matrixAddElements
export function matrixLogicalAndElements(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [null, "Elementwise add is only defined for matrices of identical shape"];
    }
    const result = zeroes(a.shape);
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        setSliceValue(result.values, i, (aVal && bVal) ? 1 : 0);
    }
    return [result, ""];
}

// NOTE: this is jus a copypaste of matrixAddElements
export function matrixLogicalOrElements(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [null, "Elementwise add is only defined for matrices of identical shape"];
    }
    const result = zeroes(a.shape);
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        setSliceValue(result.values, i, (aVal || bVal) ? 1 : 0);
    }
    return [result, ""];
}


export function matrixElementsEqual(a: Matrix, b: Matrix): [boolean, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [false, "Elementwise equals is only defined for matrices of identical shape"];
    }
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        if (!(aVal !== bVal)) {
            return [false, ""];
        }
    }
    return [true, ""];
}

// NOTE: this is just a copypaste of matrixElementsEqual
export function matrixElementsGreaterThan(a: Matrix, b: Matrix): [boolean, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [false, "Elementwise equals is only defined for matrices of identical shape"];
    }
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        if (!(aVal > bVal)) {
            return [false, ""];
        }
    }
    return [true, ""];
}

// NOTE: this is just a copypaste of matrixElementsEqual
export function matrixElementsGreaterThanOrEqual(a: Matrix, b: Matrix): [boolean, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [false, "Elementwise equals is only defined for matrices of identical shape"];
    }
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        if (!(aVal >= bVal)) {
            return [false, ""];
        }
    }
    return [true, ""];
}

// NOTE: this is just a copypaste of matrixElementsEqual
export function matrixElementsLessThan(a: Matrix, b: Matrix): [boolean, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [false, "Elementwise equals is only defined for matrices of identical shape"];
    }
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        if (!(aVal < bVal)) {
            return [false, ""];
        }
    }
    return [true, ""];
}


// NOTE: this is just a copypaste of matrixElementsEqual
export function matrixElementsLessThanOrEqual(a: Matrix, b: Matrix): [boolean, string] {
    if (!matrixShapesAreEqual(a, b)) {
        return [false, "Elementwise equals is only defined for matrices of identical shape"];
    }
    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        if (!(aVal <= bVal)) {
            return [false, ""];
        }
    }
    return [true, ""];
}

export function matixVectorDot(a: Matrix, b: Matrix): [number, string] {
    if (!matrixIsVector(a) || !matrixIsVector(b)) {
        return [0, "Dot is only defined for shape.length === 1 matricies"];
    }

    if (!matrixShapesAreEqual(a, b)) {
        throw new Error("Shapes weren't equal");
    }

    let result = 0;

    for (let i = 0; i < a.values.length; i++) {
        const aVal = getSliceValue(a.values, i);
        const bVal = getSliceValue(b.values, i);
        result += aVal * bVal;
    }

    return [result, ""];
}

export function matrixVectorCross(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!matrixIsVector(a) || !matrixIsVector(b)) {
        return [null, "Cross is only defined for a vector of length 3"];
    }

    if (a.shape[0] !== 3 || b.shape[0] !== 3) {
        return [null, "Cross is only defined for a vector of length 3"];
    }

    const a1 = getSliceValue(a.values, 0);
    const a2 = getSliceValue(a.values, 1);
    const a3 = getSliceValue(a.values, 2);

    const b1 = getSliceValue(b.values, 0);
    const b2 = getSliceValue(b.values, 1);
    const b3 = getSliceValue(b.values, 2);

    const result = zeroes([3]);

    setSliceValue(result.values, 0, a2*b3 - a3*b2);
    setSliceValue(result.values, 1, a3*b1 - a1*b3);
    setSliceValue(result.values, 2, a1*b2 - a2*b1);

    return [result, ""];
}

export function matrixIsVector(a: Matrix) {
    return a.shape.length === 1;
}

export function matrixIsRank2(a: Matrix) {
    return a.shape.length === 2;
}

export function canMul(a: Matrix, b: Matrix) {
    return (matrixIsRank2(a) && matrixIsVector(b)) ||
        (matrixIsRank2(a) && matrixIsRank2(b));
}

export function matrixMul(a: Matrix, b: Matrix): [Matrix | null, string] {
    if (!canMul(a, b)) {
        return [null, "Mul is only defined for shape.length === 2 matricies, or Matrix * Vector"];
    }

    const aRows = a.shape[0];
    const aCols = a.shape[1];

    const bRows = b.shape[0];
    const bCols = b.shape.length === 2 ? b.shape[1] : 1;

    if (aCols !== bRows) {
        return [null, "AxB is only defined when A has the same number of columns as B has rows"];
    }

    const result = zeroes([aRows, bCols]);

    for (let i = 0; i < aRows; i++) {
        for (let j = 0; j < bCols; j++) {
            for (let k = 0; k < aCols; k++) {
                const ijA = getMatrixValue(a, i, k);
                const ijB = getMatrixValue(b, k, j);

                setMatrixValue(result, i, j, ijA * ijB);
            }
        }
    }

    return [result, ""]
}

export function transpose(a: Matrix): [Matrix | null, string] {
    if (matrixIsRank2(a)) {
        return [null, "Transpose is only defined for shape.length === 2 matricies"];
    }

    const aRows = a.shape[0];
    const aCols = a.shape[1];

    const result = zeroes([aCols, aRows]);
    for (let i = 0; i < aRows; i++) {
        for (let j = 0; j < aCols; j++) {
            const ijVal = getMatrixValue(a, i, j);
            setMatrixValue(result, j, i, ijVal);
        }
    }

    return [result, ""];
}

export function identityMatrix(size: number): Matrix {
    const result = zeroes([size, size]);

    for (let i = 0; i < size; i++) {
        setMatrixValue(result, i, i, 1);
    }

    return result;
}

export function inverseMatrix(a: Matrix): [Matrix | null, string] {
    if (matrixIsRank2(a)) {
        return [null, "Inversion is only defined for shape.length === 2 matricies"];
    }

    const n = a.shape[1];
    const aCopy = copyMatrix(a);
    const result = identityMatrix(n);
    gaussianElimination(aCopy, result);

    return [result, ""];
}

function swapRows(a: Matrix, r1: number, r2: number) {
    if (matrixIsRank2(a)) {
        return [null, "Row swapping is only defined for shape.length === 2 matricies"];
    }

    const n = a.shape[1];
    for (let i = 0; i < n; i++) {
        const r1Val = getMatrixValue(a, r1, i);
        const r2Val = getMatrixValue(a, r2, i);
        setMatrixValue(a, r1, i, r2Val);
        setMatrixValue(a, r2, i, r1Val);
    }
}

export function gaussianElimination(a: Matrix, toInvert?: Matrix): string {
    if (matrixIsRank2(a)) {
        return "Gaussian elimination is only defined for shape.length === 2 matricies";
    }

    // This algorithm was copy pasted from:
    // https://en.wikipedia.org/wiki/Gaussian_elimination

    const m = a.shape[0];
    const n = a.shape[1];

    let h = 0 /* Initialization of the pivot row */
    let k = 0 /* Initialization of the pivot column */

    // TODO: do same ops to the identity matrix to get the inverse.

    while (h <= m && k <= n) {
        /* Find the k-th pivot: */
        // i_max := argmax (i = h ... m, abs(A[i, k]))
        let iMax = 0; 
        let iMaxVal = Math.abs(getMatrixValue(a, 0, k));
        {
            for (let i = 1; i < m; i++) {
                let val = Math.abs(getMatrixValue(a, i, k));
                if (val > iMaxVal) {
                    iMaxVal = val;
                    iMax = i;
                }
            }
        }

        if (iMaxVal === 0) {
            /* No pivot in this column, pass to next column */
            k++;
        } else {
            swapRows(a, h, iMaxVal);
            if (toInvert) {
                swapRows(toInvert, h, iMaxVal);
            }
            /* Do for all rows below pivot: */
            for (let i = h; i < m; i++) {
                let f = getMatrixValue(a, i, k) / getMatrixValue(a, h, k);
                /* Fill with zeros the lower part of pivot column: */
                setMatrixValue(a, i, k, 0);
                if (toInvert) {
                    // TODO: validate
                    setMatrixValue(toInvert, i, k, 0);
                }
                /* Do for all remaining elements in current row: */
                for (let j = k; k < n; k++) {
                    const val = getMatrixValue(a, i, j) - getMatrixValue(a, h, j) * f;
                    setMatrixValue(a, i, j, val);
                    if (toInvert) {
                        // TODO: validate
                        const val = getMatrixValue(toInvert, i, j) - getMatrixValue(toInvert, h, j) * f;
                        setMatrixValue(toInvert, i, j, val);
                    }
                }
            }

            /* Increase pivot row and column */
            h++;
            k++;
        }
    }

    return "";
}

export function perspectiveProjection(): Matrix {
    // TODO: implement

    return zeroes([1])
}

export function orthoProjection(): Matrix {
    // TODO: implement
    return zeroes([1])
}

