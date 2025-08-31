import { imCode } from './app-styling';
import { imProgramOutputs, imFunctionInstructions, imProgramResult, getFunctionName } from './code-output';
import { BLOCK, COL, imButton, imFlex, imGap, imLayout, imLayoutEnd, imPadding, NA, PX, ROW } from './components/core/layout';
import { imScrollContainerBegin, newScrollContainer } from './components/scroll-container';
import { getCurrentCallstack, ProgramInterpretResult, stepProgram } from './program-interpreter';
import { GlobalContext, startDebugging } from './state';
import "./styling";
import { assert } from './utils/assert';
import { ImCache, imFor, imForEnd, imGet, imIf, imIfElse, imIfEnd, imSet, imState, inlineTypeId, isFirstishRender } from './utils/im-core';
import { EL_H3, elHasMouseDown, elSetStyle, imElBegin, imElEnd, imStr, imStrFmt } from './utils/im-dom';


export function imDebugger(
    c: ImCache,
    ctx: GlobalContext,
    interpretResult: ProgramInterpretResult
) {
    const sc = imState(c, newScrollContainer);

    imScrollContainerBegin(c, sc); {
        let message; message = imGet(c, inlineTypeId(imDebugger));
        if (!message) message = imSet(c, {
            val: "",
        });

        imLayout(c, ROW); imGap(c, 5, PX); {
            imLayout(c, BLOCK); imFlex(c); imButton(c); {
                imStr(c, "Stop debugging");
                if (elHasMouseDown(c, ctx.ev)) {
                    ctx.isDebugging = false;
                }
            } imLayoutEnd(c);

            imLayout(c, BLOCK); imFlex(c); imButton(c); {
                imStr(c, "Step");
                if (elHasMouseDown(c, ctx.ev)) {
                    const result = stepProgram(interpretResult);
                    if (!result) {
                        message.val = "Program complete! you can stop debugging now.";
                    }
                }
            } imLayoutEnd(c);

            imLayout(c, BLOCK); imFlex(c); imButton(c); {
                imStr(c, "Reset");
                if (elHasMouseDown(c, ctx.ev)) {
                    assert(ctx.lastParseResult !== undefined);
                    startDebugging(ctx);
                    message.val = "";
                }
            } imLayoutEnd(c);
        } imLayoutEnd(c);

        if (imIf(c) && message.val) {
            imLayout(c, BLOCK); {
                imStr(c, message.val);
            } imLayoutEnd(c);
        } imIfEnd(c);

        const cs = getCurrentCallstack(interpretResult);

        imLayout(c, COL); imFlex(c); {
            imLayout(c, COL); imFlex(c); {
                if (imIf(c) && cs) {
                    imLayout(c, BLOCK); {
                        imElBegin(c, EL_H3); imStrFmt(c, cs.fn, getFunctionName); imElEnd(c, EL_H3);

                        imFunctionInstructions(c, interpretResult, cs.code);
                    } imLayoutEnd(c);
                } imIfEnd(c)
            } imLayoutEnd(c);
            imLayout(c, ROW); imFlex(c); {
                imLayout(c, COL); imFlex(c); {
                    imElBegin(c, EL_H3); imStr(c, "Stack"); imElEnd(c, EL_H3);
                    imProgramStack(c, ctx, interpretResult);
                } imLayoutEnd(c);
                imLayout(c, COL); imFlex(c); {
                    imElBegin(c, EL_H3); imStr(c, "Results"); imElEnd(c, EL_H3);
                    imProgramOutputs(c, ctx, interpretResult, interpretResult.outputs);
                } imLayoutEnd(c);
            } imLayoutEnd(c);
        } imLayoutEnd(c);
    } imLayoutEnd(c);
}


function imProgramStack(
    c: ImCache,
    ctx: GlobalContext,
    interpretResult: ProgramInterpretResult
) {
    let variablesReverseMap; variablesReverseMap = imGet(c, inlineTypeId(imGet));
    if (!variablesReverseMap) {
        variablesReverseMap = imSet(c, new Map<number, string>());
    }
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

    imFor(c); for (let addr = 0; addr <= n; addr++) {
        const res = interpretResult.stack[addr];

        imLayout(c, BLOCK); {
            imLayout(c, ROW); imGap(c, 5, PX); {
                function imAddrArrow(c: ImCache, name: string) {
                    imLayout(c, BLOCK); imCode(c); imPadding(c, 0, NA, 10, PX, 0, NA, 10, PX); {
                        imStr(c, name + "->");
                    } imLayoutEnd(c);
                }

                if (imIf(c) && addr === interpretResult.stackIdx) {
                    imAddrArrow(c, "");
                } imIfEnd(c);

                // every callstack will have a different return address
                let callstackIdx = -1;
                for (let i = 0; i < interpretResult.callStack.length; i++) {
                    const cs = interpretResult.callStack[i];
                    if (cs.returnAddress === addr) {
                        callstackIdx = i;
                    }
                }

                if (imIf(c) && callstackIdx !== -1) {
                    imAddrArrow(c, "r" + callstackIdx + "");
                } imIfEnd(c);

                // every callstack will have a different next-variable address
                callstackIdx = -1;
                for (let i = 0; i < interpretResult.callStack.length; i++) {
                    const cs = interpretResult.callStack[i];
                    if (cs.nextVarAddress === addr) {
                        callstackIdx = i;
                    }
                }

                if (imIf(c) && callstackIdx !== -1) {
                    imAddrArrow(c, "v" + callstackIdx + "");
                } imIfEnd(c);

                const variable = variablesReverseMap.get(addr);
                if (imIf(c) && variable) {
                    imLayout(c, BLOCK); imCode(c); imStr(c, variable + " = "); imLayoutEnd(c);
                } imIfEnd(c);

                imLayout(c, BLOCK); imFlex(c); {
                    if (imIf(c) && res) {
                        imProgramResult(c, res);
                    } else {
                        imIfElse(c);
                        imStr(c, "null");
                    } imIfElse(c);
                } imLayoutEnd(c);
            } imLayoutEnd(c);
        } imLayoutEnd(c);
    } imForEnd(c);
}
