import { interpret, ProgramInterpretResult, ProgramResultFunction, startInterpreting } from "./program-interpreter";
import { parse, ProgramParseResult } from "./program-parser";
import { autoMigrate, recursiveCloneNonComputedFields } from "./utils/serialization";

export type GlobalState = {
    text: string;
    showParserOutput: boolean;
    showInterpreterOutput: boolean;
    autoRun: boolean;
};

export type GlobalContext = {
    isDebugging: boolean;
    functionToDebug: ProgramResultFunction | null;
    cursorPos: number;
    cursorLine: number;

    lastParseResult: ProgramParseResult | undefined;
    lastInterpreterResult: ProgramInterpretResult | undefined;

    // This stuff is actually saved and persisted between runs
    state: GlobalState;

    reinterpretSignal: boolean;
}

export function startDebugging(ctx: GlobalContext): string {
    ctx.lastParseResult = parse(ctx.state.text);

    if (ctx.lastParseResult.errors.length === 0) {
        ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult, true, undefined);

        if (ctx.lastInterpreterResult.errors.length === 0) {
            ctx.functionToDebug = null;
            ctx.isDebugging = true;
            return "";
        } 
    } 

    return "Fix parsing errors before you can start debugging";
}

// Even after this method is called, the user still needs to input arguments into the function.
// so you haven't actually started stepping through the function yetfunction yet.
export function startDebuggingFunction(ctx: GlobalContext, functionName: string): string {
    ctx.lastParseResult = parse(ctx.state.text);

    if (ctx.lastParseResult.errors.length > 0) {
        return "Fix parsing errors before you can start debugging";
    } 

    const program = interpret(ctx.lastParseResult, undefined);
    ctx.lastInterpreterResult = program;
    const fn = program.functions.get(functionName);
    if (!fn) {
        return "This function doesn't exist!";
    }

    ctx.functionToDebug = fn;
    ctx.isDebugging = true;
    return "";
}

export function newGlobalContext(): GlobalContext {
    return {
        state: loadState(),

        isDebugging: false,
        functionToDebug: null,
        cursorPos: 0,
        cursorLine: 0,

        lastParseResult: undefined, 
        lastInterpreterResult: undefined,
        reinterpretSignal: true,
    };
}
export function newGlobalState(): GlobalState {
    return {
        text: "",
        showParserOutput: false,
        showInterpreterOutput: false,
        autoRun: true,
    };
}

export function loadStateFromJson(string: string): GlobalState {
    const state: GlobalState = JSON.parse(string);

    autoMigrate(state, newGlobalState);

    return state;
}

export function getStateJSON(state: GlobalState): string {
    const stripped = recursiveCloneNonComputedFields(state);
    return JSON.stringify(stripped);
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
