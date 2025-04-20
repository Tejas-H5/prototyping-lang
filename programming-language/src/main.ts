import { renderApp, } from './app.ts';
import { imTextSpan } from './layout.ts';
import "./styling.ts";
import { cssVars } from './styling.ts';
import { imBeginFrame, deltaTimeSeconds, elementHasMouseClick, imEndFrame, imBeginDiv, imBeginMemo, imBeginSpan, imEnd, imEndMemo, imInit, initializeDomRootAnimiationLoop, initializeDomUtils, initializeImEvents, setInnerText, setStyle, imState } from './utils/im-dom-utils.ts';

initializeDomUtils();
initializeImEvents();

type FpsCounterState = {
    t: number;
    t0: number;
    frames: number;
    frameTime: number;
    screenHz: number;

    timeSpentRendering: number;
    timeSpentRenderingPerFrame: number;
    renders: number;
    renderHz: number;

    // Try to infer the 'baseline' frequency, so we know when we're lagging.
    baselineFrameMs: number;
    baselineFrameMsFreq: number;
    baselineLocked: boolean;
    nextBaseline: number;
    nextFreq: number;

    framesMsRounded: number;
    renderMsRounded: number;
}

function newFpsCounterState(): FpsCounterState {
    return {
        t: 0,
        t0: 0,
        frames: 0,
        frameTime: 0,
        screenHz: 0,

        timeSpentRendering: 0,
        timeSpentRenderingPerFrame: 0,
        renders: 0,
        renderHz: 0,

        // Try to infer the 'baseline' frequency, so we know when we're lagging.
        baselineFrameMs: 100,
        baselineFrameMsFreq: 0,
        baselineLocked: false,
        nextBaseline: 100,
        nextFreq: 0,

        framesMsRounded: 0,
        renderMsRounded: 0,
    };
}

function startPerfTimer(fps: FpsCounterState) {
    fps.t0 = performance.now();
    const dt = deltaTimeSeconds();
    fps.t += dt;
    if (fps.t > 1) {
        fps.frameTime = fps.t / fps.frames;
        fps.screenHz = Math.round(fps.frames / fps.t);
        fps.t = 0;
        fps.frames = 1;
    } else {
        fps.frames++;
    }

    fps.framesMsRounded = Math.round(1000 * fps.frameTime);
    fps.renderMsRounded = Math.round(1000 * fps.timeSpentRenderingPerFrame);

    // Compute our baseline framerate based on the frames we see.
    // Lock it down once we've seen the same framerate for long enough.
    fps.baselineLocked = fps.baselineFrameMsFreq > 240
    if (!fps.baselineLocked) {
        if (fps.framesMsRounded === fps.nextBaseline) {
            if (fps.nextFreq < Number.MAX_SAFE_INTEGER) {
                fps.nextFreq++;
            }
        } else if (fps.framesMsRounded === fps.baselineFrameMs) {
            if (fps.baselineFrameMsFreq < Number.MAX_SAFE_INTEGER) {
                fps.baselineFrameMsFreq++;
            }
        } else {
            fps.nextBaseline = fps.framesMsRounded;
            fps.nextFreq = 1;
        }

        if (fps.nextFreq > fps.baselineFrameMsFreq) {
            fps.baselineFrameMs = fps.nextBaseline;
            fps.baselineFrameMsFreq = fps.nextFreq;
            fps.nextBaseline = 100;
            fps.nextFreq = 0;
        }
    }
}

function stopPerfTimer(fps: FpsCounterState) {
    // render-start     -> Timer start
    //      rendering code()
    // render-end       -> timer stop
    // --- wait for next animation frame ---
    // this timer intentionally skips all of the time here.
    // we want to know what our remaining performance budget is, basically
    // ---
    // repeat
    fps.timeSpentRendering += (performance.now() - fps.t0);
    if (fps.renders > 100) {
        fps.timeSpentRenderingPerFrame = (fps.timeSpentRendering / 1000) / fps.renders;
        fps.renderHz = Math.round(fps.renders / (fps.timeSpentRendering / 1000));
        fps.timeSpentRendering = 0;
        fps.renders = 1;
    } else {
        fps.renders++;
    }
}

function imPerfTimerOutput(fps: FpsCounterState) {
    imBeginDiv(); {
        if (imInit()) {
            setStyle("position", "absolute");
            setStyle("top", "5px");
            setStyle("right", "5px");
            setStyle("padding", "5px");
            setStyle("zIndex", "1000000");
            setStyle("backgroundColor", cssVars.bg);
            setStyle("borderRadius", "1000px");
            setStyle("opacity", "0.5");
            // setStyle("backgroundColor", cssVars.fg);
            // setStyle("width", "20px");
            // setStyle("height", "20px");
            // setStyle("transformOrigin", "center");
        }

        // r.text(screenHz + "hz screen, " + renderHz + "hz code");

        imTextSpan(fps.baselineLocked ? (fps.baselineFrameMs + "ms baseline, ") : "computing baseline...");

        imTextSpan(fps.framesMsRounded + "ms frame, ");

        imBeginSpan(); {
            if (imBeginMemo().val(fps.renderMsRounded).changed()) {
                setStyle("color", fps.renderMsRounded / fps.baselineFrameMs > 0.5 ? "red" : "");
            } imEndMemo();
            setInnerText(fps.renderMsRounded + "ms render");
        } imEnd();
        // setStyle("transform", "rotate(" + angle + "deg)");

        if (elementHasMouseClick()) {
            fps.baselineFrameMsFreq = 0;
        }

    } imEnd();
}

function renderRoot() {
    imBeginFrame();

    const fps = imState(newFpsCounterState);
    startPerfTimer(fps);
    imPerfTimerOutput(fps);
    
    renderApp();

    stopPerfTimer(fps);

    imEndFrame();
}


initializeDomRootAnimiationLoop(renderRoot);
