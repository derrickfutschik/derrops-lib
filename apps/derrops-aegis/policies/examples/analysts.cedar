// Analysts get read-only access on staging only.

permit (
  principal in AegisNamespace::UserGroup::"analysts",
  action in AegisNamespace::Action::"callApiRead",
  resource in AegisNamespace::ApiEnvironment::"staging"
);
