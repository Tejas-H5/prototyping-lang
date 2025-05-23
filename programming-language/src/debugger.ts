import { imFunctionName, imProgramOutputs, renderFunctionInstructions, renderProgramResult } from './code-output';
import {
    BOLD,
    CODE,
    COL,
    FLEX,
    GAP,
    H100,
    H3,
    imBeginButton,
    imBeginLayout,
    imBeginScrollContainer,
    imTextSpan,
    newH3,
    ROW
} from './layout';
import { getCurrentCallstack, ProgramInterpretResult, stepProgram } from './program-interpreter';
import { GlobalContext, startDebugging } from './state';
import "./styling";
import { assert } from './utils/assert';
import {
    elementHasMousePress,
    imDiv,
    imEl,
    imList,
    imEnd,
    imEndList,
    imInit,
    imRef,
    imStateInline,
    nextListRoot,
    setAttr,
    imIf,
    imEndIf,
    imElse
} from './utils/im-dom-utils';


export function renderDebugger(ctx: GlobalContext, interpretResult: ProgramInterpretResult) {
    imBeginScrollContainer(COL | GAP | H100); {
        const message = imRef<string>();

        imBeginLayout(ROW | GAP); {
            imBeginLayout(FLEX); {
                imBeginButton(); {
                    imTextSpan("Stop debugging");
                    if (elementHasMousePress()) {
                        ctx.isDebugging = false;
                    }
                } imEnd();
            } imEnd();

            imBeginLayout(FLEX); {
                imBeginButton(); {
                    imTextSpan("Step");

                    if (elementHasMousePress()) {
                        const result = stepProgram(interpretResult);
                        if (!result) {
                            message.val = "Program complete! you can stop debugging now.";
                        }
                    }
                } imEnd();
            } imEnd();

            imBeginLayout(FLEX); {
                imBeginButton(); {
                    imTextSpan("Reset");
                    if (elementHasMousePress()) {
                        assert(ctx.lastParseResult !== undefined);
                        startDebugging(ctx);
                        message.val = "";
                    }
                } imEnd();
            } imEnd();
        } imEnd();

        if (imIf() && message.val) {
            imDiv(); {
                imTextSpan(message.val);
            } imEnd();
        } imEndIf();

        const cs = getCurrentCallstack(interpretResult);

        imBeginLayout(COL | FLEX); {
            imBeginLayout(COL | FLEX); {
                if (imIf() && cs) {
                    const fnName = imFunctionName(cs.fn);
                    imBeginLayout(H3 | BOLD); {
                        imTextSpan(fnName);
                    } imEnd();

                    renderFunctionInstructions(interpretResult, cs.code);
                } imEndIf()
            } imEnd();
            imBeginLayout(ROW | FLEX); {
                imBeginLayout(COL | FLEX); {
                    imEl(newH3); {
                        imTextSpan("Stack");
                    } imEnd();

                    // render the stack
                    {
                        const variablesReverseMap = imStateInline(() => new Map<number, string>());
                        variablesReverseMap.clear();
                        for (const cs of interpretResult.callStack) {
                            for (const [varName, addr] of cs.variables) {
                                variablesReverseMap.set(addr, varName);
                            }
                        }

                        let n = interpretResult.stack.length;
                        while (n > 0) {
                            n--;
                            if (interpretResult.stack[n]) {
                                break;
                            }
                        }

                        // show a couple more addresses after, why not.
                        n += 10;
                        if (n > interpretResult.stack.length) {
                            n = interpretResult.stack.length - 1;
                        }

                        imList();
                        for (let addr = 0; addr <= n; addr++) {
                            const res = interpretResult.stack[addr];

                            nextListRoot();

                            imDiv(); {
                                imBeginLayout(ROW | GAP); {
                                    const stackAddrArrow = (name: string) => {
                                        imDiv(); {
                                            if (imInit()) setAttr("style", "padding-left: 10px; padding-right: 10px");

                                            imTextSpan(name + "->", CODE);
                                        } imEnd();
                                    }

                                    if (imIf() && addr === interpretResult.stackIdx) {
                                        stackAddrArrow("");
                                    } imEndIf();

                                    // every callstack will have a different return address
                                    let callstackIdx = -1;
                                    for (let i = 0; i < interpretResult.callStack.length; i++) {
                                        const cs = interpretResult.callStack[i];
                                        if (cs.returnAddress === addr) {
                                            callstackIdx = i;
                                        }
                                    }

                                    if (imIf() && callstackIdx !== -1) {
                                        stackAddrArrow("r" + callstackIdx + "");
                                    } imEndIf();

                                    // every callstack will have a different next-variable address
                                    callstackIdx = -1;
                                    for (let i = 0; i < interpretResult.callStack.length; i++) {
                                        const cs = interpretResult.callStack[i];
                                        if (cs.nextVarAddress === addr) {
                                            callstackIdx = i;
                                        }
                                    }

                                    if (imIf() && callstackIdx !== -1) {
                                        stackAddrArrow("v" + callstackIdx + "");
                                    } imEndIf();

                                    const variable = variablesReverseMap.get(addr);
                                    if (imIf() && variable) {
                                        imDiv(); {
                                            imTextSpan(variable + " = ", CODE);
                                        } imEnd();
                                    } imEndIf();

                                    imBeginLayout(FLEX); {
                                        if (imIf() && res) {
                                            renderProgramResult(res);
                                        } else {
                                            imElse();
                                            imTextSpan("null");
                                        } imEndIf();
                                    } imEnd();
                                } imEnd();
                            } imEnd();
                        } imEndList();
                    }
                } imEnd();
                imBeginLayout(FLEX | COL); {
                    imEl(newH3); {
                        imTextSpan("Results");
                    } imEnd();

                    imProgramOutputs(ctx, interpretResult, interpretResult.outputs);
                } imEnd();
            } imEnd();
        } imEnd();
    } imEnd();
}

