import { ProgramInterpretResult } from "./program-interpreter";
import { ProgramParseResult } from "./program-parser";

export type GlobalState = {
    text: string;
    collapseParserOutput: boolean;
    collapseProgramOutput: boolean;
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
        collapseProgramOutput: false,
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
