
export type GlobalState = {
    text: string;
};

export function newGlobalState(): GlobalState {
    return {
        text: ""
    };
}
