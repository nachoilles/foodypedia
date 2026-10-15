export type UnitName = 
    | typeof volumeUnits[number]["name"] 
    | typeof weightUnits[number]["name"] 
    | typeof quantityUnits[number]["name"] 
    | typeof rationUnits[number]["name"]

export const days: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const

export const meals: Meal[] = ["breakfast", "lunch", "dinner"] as const

export const unitFactors: Record<string, number> = {
    ml: 0.001,
    cl: 0.01,
    dl: 0.1,
    l: 1,
    tsp: 0.005,
    tbsp: 0.015,
    cup: 0.24,
    pint: 0.568,
    quart: 1.136,
    gallon: 4.546,

    mg: 0.001,
    g: 1,
    kg: 1000,
    oz: 28.3495,
    lb: 453.592,
    stone: 6350.29,

    unit: 1,
    pair: 2,
    dozen: 12,
}

export const volumeUnits: VolumeUnit[] = [
    { name: "ml", factor: 0.001 },
    { name: "cl", factor: 0.01 },
    { name: "dl", factor: 0.1 },
    { name: "l", factor: 1 },
    { name: "tsp", factor: 0.005 },
    { name: "tbsp", factor: 0.015 },
    { name: "cup", factor: 0.24 },
    { name: "pint", factor: 0.568 },
    { name: "quart", factor: 1.136 },
    { name: "gallon", factor: 4.546 },
]

export const weightUnits: WeightUnit[] = [
    { name: "mg", factor: 0.001 },
    { name: "g", factor: 1 },
    { name: "kg", factor: 1000 },
    { name: "oz", factor: 28.3495 },
    { name: "lb", factor: 453.592 },
    { name: "stone", factor: 6350.29 },
]

export const quantityUnits: QuantityUnit[] = [
    { name: "unit", factor: 1 },
    { name: "pair", factor: 2 },
    { name: "dozen", factor: 12}
]

export const rationUnits: RationUnit[] = [
    { name: "ration", factor: 1}
]

export const isVolumeUnit = (unit: string): boolean => {
    return volumeUnits.some((u) => u.name === unit)
}

export const isWeightUnit = (unit: string): boolean => {
    return weightUnits.some((u) => u.name === unit)
}

export const isQuantityUnit = (unit: string): boolean => {
    return quantityUnits.some((u) => u.name === unit)
}

export const getUnitsFor = (unit: Unit | RationUnit): Unit[] | RationUnit[] => {
    return volumeUnits.some(candidate => candidate.name === unit.name)
        ? volumeUnits
        : weightUnits.some(candidate => candidate.name === unit.name)
            ? weightUnits
            : quantityUnits.some(candidate => candidate.name === unit.name)
                ? quantityUnits
                : rationUnits
}

export const getUnitsForName = (unit: UnitName): Unit[] | RationUnit[] => {
        return volumeUnits.some(candidate => candidate.name === unit)
        ? volumeUnits
        : weightUnits.some(candidate => candidate.name === unit)
            ? weightUnits
            : quantityUnits.some(candidate => candidate.name === unit)
                ? quantityUnits
                : rationUnits
}