import { evaluateFunctionWithinProgramWithArgs, interpret, ProgramInterpretResult, ProgramResultFunction, startEvaluatingFunctionWithingProgramWithArgs, startInterpreting } from "./program-interpreter";
import { parse, ProgramParseResult } from "./program-parser";

export type GlobalState = {
    text: string;
    collapseParserOutput: boolean;
    collapseInterpreterPass1Output: boolean;
    autorun: boolean;
};

export type GlobalContext = {
    isDebugging: boolean;
    functionToDebug: ProgramResultFunction | null;

    lastParseResult: ProgramParseResult | undefined;
    lastInterpreterResult: ProgramInterpretResult | undefined;

    // This stuff is actually saved and persisted between runs
    state: GlobalState;

    reinterpretSignal: boolean;
}

export function startDebugging(ctx: GlobalContext): string {
    ctx.lastParseResult = parse(ctx.state.text);

    if (ctx.lastParseResult.errors.length > 0) {
        return "Fix parsing errors before you can start debugging";
    } 

    ctx.lastInterpreterResult = startInterpreting(ctx.lastParseResult, true, undefined);
    ctx.functionToDebug = null;
    ctx.isDebugging = true;
    return "";
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

        lastParseResult: undefined, 
        lastInterpreterResult: undefined,
        reinterpretSignal: true,
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
