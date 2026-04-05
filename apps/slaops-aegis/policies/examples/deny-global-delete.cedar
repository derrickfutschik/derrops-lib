// No principal may call DELETE on any resource.
// This is a global safety baseline — it cannot be overridden by any permit.

forbid (
  principal,
  action == AegisNamespace::Action::"httpDelete",
  resource
);
