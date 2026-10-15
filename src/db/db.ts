import { DEFAULT_SETTINGS, DEFAULT_ID_STATE } from "../core/settings.js"
import { sanitizeState } from "./sanitizer.js"



const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("app", 1)

        request.onupgradeneeded = () => {
            const db = request.result

            if (!db.objectStoreNames.contains("settings")) {
                db.createObjectStore("settings", { keyPath: "key" })
            }

            for (const name of ["ingredients", "recipes", "menus", "plans"]) {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, { keyPath: "id" })
                }
            }

            for (const name of ["ingredientIdState", "recipeIdState", "menuIdState", "planIdState"]) {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, { keyPath: "key" })
                }
            }
        }

        request.onsuccess = () => {
            const db = request.result
            db.onversionchange = () => db.close()
            resolve(db)
        }

        request.onerror = () => reject(request.error)

        request.onblocked = () => {
            console.error("Database upgrade blocked")
        }
    })
}

const getSettings = (db: IDBDatabase): Promise<Settings> => {
    return new Promise((resolve, reject) => {
        const request = db.transaction("settings", "readonly")
            .objectStore("settings").get("settings")

        request.onsuccess = () => {
            const record = request.result as ( Settings & { key: string } | undefined)

            resolve(record
                ? {
                    bgColor: record.bgColor,
                    lowColor: record.lowColor,
                    defColor: record.defColor,
                    highColor: record.highColor,
                    showDefIngredients: record.showDefIngredients,
                }
                : {
                    ...DEFAULT_SETTINGS,
                }
            )
        }
        
        request.onerror = () => reject(request.error)
    })
}

const getAll = <T>(db: IDBDatabase, storeName: string): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly")
            .objectStore(storeName).getAll()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

const getIdState = (
    db: IDBDatabase, 
    storeName: "ingredientIdState" | "recipeIdState" | "menuIdState" | "planIdState"
): Promise<IdManagerState> => {
    return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly")
            .objectStore(storeName).get("ids")

        request.onsuccess = () => {
            const record = request.result as IdManagerRecord | undefined
            const { nextBuiltinId, nextUserId, freeHead, freeNext } = record ?? DEFAULT_ID_STATE

            resolve({ nextBuiltinId, nextUserId, freeHead, freeNext })
        }

        request.onerror = () => reject(request.error)
    })
}

const getState = async (): Promise<DBState> => {
    const db = await getDB()

    const [
        settings,
        ingredients,
        recipes,
        menus,
        plans,
        ingredientIdManager,
        recipeIdManager,
        menuIdManager,
        planIdManager,
    ] = await Promise.all([
        getSettings(db),
        getAll<Ingredient>(db, "ingredients"),
        getAll<Recipe>(db, "recipes"),
        getAll<Menu>(db, "menus"),
        getAll<Plan>(db, "plans"),
        getIdState(db, "ingredientIdState"),
        getIdState(db, "recipeIdState"),
        getIdState(db, "menuIdState"),
        getIdState(db, "planIdState"),
    ])

    return {
        settings,
        ingredients, 
        recipes, 
        menus, 
        plans, 
        ingredientIdManager, 
        recipeIdManager, 
        menuIdManager, 
        planIdManager 
    }
}

const saveState = async (state: DBState): Promise<void> => {
    try {
        sanitizeState(state)

        const db = await getDB()

        return await new Promise<void>((resolve, reject) => {
            let tx: IDBTransaction

            try {
                tx = db.transaction(
                    [
                        "settings",
                        "ingredients",
                        "recipes",
                        "menus",
                        "plans",
                        "ingredientIdState",
                        "recipeIdState",
                        "menuIdState",
                        "planIdState",
                    ],
                    "readwrite"
                )
            } catch (error) {
                reject(error)
                return
            }

            tx.oncomplete = () => {
                resolve()
            }

            tx.onerror = () => {
                console.error("saveState: transaction error", tx.error)
                reject(tx.error ?? new Error("Transaction failed"))
            }

            tx.onabort = () => {
                console.error("saveState: transaction aborted", tx.error)
                reject(tx.error ?? new Error("Transaction aborted"))
            }

            try {
                const settingsStore = tx.objectStore("settings")
                settingsStore.put({ key: "settings", ...state.settings })

                const stores = [
                    ["ingredients", "ingredientIdState", state.ingredients, state.ingredientIdManager],
                    ["recipes", "recipeIdState", state.recipes, state.recipeIdManager],
                    ["menus", "menuIdState", state.menus, state.menuIdManager],
                    ["plans", "planIdState", state.plans, state.planIdManager],
                ] as const

                for (const [ name, idStoreName, items, manager ] of stores) {
                    const store = tx.objectStore(name)
                    store.clear()
                    items.forEach(item => store.put(item))
                    tx.objectStore(idStoreName).put({ key: "ids", ...manager})
                }
            } catch (error) {
                console.error("Failed to queue database requests:", error)

                try {
                    tx.abort()
                } catch {
                    // The transaction may already be inactive.
                }

                reject(error)
            }
        })
    } catch (error) {
        console.error("saveState failed:", error)
        throw error
    }
}

export { getState, saveState }