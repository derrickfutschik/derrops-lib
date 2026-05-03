// Platform engineers get full API access on production and staging.
// Writes to production require MFA.

// Read access on all environments
permit (
  principal in AegisNamespace::UserGroup::"platform-engineers",
  action in AegisNamespace::Action::"callApiRead",
  resource
);

// Write access on staging (no MFA required)
permit (
  principal in AegisNamespace::UserGroup::"platform-engineers",
  action in AegisNamespace::Action::"callApiWrite",
  resource in AegisNamespace::ApiEnvironment::"staging"
);

// Write access on production requires MFA
permit (
  principal in AegisNamespace::UserGroup::"platform-engineers",
  action in AegisNamespace::Action::"callApiWrite",
  resource in AegisNamespace::ApiEnvironment::"prod"
) when {
  context.mfaVerified == true
};
