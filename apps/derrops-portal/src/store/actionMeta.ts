// ---------------------------------------------------------------------------
// Action creator registry
//
// Every Redux action creator in this app must be registered via
// `actionRegistry.registerAll()`. This attaches metadata onto each action
// creator function and adds it to a queryable list so AI agents and developer
// tooling can discover all available actions at runtime.
//
// See apps/derrops-portal/CLAUDE.md §Redux conventions for the full spec.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Functional domain areas used to group action creators. */
export enum ActionArea {
  Request = 'request',
  Response = 'response',
  Export = 'export',
  UI = 'ui',
}

/**
 * Logical sub-groups within an area.
 * Add a new value here whenever a new grouping is needed.
 */
export enum ActionGroup {
  // request area
  Navigation = 'navigation',
  Layout = 'layout',
  SendRequest = 'send-request',
  // response area
  ViewMode = 'view-mode',
  Json = 'json',
  Table = 'table',
  TableColumns = 'table-columns',
  // apis area
  Apis = 'apis',
  // new api wizard
  NewApiWizard = 'new-api-wizard',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata that must be provided when registering an action creator. */
export interface ActionMeta {
  /** Plain-English explanation of what the action does and when to use it. */
  description: string
  /** Functional domain this action belongs to. */
  area: ActionArea
  /** Logical sub-group within the area for finer-grained categorisation. */
  group: ActionGroup
}

/** An action creator with `ActionMeta` fields attached directly on the function. */
export type RegisteredAction<T> = T & ActionMeta

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class ActionRegistry {
  private readonly _list: Array<RegisteredAction<object>> = []

  /**
   * Register a single action creator with metadata.
   *
   * Attaches `meta` fields directly onto `actionCreator` (mutation) and adds
   * it to the registry. Returns the same reference typed as `RegisteredAction`.
   */
  register<T extends object>(actionCreator: T, meta: ActionMeta): RegisteredAction<T> {
    const registered = Object.assign(actionCreator, meta)
    this._list.push(registered)
    return registered
  }

  /**
   * Register every action creator in a slice's `.actions` object in one call.
   *
   * - `metaMap` must provide an `ActionMeta` entry for **every** key in
   *   `actions` — TypeScript will error if any are missing or misspelled.
   * - Mutates each action creator in place (attaches `description`, `area`,
   *   `group`) and adds all of them to the registry.
   * - Returns the same `actions` object with each value typed as
   *   `RegisteredAction`, ready for destructuring into named exports.
   *
   * @example
   * export const { setSelectedView, setHighlightDuplicates } =
   *   actionRegistry.registerAll(mySlice.actions, {
   *     setSelectedView: {
   *       description: "Sets the active view mode.",
   *       area: ActionArea.Response,
   *       group: ActionGroup.ViewMode,
   *     },
   *     setHighlightDuplicates: { ... },
   *   })
   */
  registerAll<T extends Record<string, object>>(
    actions: T,
    metaMap: { [K in keyof T]: ActionMeta },
  ): { [K in keyof T]: RegisteredAction<T[K]> } {
    for (const key of Object.keys(actions) as Array<keyof T>) {
      Object.assign(actions[key], metaMap[key])
      this._list.push(actions[key] as RegisteredAction<object>)
    }
    return actions as { [K in keyof T]: RegisteredAction<T[K]> }
  }

  /** All registered action creators in registration order. */
  get all(): ReadonlyArray<RegisteredAction<object>> {
    return this._list
  }

  /** All registered action creators for a given area. */
  byArea(area: ActionArea): ReadonlyArray<RegisteredAction<object>> {
    return this._list.filter((a) => a.area === area)
  }

  /** All registered action creators for a given group. */
  byGroup(group: ActionGroup): ReadonlyArray<RegisteredAction<object>> {
    return this._list.filter((a) => a.group === group)
  }
}

/**
 * Singleton registry for all portal Redux action creators.
 * Import this to register actions (in slices) or query the list (in tooling).
 */
export const actionRegistry = new ActionRegistry()
