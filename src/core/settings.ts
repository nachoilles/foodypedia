export const DEFAULT_SETTINGS = {
    bgColor: "#000000",
    lowColor: "#76f5db",
    defColor: "#06b300",
    highColor: "#efff10",
    showDefIngredients: true,
}

export const DEFAULT_ID_STATE: IdManagerState = {
    nextBuiltinId: 0,
    nextUserId: 65_536,
    freeHead: null,
    freeNext: {}
}