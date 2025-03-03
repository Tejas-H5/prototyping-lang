
export type GlobalState = {
    text: string;
};

export function newGlobalState(): GlobalState {
    return {
        text: ""
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
