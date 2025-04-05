export async function copyToClipboard(s: string) {
    return await navigator.clipboard.writeText(s);
}

export async function readFromClipboard(): Promise<string> {
    return await navigator.clipboard.readText();
}
