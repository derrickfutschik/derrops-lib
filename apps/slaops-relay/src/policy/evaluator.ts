import type { Policy, PolicyResult, Enforcement, RequestContext } from './types'
import { matches } from './matcher'

function mergeEnforcement(base: Enforcement, override: Enforcement): Enforcement {
  return { ...base, ...override }
}

/**
 * Evaluate the policy against the request context.
 *
 * Evaluation order:
 * 1. Hard-deny conditions — unconditional; cannot be overridden by any rule.
 * 2. Named rules (deny-wins): scan ALL rules for any matching deny first.
 * 3. Named rules: then scan for any matching allow.
 * 4. Fallback to policy mode (deny-by-default rejects; allow-by-default permits).
 */
export function evaluatePolicy(policy: Policy, ctx: RequestContext): PolicyResult {
  // 1. Hard-deny — always checked first
  for (const cond of policy.hardDeny ?? []) {
    if (matches(cond, ctx)) {
      return { allowed: false, reason: 'Matched hard-deny rule' }
    }
  }

  // 2. Deny-wins: any matching deny rule blocks the request
  for (const rule of policy.rules) {
    if (rule.effect === 'deny' && matches(rule.when, ctx)) {
      return { allowed: false, reason: `Denied by rule '${rule.id}'` }
    }
  }

  // 3. First matching allow rule grants access
  for (const rule of policy.rules) {
    if (rule.effect === 'allow' && matches(rule.when, ctx)) {
      return {
        allowed: true,
        ruleId: rule.id,
        enforce: mergeEnforcement(policy.defaults ?? {}, rule.enforce ?? {}),
      }
    }
  }

  // 4. No rule matched — fall back to policy mode
  if (policy.mode === 'deny-by-default') {
    return { allowed: false, reason: 'No allow rule matched (deny-by-default)' }
  }

  return { allowed: true, ruleId: '__default__', enforce: policy.defaults ?? {} }
}
