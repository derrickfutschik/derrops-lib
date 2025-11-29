export const redact = (headers: any, patterns: (string | RegExp)[] | undefined): Record<string, string> => {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const hit = (patterns ?? []).some((p) =>
      typeof p === 'string' ? k.toLowerCase() === p.toLowerCase() : (p as RegExp).test(k),
    );
    out[k] = hit ? '[REDACTED]' : String(v);
  }
  return out;
};
