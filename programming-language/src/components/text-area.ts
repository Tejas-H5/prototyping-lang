import { cssVars } from "src/styling";
import { cn, div, el, setInputValue, imOn, newCssBuilder, span, UIRoot, newDomElement, imState, imIf } from "src/utils/im-dom-utils";
import { getLineBeforePos } from "src/utils/text-utils";

const CSSVARS_FOCUS = cssVars.bg;
const CSSVARS_FG = cssVars.fg;

export function newTextArea(initFn?: (el: HTMLTextAreaElement) => void): HTMLTextAreaElement {
    const textArea = newDomElement("textarea");

    initFn?.(textArea);

    return textArea
}

const cssb = newCssBuilder();

const cnEditableTextArea = cssb.newClassName("editableTextArea");
cssb.s(`
textarea.${cnEditableTextArea} { 
    white-space: pre-wrap; padding: 5px; 
    caret-color: ${CSSVARS_FG};
};
textarea.${cnEditableTextArea}:focus { background-color: ${CSSVARS_FOCUS}; };
`);

export type EditableTextAreaArgs = {
    text: string;
    isEditing: boolean;
    isOneLine?: boolean;
    onInput(text: string, textArea: HTMLTextAreaElement): void;
    onInputKeyDown(e: KeyboardEvent, textArea: HTMLTextAreaElement): void;
    config: EditableTextAreaConfig;
};

type EditableTextAreaConfig = {
    useSpacesInsteadOfTabs?: boolean;
    tabStopSize?: number;
};

function newEditableTextAreaState() {
    return { 
        isEditing: false,
        lastText: "",
        lastIsEditing: false,
    };
}

// NOTE: this text area has a tonne of minor things wrong with it. we should fix them at some point.
//   - When I have a lot of empty newlines, and then click off, the empty lines go away 'as needed' 
export function EditableTextArea(r: UIRoot, {
    text,
    isEditing,
    isOneLine,
    onInput,
    onInputKeyDown,
    config,
}: EditableTextAreaArgs) {
    const state = imState(r, newEditableTextAreaState);

    const wasEditing = state.isEditing;
    state.isEditing = isEditing;

    const root = div(r, r => {
        if (r.isFirstRender) {
            r.c(cn.flex1).c(cn.row).c(cn.h100).c(cn.relative)
             .s("overflowY", "hidden");
        }

        imIf(isEditing, r, r => {
            el(r, newTextArea, r => {
                if (r.isFirstRender) {
                    r.c(cn.allUnset)
                     .c(cnEditableTextArea)
                     .c(cn.absolute).c(cn.preWrap).c(cn.w100).c(cn.h100)
                     .s("backgroundColor", "transparent")
                     .s("color", "transparent")
                     .s("overflowY", "hidden")
                     .s("padding", "0")
                }

                if (!wasEditing) {
                    r.root.focus({ preventScroll: true });
                }


                if (state.lastText !== text || state.lastIsEditing !== isEditing) {
                    state.lastText = text;
                    // for some reason, we need to render this thing again when we start editing - perhaps
                    // setting the input value doesn't work if it isn't visible...
                    state.lastIsEditing = isEditing;
                    setInputValue(r.root, text);
                }

                imOn(r, "input", () => {
                    onInput(r.root.value, r.root);
                });

                imOn(r, "keydown", (e) => {
                    if (!handleTextAreaKeyboardInput(e, r.root, config)) {
                        onInputKeyDown(e, r.root);
                    }
                });
            });
        });

        // This is now always present.
        div(r, r => {
            r.c(cn.handleLongWords)
             .c(cn.preWrap, !isOneLine)
             .c(cn.pre, !!isOneLine)
             .c(cn.overflowHidden, isOneLine)
             .c(cn.noWrap, !!isOneLine);

            // This is a facade that gives the text area the illusion of auto-sizing!
            // but it only works if the text doesn't end in whitespace....
            span(r, r => {
                r.text(text);
            });

            // This full-stop at the end of the text is what prevents the text-area from collapsing in on itself
            span(r, r => {
                if (r.isFirstRender) {
                    r.s("color", "transparent").text(".");
                }
            });
        });
    });

    return root;
}


function handleTextAreaKeyboardInput(e: KeyboardEvent, textArea: HTMLTextAreaElement, config: EditableTextAreaConfig): boolean {
    // HTML text area doesn't like tabs, we need this additional code to be able to insert tabs (among other things).
    // Using the execCommand API is currently the only way to do this while perserving undo, 
    // and I won't be replacing it till there is really something better.
    const spacesInsteadOfTabs = config.useSpacesInsteadOfTabs ?? false;
    const tabStopSize = config.tabStopSize ?? 4;

    let text = textArea.value;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;

    let handled = false;

    const getSpacesToRemove = (col: string) => {
        if (!config.useSpacesInsteadOfTabs) {
            return 1;
        }

        // if this bit has tabs, we can't do shiet
        if (![...col].every(c => c === " ")) {
            return 1;
        }

        // seems familiar, because it is - see the tab stop computation below
        let spacesToRemove = (col.length % tabStopSize)
        if (spacesToRemove === 0) {
            spacesToRemove = tabStopSize;
        }
        if (spacesToRemove > col.length) {
            spacesToRemove = col.length;
        }

        return spacesToRemove;
    }

    const getIndentation = (col: string): string => {
        if (!spacesInsteadOfTabs) {
            return "\t";
        }

        const numSpaces = tabStopSize - (col.length % tabStopSize);
        return " ".repeat(numSpaces);
    }

    if (e.key === "Backspace" && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        handled = true;

        if (start === end) {
            const col = getLineBeforePos(text, start);

            const spacesToRemove = getSpacesToRemove(col);
            if (spacesToRemove) {
                e.preventDefault();
                for (let i = 0; i < spacesToRemove; i++) {
                    document.execCommand("delete", false, undefined);
                }
            }
        }
    } else if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        handled = true;

        if (e.shiftKey) {
            e.preventDefault();

            let newStart = start;
            let newEnd = end;

            // iterating backwards allows us to delete text while iterating, since indices won't be shifted.
            let i = end;
            while (i >= start) {
                const col = getLineBeforePos(text, i);
                if (col.length === 0) {
                    i--;
                    continue;
                }

                const numNonWhitespaceAtColStart = col.trimStart().length;
                const pos = i - numNonWhitespaceAtColStart;
                textArea.selectionStart = pos;
                textArea.selectionEnd = pos;

                // de-indent by the correct amount.
                {
                    const col2 = col.substring(0, col.length - numNonWhitespaceAtColStart);
                    const spacesToRemove = getSpacesToRemove(col2);
                    for (let i = 0; i < spacesToRemove; i++) {
                        // cursor implicitly moves back 1 for each deletion.
                        document.execCommand("delete", false, undefined);
                        newEnd--;
                    }
                }

                i -= col.length;
            }

            textArea.selectionStart = newStart;
            textArea.selectionEnd = newEnd;
        } else {
            if (start === end) {
                const col = getLineBeforePos(text, start);
                const indentation = getIndentation(col);
                e.preventDefault();
                document.execCommand("insertText", false, indentation);
            } else {
                e.preventDefault();

                let newStart = start;
                let newEnd = end;

                // iterating backwards allows us to delete text while iterating, since indices won't be shifted.
                let i = end;
                while (i >= start) {
                    const col = getLineBeforePos(text, i);
                    if (col.length === 0) {
                        i--;
                        continue;
                    }

                    const numNonWhitespaceAtColStart = col.trimStart().length;
                    const pos = i - numNonWhitespaceAtColStart;

                    // indent by the correct amount.
                    const col2 = col.substring(0, col.length - numNonWhitespaceAtColStart);
                    const indentation = getIndentation(col2);
                    textArea.selectionStart = pos;
                    textArea.selectionEnd = pos;
                    document.execCommand("insertText", false, indentation);
                    newEnd += indentation.length;

                    i -= col.length;
                }

                textArea.selectionStart = newStart;
                textArea.selectionEnd = newEnd;

            }
        }
    } else if (e.key === "Escape" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && start !== end) {
        handled = true;
        e.stopImmediatePropagation();
        textArea.selectionEnd = textArea.selectionStart;
    }

    return handled;
}

