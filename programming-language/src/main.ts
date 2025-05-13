import { initCnStyles } from "src/utils/cn";
import { renderApp, } from './app.ts';
import {
    imFpsCounterOutput, newFpsCounterState, startFpsCounter, stopFpsCounter,
} from "./components/fps-counter.ts";
import "./styling.ts";
import { imState, initializeImDomUtils, } from './utils/im-dom-utils.ts';

function renderRoot() {
    const fps = imState(newFpsCounterState);
    imFpsCounterOutput(fps);

    startFpsCounter(fps);

    renderApp();

    stopFpsCounter(fps);
}

initCnStyles();
initializeImDomUtils(renderRoot);
