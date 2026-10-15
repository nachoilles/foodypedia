import { Module } from "../core/module.js";
import { getUnitsFor, rationUnits } from "../core/units.js";
import { saveState } from "../db/db.js";
import { IdManager } from "../db/id-manager.js";


type FiltersChangedCallback = () => void
type MenuChangedCallback = (menu: Menu) => void
type RemoveMenuCallback = () => void
type AddMenuCallback = (menu: Omit<Menu, "id">) => Promise<void>
type ShowMenuCallback = (menu: Menu | null) => void
type MenuItemSelectedCallback = (
    result: { 
        type: "ingredient" | "recipe", 
        item: IngredientEntry | RecipeEntry 
    }
) => void
type MenuItemChangedCallback = (menuItem: IngredientEntry | RecipeEntry) => void
type MenuItemRemovedCallback = () => void

type MenuFiltersT = {
    name: string
    ingredients: Ingredient[]
    recipes: Recipe[]
}

const menuListTemplate = `
<div id="menu-list-wrapper">
    <div id="menu-list-filters"></div>
    <div id="menu-list-data"></div>
</div>
`

const menuListCss = `
#menu-list-wrapper {
    padding: 0.5rem 1rem;
}

#menu-list-data {
    margin-top: 0.5rem;
    max-height: 30vh;
    overflow-y: auto;
    scrollbar-color: var(--def-color, green) transparent;
    scrollbar-width: thin;
}
`

export class MenuList extends Module {
    #state: DBState
    #filters: MenuFilters
    #list: HTMLDivElement
    #idManager: IdManager

    #onShowMenu: ShowMenuCallback

    constructor(
        parent: Element, 
        state: DBState,
        onShowMenu: ShowMenuCallback
    ) {
        super(parent, menuListTemplate, menuListCss)
        this.#state = state
        this.#idManager = new IdManager(this.#state.menuIdManager)
        this.#onShowMenu = onShowMenu

        const filtersWrapper = this.get<HTMLDivElement>("#menu-list-filters")
        const listWrapper = this.get<HTMLDivElement>("#menu-list-data")

        this.#list = listWrapper

        this.#filters = new MenuFilters(
            filtersWrapper, 
            state,
            () => this.render(),
            menu => this.addMenu(menu),
        )

        this.render()
    }

    async addMenu(menu: Omit<Menu, "id">): Promise<void> {
        const id = this.#idManager.allocateUser()

        const newMenu: Menu = {
            id,
            ...menu
        }

        this.#state.menus.push(newMenu)
        this.#state.menuIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
        this.#onShowMenu(newMenu)
    }

    async removeMenu(id: number): Promise<void> {
        const index = this.#state.menus.findIndex(menu => menu.id === id)
        
        if (index === -1) return

        this.#idManager.deallocateUser(id)

        this.#state.menus.splice(index, 1)
        this.#state.menuIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
    }

    async updateMenu(menu: Menu): Promise<void> {
        const storedMenu = this.#state.menus.find(m => m.id === menu.id)

        if (!storedMenu) return

        storedMenu.name = menu.name
        storedMenu.ingredients = menu.ingredients
        storedMenu.recipes = menu.recipes

        await saveState(this.#state)

        this.render()
    }

    render(): void {
        this.#list.replaceChildren()

        const filteredMenus = this.#state.menus
            .filter(
                m =>
                    m.name.toLocaleLowerCase().includes(this.#filters.name.toLowerCase()) &&
                    this.#filters.ingredients.every(ing => m.ingredients.some(i => i.id === ing.id)) &&
                    this.#filters.recipes.every(rec => m.recipes.some(r => r.id === rec.id)))
            .sort((a, b) => a.name.localeCompare(b.name))
        
        for (const menu of filteredMenus) {
            new MenuListItem(
                this.#list,
                menu,
                m => this.updateMenu(m),
                () => this.removeMenu(menu.id),
                m => this.#onShowMenu(m),
                menu.id >= this.#idManager.reservedLimit,
            )
        }
    }
}

const menuViewTemplate = `
<div id="menu-view-wrapper">
    <h1 id="menu-view-name"></h1>
    <h2>ITEMS:</h2>
    <div id="menu-view-item-list"></div>
</div>
`

const menuViewCss = `
#menu-view-wrapper {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    max-height: 90vh;
    overflow-y: auto;

    scrollbar-width: thin;
    scrollbar-color: var(--def-color, green) transparent;
}

#menu-view-wrapper[hidden] {
    display: none;
}

#menu-view-name {
    text-align: center;
    margin-bottom: 1rem;
}

#menu-view-item-list {
    margin-left: 1rem;
}

.menu-item-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.menu-item-row {
    flex-wrap: wrap;
}

.menu-item-quantity {
    width: 5rem;
}

.menu-item-unit {
    min-width: 5rem;
}

.menu-remove-button {
    flex-shrink: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
}
`

export class MenuView extends Module {
    #state: DBState
    #menu: Menu | null = null
    #menuName: HTMLHeadingElement

    constructor(parent: Element, state: DBState) {
        super(parent, menuViewTemplate, menuViewCss)
        this.#state = state

        const menuName = this.get<HTMLHeadingElement>("#menu-view-name")

        this.#menuName = menuName

        this.render()
    }

    set menu(menu: Menu | null) {
        this.#menu = menu

        this.render()
    }

    render(): void {
        this.getRootAs(HTMLElement).hidden = !this.#menu

        if (!this.#menu) return

        this.#menuName.innerText = this.#menu.name.toUpperCase()

        const itemList = this.get<HTMLDivElement>("#menu-view-item-list")

        itemList.replaceChildren()

        const menuItems = [
            ...this.#menu.ingredients.map((item, index) => ({
                item,
                type: "ingredient" as const,
                index,
            })),
            ...this.#menu.recipes.map((item, index) => ({
                item,
                type: "recipe" as const,
                index,
            })),
        ]

        menuItems.forEach(({ item, type, index }) => {
            new MenuViewItemListItem(
                itemList,
                this.#state,
                item,
                async (it: IngredientEntry | RecipeEntry) => {
                    if (!this.#menu) return

                    const collection =
                        type === "ingredient"
                            ? this.#menu.ingredients
                            : this.#menu.recipes

                    collection[index] = it
                    await saveState(this.#state)
                },
                async () => {
                    if (!this.#menu) return

                    const collection = type === "ingredient"
                        ? this.#menu.ingredients
                        : this.#menu.recipes

                    collection.splice(index, 1)
                    await saveState(this.#state)
                    this.render()
                }
            )
        })

        const addItemButton = document.createElement("button")
        addItemButton.type = "button"
        addItemButton.textContent = "ADD"
        addItemButton.addEventListener("click", () => {
            if (!this.#menu) return

            if (itemList.querySelector(".menu-item-picker")) return

            new MenuItemPicker(
                itemList,
                this.#state,
                async (result: {
                    type: "ingredient" | "recipe"
                    item: IngredientEntry | RecipeEntry
                }) => {
                    if (!this.#menu) return

                    if (result.type === "ingredient") {
                        this.#menu.ingredients.push(result.item as IngredientEntry)
                    } else {
                        this.#menu.recipes.push(result.item as RecipeEntry)
                    }

                    await saveState(this.#state)
                    this.render()
                }
            )
        })
        itemList.append(addItemButton)
    }
}

const menuFiltersTemplate = `
<form id="menu-list-filters-wrapper">
    <div id="menu-list-top-wrapper">
        <input
            id="menu-filter-name"
            name="name"
            type="search"
            placeholder="Search menu..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="button" id="new-menu-button">NEW</button>
    </div>

    <div id="new-menu-wrapper">
        <input
            id="new-menu-name"
            name="new-name"
            type="text"
            placeholder="Name..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="submit" id="add-menu-button">ADD</button>
    </div>
        
    <div id="filter-menu-items-top-wrapper">
        <input
            id="filter-menu-item-search"
            name="menu-item-name"
            type="search"
            placeholder="Find menu item..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="button" id="menu-list-toggle-advanced">FILTER</button>
    </div>

    <div id="menu-list-advanced-filters-panel">
        <div id="filter-menu-item-wrapper">
            <div id="filter-menu-item-options"></div>
            <div id="filter-selected-menu-items"></div>
        </div>
        <button type="reset">CLEAR</button>
    </div>
</form>
`

const menuFiltersCss = `
#menu-list-filters-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
}

#new-menu-wrapper,
#menu-list-top-wrapper {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: center;
}

#new-menu-wrapper[hidden] {
    display: none;
}

#menu-filter-name {
    grid-column: span 4;
}

#new-menu-button {
    grid-column: span 1;
    text-align: right;
}

#new-menu-name {
    grid-column: span 4;
}

#add-menu-button {
    grid-column: span 1;
    text-align: right;
}

#filter-menu-items-top-wrapper {
    display: flex;
    justify-content: flex-end;
}

#filter-menu-item-search {
    min-width: 0;
}

#filter-menu-item-search[hidden] {
    display: none;
}

#menu-list-advanced-filters-panel {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-end;
}

#menu-list-advanced-filters-panel[hidden] {
    display: none;
}

#filter-menu-item-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

#filter-menu-item-options {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.menu-item-option {
    text-align: left;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
}

#filter-selected-menu-items {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.menu-item-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid green;
}

.menu-item-chip button {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
}
`

class MenuFilters extends Module {
    #state: DBState
    #filters: MenuFiltersT
    #menuItemInput: HTMLInputElement

    #onFiltersChanged: FiltersChangedCallback

    constructor(
        parent: Element, 
        state: DBState,
        onFiltersChanged: FiltersChangedCallback,
        onAddMenu: AddMenuCallback,
    ) {
        super(parent, menuFiltersTemplate, menuFiltersCss)
        this.#state = state
        this.#onFiltersChanged = onFiltersChanged

        this.#filters = { name: "", ingredients: [], recipes: []}

        const newMenuButton = this.get<HTMLButtonElement>("#new-menu-button")
        const newMenuPanel = this.get<HTMLDivElement>("#new-menu-wrapper")
        const newMenuName = this.get<HTMLInputElement>("#new-menu-name")
        const advancedFiltersButton = this.get<HTMLButtonElement>("#menu-list-toggle-advanced")
        const advancedFiltersPanel = this.get<HTMLDivElement>("#menu-list-advanced-filters-panel")
        const nameInput = this.get<HTMLInputElement>("#menu-filter-name")
        const menuItemSearch = this.get<HTMLInputElement>("#filter-menu-item-search")
        const form = this.parent.querySelector<HTMLFormElement>("#menu-list-filters-wrapper")

        if (!form)
            throw new Error("Missing element: #menu-list-filters-wrapper")

        form.addEventListener("submit", async event => {
            event.preventDefault()

            const newName = newMenuName.value.trim()

            if (!newName) return

            const newMenu: Omit<Menu, "id"> = {
                name: newName,
                ingredients: [],
                recipes: [],
            }

            try {
                await onAddMenu(newMenu)

                newMenuName.value = ""
                newMenuPanel.hidden = true
            } catch (error) {
                console.warn("Failed to add menu item: ", error)
            }
        })

        newMenuPanel.hidden = true
        advancedFiltersPanel.hidden = true
        menuItemSearch.hidden = true

        this.#menuItemInput = menuItemSearch


        newMenuButton.addEventListener("click", () => newMenuPanel.hidden = !newMenuPanel.hidden)
        advancedFiltersButton.addEventListener("click", () => {
            advancedFiltersPanel.hidden = !advancedFiltersPanel.hidden
            menuItemSearch.hidden = !menuItemSearch.hidden
        })

        nameInput.addEventListener("input", () => {
            this.#filters.name = nameInput.value
            onFiltersChanged()
        })

        this.#menuItemInput.addEventListener("input", () => this.renderMenuItemOptions())

        form.addEventListener("reset", () => {
            queueMicrotask(() => {
                this.#filters.name = ""
                this.#filters.ingredients = []
                this.#filters.recipes = []

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

    get recipes() {
        return this.#filters.recipes
    }

    renderMenuItemOptions(): void {
        const options = this.parent.querySelector<HTMLDivElement>("#filter-menu-item-options")
        const search = this.#menuItemInput.value

        if (!options) return

        options.replaceChildren()

        if (!search.trim()) {
            options.hidden = true
            return
        }

        const selectedIngredientIds = new Set(this.#filters.ingredients.map(i => i.id))
        const selectedRecipeIds = new Set(this.#filters.recipes.map(i => i.id))

        const ingredients = this.#state.ingredients.filter(
            ingredient =>
                ingredient.name.toLowerCase().includes(search.toLowerCase()) &&
                !selectedIngredientIds.has(ingredient.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 3)

        const recipes = this.#state.recipes.filter(
            recipe =>
                recipe.name.toLowerCase().includes(search.toLowerCase()) &&
                !selectedRecipeIds.has(recipe.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 3)

        const menuItems = [
            ...ingredients.map(ingredient => ({
                ...ingredient,
                type: "ingredient" as const
            })),
            ...recipes.map(recipe => ({
                ...recipe,
                type: "recipe" as const
            }))
        ]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 3);

        for (const menuItem of menuItems) {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "menu-item-option"
            button.textContent = menuItem.name

            button.addEventListener("click", () => {
                if (menuItem.type === "ingredient") {
                    const { type: _, ...ingredient } = menuItem;
                    this.#filters.ingredients.push(ingredient);
                } else {
                    const { type: _, ...recipe } = menuItem;
                    this.#filters.recipes.push(recipe);
                }
                this.#menuItemInput.value = ""
                this.render()
                this.#onFiltersChanged()
            })

            options.append(button)
        }
    }

    renderSelectedMenuItems(): void {
        const container = this.get("#filter-selected-menu-items")

        if (!container) return

        container.replaceChildren()

        const menuItems = [
            ...this.#filters.ingredients,
            ...this.#filters.recipes,
        ]
        .sort((a, b) => a.name.localeCompare(b.name))

        for (const menuItem of menuItems) {
            const chip = document.createElement("span")
            chip.className = "menu-item-chip"

            const name = document.createElement("span")
            name.textContent = menuItem.name

            const removeButton = document.createElement("button")
            removeButton.type = "button"
            removeButton.textContent = "x"
            removeButton.setAttribute("aria-label", `Remove ${menuItem.name}`)

            removeButton.addEventListener("click", () => {
                this.#filters.ingredients = this.#filters.ingredients
                    .filter(i => i.id !== menuItem.id)
                this.#filters.recipes = this.#filters.recipes
                    .filter(r => r.id !== menuItem.id)

                this.render()
                this.#onFiltersChanged()
            })

            chip.append(name, removeButton)
            container.append(chip)
        }
    }

    render(): void {
        this.renderMenuItemOptions()
        this.renderSelectedMenuItems()
    }
}

const menuListItemTemplate = `
<div class="menu-list-item">
    <input
        class="menu-list-item-name"
        type="text"
        name="name"
        autocomplete="off"
        spellcheck="false"
    />
    <button type="button" class="remove-menu-button">x</button>
</div>
`

const menuListItemCss = `
.menu-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
}

.menu-list-item-name {
    flex: 1;
    min-width: 0;
    width: 0;

    background-color: var(--bg-color, black);
    color: var(--def-color, green);

    overflow-x: hidden;
    cursor: default;
}

.remove-menu-button {
    margin-right: 0.5rem;
}
`

class MenuListItem extends Module {
    #menu: Menu

    constructor(
        parent: Element, 
        menu: Menu,
        onMenuChanged: MenuChangedCallback,
        onMenuRemoved: RemoveMenuCallback,
        onShowMenu: ShowMenuCallback,
        isUserMenu: boolean = true
    ) {
        super(parent, menuListItemTemplate, menuListItemCss)
        this.#menu = menu

        const nameInput = this.get<HTMLInputElement>(".menu-list-item-name")
        const removeButton = this.get<HTMLButtonElement>(".remove-menu-button")

        nameInput.value = menu.name
        nameInput.readOnly = true
        nameInput.style.cursor = "default"

        nameInput.addEventListener("click", () => onShowMenu(this.#menu))

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
                nameInput.value = this.#menu.name
                nameInput.blur()
            }
        })

        nameInput.addEventListener("change", () => {
            const name = nameInput.value.trim()

            if (!name) {
                nameInput.value = this.#menu.name
                return
            }

            this.#menu.name = name
            onMenuChanged(this.#menu)
            onShowMenu(this.#menu)
        })

        removeButton.hidden = !isUserMenu

        removeButton.addEventListener("click", () => {
            onMenuRemoved()
            onShowMenu(null)
        })
    }
}

const menuItemPickerTemplate = `
<form class="menu-item-picker">
    <div class="menu-item-picker-search-wrapper">
        <input
            class="menu-item-picker-search"
            name="menu-item-name"
            type="search"
            placeholder="Search menu items..."
            autocomplete="off"
            spellcheck="false"
        />
        <div class="menu-item-options"></div>
    </div>

    <div class="menu-item-entry-editor" hidden>
        <label>
            Amount
            <input
                class="menu-item-entry-quantity"
                name="menu-item-quantity"
                type="number"
                min="0"
                step="any"
                value="1"
            />
        </label>

        <label>
            Unit
            <select 
                class="menu-item-entry-unit"
                name="menu-item-unit"
            ></select>
        </label>

        <div class="menu-item-entry-actions">
            <button type="submit" class="menu-item-entry-confirm">
                ADD
            </button>
            <button type="button" class="menu-item-entry-cancel">
                CANCEL
            </button>
        </div>
    </div>
</form>
`

const menuItemPickerCss = `
.menu-item-picker {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
}

.menu-item-picker-search-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1 1 0;
    min-width: 0;
}

.menu-item-picker-search {
    min-width: 0;
}

.menu-item-options {
    display: flex;
    flex-direction: column;
    max-height: 10rem;
    overflow-y: auto;
    min-width: 0;
}

.menu-item-options:empty {
    display: none;
}

.menu-item-options button {
    cursor: pointer;
    text-align: left;
}

.menu-item-entry-editor {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex: 0 1 auto;
    min-width: 0;
}

.menu-item-entry-editor label {
    min-width: 0;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.menu-item-entry-editor label > * {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
}

.menu-item-entry-quantity {
    max-width: 100%;
    flex: 0 1 6rem;
}
    
.menu-item-entry-editor select,
.menu-item-entry-editor input {
    color: var(--low-color, #888);
}

.menu-item-entry-editor option {
    background-color: var(--bg-color, black);
    color: var(--def-color, green);
}

.menu-item-entry-editor[hidden] {
    display: none;
}

.menu-item-entry-editor label {
    min-width: 0;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

/* Chrome, Safari, Edge, Opera */
.menu-item-entry-quantity::-webkit-inner-spin-button,
.menu-item-entry-quantity::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Firefox */
.menu-item-entry-quantity {
    -moz-appearance: textfield;
    appearance: textfield;
}

.menu-item-entry-actions {
    display: flex;
    gap: 0.5rem;
}
`

class MenuItemPicker extends Module {
    #state: DBState
    #selectedMenuItem: Ingredient | Recipe | null = null
    #onSelected: MenuItemSelectedCallback

    constructor(
        parent: Element,
        state: DBState,
        onSelected: MenuItemSelectedCallback
    ) {
        super(parent, menuItemPickerTemplate, menuItemPickerCss)

        this.#state = state
        this.#onSelected = onSelected

        const form = this.parent.querySelector<HTMLFormElement>(".menu-item-picker")
        const search = this.get<HTMLInputElement>(".menu-item-picker-search")
        const quantity = this.get<HTMLInputElement>(".menu-item-entry-quantity")
        const unitSelect = this.get<HTMLSelectElement>(".menu-item-entry-unit")
        const editor = this.get<HTMLDivElement>(".menu-item-entry-editor")
        const cancelButton = this.get<HTMLButtonElement>(".menu-item-entry-cancel")

        if (!form)
            throw new Error("Could not create IngredientPicker")

        search.addEventListener("input", () => {
            this.#selectedMenuItem = null
            editor.hidden = true
            this.renderOptions(search)
        })

        form.addEventListener("submit", event => {
            event.preventDefault()

            const menuItem = this.#selectedMenuItem
            const amount = quantity.valueAsNumber

            if (!menuItem || !Number.isFinite(amount) || amount <= 0) {
                quantity.focus()
                return
            }

            const selectedUnit = this.#getSelectedUnit(unitSelect)
            if (!selectedUnit) {
                unitSelect.focus()
                return
            }

            if ("defaultUnit" in menuItem) {
                const entry: IngredientEntry = {
                    ...menuItem,
                    quantity: amount,
                    unit: selectedUnit as Unit,
                }

                this.#onSelected({ type: "ingredient", item: entry })
            } else {
                const entry: RecipeEntry = {
                    ...menuItem,
                    quantity: amount,
                    unit: selectedUnit as RationUnit,
                }

                this.#onSelected({ type: "recipe", item: entry })
            }

            this.root.remove()
        })

        cancelButton.addEventListener("click", () => this.root.remove())

        search.focus()
    }

    renderOptions(search: HTMLInputElement): void {
        const options = this.get<HTMLDivElement>(".menu-item-options")

        options.replaceChildren()

        const query = search.value.trim().toLowerCase()

        if (!query) return

        const menuItems = [
            ...this.#state.ingredients,
            ...this.#state.recipes,
        ]

        const matches = menuItems
            .filter(it => it.name.toLowerCase().includes(query))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 3)

        for (const menuItem of matches) {
            const button = document.createElement("button")
            button.type = "button"
            button.textContent = menuItem.name

            button.addEventListener("click", () => this.#selectMenuItem(menuItem))

            options.append(button)
        }
    }

    #selectMenuItem(menuItem: Ingredient | Recipe): void {
        const quantity = this.get<HTMLInputElement>(".menu-item-entry-quantity")
        const unitSelect = this.get<HTMLSelectElement>(".menu-item-entry-unit")
        const editor = this.get<HTMLDivElement>(".menu-item-entry-editor")
        const search = this.get<HTMLInputElement>(".menu-item-picker-search")
        const options = this.get<HTMLDivElement>(".menu-item-options")

        if (!quantity || !unitSelect || !editor || !search || !options) {
            throw new Error("Could not select menu item")
        }

        this.#selectedMenuItem = menuItem

        search.value = menuItem.name
        options.replaceChildren()

        quantity.value = "1"

        const availableUnits = "defaultUnit" in menuItem 
            ? getUnitsFor(menuItem.defaultUnit)
            : rationUnits

        unitSelect.replaceChildren()

        for (const unit of availableUnits) {
            const option = document.createElement("option")
            option.value = unit.name
            option.textContent = unit.name
            option.selected = unit.name === ("defaultUnit" in menuItem
                ? menuItem.defaultUnit.name
                : rationUnits[0].name)
            unitSelect.append(option)
        }

        editor.hidden = false
        quantity.focus()
    }

    #getSelectedUnit(select: HTMLSelectElement): Unit | RationUnit | null {
        const selectedName = select.value

        if (!this.#selectedMenuItem)
            return null

        if (!("defaultUnit" in this.#selectedMenuItem))
            return rationUnits[0]

        const units = getUnitsFor(this.#selectedMenuItem.defaultUnit) as Unit[]

        return units.find(unit => unit.name === selectedName) ?? null
    }
}

const menuViewItemListItemTemplate = `
<div class="menu-view-item-row">
    <button
        type="button"
        class="menu-view-item-remove"
        aria-label="Remove menu item"
    >x</button>
    <div class="menu-view-item-amount">
        <input
            class="menu-view-item-quantity"
            type="number"
            min="0.001"
            step="any"
            aria-label="menu item quantity"
        />
        <select
            class="menu-view-item-unit"
            aria-label="menu item unit"
        ></select>
    </div>
    <span class="menu-view-item-name"></span>
</div>
`

const menuViewItemListItemCss = `
.menu-view-item-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    min-width: 0;
}

.menu-view-item-amount {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
}

.menu-view-item-row input,
.menu-view-item-row select {
    color: var(--low-color, #888);
}

.menu-view-item-row option {
    background-color: var(--bg-color, black);
    color: var(--def-color, green);
}

.menu-view-item-quantity {
    max-width: 3rem;
    text-align: right;
}

/* Chrome, Safari, Edge, Opera */
.menu-view-item-quantity::-webkit-inner-spin-button,
.menu-view-item-quantity::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Firefox */
.menu-view-item-quantity {
    -moz-appearance: textfield;
    appearance: textfield;
}

.menu-view-item-unit {
    max-width: 4rem;
}

.menu-view-item-name {
    min-width: 0;
    overflow-wrap: anywhere;
}

.menu-view-item-name::before {
    content: "of ";
}

.menu-view-item-remove {
    flex-shrink: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
}
`

class MenuViewItemListItem extends Module {
    constructor(
        parent: Element,
        state: DBState,
        menuItem: IngredientEntry | RecipeEntry,
        onChanged: MenuItemChangedCallback,
        onRemoved: MenuItemRemovedCallback
    ) {
        super(parent, menuViewItemListItemTemplate, menuViewItemListItemCss)

        const { unit: u, quantity: q, ...item } = menuItem
        const serializedItem = JSON.stringify(item)

        const currentMenuItem = 
            state.ingredients.find(ing => JSON.stringify(ing) === serializedItem) || 
            state.recipes.find(rec => JSON.stringify(rec) === serializedItem)

        const { unit, quantity, ...rawMenuItem } = menuItem

        const isObsolete = !currentMenuItem || JSON.stringify(currentMenuItem) !== JSON.stringify(rawMenuItem)

        const quantityInput = this.get<HTMLInputElement>(".menu-view-item-quantity")
        const unitSelect = this.get<HTMLSelectElement>(".menu-view-item-unit")
        const name = this.get<HTMLSpanElement>(".menu-view-item-name")
        const removeButton = this.get<HTMLButtonElement>(".menu-view-item-remove")

        name.textContent = menuItem.name
        if (isObsolete) name.style.textDecoration = "line-through"
        quantityInput.value = String(menuItem.quantity)
        quantityInput.setAttribute("aria-label", `Quantity of ${menuItem.name}`)
        removeButton.setAttribute("aria-label", `Remove ${menuItem.name}`)

        const units = getUnitsFor(menuItem.unit)

        for (const unit of units) {
            const option = document.createElement("option")
            option.value = unit.name
            option.textContent = unit.name
            option.selected = unit.name === menuItem.unit.name
            unitSelect.append(option)
        }

        quantityInput.addEventListener("change", () => {
            const quantity = quantityInput.valueAsNumber

            if (!Number.isFinite(quantity) || quantity <= 0) {
                quantityInput.value = String(menuItem.quantity)
                return
            }

            menuItem.quantity = quantity
            onChanged(menuItem)
        })

        unitSelect.addEventListener("change", () => {
            const unit = units.find(candidate => candidate.name === unitSelect.value)
            if (!unit) return

            menuItem.unit = unit as Unit
            onChanged(menuItem)
        })

        removeButton.addEventListener("click", () => onRemoved())
    }
}