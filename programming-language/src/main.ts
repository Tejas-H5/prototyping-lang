import { App } from './app.ts';
import "./styling.ts";
import { initializeDomUtils, newUiRoot } from './utils/im-dom-utils.ts';

initializeDomUtils();

const root = newUiRoot(() => document.body);

App(root);
