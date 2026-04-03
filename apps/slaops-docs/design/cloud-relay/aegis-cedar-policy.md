---
sidebar_position: 8
title: Aegis — Cedar Policy Authorization Design
tags: [cloud-relay, aegis, authorization, cedar-policy, security, component-design]
---

# Aegis — Cedar Policy Authorization Design

This document describes how [Cedar Policy](https://www.cedarpolicy.com) is used as the pluggable policy engine inside the Aegis Broker to determine what a given user is allowed to do through the SLAOps relay.

Related documents:
- [Aegis Token Broker Design](./aegis-token-broker-design) — session delegation model, JWT flow, and dual-authorization model
- [Cloud Relay Security](./cloud-relay-security) — authentication methods between Relay and control plane
- [Network Topology](./network-topology) — runtime component separation

---

## Why Cedar Policy

Aegis's core design goal is that the **customer, not the SLAOps platform, is the final authority for what APIs may be called**. The Aegis Broker was designed with a pluggable policy engine; Cedar Policy is the recommended implementation for that slot.

Cedar fits this problem well for three reasons:

| Property | Why it matters for Aegis |
|---|---|
| **Expressive but bounded** | Cedar can encode RBAC, ABAC, time bounds, and environment constraints without becoming Turing-complete. Policies are analyzable — you can formally prove what is and is not allowed. |
| **Auditable** | Every policy is a human-readable Cedar document. Customers can version-control, review, and audit policies alongside their infrastructure code. |
| **Separation of concerns** | Authorization logic lives in Cedar policy files, not in application code. Aegis evaluates them; it does not embed them. This matches the customer-owned-policy model. |
| **Default deny** | Cedar denies everything unless a `permit` policy explicitly matches. No accidental access. |
| **Schema-validated** | Cedar schemas define the entity types and allowed actions. Policies are validated against the schema before they are deployed, catching errors early. |

---

## Core Concepts: The PARC Model Applied to Aegis

Cedar authorization is structured around four elements: **Principal**, **Action**, **Resource**, and **Context** (PARC). Every Aegis authorization question maps onto this model.

```
Is this Principal allowed to perform this Action on this Resource given this Context?
```

| PARC element | Aegis mapping | Example |
|---|---|---|
| **Principal** | Authenticated user or IdP group | `User::"alice@acme.com"`, `UserGroup::"platform-engineers"` |
| **Action** | Operation the user wants to perform via the relay | `Action::"callApi"`, `Action::"callApiReadOnly"` |
| **Resource** | The API endpoint or host being targeted | `ApiEndpoint::"GET /v1/orders"`, `ApiHost::"payments.internal"` |
| **Context** | Environmental data at session grant time | `{ environment: "prod", relayId: "relay-01", time: ... }` |

---

## Entity Model

### Principal hierarchy

```
UserGroup (e.g. "platform-engineers")
  └── User (e.g. "alice@acme.com")
```

Users are assigned to one or more `UserGroup` entities. Policies can target individual users or entire groups. Group membership is populated from the customer's IdP at session grant time (SSO claims → Cedar entity graph).

```cedar
// alice is a member of platform-engineers
entity User in [UserGroup] {
  email: String,
  department: String,
};

entity UserGroup {
  displayName: String,
};
```

### Action hierarchy

Actions are organized from coarse to fine-grained. A policy granting `callApi` covers all child actions.

```
callApi
  ├── callApiReadOnly   // GET, HEAD, OPTIONS
  └── callApiWrite      // POST, PUT, PATCH, DELETE
```

```cedar
action callApi;
action callApiReadOnly in [callApi];
action callApiWrite in [callApi];
```

### Resource hierarchy

Resources represent the things being accessed. `ApiEndpoint` is the leaf; `ApiHost` and `ApiEnvironment` are grouping ancestors.

```
ApiEnvironment (e.g. "prod", "staging")
  └── ApiHost (e.g. "payments.internal")
       └── ApiEndpoint (e.g. "GET /v1/orders/{id}")
```

```cedar
entity ApiEnvironment {
  name: String,      // "prod" | "staging" | "dev"
};

entity ApiHost in [ApiEnvironment] {
  hostname: String,
  internal: Bool,
};

entity ApiEndpoint in [ApiHost] {
  method: String,   // "GET" | "POST" | ...
  pathPattern: String,
  tags: Set<String>, // OASpec operation tags, e.g. {"billing", "read-only"}
};
```

### Context

Context carries request-time data that cannot be embedded in entity attributes because it varies per session.

```typescript
// Context shape passed to Cedar at session grant time
{
  environment: "prod",            // target environment
  relayId: "relay-01",           // which relay the session will use
  ipAddress: "10.0.0.5",         // user's originating IP
  time: "2026-04-03T09:00:00Z",  // session grant timestamp
  mfaVerified: true,             // whether IdP reported MFA
}
```

---

## Cedar Schema (Aegis Domain)

The schema defines valid entity types, their attributes, and which actions are permitted against which resource types. Policies are validated against this schema before deployment.

```json
{
  "AegisNamespace": {
    "entityTypes": {
      "User": {
        "memberOfTypes": ["UserGroup"],
        "shape": {
          "type": "Record",
          "attributes": {
            "email":      { "type": "String" },
            "department": { "type": "String" }
          }
        }
      },
      "UserGroup": {
        "shape": {
          "type": "Record",
          "attributes": {
            "displayName": { "type": "String" }
          }
        }
      },
      "ApiEnvironment": {
        "shape": {
          "type": "Record",
          "attributes": {
            "name": { "type": "String" }
          }
        }
      },
      "ApiHost": {
        "memberOfTypes": ["ApiEnvironment"],
        "shape": {
          "type": "Record",
          "attributes": {
            "hostname": { "type": "String" },
            "internal": { "type": "Boolean" }
          }
        }
      },
      "ApiEndpoint": {
        "memberOfTypes": ["ApiHost"],
        "shape": {
          "type": "Record",
          "attributes": {
            "method":      { "type": "String" },
            "pathPattern": { "type": "String" },
            "tags":        { "type": "Set", "element": { "type": "String" } }
          }
        }
      }
    },
    "actions": {
      "callApi": {
        "appliesTo": {
          "principalTypes": ["User", "UserGroup"],
          "resourceTypes": ["ApiEndpoint", "ApiHost", "ApiEnvironment"]
        }
      },
      "callApiReadOnly": {
        "memberOf": [{ "id": "callApi", "type": "Action" }],
        "appliesTo": {
          "principalTypes": ["User", "UserGroup"],
          "resourceTypes": ["ApiEndpoint", "ApiHost", "ApiEnvironment"]
        }
      },
      "callApiWrite": {
        "memberOf": [{ "id": "callApi", "type": "Action" }],
        "appliesTo": {
          "principalTypes": ["User", "UserGroup"],
          "resourceTypes": ["ApiEndpoint", "ApiHost", "ApiEnvironment"]
        }
      }
    }
  }
}
```

---

## Example Policies

### 1. Grant a group read-only access to all staging APIs

```cedar
permit (
  principal in UserGroup::"platform-engineers",
  action == Action::"callApiReadOnly",
  resource in ApiEnvironment::"staging"
);
```

### 2. Grant a user full access to a specific internal host

```cedar
permit (
  principal == User::"alice@acme.com",
  action,
  resource in ApiHost::"payments.internal"
);
```

### 3. Allow all production reads, but only after MFA

```cedar
permit (
  principal in UserGroup::"analysts",
  action == Action::"callApiReadOnly",
  resource in ApiEnvironment::"prod"
) when {
  context.mfaVerified == true
};
```

### 4. Explicitly deny access to billing endpoints for contractors

Forbid policies always override permit policies in Cedar, regardless of evaluation order.

```cedar
forbid (
  principal in UserGroup::"contractors",
  action,
  resource
) when {
  resource.tags.contains("billing")
};
```

### 5. Time-bounded access — allow only during business hours

```cedar
permit (
  principal in UserGroup::"on-call",
  action,
  resource in ApiEnvironment::"prod"
) when {
  context.time.toTime().hour >= 8 &&
  context.time.toTime().hour < 18
};
```

### 6. Restrict to a specific relay

```cedar
permit (
  principal in UserGroup::"external-contractors",
  action == Action::"callApiReadOnly",
  resource in ApiEnvironment::"staging"
) when {
  context.relayId == "relay-dmz-01"
};
```

---

## Decision Logic

Cedar's authorization decision is **default deny** with explicit forbid override:

```
1. Evaluate all policies in the policy set against the request.
2. If ANY forbid policy matches → DENY (final, cannot be overridden).
3. If at least one permit policy matches AND no forbid matches → ALLOW.
4. If no permit policy matches → DENY (default).
```

This maps cleanly onto Aegis's trust model: unless a customer-authored policy explicitly grants access, the session delegation JWT will not include that endpoint in its scope.

---

## Integration with Aegis Session Grant Flow

Cedar evaluation happens **once at session grant time**, not per-request. This is consistent with the Aegis design principle that Aegis must not be in the hot path of every relay request.

```mermaid
sequenceDiagram
    actor User
    participant Portal as SLAOps Portal
    participant IdP as Customer SSO IdP
    participant Aegis as Aegis Broker (Cedar)
    participant CP as SaaS Control Plane
    participant Relay as Customer Relay

    User->>Portal: Open session
    Portal->>IdP: Authenticate user (OIDC/SAML)
    IdP-->>Portal: ID token (groups, claims)
    Portal->>Aegis: POST /session-grant { idToken, requestedEndpoints }
    Aegis->>Aegis: Build Cedar entity graph from IdP claims
    Aegis->>Aegis: Evaluate Cedar policies for each requested endpoint
    Aegis-->>Portal: Session Delegation JWT { permittedScopes, relayId }
    Portal->>CP: Attach session delegation JWT to vendor job envelope
    CP->>Relay: Execute job (vendor job + session delegation JWT)
    Relay->>Relay: Verify both tokens; check scope
    Relay-->>CP: Result
```

### Session grant request

The browser sends the user's IdP token and the list of API endpoints the user wants to reach in this session. Aegis resolves each endpoint against the Cedar policy set.

```typescript
// POST /session-grant
{
  idToken: "<customer IdP JWT>",
  requestedEndpoints: [
    { host: "payments.internal", method: "GET", path: "/v1/orders/{id}" },
    { host: "payments.internal", method: "POST", path: "/v1/refunds" },
  ],
  relayId: "relay-01",
  environment: "prod"
}
```

### Cedar evaluation per endpoint

For each requested endpoint, Aegis issues one Cedar authorization query:

```typescript
// Cedar query for each requested endpoint
{
  principal: User::"alice@acme.com",     // from IdP token sub claim
  action:    Action::"callApiWrite",     // derived from HTTP method
  resource:  ApiEndpoint::"POST /v1/refunds",
  context: {
    environment: "prod",
    relayId:     "relay-01",
    mfaVerified: true,
    time:        "2026-04-03T09:12:00Z"
  }
}
```

Cedar returns `Allow` or `Deny` plus the set of determining policies. Aegis collects the permitted endpoints and encodes them into the session delegation JWT scope.

### Session delegation JWT scope

Only endpoints for which Cedar returned `Allow` are included in the JWT claims:

```json
{
  "sub": "alice@acme.com",
  "iss": "https://aegis.acme.internal",
  "exp": 1743757200,
  "relayId": "relay-01",
  "environment": "prod",
  "permittedScopes": [
    { "host": "payments.internal", "method": "GET", "path": "/v1/orders/{id}" }
  ]
}
```

The `POST /v1/refunds` endpoint was denied by policy and is absent from the scope. The Relay enforces this scope on execution: if a vendor job requests an endpoint not listed in the session delegation JWT, the Relay rejects it regardless of the vendor job's own claims.

### Entitlements returned to the portal

The session grant response also returns the permitted scopes to the portal so the UI can disable or hide controls for endpoints the user cannot access:

```typescript
// POST /session-grant response
{
  sessionJwt: "<signed session delegation JWT>",
  permittedScopes: [
    { host: "payments.internal", method: "GET", path: "/v1/orders/{id}" }
  ],
  deniedScopes: [
    { host: "payments.internal", method: "POST", path: "/v1/refunds", reason: "no matching permit policy" }
  ]
}
```

---

## Policy Deployment and Management

### Policy storage

Customer Cedar policies are stored as plain `.cedar` files alongside the Aegis deployment. They are treated as configuration — versioned in the customer's own repository and deployed via their CI/CD pipeline.

```
aegis/
├── policies/
│   ├── platform-engineers.cedar
│   ├── analysts.cedar
│   ├── contractors.cedar
│   └── deny-billing-contractors.cedar
├── schema.json          # Cedar schema for the Aegis entity model
└── entities.json        # Entity graph template (populated at runtime from IdP)
```

### Schema validation

Cedar validates all policies against `schema.json` at startup. Policies that reference entity types or attributes not present in the schema are rejected before Aegis serves any traffic. This prevents misconfigured policies from silently granting or denying access incorrectly.

### Policy set lifecycle

| Event | Action |
|---|---|
| Policy added | Deploy new `.cedar` file; Aegis hot-reloads on file change (or restart) |
| Policy updated | Replace `.cedar` file; existing sessions are unaffected until next session grant |
| Policy removed | Delete `.cedar` file; next session grant will re-evaluate without the removed policy |
| Schema change | Redeploy Aegis; all policies re-validated against new schema at startup |

Existing session delegation JWTs are not revoked when policies change — they remain valid until expiry. Customers requiring immediate revocation should use short JWT expiry windows (e.g. 15–60 minutes).

---

## Mapping IdP Groups to Cedar Principals

At session grant time, Aegis extracts group membership from the IdP token and constructs the Cedar entity graph for that user. This is the bridge between the customer's identity system and Cedar's principal hierarchy.

```typescript
// IdP token claims (OIDC)
{
  "sub": "alice@acme.com",
  "groups": ["platform-engineers", "billing-viewers"],
  "department": "Engineering"
}

// Translated Cedar entities
[
  {
    "uid": { "type": "User", "id": "alice@acme.com" },
    "attrs": { "email": "alice@acme.com", "department": "Engineering" },
    "parents": [
      { "type": "UserGroup", "id": "platform-engineers" },
      { "type": "UserGroup", "id": "billing-viewers" }
    ]
  },
  {
    "uid": { "type": "UserGroup", "id": "platform-engineers" },
    "attrs": { "displayName": "Platform Engineers" },
    "parents": []
  },
  {
    "uid": { "type": "UserGroup", "id": "billing-viewers" },
    "attrs": { "displayName": "Billing Viewers" },
    "parents": []
  }
]
```

Cedar's parent/child entity traversal means a policy written for `UserGroup::"platform-engineers"` automatically applies to all users who are members — no per-user policy duplication.

---

## Security Properties

| Property | Guarantee |
|---|---|
| **Default deny** | A user with no matching `permit` policy cannot access any endpoint. |
| **Explicit deny wins** | A `forbid` policy on billing endpoints cannot be overridden by a `permit` on the same resource. |
| **Scope binding** | The relay enforces the session delegation JWT scope on every execution. Cedar's decision at session grant time is the source of truth for that scope. |
| **No vendor bypass** | The SLAOps control plane cannot expand or forge session delegation JWTs — it holds whatever Aegis issued, and the Relay validates the Aegis signature independently. |
| **Auditability** | Every `permit` or `forbid` decision identifies the determining Cedar policy by ID. Aegis logs include policy IDs alongside session grant decisions, enabling forensic audit. |
| **Schema safety** | Cedar validates policies against the schema before any traffic is served. Type errors in policies are caught at deploy time, not runtime. |

---

## Related Documents

- [Aegis Token Broker Design](./aegis-token-broker-design) — session delegation model, dual-authorization design, and JWT structure
- [Cloud Relay Security](./cloud-relay-security) — authentication methods between Relay and SaaS control plane
- [Network Topology](./network-topology) — why Relay and Aegis are separate runtime components
- [Multi-Tenancy](../infrastructure/multi-tenancy) — per-tenant IAM and data isolation; Cedar operates at the user-within-tenant level
