import { Module } from "../core/module.js";
import { getUnitsFor, isQuantityUnit } from "../core/units.js";
import { saveState } from "../db/db.js";
import { IdManager } from "../db/id-manager.js";


type FiltersChangedCallback = () => void
type RecipeChangedCallback = (recipe: Recipe) => void
type RemoveRecipeCallback = () => void
type AddRecipeCallback = (recipe: Omit<Recipe, "id">) => Promise<void>
type ShowRecipeCallback = (recipe: Recipe | null) => void
type IngredientSelectedCallback = (entry: IngredientEntry) => void
type InstructionAddedCallback = (instruction: string) => void
type IngredientChangedCallback = (ingredient: IngredientEntry) => void
type IngredientRemovedCallback = () => void
type InstructionChangedCallback = (instruction: string) => void
type InstructionRemovedCallback = () => void

type RecipeFiltersT = {
    name: string
    ingredients: Ingredient[]
}

const recipeListTemplate = `
<div id="recipe-list-wrapper">
    <div id="recipe-list-filters"></div>
    <div id="recipe-list-data"></div>
</div>
`

const recipeListCss = `
#recipe-list-wrapper {
    padding: 0.5rem 1rem;
}

#recipe-list-data {
    margin-top: 0.5rem;
    max-height: 30vh;
    overflow-y: auto;
    scrollbar-color: var(--def-color, green) transparent;
    scrollbar-width: thin;
}
`

export class RecipeList extends Module {
    #state: DBState
    #filters: RecipeFilters
    #list: HTMLDivElement
    #idManager: IdManager

    #onShowRecipe: ShowRecipeCallback

    constructor(
        parent: Element, 
        state: DBState,
        onShowRecipe: ShowRecipeCallback,
    ) {
        super(parent, recipeListTemplate, recipeListCss)
        this.#state = state
        this.#idManager = new IdManager(state.recipeIdManager)
        this.#onShowRecipe = onShowRecipe

        const filterParent = document.getElementById("recipe-list-filters")
        const recipeList = document.getElementById("recipe-list-data")

        if (
            !(filterParent instanceof HTMLDivElement) ||
            !(recipeList instanceof HTMLDivElement)
        ) throw new Error("Could not find element with id #recipe-list-filters")

        this.#list = recipeList

        this.#filters = new RecipeFilters(
            filterParent, 
            state, 
            () => this.render(),
            recipe => this.addRecipe(recipe),
        )

        this.render()
    }

    async addRecipe(recipe: Omit<Recipe, "id">): Promise<void> {
        const id = this.#idManager.allocateUser()

        const newRecipe: Recipe = {
            id,
            ...recipe
        }

        this.#state.recipes.push(newRecipe)
        this.#state.recipeIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
        this.#onShowRecipe(newRecipe)
    }

    async removeRecipe(id: number): Promise<void> {
        const index = this.#state.recipes.findIndex(recipe => recipe.id === id)
        
        if (index === -1) return

        this.#idManager.deallocateUser(id)

        this.#state.recipes.splice(index, 1)
        this.#state.recipeIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
    }

    async updateRecipe(recipe: Recipe): Promise<void> {
        const storedRecipe = this.#state.recipes.find(
            r => r.id === recipe.id
        )

        if (!storedRecipe) return

        storedRecipe.name = recipe.name
        storedRecipe.ingredients = recipe.ingredients
        storedRecipe.instructions = recipe.instructions
        storedRecipe.rations = recipe.rations

        await saveState(this.#state)

        this.render()
    }

    render(): void {
        this.#list.replaceChildren()

        const filteredRecipes = this.#state.recipes
            .filter(
                r =>
                    r.name.toLowerCase().includes(this.#filters.name.toLowerCase()) &&
                    this.#filters.ingredients.every(ing => r.ingredients.some(i => i.id === ing.id)))
            .sort((a, b) => a.name.localeCompare(b.name))

        for (const recipe of filteredRecipes) {
            new RecipeListItem(
                this.#list,
                recipe,
                r => this.updateRecipe(r),
                () => this.removeRecipe(recipe.id),
                r => this.#onShowRecipe(r),
                recipe.id >= this.#idManager.reservedLimit,
            )
        }
    }
}

const recipeViewTemplate = `
<div id="recipe-view-wrapper">
    <h1 id="recipe-view-name"></h1>
    <div id="recipe-view-rations-wrapper">
        <h2>RATIONS:</h2>
        <input 
            id="recipe-view-rations"
            name="recipe-rations"
            type="number"
            min="1"
            step="1"
        />
    </div>
    <h2>INGREDIENTS:</h2>
    <div id="recipe-view-ingredient-list"></div>
    <h2>INSTRUCTIONS:</h2>
    <div id="recipe-view-instruction-list"></div>
</div>
`

const recipeViewCss = `
#recipe-view-wrapper {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    max-height: 90vh;
    overflow-y: auto;

    scrollbar-width: thin;
    scrollbar-color: var(--def-color, green) transparent;
}

#recipe-view-wrapper[hidden] {
    display: none;
}

#recipe-view-name {
    text-align: center;
    margin-bottom: 1rem;
}

#recipe-view-rations-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
}

#recipe-view-rations-wrapper input{
    min-width: 0;
    color: var(--low-color, #888);
    font-size: var(--l-fs, 1.4rem);
}

/* Chrome, Safari, Edge, Opera */
#recipe-view-rations::-webkit-inner-spin-button,
#recipe-view-rations::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Firefox */
#recipe-view-rations {
    -moz-appearance: textfield;
    appearance: textfield;
}

#recipe-view-ingredient-list,
#recipe-view-instruction-list {
    margin-left: 1rem;
}

.recipe-ingredient-row,
.recipe-instruction-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.recipe-ingredient-row {
    flex-wrap: wrap;
}

.recipe-ingredient-quantity {
    width: 5rem;
}

.recipe-ingredient-unit {
    min-width: 5rem;
}

.recipe-instruction-input {
    flex: 1;
    min-width: 0;
    min-height: 3rem;
    resize: vertical;
}

.recipe-remove-button {
    flex-shrink: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
}
`

export class RecipeView extends Module {
    #state: DBState
    #recipe: Recipe | null = null
    #recipeName: HTMLHeadingElement
    #rations: HTMLInputElement

    constructor(parent: Element, state: DBState) {
        super(parent, recipeViewTemplate, recipeViewCss)
        this.#state = state

        const recipeName = this.root.querySelector<HTMLHeadingElement>("#recipe-view-name")
        const rationsInput = this.root.querySelector<HTMLInputElement>("#recipe-view-rations")
        const recipeIngredientListParent = this.root.querySelector<HTMLDivElement>("#recipe-view-ingredient-list")
        const recipeInstructionListParent = this.root.querySelector<HTMLDivElement>("#recipe-view-instruction-list")

        if (!rationsInput || !recipeName ||  !recipeIngredientListParent || !recipeInstructionListParent)
            throw new Error("Could not create RecipeView")

        this.#recipeName = recipeName
        this.#rations = rationsInput

        this.#rations.addEventListener("change", async() => {
            if (!this.#recipe) return

            const value = this.#rations.valueAsNumber

            if (!Number.isInteger(value) || value < 1) {
                this.#rations.value = String(this.#recipe.rations)
                return
            }

            this.#recipe.rations = value

            await saveState(this.#state)
        })

        this.render()
    }

    set recipe(recipe: Recipe | null) {
        this.#recipe = recipe

        this.render()
    }

    render(): void {
        this.getRootAs(HTMLElement).hidden = !this.#recipe

        if (!this.#recipe) return

        this.#recipeName.innerText = this.#recipe.name.toUpperCase()
        this.#rations.value = this.#recipe.rations.toString()
        
        const ingredientList = this.get<HTMLDivElement>("#recipe-view-ingredient-list")
        const instructionList = this.get<HTMLDivElement>("#recipe-view-instruction-list")

        ingredientList.replaceChildren()
        instructionList.replaceChildren()

        this.#recipe.ingredients.forEach((ingredient, index) => {
            new RecipeViewIngredientListItem(
                ingredientList,
                this.#state,
                ingredient,
                async ing => {
                    if (!this.#recipe) return
                    this.#recipe.ingredients[index] = ing
                    await saveState(this.#state)
                },
                async () => {
                    if (!this.#recipe) return
                    this.#recipe.ingredients.splice(index, 1)
                    await saveState(this.#state)
                    this.render()
                }
            )
        })

        const addIngredientButton = document.createElement("button")
        addIngredientButton.type = "button"
        addIngredientButton.textContent = "ADD"
        addIngredientButton.addEventListener("click", () => {
            if (!this.#recipe) return

            if (ingredientList.querySelector(".recipe-ingredient-picker")) return

            new IngredientPicker(
                ingredientList,
                this.#state,
                async it => {
                    if (!this.#recipe) return

                    this.#recipe.ingredients.push(it)

                    await saveState(this.#state)

                    this.render()
                }
            )
        })
        ingredientList.append(addIngredientButton)

        this.#recipe.instructions.forEach((instruction, index) => {
            new RecipeViewInstructionListItem(
                instructionList,
                instruction,
                index,
                async updatedInstruction => {
                    if (!this.#recipe) return
                    this.#recipe.instructions[index] = updatedInstruction
                    await saveState(this.#state)
                },
                async () => {
                    if (!this.#recipe) return
                    this.#recipe.instructions.splice(index, 1)
                    await saveState(this.#state)
                    this.render()
                }
            )
        })

        const addInstructionButton = document.createElement("button")
        addInstructionButton.type = "button"
        addInstructionButton.textContent = "ADD"
        addInstructionButton.addEventListener("click", () => {
            if (!this.#recipe) return

            if (instructionList.querySelector(".instruction-editor")) return

            new InstructionEditor(
                instructionList,
                instruction => {
                    if (!this.#recipe) return

                    this.#recipe.instructions.push(instruction)
                    this.render()
                }
            )
        })
        instructionList.append(addInstructionButton)
    }
}

const recipeFiltersTemplate = `
<form id="recipe-list-filters-wrapper">
    <div id="recipe-list-top-wrapper">
        <input
            id="recipe-filter-name"
            name="name"
            type="search"
            placeholder="Search recipe..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="button" id="new-recipe-button">NEW</button>
    </div>

    <div id="new-recipe-wrapper">
        <input
            id="new-recipe-name"
            name="new-name"
            type="text"
            placeholder="Name..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="submit" id="add-recipe-button">ADD</button>
    </div>
        
    <div id="filter-ingredients-top-wrapper">
        <input
            id="filter-ingredient-search"
            name="ingredient-name"
            type="search"
            placeholder="Find ingredient..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="button" id="recipe-list-toggle-advanced">FILTER</button>
    </div>

    <div id="recipe-list-advanced-filters-panel">
        <div id="filter-ingredients-wrapper">
            <div id="filter-ingredient-options"></div>
            <div id="filter-selected-ingredients"></div>
        </div>
        <button type="reset">CLEAR</button>
    </div>
</form>
`

const recipeFiltersCss = `
#recipe-list-filters-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
}

#new-recipe-wrapper,
#recipe-list-top-wrapper {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
}

#new-recipe-wrapper[hidden] {
    display: none;
}

#recipe-filter-name {
    grid-column: span 4;
}

#new-recipe-button {
    grid-column: span 1;
    text-align: right;
}

#new-recipe-name {
    grid-column: span 4;
}

#add-recipe-button {
    grid-column: span 1;
    text-align: right;
}

#filter-ingredients-top-wrapper {
    display: flex;
    justify-content: flex-end;
}

#filter-ingredient-search {
    min-width: 0;
}

#filter-ingredient-search[hidden] {
    display: none;
}

#recipe-list-advanced-filters-panel {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-end;
}

#recipe-list-advanced-filters-panel[hidden] {
    display: none;
}

#filter-ingredients-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

#filter-ingredient-options {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.ingredient-option {
    text-align: left;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
}

#filter-selected-ingredients {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.ingredient-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.3rem;
    border: 1px solid green;
}

.ingredient-chip button {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
}
`

class RecipeFilters extends Module {
    #state: DBState
    #filters: RecipeFiltersT
    #ingredientInput: HTMLInputElement

    #onFiltersChanged: FiltersChangedCallback

    constructor(
        parent: Element, 
        state: DBState,
        onFiltersChanged: FiltersChangedCallback,
        onAddRecipe: AddRecipeCallback,
    ) {
        super(parent, recipeFiltersTemplate, recipeFiltersCss)
        this.#state = state
        this.#onFiltersChanged = onFiltersChanged

        this.#filters = { name: "", ingredients: [] }

        const newRecipeButton = this.get<HTMLButtonElement>("#new-recipe-button")
        const newRecipePanel = this.get<HTMLDivElement>("#new-recipe-wrapper")
        const newRecipeName = this.get<HTMLInputElement>("#new-recipe-name")
        const advancedFiltersButton = this.get<HTMLButtonElement>("#recipe-list-toggle-advanced")
        const advancedFiltersPanel = this.get<HTMLDivElement>("#recipe-list-advanced-filters-panel")
        const nameInput = this.get<HTMLInputElement>("#recipe-filter-name")
        const ingredientSearch = this.get<HTMLInputElement>("#filter-ingredient-search")
        const form = this.parent.querySelector<HTMLFormElement>("#recipe-list-filters-wrapper")

        if (!form)
            throw new Error("Missing element: #recipe-list-filters-wrapper")

        form.addEventListener("submit", async event => {
            event.preventDefault()

            const newName = newRecipeName.value.trim()

            if (!newName) return

            const newRecipe: Omit<Recipe, "id"> = {
                name: newName,
                rations: 1,
                ingredients: [],
                instructions: [],
            }

            try {
                await onAddRecipe(newRecipe)

                newRecipeName.value = ""
                newRecipePanel.hidden = true
            } catch (error) {
                console.warn("Failed to add ingredient: ", error)
            }
        })

        newRecipePanel.hidden = true
        advancedFiltersPanel.hidden = true
        ingredientSearch.hidden = true

        this.#ingredientInput = ingredientSearch


        newRecipeButton.addEventListener("click", () => newRecipePanel.hidden = !newRecipePanel.hidden)
        advancedFiltersButton.addEventListener("click", () => {
            advancedFiltersPanel.hidden = !advancedFiltersPanel.hidden
            ingredientSearch.hidden = !ingredientSearch.hidden
        })

        nameInput.addEventListener("input", () => {
            this.#filters.name = nameInput.value
            onFiltersChanged()
        })

        this.#ingredientInput.addEventListener("input", () => this.renderIngredientOptions())

        form.addEventListener("reset", () => {
            queueMicrotask(() => {
                this.#filters.name = ""
                this.#filters.ingredients = []

                this.render()
                onFiltersChanged()
            })
        })

        this.render()
    }

    get filters() {
        return this.#filters
    }

    get name() {
        return this.#filters.name
    }

    get ingredients() {
        return this.#filters.ingredients
    }

    renderIngredientOptions(): void {
        const options = this.parent.querySelector<HTMLDivElement>("#filter-ingredient-options")
        const search = this.#ingredientInput.value

        if (!options) return

        options.replaceChildren()

        if (!search.trim()) {
            options.hidden = true
            return
        }

        const selectedIds = new Set(this.#filters.ingredients.map(i => i.id))

        const ingredients = this.#state.ingredients.filter(
            ingredient =>
                ingredient.name.toLowerCase().includes(search.toLowerCase()) &&
                !selectedIds.has(ingredient.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 3)

        for (const ingredient of ingredients) {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "ingredient-option"
            button.textContent = ingredient.name

            button.addEventListener("click", () => {
                this.#filters.ingredients.push(ingredient)
                this.#ingredientInput.value = ""
                this.render()
                this.#onFiltersChanged()
            })

            options.append(button)
        }
    }

    renderSelectedIngredients(): void {
        const container = this.root.querySelector("#filter-selected-ingredients")

        if (!container) return

        container.replaceChildren()

        for (const ingredient of this.#filters.ingredients) {
            const chip = document.createElement("span")
            chip.className = "ingredient-chip"

            const name = document.createElement("span")
            name.textContent = ingredient.name

            const removeButton = document.createElement("button")
            removeButton.type = "button"
            removeButton.textContent = "x"
            removeButton.setAttribute("aria-label", `Remove ${ingredient.name}`)

            removeButton.addEventListener("click", () => {
                this.#filters.ingredients = this.#filters.ingredients
                    .filter(i => i.id !== ingredient.id)

                this.render()
                this.#onFiltersChanged()
            })

            chip.append(name, removeButton)
            container.append(chip)
        }
    }

    render(): void {
        this.renderIngredientOptions()
        this.renderSelectedIngredients()
    }
}

const recipeListItemTemplate = `
<div class="recipe-list-item">
    <input
        class="recipe-list-item-name"
        type="text"
        name="name"
        autocomplete="off"
        spellcheck="false"
    />
    <button type="button" class="remove-recipe-button">x</button>
</div>
`

const recipeListItemCss = `
.recipe-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
}

.recipe-list-item-name {
    flex: 1;
    min-width: 0;
    width: 0;

    background-color: var(--bg-color, black);
    color: var(--def-color, green);

    overflow-x: hidden;
    cursor: default;
}

.remove-recipe-button {
    margin-right: 0.5rem;
}
`

class RecipeListItem extends Module {
    #recipe: Recipe

    constructor(
        parent: Element, 
        recipe: Recipe,
        onRecipeChanged: RecipeChangedCallback,
        onRecipeRemoved: RemoveRecipeCallback,
        onShowRecipe: ShowRecipeCallback,
        isUserRecipe: boolean = true
    ) {
        super(parent, recipeListItemTemplate, recipeListItemCss)
        this.#recipe = recipe

        const nameInput = this.root.querySelector(".recipe-list-item-name")
        const removeButton = this.root.querySelector(".remove-recipe-button")

        if (
            !(nameInput instanceof HTMLInputElement) ||
            !(removeButton instanceof HTMLButtonElement)
        ) throw new Error("Could not create RecipeListItem")

        nameInput.value = recipe.name
        nameInput.readOnly = true
        nameInput.style.cursor = "default"

        nameInput.addEventListener("click", () => onShowRecipe(this.#recipe))

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
                nameInput.value = this.#recipe.name
                nameInput.blur()
            }
        })

        nameInput.addEventListener("change", () => {
            const name = nameInput.value.trim()

            if (!name) {
                nameInput.value = this.#recipe.name
                return
            }

            this.#recipe.name = name
            onRecipeChanged(this.#recipe)
            onShowRecipe(this.#recipe)
        })

        removeButton.hidden = !isUserRecipe

        removeButton.addEventListener("click", () => {
            onRecipeRemoved()
            onShowRecipe(null)
        })
    }
}

const ingredientPickerTemplate = `
<form class="recipe-ingredient-picker">
    <div class="ingredient-picker-search-wrapper">
        <input
            class="ingredient-picker-search"
            name="ingredient-name"
            type="search"
            placeholder="Search ingredients..."
            autocomplete="off"
            spellcheck="false"
        />
        <div class="recipe-ingredient-options"></div>
    </div>

    <div class="ingredient-entry-editor" hidden>
        <label>
            Amount
            <input
                class="ingredient-entry-quantity"
                name="ingredient-quantity"
                type="number"
                min="0"
                step="any"
                value="1"
            />
        </label>

        <label>
            Unit
            <select 
                class="ingredient-entry-unit"
                name="ingredient-unit"
            ></select>
        </label>

        <div class="ingredient-entry-actions">
            <button type="submit" class="ingredient-entry-confirm">
                ADD
            </button>
            <button type="button" class="ingredient-entry-cancel">
                CANCEL
            </button>
        </div>
    </div>
</form>
`

const ingredientPickerCss = `
.recipe-ingredient-picker {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
}

.ingredient-picker-search-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1 1 0;
    min-width: 0;
}

.ingredient-picker-search {
    min-width: 0;
}

.recipe-ingredient-options {
    display: flex;
    flex-direction: column;
    max-height: 10rem;
    overflow-y: auto;
    min-width: 0;
}

.recipe-ingredient-options:empty {
    display: none;
}

.recipe-ingredient-options button {
    cursor: pointer;
    text-align: left;
}

.ingredient-entry-editor {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex: 0 1 auto;
    min-width: 0;
}

.ingredient-entry-editor label {
    min-width: 0;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.ingredient-entry-editor label > * {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
}

.ingredient-entry-quantity {
    max-width: 100%;
    flex: 0 1 6rem;
}
    
.ingredient-entry-editor select,
.ingredient-entry-editor input {
    color: var(--low-color, #888);
}

.ingredient-entry-editor option {
    background-color: var(--bg-color, black);
    color: var(--def-color, green);
}

.ingredient-entry-editor[hidden] {
    display: none;
}

.ingredient-entry-editor label {
    min-width: 0;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

/* Chrome, Safari, Edge, Opera */
.ingredient-entry-quantity::-webkit-inner-spin-button,
.ingredient-entry-quantity::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Firefox */
.ingredient-entry-quantity {
    -moz-appearance: textfield;
    appearance: textfield;
}

.ingredient-entry-actions {
    display: flex;
    gap: 0.5rem;
}
`

class IngredientPicker extends Module {
    #state: DBState
    #selectedIngredient: Ingredient | null = null
    #onSelected: IngredientSelectedCallback

    constructor(
        parent: Element,
        state: DBState,
        onSelected: IngredientSelectedCallback
    ) {
        super(parent, ingredientPickerTemplate, ingredientPickerCss)

        this.#state = state
        this.#onSelected = onSelected

        const form = this.parent.querySelector<HTMLFormElement>(".recipe-ingredient-picker")
        const search = this.root.querySelector<HTMLInputElement>(".ingredient-picker-search")
        const quantity = this.root.querySelector<HTMLInputElement>(".ingredient-entry-quantity")
        const unitSelect = this.root.querySelector<HTMLSelectElement>(".ingredient-entry-unit")
        const editor = this.root.querySelector<HTMLDivElement>(".ingredient-entry-editor")
        const cancelButton = this.root.querySelector<HTMLButtonElement>(".ingredient-entry-cancel")

        if (!form || !search || !quantity || !unitSelect || !editor || !cancelButton)
            throw new Error("Could not create IngredientPicker")

        search.addEventListener("input", () => {
            this.#selectedIngredient = null
            editor.hidden = true
            this.renderOptions(search)
        })

        form.addEventListener("submit", event => {
            event.preventDefault()

            const ingredient = this.#selectedIngredient
            const amount = quantity.valueAsNumber

            if (!ingredient || !Number.isFinite(amount) || amount <= 0) {
                quantity.focus()
                return
            }

            const selectedUnit = this.#getSelectedUnit(unitSelect)
            if (!selectedUnit) {
                unitSelect.focus()
                return
            }

            const entry: IngredientEntry = {
                ...ingredient,
                quantity: amount,
                unit: selectedUnit,
            }

            this.#onSelected(entry)
            this.root.remove()
        })

        cancelButton.addEventListener("click", () => this.root.remove())

        search.focus()
    }

    renderOptions(search: HTMLInputElement): void {
        const options = this.root.querySelector<HTMLDivElement>(".recipe-ingredient-options")

        if (!options)
            throw new Error("Could not render IngredientPicker options")

        options.replaceChildren()

        const query = search.value.trim().toLowerCase()

        if (!query) return

        const matches = this.#state.ingredients
            .filter(ingredient => ingredient.name.toLowerCase().includes(query))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 3)

        for (const ingredient of matches) {
            const button = document.createElement("button")
            button.type = "button"
            button.textContent = ingredient.name

            button.addEventListener("click", () => this.#selectIngredient(ingredient))

            options.append(button)
        }
    }

    #selectIngredient(ingredient: Ingredient): void {
        const quantity = this.root.querySelector<HTMLInputElement>(".ingredient-entry-quantity")
        const unitSelect = this.root.querySelector<HTMLSelectElement>(".ingredient-entry-unit")
        const editor = this.root.querySelector<HTMLDivElement>(".ingredient-entry-editor")
        const search = this.root.querySelector<HTMLInputElement>(".ingredient-picker-search")
        const options = this.root.querySelector<HTMLDivElement>(".recipe-ingredient-options")

        if (!quantity || !unitSelect || !editor || !search || !options) {
            throw new Error("Could not select ingredient")
        }

        this.#selectedIngredient = ingredient

        search.value = ingredient.name
        options.replaceChildren()

        quantity.value = "1"

        const availableUnits = getUnitsFor(ingredient.defaultUnit) as Unit[]

        unitSelect.replaceChildren()

        for (const unit of availableUnits) {
            const option = document.createElement("option")
            option.value = unit.name
            option.textContent = unit.name
            option.selected = unit.name === ingredient.defaultUnit.name
            unitSelect.append(option)
        }

        editor.hidden = false
        quantity.focus()
    }

    #getSelectedUnit(select: HTMLSelectElement): Unit | null {
        const selectedName = select.value

        const units = this.#selectedIngredient && getUnitsFor(this.#selectedIngredient.defaultUnit) as Unit[] | null

        return units?.find(unit => unit.name === selectedName) ?? null
    }
}

const instructionEditorTemplate = `
<div class="instruction-editor">
    <textarea
        class="instruction-editor-input"
        placeholder="Write an instruction..."
    ></textarea>
    <div class="instruction-editor-actions">
        <button type="button" class="instruction-editor-add">ADD</button>
        <button type="button" class="instruction-editor-cancel">CANCEL</button>
    </div>
</div>
`

const instructionEditorCss = `
.instruction-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.instruction-editor-input {
    box-sizing: border-box;
    width: 100%;
    min-height: 5rem;
    resize: none;
}

.instruction-editor-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}
`

class InstructionEditor extends Module {
    constructor(
        parent: Element,
        onAdded: InstructionAddedCallback
    ) {
        super(parent, instructionEditorTemplate, instructionEditorCss)

        const input = this.root.querySelector<HTMLTextAreaElement>(".instruction-editor-input")
        const addButton = this.root.querySelector<HTMLButtonElement>(".instruction-editor-add")
        const cancelButton = this.root.querySelector<HTMLButtonElement>(".instruction-editor-cancel")

        if (!input || !addButton || !cancelButton)
            throw new Error("Could not create InstructionEditor")

        addButton.addEventListener("click", () => {
            const instruction = input.value.trim()
            if (!instruction) {
                input.focus()
                return
            }

            onAdded(instruction)
            this.root.remove()
        })

        cancelButton.addEventListener("click", () => this.root.remove())

        input.focus()
    }
}

const recipeViewIngredientListItemTemplate = `
<div class="recipe-view-ingredient-row">
    <button
        type="button"
        class="recipe-view-ingredient-remove"
        aria-label="Remove ingredient"
    >x</button>
    <div class="recipe-view-ingredient-amount">
        <input
            class="recipe-view-ingredient-quantity"
            type="number"
            min="0.001"
            step="any"
            aria-label="Ingredient quantity"
        />
        <select
            class="recipe-view-ingredient-unit"
            aria-label="Ingredient unit"
        ></select>
    </div>
    <span class="recipe-view-ingredient-name"></span>
</div>
`

const recipeViewIngredientListItemCss = `
.recipe-view-ingredient-row {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    min-width: 0;
}

.recipe-view-ingredient-row button {
    grid-column: span 1;
}

.recipe-view-ingredient-amount {
    grid-column: span 2;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
}

.recipe-view-ingredient-row input,
.recipe-view-ingredient-row select {
    color: var(--low-color, #888);
}

.recipe-view-ingredient-row option {
    background-color: var(--bg-color, black);
    color: var(--def-color, green);
}

.recipe-view-ingredient-quantity {
    max-width: 3rem;
    text-align: right;
}

/* Chrome, Safari, Edge, Opera */
.recipe-view-ingredient-quantity::-webkit-inner-spin-button,
.recipe-view-ingredient-quantity::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Firefox */
.recipe-view-ingredient-quantity {
    -moz-appearance: textfield;
    appearance: textfield;
}

.recipe-view-ingredient-name {
    grid-column: span 5;
    min-width: 0;
    overflow-wrap: anywhere;
}

.recipe-view-ingredient-name::before {
    content: "of ";
}

.recipe-view-ingredient-remove {
    flex-shrink: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
}
`

class RecipeViewIngredientListItem extends Module {
    constructor(
        parent: Element,
        state: DBState,
        ingredient: IngredientEntry,
        onChanged: IngredientChangedCallback,
        onRemoved: IngredientRemovedCallback
    ) {
        super(parent, recipeViewIngredientListItemTemplate, recipeViewIngredientListItemCss)

        const currentIngredient = state.ingredients.find(ing => ing.id === ingredient.id)
        const { unit, quantity, ...rawIngredient } = ingredient

        const isObsolete = !currentIngredient || JSON.stringify(currentIngredient) !== JSON.stringify(rawIngredient)

        const quantityInput = this.root.querySelector<HTMLInputElement>(".recipe-view-ingredient-quantity")
        const unitSelect = this.root.querySelector<HTMLSelectElement>(".recipe-view-ingredient-unit")
        const name = this.root.querySelector<HTMLSpanElement>(".recipe-view-ingredient-name")
        const removeButton = this.root.querySelector<HTMLButtonElement>(".recipe-view-ingredient-remove")

        if (!quantityInput || !unitSelect || !name || !removeButton) {
            throw new Error("Could not create RecipeViewIngredientListItem")
        }

        name.textContent = ingredient.name
        if (isObsolete) name.style.textDecoration = "line-through"
        quantityInput.value = String(ingredient.quantity)
        quantityInput.setAttribute("aria-label", `Quantity of ${ingredient.name}`)
        removeButton.setAttribute("aria-label", `Remove ${ingredient.name}`)

        const units = getUnitsFor(ingredient.unit)

        for (const unit of units) {
            const option = document.createElement("option")
            option.value = unit.name
            option.textContent = unit.name
            option.selected = unit.name === ingredient.unit.name
            unitSelect.append(option)
        }

        quantityInput.addEventListener("change", () => {
            const quantity = quantityInput.valueAsNumber

            if (!Number.isFinite(quantity) || quantity <= 0) {
                quantityInput.value = String(ingredient.quantity)
                return
            }

            ingredient.quantity = quantity
            onChanged(ingredient)
        })

        unitSelect.addEventListener("change", () => {
            const unit = units.find(candidate => candidate.name === unitSelect.value)
            if (!unit) return

            ingredient.unit = unit as Unit
            onChanged(ingredient)
        })

        removeButton.addEventListener("click", () => onRemoved())
    }
}

const recipeViewInstructionListItemTemplate = `
<div class="recipe-view-instruction-row">
    <textarea
        class="recipe-view-instruction-input"
        aria-label="Recipe instruction"
    ></textarea>
    <button
        type="button"
        class="recipe-view-instruction-remove"
        aria-label="Remove instruction"
    >x</button>
</div>
`

const recipeViewInstructionListItemCss = `
.recipe-view-instruction-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.recipe-view-instruction-input {
    flex: 1;
    min-width: 0;
    min-height: 3rem;
    resize: none;
    border-bottom: 2px solid var(--def-color, green);
}

.recipe-view-instruction-remove {
    flex-shrink: 0;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
}
`

class RecipeViewInstructionListItem extends Module {
    constructor(
        parent: Element,
        instruction: string,
        index: number,
        onChanged: InstructionChangedCallback,
        onRemoved: InstructionRemovedCallback
    ) {
        super(parent, recipeViewInstructionListItemTemplate, recipeViewInstructionListItemCss)

        const input = this.root.querySelector<HTMLTextAreaElement>(".recipe-view-instruction-input")
        const removeButton = this.root.querySelector<HTMLButtonElement>(".recipe-view-instruction-remove")

        if (!input || !removeButton) {
            throw new Error("Could not create RecipeViewInstructionListItem")
        }

        input.value = instruction
        input.setAttribute("aria-label", `Instruction ${index + 1}`)
        removeButton.setAttribute("aria-label", `Remove instruction ${index + 1}`)

        input.addEventListener("change", () => onChanged(input.value))

        removeButton.addEventListener("click", () => onRemoved())
    }
}