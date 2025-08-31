import { ImCache, imMemo, isFirstishRender } from "src/utils/im-core";
import { elSetClass, elSetStyle } from "src/utils/im-dom";
import { cnApp } from "./styling";

export function imCode(c: ImCache, indent = 0) {
    if (imMemo(c, indent)) {
        elSetClass(c, cnApp.code);
        elSetStyle(c, "paddingLeft", (4 * indent) + "ch");
    }
}

export function imNotCode(c: ImCache) {
    if (isFirstishRender(c)) {
        elSetClass(c, cnApp.normal);
    }
}
