import { Module } from "../core/module.js"
import { days, meals, rationUnits } from "../core/units.js"
import { saveState } from "../db/db.js"
import { IdManager } from "../db/id-manager.js"


type FiltersChangedCallback = () => void
type PlanChangedCallback = (plan: Plan) => void
type RemovePlanCallback = () => void
type AddPlanCallback = (plan: Omit<Plan, "id">) => Promise<void>
type ShowPlanCallback = (plan: Plan | null) => void

type PlanFiltersT = {
    name: string
}

type MenuCombobox = {
    meal: Meal
    input: HTMLInputElement
    listbox: HTMLUListElement
    removeButton: HTMLButtonElement
    activeIndex: number
}

const planListTemplate = `
<div id="plan-list-wrapper">
    <div id="plan-list-filters"></div>
    <div id="plan-list-data"></div>
</div>
`

const planListCss = `
#plan-list-wrapper {
    padding: 0 1rem;
}

#plan-list-filters {
    padding-top: 0.5rem;
    position: sticky;
    top: 0;
    background-color: var(--bg-color, black);
}

#plan-list-data {
    margin-top: 0.5rem;
    overflow-y: auto;
    scrollbar-color: var(--def-color, green) transparent;
    scrollbar-width: thin;
}
`

export class PlanList extends Module {
    #state: DBState
    #filters: PlanFilters
    #list: HTMLDivElement
    #idManager: IdManager

    #onShowPlan: ShowPlanCallback

    constructor(
        parent: Element, 
        state: DBState,
        onShowPlan: ShowPlanCallback
    ) {
        super(parent, planListTemplate, planListCss)
        this.#state = state
        this.#idManager = new IdManager(this.#state.planIdManager)
        this.#onShowPlan = onShowPlan

        const filtersWrapper = this.root.querySelector<HTMLDivElement>("#plan-list-filters")
        const listWrapper = this.root.querySelector<HTMLDivElement>("#plan-list-data")

        if (!filtersWrapper || !listWrapper)
            throw new Error("Error creating PlanList")

        this.#list = listWrapper

        this.#filters = new PlanFilters(
            filtersWrapper, 
            state,
            () => this.render(),
            plan => this.addPlan(plan),
        )

        this.render()
    }

    async addPlan(plan: Omit<Plan, "id">): Promise<void> {
        const id = this.#idManager.allocateUser()

        const newPlan: Plan = {
            id,
            ...plan
        }

        this.#state.plans.push(newPlan)
        this.#state.planIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
        this.#onShowPlan(newPlan)
    }

    async removePlan(id: number): Promise<void> {
        const index = this.#state.plans.findIndex(plan => plan.id === id)
        
        if (index === -1) return

        this.#idManager.deallocateUser(id)

        this.#state.plans.splice(index, 1)
        this.#state.planIdManager = this.#idManager.serialize()

        await saveState(this.#state)

        this.render()
    }

    async updatePlan(plan: Plan): Promise<void> {
        const storedPlan = this.#state.plans.find(p => p.id === plan.id)

        if (!storedPlan) return

        storedPlan.name = plan.name
        storedPlan.daily = plan.daily

        await saveState(this.#state)

        this.render()
    }

    render(): void {
        this.#list.replaceChildren()

        const filteredPlans = this.#state.plans
            .filter(p => p.name.toLocaleLowerCase().includes(this.#filters.name.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))
        
        for (const plan of filteredPlans) {
            new PlanListItem(
                this.#list,
                plan,
                p => this.updatePlan(p),
                () => this.removePlan(plan.id),
                p => this.#onShowPlan(p),
                plan.id >= this.#idManager.reservedLimit,
            )
        }
    }
}

const planViewTemplate = `
<div id="plan-view-wrapper">
    <h1 id="plan-view-name"></h1>
    <div id="plan-view-day-buttons">
        <button type="button" class="plan-view-day-button" selected>MON</button>
        <button type="button" class="plan-view-day-button">TUE</button>
        <button type="button" class="plan-view-day-button">WED</button>
        <button type="button" class="plan-view-day-button">THU</button>
        <button type="button" class="plan-view-day-button">FRI</button>
        <button type="button" class="plan-view-day-button">SAT</button>
        <button type="button" class="plan-view-day-button">SUN</button>
    </div>
    <div id="plan-view-daily-wrapper">
        <div class="plan-view-daily-row">
            <p>BREAKFAST</p>
            <div class="combobox">
                <input
                    id="plan-view-breakfast-menu-input"
                    class="plan-view-menu-input"
                    role="combobox"
                    aria-expanded="false"
                    aria-controls="breakfast-menu-options"
                    aria-autocomplete="list"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="Select menu..."
                />
                <ul 
                    id="breakfast-menu-options"
                    class="plan-view-menu-options"
                    role="listbox" 
                    hidden
                ></ul>
            </div>
            <button type="button" class="plan-view-remove-menu-button">x</button>
        </div>
        <div class="plan-view-daily-row">
            <p>LUNCH</p>
            <div class="combobox">
                <input
                    id="plan-view-lunch-menu-input"
                    class="plan-view-menu-input"
                    role="combobox"
                    aria-expanded="false"
                    aria-controls="lunch-menu-options"
                    aria-autocomplete="list"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="Select menu..."
                />
                <ul 
                    id="lunch-menu-options"
                    class="plan-view-menu-options"
                    role="listbox" 
                    hidden
                ></ul>
            </div>
            <button type="button" class="plan-view-remove-menu-button">x</button>
        </div>
        <div class="plan-view-daily-row">
            <p>DINNER</p>
            <div class="combobox">
                <input
                    id="plan-view-dinner-menu-input"
                    class="plan-view-menu-input"
                    role="combobox"
                    aria-expanded="false"
                    aria-controls="dinner-menu-options"
                    aria-autocomplete="list"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="Select menu..."
                />
                <ul 
                    id="dinner-menu-options"
                    class="plan-view-menu-options"
                    role="listbox" 
                    hidden
                ></ul>
            </div>
            <button type="button" class="plan-view-remove-menu-button">x</button>
        </div>
    </div>
    <div id="plan-view-lists-wrapper">
        <div id="plan-view-recipe-list-wrapper">
            <h2>RECIPES</h2>
            <div id="plan-view-recipe-list"></div>
        </div>
        <div id="plan-view-ingredient-list-wrapper">
            <h2>INGREDIENTS</h2>
            <div id="plan-view-ingredient-list"></div>
        </div>
    </div>
</div>
`

const planViewCss = `
#plan-view-wrapper {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    overflow-y: auto;

    scrollbar-width: thin;
    scrollbar-color: var(--def-color, green) transparent;
}

#plan-view-wrapper[hidden] {
    display: none;
}

#plan-view-name {
    text-align: center;
    margin-bottom: 1rem;
}

#plan-view-day-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2rem;
}

.plan-view-day-button[selected] {
    color: var(--bg-color, black);
    background-color: var(--high-color, yellow);
}

#plan-view-daily-wrapper {
    margin: 0 20% 1rem 20%;
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) max-content;
    align-items: center;
    gap: 0.5rem 0.75rem;
}

.plan-view-daily-row {
    display: contents;
}

.combobox {
    position: relative;
}

.plan-view-menu-input {
    color: var(--low-color, #888)
}

.plan-view-menu-options {
    position: absolute;
    z-index: 10;
    border: 1px solid green;
    background-color: black;
    left: 0;
    right: 0;
    
    list-style: none;
    max-height: 8rem;
    overflow-y: auto;

    user-select: none;
}

.plan-view-menu-options[hidden] {
    display: none;
}

.plan-view-menu-options [role="option"] {
    padding: 0.5rem;
}

.plan-view-menu-options [role="option"][aria-selected="true"],
.plan-view-menu-options [role="option"]:hover {
    background-color: var(--def-color, green);
    color: var(--bg-color, black);
}

#plan-view-lists-wrapper {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    flex: 1;
    min-height: 27vh;
    max-height: 27vh;
}

#plan-view-recipe-list-wrapper,
#plan-view-ingredient-list-wrapper {
    display: flex;
    flex-direction: column;
    align-items: stretch;
}

#plan-view-recipe-list-wrapper {
    border-right: 2px solid var(--def-color, green);
}

#plan-view-ingredient-list-wrapper {
    border-left: 2px solid var(--def-color, green);
}

#plan-view-lists-wrapper h2 {
    align-self: center;
}

#plan-view-recipe-list,
#plan-view-ingredient-list {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;

    min-height: 23vh;
    max-height: 23vh;
    overflow-y: auto;
}

.plan-view-list-row {
    grid-column: span 4;

    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
}

.plan-view-list-recipe-quantity,
.plan-view-list-ingredient-quantity {
    grid-column: span 1;
    color: var(--low-color, #888);
    text-align: right;
}

.plan-view-list-recipe-name,
.plan-view-list-ingredient-name {
    grid-column: span 2;
}
`

export class PlanView extends Module {
    #state: DBState
    #plan: Plan | null = null
    #planName: HTMLHeadingElement
    #selectedDay: Day = "MON"
    #mealInputs: HTMLInputElement[]
    #recipeList: HTMLDivElement
    #ingredientList: HTMLDivElement

    #comboboxes: MenuCombobox[]

    constructor(parent: Element, state: DBState) {
        super(parent, planViewTemplate, planViewCss)
        this.#state = state

        const planName = this.root.querySelector<HTMLHeadingElement>("#plan-view-name")
        const recipeList = this.root.querySelector<HTMLDivElement>("#plan-view-recipe-list")
        const ingredientList = this.root.querySelector<HTMLDivElement>("#plan-view-ingredient-list")

        if ( !planName || !recipeList || !ingredientList)
            throw new Error("Could not create RecipeView")

        this.#planName = planName
        this.#recipeList = recipeList
        this.#ingredientList = ingredientList

        this.#mealInputs = Array.from(this.root.querySelectorAll<HTMLInputElement>("#plan-view-daily-wrapper input"))

        this.#comboboxes = meals.map((meal) => {
            const row = this.root.querySelector<HTMLElement>(`.plan-view-daily-row:nth-child(${meals.indexOf(meal) + 1})`)
            const input = row?.querySelector<HTMLInputElement>(".plan-view-menu-input")
            const listbox = row?.querySelector<HTMLUListElement>(".plan-view-menu-options")
            const removeButton = row?.querySelector<HTMLButtonElement>(".plan-view-remove-menu-button")

            if (!input || !listbox || !removeButton)
                throw new Error(`Could not create ${meal} combobox`)

            return { meal, input, listbox, removeButton, activeIndex: -1 }
        })

        for (const combobox of this.#comboboxes)
            this.#attachComboboxEvents(combobox)

        this.root.querySelectorAll<HTMLButtonElement>(".plan-view-day-button")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    const day = button.textContent?.trim()

                    if (!day || !days.includes(day as Day)) return

                    this.#selectedDay = day as Day
                    this.render()
                })
            })

        document.addEventListener("click", event => {
            const target = event.target
            if (!(target instanceof Element)) return
            if (target.closest(".combobox")) return

            this.#closeAllComboboxes()
        })

        this.render()
    }

    set plan(plan: Plan | null) {
        this.#plan = plan

        this.render()
    }

    render(): void {
        this.getRootAs(HTMLElement).hidden = !this.#plan

        if (!this.#plan) return

        this.#planName.innerText = this.#plan?.name.toUpperCase() ?? ""

        const dayButtons = this.root.querySelectorAll<HTMLButtonElement>(".plan-view-day-button")

        dayButtons.forEach(button => button.toggleAttribute("selected", button.textContent?.trim() === this.#selectedDay))

        this.#recipeList.replaceChildren()
        this.#ingredientList.replaceChildren()

        const dailyPlan = this.#getSelectedDailyPlan()

        if (!dailyPlan) return

        meals.forEach((meal, index) => this.#mealInputs[index].value = dailyPlan[meal]?.name ?? "")

        this.#renderRecipes()
        this.#renderIngredients()
    }

    #refreshCombobox(combobox: MenuCombobox): void {
        this.#renderMenuOptions(combobox)
        this.#openCombobox(combobox)
    }

    #attachComboboxEvents(combobox: MenuCombobox): void {
        const { input, listbox } = combobox

        input.addEventListener("input", async () => {
            const menu = this.#state.menus.find(m => m.name === input.value)

            if (input.value !== "" && !menu) {
                input.style.textDecoration = "line-through"
            } else {
                input.style.textDecoration = "none"
            }

            const plan = this.#getSelectedPlan()
            const day = days.indexOf(this.#selectedDay)

            if (!plan || day < 0) return

            plan.daily[day][combobox.meal] = menu
                ? {unit: rationUnits[0], quantity: 1, ...menu}
                : null

            await saveState(this.#state)

            combobox.activeIndex = -1
            this.#refreshCombobox(combobox)
        })

        input.addEventListener("blur", () => {
            const plan = this.#state.plans.find(p => p.id === this.#plan?.id)
            const day = days.indexOf(this.#selectedDay)

            if (plan && day !== -1) {
                const entry = plan.daily[day][combobox.meal]
                input.value = entry?.name ?? ""
            }

            input.style.textDecoration = "none"
            combobox.activeIndex = -1
            this.#closeCombobox(combobox)
        })

        input.addEventListener("focus", () => {
            this.#refreshCombobox(combobox)
        })

        input.addEventListener("keydown", (event: KeyboardEvent) => {
            const options = listbox.querySelectorAll<HTMLLIElement>('[role="option"]')

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault()

                    if (listbox.hidden) {
                        this.#refreshCombobox(combobox)
                    } else if (options.length > 0) {
                        combobox.activeIndex = (combobox.activeIndex + 1) % options.length
                        this.#updateActiveOption(combobox)
                    }
                    break

                case "ArrowUp":
                    event.preventDefault()

                    if (options.length > 0) {
                        combobox.activeIndex =
                            combobox.activeIndex <= 0
                                ? options.length - 1
                                : combobox.activeIndex - 1

                        this.#updateActiveOption(combobox)
                    }
                    break

                case "Enter":
                    if (!listbox.hidden && combobox.activeIndex >= 0) {
                        event.preventDefault()

                        const activeOption = options[combobox.activeIndex]

                        if (activeOption) {
                            const menuId = Number(activeOption.dataset.menuId)
                            const menu = this.#state.menus.find(
                                item => item.id === menuId
                            )

                            if (menu) {
                                this.#selectMenu(combobox, menu)
                            }
                        }
                    }

                    input.blur()
                    break

                case "Escape":
                    this.#closeCombobox(combobox)

                    input.blur()

                    break
            }
        })

        listbox.addEventListener("mousedown", (event: MouseEvent) => {
            event.preventDefault()
        })

        listbox.addEventListener("click", async (event: MouseEvent) => {
            const target = event.target
            if (!(target instanceof Element)) return

            const option = target.closest<HTMLLIElement>('[role="option"]')

            if (!option) return

            const menuId = Number(option.dataset.menuId)
            const menu = this.#state.menus.find(item => item.id === menuId)

            if (menu) {
                this.#selectMenu(combobox, menu)

                await saveState(this.#state)
            }
        })

        combobox.removeButton.addEventListener("click", async () => {
            this.#clearMenu(combobox)

            await saveState(this.#state)
        })
    }

    #getSelectedPlan(): Plan | null {
        const selectedPlan = this.#plan

        if (!selectedPlan)
            return null

        return this.#state.plans.find(p => p.id === selectedPlan.id) ?? null
    }

    #getSelectedDailyPlan(): DailyPlan | null {
        const plan = this.#getSelectedPlan()
        const dayIndex = days.indexOf(this.#selectedDay)

        if (!plan || dayIndex < 0)
            return null

        return plan.daily[dayIndex] ?? null
    }

    #selectMenu(combobox: MenuCombobox, menu: Menu): void {
        const dailyPlan = this.#getSelectedDailyPlan()

        if (!dailyPlan)
            return

        dailyPlan[combobox.meal] = {
            ...menu,
            unit: rationUnits[0],
            quantity: 1,
        }

        combobox.input.value = menu.name

        this.#closeCombobox(combobox)
        this.render()
    }

    #clearMenu(combobox: MenuCombobox): void {
        if (!this.#plan) return

        const dailyPlan = this.#getSelectedDailyPlan()

        if (!dailyPlan) return

        dailyPlan[combobox.meal] = null

        combobox.input.value = ""
        this.#closeAllComboboxes()
        this.render()
    }

    #openCombobox(combobox: MenuCombobox): void {
        for (const other of this.#comboboxes)
            if (other !== combobox)
                this.#closeCombobox(other)

        combobox.listbox.hidden = false
        combobox.input.setAttribute("aria-expanded", "true")
    }

    #closeAllComboboxes(): void {
        for (const combobox of this.#comboboxes)
            this.#closeCombobox(combobox)
    }

    #closeCombobox(combobox: MenuCombobox): void {
        combobox.listbox.hidden = true
        combobox.activeIndex = -1
        combobox.input.removeAttribute("aria-activedescendant")
        combobox.input.setAttribute("aria-expanded", "false")
    }

    #getFilteredMenus(combobox: MenuCombobox): Menu[] {
        const query = combobox.input.value.trim().toLocaleLowerCase()

        if (!query)
            return this.#state.menus

        return this.#state.menus.filter(menu => menu.name.toLocaleLowerCase().includes(query))
    }

    #updateActiveOption(combobox: MenuCombobox): void {
        const options = combobox.listbox.querySelectorAll<HTMLElement>('[role="option"]')

        options.forEach((option, index) => {
            const isActive = index === combobox.activeIndex

            option.setAttribute("aria-selected", String(isActive))

            if (isActive) {
                combobox.input.setAttribute("aria-activedescendant", option.id)
                option.scrollIntoView({ block: "nearest" })
            }
        })

        if (combobox.activeIndex < 0 || combobox.activeIndex >= options.length)
            combobox.input.removeAttribute("aria-activedescendant")
    }

    #renderMenuOptions(combobox: MenuCombobox): void {
        const menus = this.#getFilteredMenus(combobox)
        const fragment = document.createDocumentFragment()

        combobox.activeIndex = -1

        for (const menu of menus) {
            const option = document.createElement("li")

            option.id = `${combobox.meal}-menu-option-${menu.id}`
            option.setAttribute("role", "option")
            option.setAttribute("aria-selected", "false")
            option.dataset.menuId = String(menu.id)
            option.textContent = menu.name

            fragment.append(option)
        }

        combobox.listbox.replaceChildren(fragment)
        combobox.input.removeAttribute("aria-activedescendant")

        if (menus.length === 0) {
            const emptyOption = document.createElement("li")
            emptyOption.className = "plan-view-menu-empty"
            emptyOption.textContent = "No menus found"
            emptyOption.setAttribute("aria-disabled", "true")

            combobox.listbox.append(emptyOption)
        }
    }

    #renderRecipes(): void {
        const plan = this.#getSelectedPlan()
        const recipeList = this.root.querySelector<HTMLDivElement>("#plan-view-recipe-list")

        if (!plan || !recipeList) return

        const recipes = plan.daily.flatMap(day => [
            ...(day.breakfast?.recipes ?? []),
            ...(day.lunch?.recipes ?? []),
            ...(day.dinner?.recipes ?? [])
        ])

        const mergedRecipes = new Map<number, RecipeEntry>()

        for (const recipe of recipes) {
            const existing = mergedRecipes.get(recipe.id)

            if (existing) {
                existing.quantity += recipe.quantity
            } else {
                mergedRecipes.set(recipe.id, { ...recipe })
            }
        }

        recipeList.replaceChildren()

        for (const recipe of mergedRecipes.values()) {
            const quantityLabel = document.createElement("p")
            quantityLabel.classList.add("plan-view-list-recipe-quantity")
            quantityLabel.textContent = parseFloat(recipe.quantity.toFixed(3)).toString()
            
            const nameLabel = document.createElement("p")
            nameLabel.classList.add("plan-view-list-recipe-name")
            nameLabel.textContent = recipe.name
            
            const rowWrapper = document.createElement("div")
            rowWrapper.classList.add("plan-view-list-row")
            rowWrapper.append(quantityLabel)
            rowWrapper.append(nameLabel)
            recipeList.append(rowWrapper)
        }
    }

    #renderIngredients(): void {
        const plan = this.#getSelectedPlan()
        const ingredientList = this.root.querySelector<HTMLDivElement>("#plan-view-ingredient-list")

        if (!plan || !ingredientList) return

        const rawIngredients = plan.daily.flatMap(day =>
            meals.flatMap(meal => day[meal]?.ingredients ?? [])
        )

        const recipeIngredients = plan.daily.flatMap(day =>
            meals.flatMap(meal =>
                (day[meal]?.recipes ?? []).flatMap(recipe =>
                    recipe.ingredients.map(ingredient => ({
                        ...ingredient,
                        quantity: ingredient.quantity * recipe.quantity / recipe.rations
                    }))
                )
            )
        )

        const ingredients = [...rawIngredients, ...recipeIngredients]

        const mergedIngredients = new Map<number, IngredientEntry>()

        for (const ingredient of ingredients) {
            const defaultUnit = ingredient.defaultUnit
            const convertedQuantity = ingredient.quantity * ingredient.unit.factor / defaultUnit.factor
            console.log(defaultUnit.factor)

            const existing = mergedIngredients.get(ingredient.id)

            if (existing) {
                existing.quantity += convertedQuantity
            } else {
                mergedIngredients.set(ingredient.id, {
                    ...ingredient,
                    unit: { ...defaultUnit },
                    quantity: convertedQuantity
                })
            }
        }

        ingredientList.replaceChildren()

        for (const ingredient of mergedIngredients.values()) {
            const quantityLabel = document.createElement("p")
            quantityLabel.classList.add("plan-view-list-ingredient-quantity")
            quantityLabel.textContent = parseFloat(ingredient.quantity.toFixed(3)).toString() + ingredient.unit.name
            
            const nameLabel = document.createElement("p")
            nameLabel.classList.add("plan-view-list-ingredient-name")
            nameLabel.textContent = ingredient.name
            
            const rowWrapper = document.createElement("div")
            rowWrapper.classList.add("plan-view-list-row")
            rowWrapper.append(quantityLabel)
            rowWrapper.append(nameLabel)
            ingredientList.append(rowWrapper)
        }
    }
}

const planFiltersTemplate = `
<form id="plan-list-filters-wrapper">
    <div id="plan-list-top-wrapper">
        <input
            id="plan-filter-name"
            name="name"
            type="search"
            placeholder="Search plan..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="button" id="new-plan-button">NEW</button>
    </div>

    <div id="new-plan-wrapper">
        <input
            id="new-plan-name"
            name="new-name"
            type="text"
            placeholder="Name..."
            autocomplete="off"
            spellcheck="false"
        />
        <button type="submit" id="add-plan-button">ADD</button>
    </div>
</form>
`

const planFiltersCss = `
#plan-list-filters-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
}

#new-plan-wrapper,
#plan-list-top-wrapper {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: center;
}

#new-plan-wrapper[hidden] {
    display: none;
}

#plan-filter-name {
    grid-column: span 4;
}

#new-plan-button {
    grid-column: span 1;
}

#new-plan-name {
    grid-column: span 4;
}

#add-plan-button {
    grid-column: span 1;
}
`

class PlanFilters extends Module {
    #state: DBState
    #filters: PlanFiltersT

    #onFiltersChanged: FiltersChangedCallback

    constructor(
        parent: Element, 
        state: DBState,
        onFiltersChanged: FiltersChangedCallback,
        onAddPlan: AddPlanCallback,
    ) {
        super(parent, planFiltersTemplate, planFiltersCss)
        this.#state = state
        this.#onFiltersChanged = onFiltersChanged

        this.#filters = { name: "" }

        const newPlanButton = this.root.querySelector<HTMLButtonElement>("#new-plan-button")
        const newPlanPanel = this.root.querySelector<HTMLDivElement>("#new-plan-wrapper")
        const newPlanName = this.root.querySelector<HTMLInputElement>("#new-plan-name")
        const nameInput = this.root.querySelector<HTMLInputElement>("#plan-filter-name")
        const form = this.parent.querySelector<HTMLFormElement>("#plan-list-filters-wrapper")

        if (!newPlanButton || !newPlanPanel || !newPlanName || !nameInput || !form)
            throw new Error("Error creating PlanFilters")

        form.addEventListener("submit", async event => {
            event.preventDefault()

            const newName = newPlanName.value.trim()

            if (!newName) return

            const newPlan: Omit<Plan, "id"> = {
                name: newName,
                daily: [
                    { breakfast: null, lunch: null, dinner: null },
                    { breakfast: null, lunch: null, dinner: null },
                    { breakfast: null, lunch: null, dinner: null },
                    { breakfast: null, lunch: null, dinner: null },
                    { breakfast: null, lunch: null, dinner: null },
                    { breakfast: null, lunch: null, dinner: null },
                    { breakfast: null, lunch: null, dinner: null },
                ],
            }

            try {
                await onAddPlan(newPlan)

                newPlanName.value = ""
                newPlanPanel.hidden = true
            } catch (error) {
                console.warn("Failed to add plan item: ", error)
            }
        })

        newPlanPanel.hidden = true

        newPlanButton.addEventListener("click", () => newPlanPanel.hidden = !newPlanPanel.hidden)

        nameInput.addEventListener("input", () => {
            this.#filters.name = nameInput.value
            onFiltersChanged()
        })

        form.addEventListener("reset", () => {
            queueMicrotask(() => {
                this.#filters.name = ""
                onFiltersChanged()
            })
        })
    }

    get filters() {
        return this.#filters
    }

    get name() {
        return this.#filters.name
    }
}

const planListItemTemplate = `
<div class="plan-list-item">
    <input
        class="plan-list-item-name"
        type="text"
        name="name"
        autocomplete="off"
        spellcheck="false"
    />
    <button type="button" class="remove-plan-button">x</button>
</div>
`

const planListItemCss = `
.plan-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
}

.plan-list-item-name {
    flex: 1;
    min-width: 0;
    width: 0;

    background-color: var(--bg-color, black);
    color: var(--def-color, green);

    overflow-x: hidden;
    cursor: default;
}

.remove-plan-button {
    margin-right: 0.5rem;
}
`

class PlanListItem extends Module {
    #plan: Plan

    constructor(
        parent: Element, 
        plan: Plan,
        onPlanChanged: PlanChangedCallback,
        onPlanRemoved: RemovePlanCallback,
        onShowPlan: ShowPlanCallback,
        isUserPlan: boolean = true
    ) {
        super(parent, planListItemTemplate, planListItemCss)
        this.#plan = plan

        const nameInput = this.root.querySelector<HTMLInputElement>(".plan-list-item-name")
        const removeButton = this.root.querySelector<HTMLButtonElement>(".remove-plan-button")

        if (!nameInput || !removeButton)
            throw new Error("Could not create RecipeListItem")

        nameInput.value = plan.name
        nameInput.readOnly = true
        nameInput.style.cursor = "default"

        nameInput.addEventListener("click", () => onShowPlan(this.#plan))

        nameInput.addEventListener("dblclick", () => {
            nameInput.readOnly = false
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
                nameInput.value = this.#plan.name
                nameInput.blur()
            }
        })

        nameInput.addEventListener("change", () => {
            const name = nameInput.value.trim()

            if (!name) {
                nameInput.value = this.#plan.name
                return
            }

            this.#plan.name = name
            onPlanChanged(this.#plan)
            onShowPlan(this.#plan)
        })

        removeButton.hidden = !isUserPlan

        removeButton.addEventListener("click", () => {
            onPlanRemoved()
            onShowPlan(null)
        })
    }
}