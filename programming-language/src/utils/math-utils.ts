export function min(a: number, b: number): number {
    return a < b ? a : b;
}

export function max(a: number, b: number): number {
    return a > b ? a : b;
}

export function moveTowards(a: number, b: number, maxDelta: number) {
    if (Math.abs(a - b) < maxDelta) return b;

    if (a > b) {
        return a - maxDelta;
    }

    return a + maxDelta;
}

export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function inverseLerp(start: number, end: number, value: number) {
    return (value - start) / (end - start);
}

export function clamp(val: number, min: number, max: number) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
}

export function sqrMag(x: number, y: number): number {
    return x * x + y * y;
}

export function mag(x: number, y: number): number {
    return sqrMag(x, y) ** 0.5;
}
