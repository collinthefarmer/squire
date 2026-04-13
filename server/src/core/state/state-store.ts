import type { ApplicationState } from "../../types";

/**
 * In-memory state store
 */
export class StateStore {
    private state: ApplicationState;

    constructor(initialState: ApplicationState = {}) {
        this.state = initialState;
    }

    /**
     * Get current state
     */
    getState(): ApplicationState {
        return this.state;
    }

    /**
     * Set state (immutable update)
     */
    setState(newState: ApplicationState): void {
        this.state = newState;
    }

    /**
     * Update state with function
     */
    updateState(updater: (state: ApplicationState) => ApplicationState): void {
        this.state = updater(this.state);
    }
}
