declare type Day =
    | "MON"
    | "TUE"
    | "WED"
    | "THU"
    | "FRI"
    | "SAT"
    | "SUN"

declare type Meal = 
    | "breakfast" 
    | "lunch" 
    | "dinner"

declare type VolumeUnit =
    | { name: "ml"; factor: 0.001 }
    | { name: "cl"; factor: 0.01 }
    | { name: "dl"; factor: 0.1 }
    | { name: "l"; factor: 1 }
    | { name: "tsp"; factor: 0.005 }
    | { name: "tbsp"; factor: 0.015 }
    | { name: "cup"; factor: 0.24 }
    | { name: "pint"; factor: 0.568 }
    | { name: "quart"; factor: 1.136 }
    | { name: "gallon"; factor: 4.546 }

declare type WeightUnit =
    | { name: "mg"; factor: 0.001 }
    | { name: "g"; factor: 1 }
    | { name: "kg"; factor: 1000 }
    | { name: "oz"; factor: 28.3495 }
    | { name: "lb"; factor: 453.592 }
    | { name: "stone"; factor: 6350.29 };

declare type QuantityUnit = 
    | { name: "unit"; factor: 1 }
    | { name: "pair"; factor: 2 }
    | { name: "dozen"; factor: 12 }

declare type RationUnit = { name: "ration"; factor: 1 }

declare type Unit = VolumeUnit | WeightUnit | QuantityUnit

declare type Ingredient = {
    id: number
    name: string
    defaultUnit: Unit
}

declare type IngredientEntry = Ingredient & {
    unit: Unit
    quantity: number
}

declare type Recipe = {
    id: number
    name: string
    rations: number
    ingredients: IngredientEntry[]
    instructions: string[]
}

declare type RecipeEntry = Recipe & {
    unit: RationUnit
    quantity: number
}

declare type Menu = {
    id: number
    name: string
    ingredients: IngredientEntry[]
    recipes: RecipeEntry[]
}

declare type MenuEntry = Menu & {
    unit: RationUnit
    quantity: number
}

type DailyPlan = Record<Meal, MenuEntry | null>

declare type Plan = {
    id: number
    name: string
    daily: DailyPlan[]
}

declare type IdManagerState = {
    nextBuiltinId: number
    nextUserId: number
    freeHead: number | null
    freeNext: Record<number, number | null>
}

declare type IdManagerRecord = IdManagerState & {
    key: "ids"
}

declare type Settings = {
    bgColor: string
    lowColor: string
    defColor: string
    highColor: string
    showDefIngredients: boolean
}

declare type DBState = {
    settings: Settings
    ingredients: Ingredient[]
    recipes: Recipe[]
    menus: Menu[]
    plans: Plan[]
    ingredientIdManager: IdManagerState
    recipeIdManager: IdManagerState
    menuIdManager: IdManagerState
    planIdManager: IdManagerState
}