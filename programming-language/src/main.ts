import { renderApp } from './app.ts';
import "./styling.ts";
import { initializeDomUtils, startRendering } from './utils/im-dom-utils.ts';

initializeDomUtils();

startRendering();
renderApp();
