import { renderApp } from './app.ts';
import "./styling.ts";
import { deltaTimeSeconds, div, end, init, initializeDomRootAnimiationLoop, initializeDomUtils, setStyle } from './utils/im-dom-utils.ts';

initializeDomUtils();

let t = 0;
function renderRoot() {
    const dt = deltaTimeSeconds();
    t += dt * 0.2;
    if (t > 1) {
        t = 0;
    }

    const angle = 360 * t;

    const r = div(); {
        if (init()) {
            setStyle("position", "absolute");
            setStyle("top", "10px");
            setStyle("right", "10px");
            // setStyle("backgroundColor", cssVars.fg);
            // setStyle("width", "20px");
            // setStyle("height", "20px");
            // setStyle("transformOrigin", "center");
        }

        const fps = Math.round(1 / dt);
        r.text(fps + " fps");

        // setStyle("transform", "rotate(" + angle + "deg)");

    } end();
    
    renderApp();
}

initializeDomRootAnimiationLoop(renderRoot);
