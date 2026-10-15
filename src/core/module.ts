export class Module {
    protected readonly parent: Element
    protected readonly root: Element
    protected readonly style: HTMLStyleElement

    #removed = false

    constructor(
        parent: Element, 
        template: string = `<div class="module"></div>`, 
        css: string = "")
    {
        this.parent = parent

        const templateElement = document.createElement("template")
        templateElement.innerHTML = template.trim()

        const root = templateElement.content.firstElementChild

        if (!root)
            throw new Error("Module template has no root element")

        if (templateElement.content.childElementCount !== 1)
            throw new Error("Module template must have exactly one root element")

        this.root = root
        parent.appendChild(this.root)

        this.style = document.createElement("style")
        this.style.textContent = css

        document.head.appendChild(this.style)
    }

    get<T extends HTMLElement>(query: string): T {
        const element = this.root.querySelector<T>(`${query}`)

        if (!element)
            throw new Error(`Missing element: ${query}`)

        return element
    }

    get removed(): boolean
    {
        return this.#removed
    }

    static getElementAs<T extends Element>(element: Element, elementType: { new (): T}): T
    {
        if (!(element instanceof elementType))
            throw new Error(`Expected module root to be ${elementType.name}`)

        return element
    }

    protected getParentAs<T extends Element>(elementType: { new (): T }): T
    {
        return Module.getElementAs(this.parent, elementType)
    }

    protected getRootAs<T extends Element>(elementType: { new (): T }): T
    {
        return Module.getElementAs(this.root, elementType)
    }
}