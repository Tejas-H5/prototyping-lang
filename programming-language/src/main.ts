import { renderApp, } from './app.ts';
import { textSpan } from './layout.ts';
import "./styling.ts";
import { cssVars } from './styling.ts';
import { beginFrame, deltaTimeSeconds, elementHasMouseClick, endFrame, imBeginDiv, imBeginMemoComputation, imBeginSpan, imEnd, imEndMemo, imInit, initializeDomRootAnimiationLoop, initializeDomUtils, initializeImEvents, setInnerText, setStyle } from './utils/im-dom-utils.ts';

initializeDomUtils();
initializeImEvents();

let t = 0;
let frames = 0;
let frameTime = 0;
let screenHz = 0;

let timeSpentRendering = 0;
let timeSpentRenderingPerFrame = 0;
let renders = 0;
let renderHz = 0;

// Try to infer the 'baseline' frequency, so we know when we're lagging.
let baselineFrameMs = 100;
let baselineFrameMsFreq = 0;
let nextBaseline = 100;
let nextFreq = 0;

function renderRoot() {
    const t0 = performance.now();

    const dt = deltaTimeSeconds();
    t += dt;
    if (t > 1) {
        frameTime = t / frames;
        screenHz = Math.round(frames / t);
        t = 0;
        frames = 1;
    } else {
        frames++;
    }


    beginFrame();

    const r = imBeginDiv(); {
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
        const frameMs = Math.round(1000 * frameTime);
        const renderMs = Math.round(1000 * timeSpentRenderingPerFrame);

        // Compute our baseline framerate based on the frames we see.
        // Lock it down once we've seen the same framerate for long enough.
        const baselineLocked = baselineFrameMsFreq > 240
        if (!baselineLocked) {
            if (frameMs === nextBaseline) {
                if (nextFreq < Number.MAX_SAFE_INTEGER) {
                    nextFreq++;
                }
            } else if (frameMs === baselineFrameMs) {
                if (baselineFrameMsFreq < Number.MAX_SAFE_INTEGER) {
                    baselineFrameMsFreq++;
                }
            } else {
                nextBaseline = frameMs;
                nextFreq = 1;
            }

            if (nextFreq > baselineFrameMsFreq) {
                baselineFrameMs = nextBaseline;
                baselineFrameMsFreq = nextFreq;
                nextBaseline = 100;
                nextFreq = 0;
            }
        }

        textSpan(baselineLocked ? (baselineFrameMs + "ms baseline, ") : "computing baseline...");

        textSpan(frameMs + "ms frame, ");

        imBeginSpan(); {
            if (imBeginMemoComputation().val(renderMs).changed()) {
                setStyle("color", renderMs / baselineFrameMs > 0.5 ? "red" : "");
            } imEndMemo();
            setInnerText(renderMs + "ms render");
        } imEnd();
        // setStyle("transform", "rotate(" + angle + "deg)");

        if (elementHasMouseClick()) {
            baselineFrameMsFreq = 0;
        }

    } imEnd();

    
    renderApp();

    // render-start     -> Timer start
    //      rendering code()
    // render-end       -> timer stop
    // --- wait for next animation frame ---
    // this timer intentionally skips all of the time here.
    // we want to know what our remaining performance budget is, basically
    // ---
    // repeat
    timeSpentRendering += (performance.now() - t0);
    if (renders > 100) {
        timeSpentRenderingPerFrame = (timeSpentRendering / 1000) / renders;
        renderHz = Math.round(renders / (timeSpentRendering / 1000));
        timeSpentRendering = 0;
        renders = 1;
    } else {
        renders++;
    }

    endFrame();
}


initializeDomRootAnimiationLoop(renderRoot);
