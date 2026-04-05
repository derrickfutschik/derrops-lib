// ---------------------------------------------------------------------------
// Action creator metadata
//
// Every Redux action creator in this app must have metadata attached to it
// via `attachMeta`. This allows AI agents (and developer tooling) to discover
// and reason about available actions without parsing source code.
//
// See apps/slaops-portal/CLAUDE.md §Redux conventions for the full spec.
// ---------------------------------------------------------------------------

/** Functional domain areas used to group action creators. */
export type ActionArea = 'request' | 'response' | 'export' | 'ui'

/**
 * Metadata that must be attached to every exported Redux action creator.
 * Access it at runtime as `myAction.description`, `myAction.area`, etc.
 */
export interface ActionMeta {
  /** Human-readable explanation of what the action does. */
  description: string
  /** Functional domain this action belongs to. */
  area: ActionArea
  /**
   * Logical sub-group within the area for finer-grained categorisation
   * (e.g. 'json', 'table-columns', 'navigation').
   */
  group: string
}

/**
 * Attaches `ActionMeta` fields directly onto an action creator function and
 * returns it. The original reference is mutated in place so existing imports
 * keep working.
 *
 * @example
 * attachMeta(setSelectedView, {
 *   description: "Sets the active response viewer mode.",
 *   area: 'response',
 *   group: 'view-mode',
 * })
 */
export function attachMeta<T extends object>(actionCreator: T, meta: ActionMeta): T & ActionMeta {
  return Object.assign(actionCreator, meta)
}
