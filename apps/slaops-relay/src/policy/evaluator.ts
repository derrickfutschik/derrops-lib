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
 *
 * @param debug - Emit a `console.debug` line for each rule evaluation. Controlled
 *                by the `RELAY_POLICY_DEBUG` env var; pass `env.relay.policyDebug`.
 */
export function evaluatePolicy(policy: Policy, ctx: RequestContext, debug = false): PolicyResult {
  const log = debug
    ? (entry: object) => console.debug(JSON.stringify({ event: 'policy_eval', ...entry }))
    : null

  // 1. Hard-deny — always checked first
  for (let i = 0; i < (policy.hardDeny ?? []).length; i++) {
    const cond = policy.hardDeny![i]
    const matched = matches(cond, ctx)
    log?.({ phase: 'hard_deny', index: i, matched, url: ctx.url.raw, method: ctx.request.method })
    if (matched) {
      const result: PolicyResult = {
        allowed: false,
        reason: 'Matched hard-deny rule',
      }
      log?.({ phase: 'decision', ...result, condition: cond })
      return result
    }
  }

  // 2. Deny-wins: any matching deny rule blocks the request
  for (const rule of policy.rules) {
    if (rule.effect !== 'deny') continue
    const matched = matches(rule.when, ctx)
    log?.({
      phase: 'deny_rule',
      rule_id: rule.id,
      matched,
      url: ctx.url.raw,
      method: ctx.request.method,
    })
    if (matched) {
      const result: PolicyResult = { allowed: false, reason: `Denied by rule '${rule.id}'` }
      log?.({ phase: 'decision', ...result })
      return result
    }
  }

  // 3. First matching allow rule grants access
  for (const rule of policy.rules) {
    if (rule.effect !== 'allow') continue
    const matched = matches(rule.when, ctx)
    log?.({
      phase: 'allow_rule',
      rule_id: rule.id,
      matched,
      url: ctx.url.raw,
      method: ctx.request.method,
    })
    if (matched) {
      const result: PolicyResult = {
        allowed: true,
        ruleId: rule.id,
        enforce: mergeEnforcement(policy.defaults ?? {}, rule.enforce ?? {}),
      }
      log?.({ phase: 'decision', ...result })
      return result
    }
  }

  // 4. No rule matched — fall back to policy mode
  if (policy.mode === 'deny-by-default') {
    const result: PolicyResult = {
      allowed: false,
      reason: 'No allow rule matched (deny-by-default)',
    }
    log?.({ phase: 'decision', ...result })
    return result
  }

  const result: PolicyResult = {
    allowed: true,
    ruleId: '__default__',
    enforce: policy.defaults ?? {},
  }
  log?.({ phase: 'decision', ...result })
  return result
}
