import { initCnStyles } from "src/utils/cn";
import "./styling.ts";
import { imTestHarness } from "./test-harness.ts";
import { initializeImDomUtils } from './utils/im-dom-utils.ts';

function imRoot() {
    imTestHarness();
}

initCnStyles();
initializeImDomUtils(imRoot);
