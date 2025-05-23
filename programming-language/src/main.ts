import { initCnStyles } from "src/utils/cn";
import { renderApp as imApp, } from './app.ts';
import {
    imFpsCounterOutput,
    newFpsCounterState,
    startFpsCounter,
    stopFpsCounter,
} from "./components/fps-counter.ts";
import "./styling.ts";
import { getImKeys, imEndIf, imIf, imState, initializeImDomUtils } from './utils/im-dom-utils.ts';
import { imTestHarness } from "./test-harness.ts";
import { IS_PROD } from "./env.ts";

let isTesting = false;

function imRoot() {
    const fps = imState(newFpsCounterState);

    startFpsCounter(fps);

    if (!IS_PROD) {
        const keys = getImKeys();
        if (keys.keyDown) {
            const key = keys.keyDown.key;
            if (key === "F1") {
                isTesting = !isTesting;
            } else if (key === "Escape" && isTesting) {
                isTesting = !isTesting;
                keys.keyDown = null;
            }
        }
    }

    imApp();

    imFpsCounterOutput(fps);

    if (!IS_PROD) {
        if (imIf() && isTesting) {
            imTestHarness();
        } imEndIf();
    }

    stopFpsCounter(fps);
}

initCnStyles();
initializeImDomUtils(imRoot);
