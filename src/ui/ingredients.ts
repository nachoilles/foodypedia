import { Module } from "../core/module.js";
import { getUnitsFor, isQuantityUnit, isVolumeUnit, isWeightUnit, quantityUnits, unitFactors, volumeUnits, weightUnits } from "../core/units.js";
import { saveState } from "../db/db.js";
import { IdManager, isUserId } from "../db/id-manager.js";


type FiltersChangedCallback = () => void
type IngredientChangedCallback = (ingredient: Ingredient) => void
type RemoveIngredientCallback = () => void
type AddIngredientCallback = (name: string, unit: string) => Promise<void>
type ShowIngredientCallback = (ingredient: Ingredient | null) => void

type IngredientFiltersT = { name: string }


const ingredientListTemplate = `
<div id="ingredient-list-wrapper">
    <div id="ingredient-list-filters"></div>
    <div id="ingredient-list-data"></div>
</div>
`

const ingredientListCss = `
#ingredient-list-wrapper {
    padding: 0 1rem;
}

#ingredient-list-filters {
    padding-top: 0.5rem;
    position: sticky;
    top: 0;
    background-color: var(--bg-color, black);
}

#ingredient-list-data {
    margin-top: 0.5rem;
    overflow-y: auto;
    scrollbar-color: var(--def-color, green) transparent;
    scrollbar-width: thin;
}
`

export class IngredientList extends Module {
    #state: DBState
    #filters: IngredientFilters
    #idManager: IdManager
    #list: HTMLElement

    #onShowIngredient: ShowIngredientCallback

    constructor(parent: Element, state: DBState, onShowIngredient: ShowIngredientCallback) {
        super(parent, ingredientListTemplate, ingredientListCss)
        this.#state = state
        this.#idManager = new IdManager(state.ingredientIdManager)
        this.#onShowIngredient = onShowIngredient

        const ingredientListFiltersParent = document.getElementById("ingredient-list-filters")
        const ingredientList = document.getElementById("ingredient-list-data")
        
        if (
            !(ingredientListFiltersParent instanceof HTMLElement) || 
            !(ingredientList instanceof HTMLElement)
        ) throw new Error("Could not create IngredientList")

        this.#list = ingredientList

        this.#filters = new IngredientFilters(
            ingredientListFiltersParent,
            () => this.render(),
            (name, unit) => this.addIngredient(name, unit),
        )

        this.render()
    }

    async addIngredient(name: string, unit: string): Promise<void> {
        if (!isVolumeUnit(unit) && !isWeightUnit(unit) && !isQuantityUnit(unit))
            throw new Error(`Invalid unit: ${unit}`)

        const id = this.#idManager.allocateUser()

        const defaultUnit: Unit = {
            name: unit,
            factor: unitFactors[unit]
        } as Unit

        const ingredient: Ingredient = {
            id,
            name: name.trim(),
            defaultUnit
        }

        this.#state.ingredients.push(ingredient)
        this.#state.ingredientIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
        this.#onShowIngredient(ingredient)
    }

    async removeIngredient(id: number): Promise<void> {
        const index = this.#state.ingredients.findIndex(ingredient => ingredient.id === id)
        
        if (index === -1) return
        
        this.#idManager.deallocateUser(id)
        
        this.#state.ingredients.splice(index, 1)
        this.#state.ingredientIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
    }

    async updateIngredient(ingredient: Ingredient): Promise<void> {
        const ing = this.#state.ingredients.find(i => i.id === ingredient.id)

        if (!ing) return

        const trimmedName = ing.name.trim()
        if (!trimmedName) return

        ing.name = trimmedName
        ing.defaultUnit = ingredient.defaultUnit

        await saveState(this.#state)
        this.render()
    }

    render(): void {
        this.#list.replaceChildren()

        const filteredIngredients = this.#state.ingredients
            .filter(ingredient => ingredient.name.toLowerCase().includes(this.#filters.name.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))

        for (const ingredient of filteredIngredients) {
            if (!this.#state.settings.showDefIngredients && !isUserId(ingredient.id))
                continue;

            new IngredientListItem(
                this.#list, 
                ingredient, 
                ing => this.updateIngredient(ing),
                () => this.removeIngredient(ingredient.id),
                ing => this.#onShowIngredient(ing),
                ingredient.id >= this.#idManager.reservedLimit,
            )
        }
    }
}

const ingredientViewTemplate = `
<div id="ingredient-view-wrapper">
    <h1 id="ingredient-view-name"></h1>
    <div id="ingredient-view-unit-wrapper">
        <h2>DEFAULT UNIT:</h2>
        <select id="ingredient-view-unit" name="ingredient-unit"></select>
    </div>
</div>
`

const ingredientViewCss = `
#ingredient-view-wrapper {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    max-height: 90vh;
    overflow-y: auto;

    scrollbar-width: thin;
    scrollbar-color: var(--def-color, green) transparent;
}

#ingredient-view-wrapper[hidden] {
    display: none;
}

#ingredient-view-name {
    text-align: center;
    margin-bottom: 1rem;
}

#ingredient-view-unit-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
}

#ingredient-view-unit{
    min-width: 0;
    color: var(--low-color, #888);
    font-size: var(--l-fs, 1.4rem);
    -webkit-appearance: none;
    -moz-appearance: none;
}

#ingredient-view-unit > option {
    background-color: var(--bg-color, black);
    color: var(--def-color, green);
}
`

export class IngredientView extends Module {
    #state: DBState
    #ingredient: Ingredient | null = null
    #ingredientName: HTMLHeadingElement
    #defaultUnit: HTMLSelectElement

    constructor(parent: Element, state: DBState) {
        super(parent, ingredientViewTemplate, ingredientViewCss)
        this.#state = state

        const ingredientName = this.get<HTMLHeadingElement>("#ingredient-view-name")
        const rationsInput = this.get<HTMLSelectElement>("#ingredient-view-unit")

        this.#ingredientName = ingredientName
        this.#defaultUnit = rationsInput

        this.#defaultUnit.addEventListener("change", async () => {
            if (!this.#ingredient) return

            const unit = [
                ...volumeUnits,
                ...weightUnits,
                ...quantityUnits,
            ].find(unit => unit.name === this.#defaultUnit.value)

            if (!unit) return

            this.#ingredient.defaultUnit = { ...unit }

            await saveState(this.#state)
        })

        this.render()
    }

    set ingredient(ingredient: Ingredient | null) {
        this.#ingredient = ingredient

        this.render()
    }

    render(): void {
        this.getRootAs(HTMLElement).hidden = !this.#ingredient

        if (!this.#ingredient) return

        this.#ingredientName.innerText = this.#ingredient.name.toUpperCase()

        this.#populateUnits()

        this.#defaultUnit.value = this.#ingredient.defaultUnit.name
    }

    #populateUnits(): void {
        if (!this.#ingredient) return

        const units = getUnitsFor(this.#ingredient.defaultUnit)

        this.#defaultUnit.replaceChildren()

        for (const unit of units) {
            const option = document.createElement("option")
            option.value = unit.name
            option.textContent = unit.name
            this.#defaultUnit.append(option)
        }
    }
}

const ingredientFiltersTemplate = `
<form id="ingredient-list-filters-wrapper">
    <div id="ingredient-list-top-wrapper">
        <input
            id="ingredient-filter-name"
            name="name"
            type="search"
            placeholder="Search ingredient..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="button" id="new-ingredient-button">NEW</button>
    </div>
    <div id="ingredient-list-new-panel">
        <input
            id="new-ingredient-name"
            name="new-name"
            type="text"
            placeholder="Name..."
            autocomplete="off"
            spellcheck="false"
        />
        <select id="new-ingredient-unit" name="new-unit" required>
            <optgroup label="Volume" id="volume-unit-options"></optgroup>
            <optgroup label="Weight" id="weight-unit-options"></optgroup>
            <optgroup label="Quantity" id="quantity-unit-options"></optgroup>
        </select>
        <button type="submit" id="add-ingredient-button">ADD</button>
    </div>
</form>
`

const ingredientFiltersCss = `
#ingredient-list-filters-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
}

#ingredient-list-top-wrapper,
#ingredient-list-new-panel {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr))    
}

#ingredient-list-filters-wrapper #ingredient-filter-name {
    grid-column: span 4;
}
    
#ingredient-list-filters-wrapper #new-ingredient-button {
    grid-column: span 1;
}

#ingredient-list-new-panel[hidden] {
    display: none;
}

#ingredient-list-new-panel label,
#new-ingredient-unit,
#add-ingredient-button {
    grid-column: span 1;
    text-align: center;
}

#new-ingredient-name {
    grid-column: span 3;
}

#new-ingredient-unit {
    color: var(--low-color, #888);
}
 
#new-ingredient-unit option {
    background-color: var(--bg-color, black);
    color: var(--def-color, green);
}

#new-ingredient-unit optgroup {
    background-color: var(--bg-color, black);
    color: var(--low-color, #888);
}

/* Scrollbar track */
#new-ingredient-unit::-webkit-scrollbar {
    color: transparent;
    width: 8px;
}

/* Scrollbar background */
#new-ingredient-unit::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 8px;
}

/* Scrollbar thumb */
#new-ingredient-unit::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 8px;
}

/* Hover effect */
#new-ingredient-unit::-webkit-scrollbar-thumb:hover {
    background: var(--def-color, green);
}

/* Firefox scrollbar styling */
#new-ingredient-unit {
    scrollbar-width: thin;
    scrollbar-color: var(--def-color, green) transparent;
}
`

class IngredientFilters extends Module {
    #filters: IngredientFiltersT

    constructor(
        parent: Element, 
        onFiltersChanged: FiltersChangedCallback, 
        onAddIngredient: AddIngredientCallback
    ) {
        super(parent, ingredientFiltersTemplate, ingredientFiltersCss)

        this.#filters = { name: "" }

        const newIngredientPanel = this.parent.querySelector<HTMLElement>("#ingredient-list-new-panel")
        const searchInput = this.parent.querySelector<HTMLInputElement>("#ingredient-filter-name")
        const newButton = this.parent.querySelector<HTMLButtonElement>("#new-ingredient-button")
        const addButton = this.parent.querySelector<HTMLButtonElement>("#add-ingredient-button")
        const newIngredientName = this.parent.querySelector<HTMLInputElement>("#new-ingredient-name")
        const newIngredientUnit = this.parent.querySelector<HTMLSelectElement>("#new-ingredient-unit")
        const form = this.parent.querySelector<HTMLFormElement>("#ingredient-list-filters-wrapper")
        const volumeOptions = this.parent.querySelector<HTMLOptGroupElement>("#volume-unit-options")
        const weightOptions = this.parent.querySelector<HTMLOptGroupElement>("#weight-unit-options")
        const quantityOptions = this.parent.querySelector<HTMLOptGroupElement>("#quantity-unit-options")

        if (
            !newIngredientPanel || !searchInput || !newButton || !addButton || !newIngredientName ||
            !newIngredientUnit || !form || !volumeOptions || !weightOptions || !quantityOptions
        ) throw new Error("Could not create IngredientFilters")
        
        form.addEventListener("submit", async event => {
            event.preventDefault()

            const newName = newIngredientName.value.trim()
            const newUnit = newIngredientUnit.value

            if (!newName || !newUnit) return

            try {
                await onAddIngredient(newName, newUnit)

                newIngredientName.value = ""
                newIngredientUnit.selectedIndex = 0
                newIngredientPanel.hidden = true
            } catch (error) {
                console.warn("Failed to add ingredient:", error)
            }
        })

        newIngredientPanel.hidden = true

        for (const unit of volumeUnits) {
            const option = new Option(unit.name, unit.name)
            volumeOptions?.appendChild(option)
        }

        for (const unit of weightUnits) {
            const option = new Option(unit.name, unit.name)
            weightOptions?.appendChild(option)
        }

        for (const unit of quantityUnits) {
            const option = new Option(unit.name, unit.name)
            quantityOptions?.appendChild(option)
        }

        newIngredientUnit.selectedIndex = 0

        searchInput.addEventListener("input", () => {
            this.#filters.name = searchInput.value
            onFiltersChanged()
        })

        newButton.addEventListener("click", () => {
            newIngredientPanel.hidden = !newIngredientPanel.hidden
        })
    }

    get filters(): IngredientFiltersT {
        return this.#filters
    }

    get name(): string {
        return this.#filters.name
    }
}

const ingredientListItemTemplate = `
<div class="ingredient-list-item">
    <input
        class="ingredient-list-item-name"
        type="text"
        name="name"
        autocomplete="off"
        spellcheck="false"
    />
    <button type="button" class="remove-ingredient-button">x</button>
</div>
`

const ingredientListItemCss = `
.ingredient-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
}

.ingredient-list-item-name {
    flex: 1;
    min-width: 0;
    width: 0;

    background-color: var(--bg-color, black);
    color: var(--def-color, green);

    overflow-x: hidden;
    min-width: 0;
    cursor: default;
}

.remove-ingredient-button {
    margin-right: 0.5rem;
}
`

class IngredientListItem extends Module {
    #ingredient: Ingredient

    constructor(
        parent: Element, 
        ingredient: Ingredient, 
        onIngredientChanged: IngredientChangedCallback,
        onIngredientRemoved: RemoveIngredientCallback,
        onShowIngredient: ShowIngredientCallback,
        isUserIngredient: boolean = true
    ) {
        super(parent, ingredientListItemTemplate, ingredientListItemCss)
        this.#ingredient = ingredient

        const nameInput = this.get<HTMLInputElement>(".ingredient-list-item-name")
        const removeButton = this.get<HTMLButtonElement>(".remove-ingredient-button")

        nameInput.value = ingredient.name

        nameInput.addEventListener("click", () => onShowIngredient(this.#ingredient))

        nameInput.addEventListener("dblclick", () => {
            nameInput.readOnly = false;
            nameInput.style.cursor = "text"
            nameInput.focus()
            nameInput.select()            
        })
        
        nameInput.addEventListener("blur", () => {
            nameInput.readOnly = true
            nameInput.style.cursor = "default"
        })
        
        nameInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                nameInput.blur()
            }

            if (event.key === "Escape") {
                nameInput.value = this.#ingredient.name
                nameInput.blur()
            }
        })

        nameInput.addEventListener("change", () => {
            const name = nameInput.value.trim()

            if (!name) {
                nameInput.value = this.#ingredient.name
                return
            }

            this.#ingredient.name = name
            onIngredientChanged(this.#ingredient)
            onShowIngredient(this.#ingredient)
        })

        removeButton.hidden = !isUserIngredient

        removeButton.addEventListener("click", () => {
            onIngredientRemoved()
            onShowIngredient(null)
        })
    }
}
