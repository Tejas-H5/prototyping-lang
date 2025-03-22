import { ProgramInterpretResult, startInterpreting } from "./program-interpreter";
import { parse, ProgramParseResult } from "./program-parser";

export type GlobalState = {
    text: string;
    collapseParserOutput: boolean;
    collapseInterpreterPass1Output: boolean;
    autorun: boolean;
};

export type GlobalContext = {
    isDebugging: boolean;
    lastParseResult: ProgramParseResult | undefined;
    lastInterpreterResult: ProgramInterpretResult | undefined;
    rerenderApp: () => void;

    // This stuff is actually saved and persisted between runs
    state: GlobalState;
}

export function startDebugging(ctx: GlobalContext): string {
    ctx.lastParseResult = parse(ctx.state.text);

    if (ctx.lastParseResult.errors.length > 0) {
        return "Fix parsing errors before you can start debugging";
    } 

    ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult);
    ctx.isDebugging = true;
    return "";
}

export function newGlobalContext(): GlobalContext {
    return {
        rerenderApp: () => {},
        state: loadState(),
        isDebugging: false,
        lastParseResult: undefined, 
        lastInterpreterResult: undefined 
    };
}
export function newGlobalState(): GlobalState {
    return {
        text: "",
        collapseParserOutput: false,
        collapseInterpreterPass1Output: false,
        autorun: false,
    };
}

export function loadStateFromJson(string: string): GlobalState {
    // trust me, bro
    return JSON.parse(string);
}

export function getStateJSON(state: GlobalState): string {
    return JSON.stringify(state);
}

const KEY = "programming-lang-save-state";

export function loadState() {
    const json = localStorage.getItem(KEY);
    if (json) {
        return loadStateFromJson(json);
    }

    return newGlobalState();
}

export function saveState(state: GlobalState) {
    localStorage.setItem(KEY, getStateJSON(state));
}
