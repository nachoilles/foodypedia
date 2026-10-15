import { getState } from "./db/db.js"
import { importIngredientsCsv } from "./db/loader.js"
import { App } from "./ui/app.js"


try {
    const appWrapper = document.getElementById("app")

    if (!appWrapper)
        throw new Error("Missing #app element")

    const state = await getState()

    try {
        const response = await fetch("/ingredients.csv")

        if (!response.ok)
            throw new Error(`Failed to load ingredients.csv: ${response.status}`)

        const file = new File(
            [await response.blob()],
            "ingredients.csv",
            { type: "text/csv" }
        )

        await importIngredientsCsv(file, state)
    } catch (error) {
        console.error("Failed to load default ingredients:", error)
    }

    new App(appWrapper, state)    
} catch (error) {
    console.log(error)
}