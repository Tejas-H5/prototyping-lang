import { initCnStyles } from "src/utils/cssb";
import "./styling.ts";
import { imTestHarness } from "./test-harness.ts";
import { ImCache, imCacheBegin, imCacheEnd, USE_ANIMATION_FRAME } from "./utils/im-core.ts";
import { imDomRootBegin, imDomRootEnd, imGlobalEventSystemBegin, imGlobalEventSystemEnd, newImGlobalEventSystem } from "./utils/im-dom.ts";

const cGlobal: ImCache = [];
const evGlobal = newImGlobalEventSystem();

function imRoot(c: ImCache) {
    imCacheBegin(c, imRoot, USE_ANIMATION_FRAME); {
        imDomRootBegin(c, document.body); {
            imGlobalEventSystemBegin(c, evGlobal); {
                imTestHarness(c, evGlobal);
            } imGlobalEventSystemEnd(c, evGlobal);
        } imDomRootEnd(c, document.body);
    } imCacheEnd(c);
}

initCnStyles();
imRoot(cGlobal);
