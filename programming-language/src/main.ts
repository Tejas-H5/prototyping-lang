import { initCnStyles } from "src/utils/cssb";
import { imApp } from './app.ts';
import { fpsMarkRenderingEnd, fpsMarkRenderingStart, newFpsCounterState, } from "./components/fps-counter.ts";
import "./styling.ts";
import { ImCache, imCacheBegin, imCacheEnd, imState, USE_ANIMATION_FRAME } from "./utils/im-core.ts";
import { imDomRootBegin, imDomRootEnd, imGlobalEventSystemBegin, imGlobalEventSystemEnd } from "./utils/im-dom.ts";

const cGlobal: ImCache = [];

function imRoot(c: ImCache) {
    imCacheBegin(cGlobal, imRoot, USE_ANIMATION_FRAME); {
        const fps = imState(c, newFpsCounterState);
        fpsMarkRenderingStart(fps);

        imDomRootBegin(c, document.body); {
            const eventSystem = imGlobalEventSystemBegin(c); {
                imApp(c, fps);
            } imGlobalEventSystemEnd(c, eventSystem);
        } imDomRootEnd(c, document.body);

        fpsMarkRenderingEnd(fps);
    } imCacheEnd(cGlobal);
}

initCnStyles();
imRoot(cGlobal);
