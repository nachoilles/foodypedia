import { meals } from "../core/units.js"

const syncIngredientEntry = (entry: IngredientEntry, canonical: Ingredient): void => {
    entry.name = canonical.name
    entry.defaultUnit = { ...canonical.defaultUnit }
}

const syncRecipeEntry = (entry: RecipeEntry, canonical: Recipe): void => {
    entry.name = canonical.name
    entry.rations = canonical.rations
    entry.instructions = [...canonical.instructions]
    entry.ingredients = canonical.ingredients.map(ingredient => ({
        ...ingredient,
        defaultUnit: { ...ingredient.defaultUnit },
        unit: { ...ingredient.unit }
    }))
}

const syncMenuEntry = (entry: MenuEntry, canonical: Menu): void => {
    entry.name = canonical.name

    entry.ingredients = canonical.ingredients.map(ingredient => ({
        ...ingredient,
        defaultUnit: { ...ingredient.defaultUnit },
        unit: { ...ingredient.unit }
    }))

    entry.recipes = canonical.recipes.map(recipe => ({
        ...recipe,
        unit: { ...recipe.unit },
        instructions: [...recipe.instructions],
        ingredients: recipe.ingredients.map(ingredient => ({
            ...ingredient,
            defaultUnit: { ...ingredient.defaultUnit },
            unit: { ...ingredient.unit }
        }))
    }))
}

const sanitizeIngredientEntries = (entries: IngredientEntry[], ingredientsById: Map<number, Ingredient>): IngredientEntry[] => {
    const result: IngredientEntry[] = []

    for (const entry of entries) {
        const canonical = ingredientsById.get(entry.id)

        if (!canonical) continue

        syncIngredientEntry(entry, canonical)
        result.push(entry)
    }

    return result
}

const sanitizeRecipeEntries = (entries: RecipeEntry[], recipesById: Map<number, Recipe>, ingredientsById: Map<number, Ingredient>): RecipeEntry[] => {
    const result: RecipeEntry[] = []

    for (const entry of entries) {
        const canonical = recipesById.get(entry.id)

        if (!canonical) continue

        syncRecipeEntry(entry, canonical)

        entry.ingredients = sanitizeIngredientEntries(entry.ingredients, ingredientsById)

        result.push(entry)
    }

    return result
}

export const sanitizeState = (state: DBState): void => {
    const ingredientsById = new Map(state.ingredients.map(ingredient => [ingredient.id, ingredient]))
    const recipesById = new Map(state.recipes.map(recipe => [recipe.id, recipe]))
    const menusById = new Map(state.menus.map(menu => [menu.id, menu]))

    for (const recipe of state.recipes) {
        recipe.ingredients = sanitizeIngredientEntries(recipe.ingredients, ingredientsById)
    }

    for (const menu of state.menus) {
        menu.ingredients = sanitizeIngredientEntries(menu.ingredients, ingredientsById)
        menu.recipes = sanitizeRecipeEntries(menu.recipes, recipesById, ingredientsById)
    }

    for (const plan of state.plans) {
        for (const day of plan.daily) {
            for (const meal of meals) {
                const entry = day[meal]

                if (!entry) continue

                const canonicalMenu = menusById.get(entry.id)

                if (!canonicalMenu) {
                    day[meal] = null
                    continue
                }

                syncMenuEntry(entry, canonicalMenu)

                entry.ingredients = sanitizeIngredientEntries(entry.ingredients, ingredientsById)

                entry.recipes = sanitizeRecipeEntries(entry.recipes, recipesById, ingredientsById)
            }
        }
    }
}