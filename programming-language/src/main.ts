import { renderApp } from './app.ts';
import "./styling.ts";
import { cssVars } from './styling.ts';
import { deltaTimeSeconds, div, end, imInit, initializeDomRootAnimiationLoop, initializeDomUtils, initializeImEvents, setStyle } from './utils/im-dom-utils.ts';

initializeDomUtils();
initializeImEvents();

let t = 0;
let frames = 0;
let fps = 0;
function renderRoot() {
    const dt = deltaTimeSeconds();
    t += dt;
    if (t > 1) {
        fps = Math.round(frames / t);
        t = 0;
        frames = 1;
    } else {
        frames++;
    }

    const r = div(); {
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

        r.text(fps + " fps");
        // setStyle("transform", "rotate(" + angle + "deg)");

    } end();
    
    renderApp();
}

initializeDomRootAnimiationLoop(renderRoot);
