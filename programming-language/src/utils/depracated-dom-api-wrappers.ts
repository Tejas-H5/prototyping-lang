// @ts-nocheck hate those deprecation warnings...
export function execCommand(commandId: string, showUI?: boolean, value?: string): boolean {
    return document.execCommand(commandId, showUI, value);
}
