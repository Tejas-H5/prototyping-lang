export function mapSet<K, V>(map: Map<K, V>, key: K, value: V) {
    map.set(key, value);
    return value;
}

export function groupBy<K, V>(dst: Map<K, V[]>, values: V[], keyFn: (val: V) => K) {
    for (const v of values) {
        const k = keyFn(v);
        let value = dst.get(k);
        if (!value) {
            value = [];
            dst.set(k, value);
        }

        value.push(v);
    }
}

