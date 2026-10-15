import { Module } from "../core/module.js";
import { ControlPanel, SettingsView } from "./controls.js";
import { IngredientList, IngredientView } from "./ingredients.js";
import { MenuList, MenuView } from "./menus.js";
import { PlanList, PlanView } from "./plans.js";
import { RecipeList, RecipeView } from "./recipes.js";


const appTemplate = `
<div id="app-wrapper">
    <div id="left-wrapper">
        <section id="recipe-list-section"></section>
        <section id="ingredient-list-section"></section>
    </div>
    <div id="top-center-wrapper">
        <section id="control-panel-section"></section>
    </div>
    <div id="right-wrapper">
        <section id="menu-list-section"></section>
        <section id="plan-list-section"></section>
    </div>
    <div id="bottom-center-wrapper">
        <section id="settings-view-section"></section>

        <section id="ingredient-view-section"></section>
        <section id="recipe-view-section"></section>
        <section id="menu-view-section"></section>
        <section id="plan-view-section"></section>
    </div>
</div>
`

const appCss = `
:root {
    --bg-color: black;
    --def-color: green;
    --low-color: #888;
    --high-color: yellow;

    --def-fs: 1.2rem;
    --l-fs: 1.5rem;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-size: var(--def-fs, 1.2rem);

    scrollbar-color: var(--def-color, green) transparent;
    scrollbar-width: thin;
}

html,
body {
    width: 100%;
    height: 100%;
    user-select: none;
    -webkit-user-select: none;
}

input,
textarea,
[contenteditable="true"] {
    user-select: text;
    -webkit-user-select: text;
}

input,
select,
textarea,
button {
    appearance: none;
    border: none;
    outline: none;
    box-shadow: none;
    border-radius: 0;
    background: transparent;
    font: inherit;
    padding: 8px 0;
    color: var(--def-color, green);
}

input:focus,
select:focus,
textarea:focus,
button:focus {
    outline: none;
    box-shadow: none;
}

input::placeholder {
    color: var(--low-color, #888);
}

*::selection {
    background-color: var(--def-color, green);
    color: var(--bg-color, black);
}

button {
    color: var(--high-color, yellow);
    cursor: pointer;
}

h1, h2 {
    font-size: var(--l-fs, 1.6rem)
}

#app-wrapper {
    font-family: "Share Tech Mono", monospace;
    background-color: var(--bg-color, black);
    color: var(--def-color, green);

    padding: 2rem;

    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    grid-template-rows: repeat(8, minmax(0, 1fr));
    min-width: 650px;
    min-height: 100vh;
    max-height: 100vh;
    min-height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    gap: 1rem;
}

#right-wrapper,
#left-wrapper {
    grid-column: span 2;
    grid-row: span 8;

    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 1rem;
}

#left-wrapper > *,
#right-wrapper > * {
    grid-column: span 1;
    grid-row: span 1;

    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;

    overflow-y: auto;
    scrollbar-color: var(--def-color, green) transparent;
    scrollbar-width: thin;
}

#top-center-wrapper {
    position: relative;
    grid-column: span 4;
    grid-row: span 1;
}

#control-panel-section {
    position: absolute;
    inset: 0;
}

#bottom-center-wrapper {
    grid-column: span 4;
    grid-row: span 7;

    position: relative;
}

#center-wrapper > * {
    position: absolute;
    inset: 0;

    overflow-y: auto;
    scrollbar-color: var(--def-color, green) transparent;
    scrollbar-width: thin;
}

#left-wrapper > *,
#right-wrapper > *,
#top-center-wrapper,
#bottom-center-wrapper {
    border: 2px solid var(--def-color, green);
    border-radius: 0.4rem;
}
`

export class App extends Module {
    #ingredientView: IngredientView
    #recipeView: RecipeView
    #menuView: MenuView
    #planView: PlanView

    constructor(parent: Element, state: DBState) {
        super(parent, appTemplate, appCss)

        const sections = {
            settings: this.get<HTMLElement>("#settings-view-section"),
            ingredient: this.get<HTMLElement>("#ingredient-view-section"),
            recipe: this.get<HTMLElement>("#recipe-view-section"),
            menu: this.get<HTMLElement>("#menu-view-section"),
            plan: this.get<HTMLElement>("#plan-view-section"),
        }

        this.#ingredientView = new IngredientView(sections.ingredient, state)
        this.#recipeView = new RecipeView(sections.recipe, state)
        this.#menuView = new MenuView(sections.menu, state)
        this.#planView = new PlanView(sections.plan, state)

        this.#applySettings(state.settings, this.getRootAs(HTMLElement))

        const show = (active: keyof typeof sections): void => {
            for (const [name, section] of Object.entries(sections))
                section.hidden = name !== active
        }
        
        new ControlPanel(
            this.get<HTMLElement>("#control-panel-section"), 
            state,
            () => show("settings")
        )

        const ingredientList = new IngredientList(
            this.get("#ingredient-list-section"),
            state,
            ingredient => {
                this.#ingredientView.ingredient = ingredient
                show("ingredient")
            }
        )

        new RecipeList(
            this.get("#recipe-list-section"),
            state,
            recipe => {
                this.#recipeView.recipe = recipe
                show("recipe")
            }
        )

        new MenuList(
            this.get("#menu-list-section"),
            state,
            menu => {
                this.#menuView.menu = menu
                show("menu")
            }
        )

        new PlanList(
            this.get("#plan-list-section"),
            state,
            plan => {
                this.#planView.plan = plan
                show("plan")
            }
        )

        new SettingsView(
            sections.settings, 
            state, 
            this.getRootAs(HTMLElement),
            () => ingredientList.render(),
        )

        show("ingredient")
    }

    #applySettings(settings: Settings, root: HTMLElement): void {
        root.style.setProperty("--bg-color", settings.bgColor)
        root.style.setProperty("--low-color", settings.lowColor)
        root.style.setProperty("--def-color", settings.defColor)
        root.style.setProperty("--high-color", settings.highColor)
    }
}