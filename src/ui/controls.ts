import { Module } from "../core/module.js"
import { DEFAULT_SETTINGS } from "../core/settings.js"
import { saveState } from "../db/db.js"


type SettingsPressedCallback = () => void
type RefreshIngredientsCallback = () => void

const controlPanelTemplate = `
<div id="control-wrapper">
    <button class="control" id="control-settings-button">SETTINGS</button>
<div>
`

const controlPanelCss = `
#control-wrapper {
    padding: 0 2rem;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));

    min-height: 0;
    height: 100%;
}

#control-wrapper .control {
    grid-column: span 1;
    color: var(--high-color, yellow);
    position: relative;

    display: grid;
    place-items: center;
}
`

export class ControlPanel extends Module {
    #state: DBState

    constructor(
        parent: Element, 
        state: DBState,
        onSettingsPressed: SettingsPressedCallback
    ) {
        super(parent, controlPanelTemplate, controlPanelCss)
        this.#state = state

        this.get<HTMLButtonElement>("#control-settings-button").onclick = () => onSettingsPressed()
    }
}

const settingsViewTemplate = `
<div id="settings-wrapper">
    <h1>SETTINGS</h1>
    <div id="settings-entry-list">
        <div class="settings-entry">
            <label for="settings-wrapper-bg-color">BG COLOR</label>
            <input id="settings-wrapper-bg-color" type="color" value="${DEFAULT_SETTINGS.bgColor}" />
        </div>
        <div class="settings-entry">
            <label for="settings-wrapper-low-color">LOW COLOR</label>
            <input id="settings-wrapper-low-color" type="color" value="${DEFAULT_SETTINGS.lowColor}" />
        </div>
        <div class="settings-entry">
            <label for="settings-wrapper-def-color">DEFAULT COLOR</label>
            <input id="settings-wrapper-def-color" type="color" value="${DEFAULT_SETTINGS.defColor}" />
        </div>
        <div class="settings-entry">
            <label for="settings-wrapper-high-color">HIGH COLOR</label>
            <input id="settings-wrapper-high-color" type="color" value="${DEFAULT_SETTINGS.highColor}" />
        </div>
        <div class="settings-entry">
            <label for="settings-wrapper-toggle-default-ingredients">DEFAULT INGREDIENTS</label>
            <input id="settings-wrapper-toggle-default-ingredients" type="checkbox" checked />
        </div>
    </div>
    <button type="button" id="restore-default-settings-button">RESTORE DEFAULT SETTINGS</button>
</div>
`

const settingsViewCss = `
#settings-wrapper {
    display: flex;
    flex-direction: column;
    padding: 1rem;
}

#settings-wrapper > h1 {
    align-self: center;
    margin-bottom: 2rem;
}

#settings-entry-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.settings-entry {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    align-items: center;
}

.settings-entry > label {
    grid-column: span 2;
}

.settings-entry > input {
    justify-self: center;
}

.settings-entry > input[type="color"] {
    grid-column: span 1;
    -webkit-appearance: none;

    width: 56px;
    height: 56px;
    padding: 2px;

    background: white;
    cursor: pointer;
    overflow: hidden;
}

.settings-entry > input[type="color"]:hover {
    border-color: var(--high-color, yellow);
    transform: scale(1.05);
}

.settings-entry > input[type="color"]:focus-visible {
    outline-offset: 1px;
}

/* Chrome, Edge and Safari */
.settings-entry > input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
}

/* Firefox */
.settings-entry > input[type="color"]::-moz-color-swatch {
    border: none;
}

.settings-entry > input[type="checkbox"] {

    width: 30px;
    height: 30px;
    border: 2px solid #888;
    border-radius: 4px;
    cursor: pointer;
    vertical-align: middle;
}

.settings-entry > input[type="checkbox"]:checked {
    background-color: var(--def-color, green);
    border-color: var(--low-color, #888);
}

#restore-default-settings-button {
    margin-top: 2rem;
}
`

export class SettingsView extends Module {
    constructor(
        parent: Element, 
        state: DBState, 
        appRoot: HTMLElement,
        onRefreshIngredients: RefreshIngredientsCallback    
    ) {
        super(parent, settingsViewTemplate, settingsViewCss)

        const colors = ["bg", "low", "def", "high"] as const

        for (const color of colors) {
            const picker = this.get<HTMLInputElement>(`#settings-wrapper-${color}-color`)

            const settingKey = `${color}Color` as const

            picker.value = state.settings[settingKey]

            picker.addEventListener("input", async () => {
                appRoot.style.setProperty(`--${color}-color`, picker.value)
                state.settings[settingKey] = picker.value
                await saveState(state)
            })
        }

        this.get<HTMLButtonElement>("#restore-default-settings-button").onclick = async () => {
            state.settings = { ...DEFAULT_SETTINGS }

            for (const color of colors) {
                const value = state.settings[`${color}Color`]
                appRoot.style.setProperty(`--${color}-color`, value)
                this.get<HTMLInputElement>(`#settings-wrapper-${color}-color`).value = value
            }

            await saveState(state)
        }

        const showDefIngredientsCheckbox = this.get<HTMLInputElement>("#settings-wrapper-toggle-default-ingredients")
        showDefIngredientsCheckbox.checked = state.settings.showDefIngredients

        showDefIngredientsCheckbox.oninput = async () => {
            state.settings.showDefIngredients = showDefIngredientsCheckbox.checked
            onRefreshIngredients()
            await saveState(state)
        }


    }
}