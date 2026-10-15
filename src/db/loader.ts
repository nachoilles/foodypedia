import { quantityUnits, UnitName, volumeUnits, weightUnits } from "../core/units.js"
import { saveState } from "./db.js"
import { IdManager } from "./id-manager.js"

export const importIngredientsCsv = async (file: File, state: DBState): Promise<number> => {
    const text = (await file.text()).replace(/^\uFEFF/, "")
    const rows = parseCsv(text)

    if (rows.length < 2)
        throw new Error("The CSV contains no ingredients.")

    const headers = rows[0].map(header => header.trim().toLowerCase())

    const nameIndex = headers.indexOf("name")
    const unitIndex = headers.indexOf("defaultunit")

    if (nameIndex === -1 || unitIndex === -1)
        throw new Error('CSV must contain "name" and "defaultUnit" columns.')

    const supportedUnits: Unit[] = [...volumeUnits, ...weightUnits, ...quantityUnits]

    const unitsByName = new Map(supportedUnits.map(unit => [unit.name, unit]))

    const existingNames = new Set(state.ingredients.map(ingredient =>ingredient.name.trim().toLowerCase()))
    const previousIdManagerState = structuredClone(state.ingredientIdManager)

    const idManager = new IdManager(state.ingredientIdManager)
    const added: Ingredient[] = []

    for (const [index, row] of rows.slice(1).entries()) {
        if (row.every(value => !value.trim())) continue

        const name = row[nameIndex]?.trim()
        const unitName = row[unitIndex]?.trim().toLowerCase()

        if (!name || !unitName)
            throw new Error(`Missing name or defaultUnit on CSV row ${index + 2}.`)

        if (existingNames.has(name.toLowerCase()))
            continue

        const unit = unitsByName.get(unitName as Exclude<UnitName, "ration">)

        if (!unit)
            throw new Error(`Unsupported unit "${unitName}" on CSV row ${index + 2}.`)

        added.push({id: idManager.allocateBuiltin(), name, defaultUnit: { ...unit }})

        existingNames.add(name.toLowerCase())
    }

    if (added.length === 0) {
        return 0
    }

    state.ingredients.push(...added)
    state.ingredientIdManager = idManager.serialize()

    try {
        await saveState(state)
    } catch (error) {
        const addedIds = new Set(added.map(ingredient => ingredient.id))
        state.ingredients = state.ingredients.filter(ingredient => !addedIds.has(ingredient.id))

        state.ingredientIdManager = previousIdManagerState

        throw error
    }

    return added.length
}

const parseCsv = (text: string): string[][] => {
    const rows: string[][] = []
    let row: string[] = []
    let field = ""
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
        const char = text[i]

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"'
                    i++
                } else {
                    inQuotes = false
                }
            } else {
                field += char
            }
            continue
        }

        if (char === '"' && field.length === 0) {
            inQuotes = true
        } else if (char === ",") {
            row.push(field)
            field = ""
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[i + 1] === "\n") i++

            row.push(field)
            rows.push(row)
            row = []
            field = ""
        } else {
            field += char
        }
    }

    if (inQuotes)
        throw new Error("The CSV contains an unclosed quoted field.")

    if (field.length > 0 || row.length > 0) {
        row.push(field)
        rows.push(row)
    }

    return rows
}
