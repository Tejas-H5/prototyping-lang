import { App } from './app.ts';
import "./styling.ts";
import { appendChild, initializeDomUtils, newComponent, newInsertable } from './utils/dom-utils.ts';


const root = newInsertable(document.body);
initializeDomUtils(root);
const app = newComponent(App);
appendChild(root, app);

app.render(null);
