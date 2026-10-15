const RESERVED_LIMIT = 65_536

const createInitialIdState = (): IdManagerState => ({
    nextBuiltinId: 0,
    nextUserId: RESERVED_LIMIT,
    freeHead: null,
    freeNext: {}
})

export const isUserId = (id: number): boolean => id >= RESERVED_LIMIT

export class IdManager {
    #state: IdManagerState

    constructor(state?: IdManagerState) {
        this.#state = state
            ? structuredClone(state)
            : createInitialIdState()
    }

    allocateBuiltin(): number {
        if (this.#state.nextBuiltinId >= RESERVED_LIMIT) {
            throw new Error("Built-in ID range exhausted")
        }

        return this.#state.nextBuiltinId++
    }

    allocateUser(): number {
        const head = this.#state.freeHead

        if (head !== null) {
            this.#state.freeHead = this.#state.freeNext[head]
            delete this.#state.freeNext[head]
            return head
        }

        if (this.#state.nextUserId > Number.MAX_SAFE_INTEGER) {
            throw new Error("User ID range exhausted")
        }

        return this.#state.nextUserId++
    }

    deallocateUser(id: number): void {
        if (
            !Number.isSafeInteger(id) ||
            id < RESERVED_LIMIT ||
            id >= this.#state.nextUserId
        ) {
            throw new Error(`Invalid user ID: ${id}`)
        }

        if (
            id === this.#state.freeHead ||
            Object.hasOwn(this.#state.freeNext, id)
        ) {
            throw new Error(`ID ${id} is already free`)
        }

        this.#state.freeNext[id] = this.#state.freeHead
        this.#state.freeHead = id
    }

    serialize(): IdManagerState {
        return structuredClone(this.#state)
    }

    get reservedLimit(): number {
        return RESERVED_LIMIT
    }
}