import { renderApp, } from './app.ts';
import "./styling.ts";
import { cssVars } from './styling.ts';
import { newTextEditorState, imTextEditor } from './text-editor.ts';
import { beginFrame, deltaTimeSeconds, imBeginDiv, imEnd, endFrame, imComponent, imInit, imState, initializeDomRootAnimiationLoop, initializeDomUtils, initializeImEvents, setStyle } from './utils/im-dom-utils.ts';

initializeDomUtils();
initializeImEvents();

const textEditorState = newTextEditorState();


let t = 0;
let frames = 0;
let frameTime = 0;
let screenHz = 0;

let timeSpentRendering = 0;
let timeSpentRenderingPerFrame = 0;
let renders = 0;
let renderHz = 0;

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
            // setStyle("backgroundColor", cssVars.fg);
            // setStyle("width", "20px");
            // setStyle("height", "20px");
            // setStyle("transformOrigin", "center");
        }

        r.text(screenHz + "hz screen, " + renderHz + "hz code");
        // setStyle("transform", "rotate(" + angle + "deg)");

    } imEnd();

    
    // renderApp();
    imTextEditor(textEditorState);

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
