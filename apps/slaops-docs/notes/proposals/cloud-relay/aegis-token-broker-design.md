# Aegis Token Broker Design

```
Relay = execution engine + network boundary
```

1. a vendor job from your control plane
2. a customer-issued session delegation grant that your control plane cannot mint or expand

Security Model

:::important
SaaS control plane is not sufficient, by itself, to make the customer relay do work.
:::

What you want is a model where your SaaS control plane is not sufficient, by itself, to make the customer relay do work.

That means the relay should require two independent approvals — but enforced at **session grant time**, not per-request:

# Broker as a customer-controlled authorization service

- OpenAPI spec
- simple deploy (Docker)
- pluggable policy
- optional integration with their IdP

```mermaid
flowchart LR
    Browser --> SaaS
    Browser --> Broker
    Broker --> Token
    SaaS --> Token
    Token --> Relay
```

# Aegis Broker Design

## Broker | Relay Token Service Design

**Suggested service name:** **Aegis Broker**

Alternative names:

- Relay Authorization Service
- Execution Grant Broker
- API Entitlement Broker
- TrustBridge Broker

`Aegis Broker` works well because it suggests protection, guardrails, and policy enforcement between the SaaS control plane and the customer-hosted relay.

---

## 1. Purpose

Aegis Broker is a customer-controlled authorization and session delegation service used with a customer-hosted Relay. It integrates with the customer identity provider (SSO / IdP), evaluates customer policy at session start, issues a **session delegation JWT** to the SaaS control plane, and allows the Relay to verify that any request within that session was authorized by both:

1. the **vendor SaaS control plane**, and
2. the **customer-controlled broker** (via the session delegation JWT embedded in every relay job).

This prevents the SaaS control plane from unilaterally causing arbitrary executions through the customer Relay without a customer-issued session grant, while avoiding a per-request Aegis round trip.

---

## 2. Why per-request relay tokens are infeasible

Per-request relay tokens (issuing a new token from Aegis for every single API call) create unacceptable latency and a synchronous dependency on Aegis availability in the hot path of every user interaction:

| Problem                                            | Impact                                                 |
| -------------------------------------------------- | ------------------------------------------------------ |
| Aegis call added to every request                  | Doubles round trips for interactive use                |
| Aegis becomes a single point of failure            | Any Aegis downtime blocks all API calls                |
| High-frequency exploratory use                     | User firing multiple requests in sequence is throttled |
| No meaningful security gain for session-bound work | The user already authenticated at session start        |

The dual-authorization model is preserved by issuing the session delegation JWT **once at session start**, embedding it in every vendor job, and having the Relay verify it. Aegis is in the critical path once per session, not once per request.

---

## 3. Goals

### Primary goals

- Allow a browser-based HTTP client to execute requests without direct browser-to-target CORS dependency.
- Ensure the customer, not the SLAOPs platform, is the final authority for what APIs may be called.
- Support customer-hosted execution for internal and external APIs.
- Prevent the SaaS control plane from issuing relay jobs without a valid customer session grant.
- Support enterprise SSO and group-based authorization.
- Return entitlements to the main platform so users can see what APIs they can access.
- Avoid per-request Aegis round trips in the interactive request path.

### Non-goals

- The Broker is not intended to be a general API gateway.
- The Broker does not perform the outbound HTTP request itself.
- The browser must not hold downstream API secrets.
- The vendor SaaS control plane should not hold customer downstream API secrets.

---

## 4. Key terms

### Cloud Relay

The browser-based HTTP client UI used by the end user.

### SaaS Control Plane

Vendor-hosted platform responsible for UI orchestration, request modeling, API catalog, auditing, and signed job issuance.

### SSO IdP

Customer identity provider used to authenticate the user.

### Aegis Broker

Customer-controlled authorization and session delegation service.

### Relay

Customer-hosted execution component that performs the outbound HTTP request to the target API.

### Vendor IdP

Vendor identity / trust issuer used by the SaaS control plane to sign vendor job envelopes.

### Session Delegation JWT

A customer-issued short-lived grant issued by Aegis to the SaaS control plane at session start. Covers a set of API scopes, environments, and relay IDs for the authenticated user. Embedded in every vendor job envelope so the Relay can verify customer authorization without calling Aegis per request.

### Vendor Job Envelope

A vendor-signed job payload carrying the request intent and the session delegation JWT.

---

## 5. High-level architecture

```mermaid
flowchart LR
    U[User] --> B[Web Browser / SLAOps Portal]
    B --> IDP[Customer SSO IdP]
    B --> CP[SaaS Control Plane]
    B --> BR[Aegis Broker]
    BR --> CP
    CP --> VIDP[Vendor IdP / Signing Authority]
    CP --> R[Customer Relay]
    R --> API[Target APIs\nPublic or Internal]
    R --> CP

    subgraph End User
      U
      B
    end

    subgraph SLAOPs Control Plane
      CP
      VIDP
    end

    subgraph Customer Control Plane
      BR
      R
      IDP
    end

    subgraph Vendor Control Plane
        API
    end
```

---

## 6. Trust model

The Relay only executes a request when all of the following are true:

1. The **Vendor Job Envelope** is valid and signed by the vendor.
2. The **Session Delegation JWT** embedded in the job is valid and signed by the customer Broker.
3. The requested operation is within the session delegation JWT scope.
4. The Relay's local safety controls also allow it.

This creates a **dual-authorization model**:

- **Vendor approval**: request came through the official platform.
- **Customer approval**: SaaS control plane holds a valid customer-issued session grant.

Neither side can independently force execution. The session delegation JWT is issued at session start by Aegis and is opaque to the SaaS control plane — it cannot mint or expand its own grants.

---

## 7. Deployment model

### Recommended enterprise deployment

- **Cloud Relay** runs in the browser.
- **SaaS Control Plane** runs in vendor infrastructure.
- **Aegis Broker** runs in customer infrastructure.
- **Relay** runs in customer infrastructure.
- **SSO IdP** is customer-controlled.
- **Vendor IdP / signing authority** is vendor-controlled.

### Broker runtime options

- Lambda + API Gateway
- ECS / Kubernetes service
- Internal VM / container service
- Existing enterprise middleware service

### Broker UI options

The Broker should be designed **service-first**. UI is optional.

Supported operating models:

1. **Service-only**
   - policy via config / database / GitOps
   - group mapping managed externally
2. **Service + admin UI**
   - delegated admin
   - API entitlements management
   - access visibility
3. **Hybrid**
   - policy managed in customer systems
   - Broker exposes only APIs and entitlement lookup

---

## 8. End-to-end request flow

### 8.1 Session start (once per session)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant WB as Web Browser / Cloud Relay
    participant IDP as Customer SSO IdP
    participant BR as Aegis Broker
    participant CP as SaaS Control Plane

    U->>WB: Open Cloud Relay / start session
    WB->>IDP: Authenticate user
    IDP-->>WB: User session token
    WB->>BR: Request session delegation JWT\n(user token + requested API scopes)
    BR->>BR: Validate user identity\nResolve groups and policy\nEvaluate requested scopes
    BR-->>WB: Session Delegation JWT\n(customer-signed, scoped, short-lived)
    WB->>CP: Register session\n(pass session delegation JWT)
    CP->>CP: Store delegation JWT for this session
    CP-->>WB: Session ready + entitlements
```

### 8.2 Per-request execution (N times per session, no Aegis round trip)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant WB as Web Browser / Cloud Relay
    participant CP as SaaS Control Plane
    participant VIDP as Vendor IdP / Signing Authority
    participant R as Customer Relay
    participant API as Target API

    U->>WB: Initiate API request
    WB->>CP: Submit intended request
    CP->>CP: Check session delegation JWT covers this request
    CP->>VIDP: Sign Vendor Job Envelope\n(embed session delegation JWT)
    VIDP-->>CP: Signed vendor job
    CP->>R: Send job envelope\n(contains delegation JWT + vendor signature)
    R->>R: Validate vendor signature
    R->>R: Validate session delegation JWT signature and scope
    R->>R: Apply local hard safety rules
    R->>API: Execute outbound HTTP request
    API-->>R: Response
    R-->>CP: Response metadata / payload
    CP-->>WB: Display result to user
```

---

## 9. Flow diagram

```mermaid
flowchart TD
    A[User opens Cloud Relay] --> B[Browser Authenticates via SSO]
    B --> C[Browser requests Session Delegation JWT from Aegis]
    C --> D[Aegis evaluates policy and user groups]
    D -->|Allowed| E[Aegis issues Session Delegation JWT]
    D -->|Denied| X[Return authorization denied]
    E --> F[Browser registers session with SaaS CP]
    F --> G[User builds and submits request]
    G --> H[SaaS CP validates request against delegation JWT scope]
    H -->|Out of scope| Y[Return scope violation]
    H -->|In scope| I[SaaS CP creates Vendor Job Envelope\nembeds session delegation JWT]
    I --> J[Relay validates vendor signature]
    J --> K[Relay validates session delegation JWT\nsignature and scope]
    K -->|Pass| L[Relay executes API request]
    K -->|Fail| Z[Reject job]
    L --> M[Relay returns response and audit metadata]
    M --> N[SaaS CP presents result]
```

---

## 10. Broker responsibilities

### Identity responsibilities

- validate user identity context from customer SSO at session start
- resolve user groups / roles / claims
- map user to workspace or environment entitlements

### Authorization responsibilities

- evaluate whether the user may access a given set of APIs, environments, and methods
- issue short-lived Session Delegation JWTs scoped to the user's entitlements
- return user entitlements to the SaaS control plane
- revoke active sessions if required (via JWT expiry or a revocation list)

### Administrative responsibilities

- expose entitlement APIs
- optionally expose admin APIs / UI for policy management
- optionally sync or map a global API catalog into local entitlements

---

## 11. Relay responsibilities

- validate vendor job signature
- validate session delegation JWT signature
- enforce delegation JWT scope constraints
- enforce hard local safety rules
- execute outbound HTTP request
- use customer-owned downstream credentials
- produce audit events and execution logs

---

## 12. Why the Broker exists

Without the Broker, the SaaS control plane could sign jobs continuously and the Relay would have no independent customer approval mechanism.

The Broker exists so that:

- the customer controls authorization policy
- the customer signs the session delegation JWT at session start
- the Relay enforces customer limits on every execution without calling Aegis per request
- entitlements can be surfaced back into the SaaS platform

Aegis is in the **critical path once per session**, not once per request. The session delegation JWT carries the customer's approval into every job the SaaS CP creates for that session.

---

## 13. Broker UI and admin model

### Should the Broker have a UI?

**Optional, but useful.**

For many enterprises, first approval is easier if the Broker is only a service with configuration-driven policy.

A UI becomes useful when the customer wants:

- delegated admin
- self-service onboarding of APIs
- group-to-API mapping
- environment-specific visibility
- approval workflows

### Recommended rollout

#### Phase 1

- service-only Broker
- config or DB-backed policy
- entitlement APIs
- no mandatory UI

#### Phase 2

- optional admin UI
- policy editor
- entitlement management
- sync with main platform catalog

---

## 14. Main platform integration for API catalog visibility

The SaaS control plane should remain the **global catalog and user experience layer**.

The Broker should remain the **local authorization oracle**.

### Recommended split

#### SaaS Control Plane

- global API directory
- search / discovery
- request builder UI
- execution history
- audit views
- entitlement-aware presentation

#### Broker

- session delegation grant issuance
- final local authorization decision at session start
- user entitlement resolution
- mapping of customer groups to APIs / environments / methods / paths

### Example integration

At session start, the platform receives the delegation JWT and can show:

- APIs available to the user
- environments they may use
- methods / paths allowed
- denial reasons where appropriate

During the session, the platform checks each request against the cached delegation JWT scope without contacting Aegis again.

---

## 15. Architecture diagram

```mermaid
classDiagram
    class CloudRelay {
      +buildRequest()
      +authenticateUser()
      +requestSessionDelegation()
      +submitRequestIntent()
      +displayResponse()
    }

    class SaaSControlPlane {
      +issueJob()
      +signVendorEnvelope()
      +checkDelegationScope()
      +presentCatalog()
      +recordAudit()
    }

    class CustomerSSOIdP {
      +authenticate()
      +issueUserToken()
      +publishJWKS()
    }

    class VendorIdP {
      +signVendorJob()
      +publishJWKS()
    }

    class AegisBroker {
      +validateUserIdentity()
      +evaluatePolicy()
      +issueSessionDelegationJWT()
      +listEntitlements()
      +adminPolicyUpdate()
      +revokeSession()
    }

    class Relay {
      +validateVendorJob()
      +validateSessionDelegationJWT()
      +enforceSafetyRules()
      +executeHttpRequest()
      +emitAuditEvent()
    }

    class TargetAPI {
      +handleRequest()
    }

    CloudRelay --> CustomerSSOIdP
    CloudRelay --> AegisBroker
    CloudRelay --> SaaSControlPlane
    SaaSControlPlane --> VendorIdP
    SaaSControlPlane --> Relay
    Relay --> TargetAPI
    AegisBroker --> CustomerSSOIdP
```

---

## 16. Domain model / class diagram

```mermaid
classDiagram
    class UserContext {
      +userId: string
      +tenantId: string
      +groups: string[]
      +claims: map
    }

    class ApiEntitlement {
      +apiId: string
      +environment: string
      +allowedHosts: string[]
      +allowedMethods: string[]
      +pathPatterns: string[]
      +relayIds: string[]
    }

    class SessionDelegationJWT {
      +iss: string
      +sub: string
      +aud: string
      +exp: number
      +jti: string
      +tenantId: string
      +workspaceId: string
      +scopes: DelegationScope[]
    }

    class DelegationScope {
      +apiId: string
      +environment: string
      +allowedHosts: string[]
      +allowedMethods: string[]
      +pathPatterns: string[]
      +relayIds: string[]
      +maxBodyBytes: number
    }

    class VendorJobEnvelope {
      +jobId: string
      +tenantId: string
      +relayId: string
      +request: ExecutionRequest
      +sessionDelegationJWT: string
      +signature: string
    }

    class ExecutionRequest {
      +method: string
      +url: string
      +headers: map
      +bodyRef: string
      +timeoutMs: number
    }

    class PolicyRule {
      +ruleId: string
      +effect: string
      +groupMatch: string[]
      +apiMatch: string[]
      +environmentMatch: string[]
    }

    UserContext --> ApiEntitlement
    ApiEntitlement --> DelegationScope
    SessionDelegationJWT --> DelegationScope
    VendorJobEnvelope --> ExecutionRequest
    VendorJobEnvelope --> SessionDelegationJWT
    PolicyRule --> ApiEntitlement
```

---

## 17. Authorization patterns

### Pattern A (recommended): Browser authenticates with Aegis directly at session start

1. Browser authenticates user with customer SSO.
2. Browser requests Session Delegation JWT from Aegis (user token + requested scopes).
3. Aegis validates identity, evaluates policy, issues session delegation JWT.
4. Browser passes delegation JWT to SaaS control plane to register the session.
5. SaaS CP embeds delegation JWT in every vendor job for the session — no further Aegis calls.

**Recommended default** for enterprise deployments. Aegis has direct proof of user identity. The SaaS control plane cannot fabricate or extend delegation JWTs.

### Pattern B: Control plane requests session delegation on behalf of user

1. Browser authenticates user with customer SSO.
2. Browser submits request intent to SaaS control plane with user identity proof.
3. SaaS control plane calls Aegis on behalf of the user to get a session delegation JWT.
4. Aegis validates user context and issues JWT.
5. SaaS CP embeds delegation JWT in vendor jobs.

Simpler browser flow (Aegis does not need to be CORS-accessible), but weakens non-repudiation — Aegis trusts SLAOps to faithfully relay user identity.

---

## 18. Relay API contract

### 18.1 Submit execution job

**Endpoint**

```http
POST /v1/jobs/execute
```

**Headers**

```http
Content-Type: application/json
Authorization: Bearer <vendor-control-plane-token>
X-Vendor-Signature: <optional detached signature>
X-Request-Id: <uuid>
```

**Request body**

```json
{
  "jobId": "job_01JX...",
  "tenantId": "westpac-uat",
  "workspaceId": "payments-team",
  "relayId": "relay-westpac-uat-01",
  "submittedAt": "2026-03-22T10:00:00Z",
  "expiresAt": "2026-03-22T10:01:00Z",
  "request": {
    "method": "POST",
    "url": "https://api.partner.com/v1/payments",
    "headers": {
      "content-type": "application/json",
      "accept": "application/json"
    },
    "body": {
      "encoding": "utf-8",
      "contentType": "application/json",
      "content": "{\"amount\":100}"
    },
    "timeoutMs": 15000,
    "followRedirects": false
  },
  "sessionDelegationJWT": "<customer-signed-jwt>",
  "vendorJobSignature": "<vendor-signed-jws>"
}
```

**Response**

```json
{
  "jobId": "job_01JX...",
  "status": "SUCCEEDED",
  "response": {
    "statusCode": 200,
    "headers": {
      "content-type": "application/json"
    },
    "body": "{\"status\":\"ok\"}",
    "durationMs": 423
  },
  "audit": {
    "decision": "ALLOW",
    "ruleId": "payments-uat-post",
    "sessionDelegationJti": "7db3d2af-...",
    "vendorJobId": "job_01JX..."
  }
}
```

### 18.2 Get job status

```http
GET /v1/jobs/{jobId}
```

### 18.3 Health endpoint

```http
GET /v1/health
```

### 18.4 Relay metadata / capabilities

```http
GET /v1/capabilities
```

Example response:

```json
{
  "relayId": "relay-westpac-uat-01",
  "status": "ONLINE",
  "version": "1.2.0",
  "supports": {
    "mTLS": true,
    "http2": true,
    "websocket": false,
    "streaming": true
  }
}
```

---

## 19. Broker API contract

### 19.1 Issue session delegation JWT

```http
POST /v1/sessions
```

**Request**

```json
{
  "tenantId": "westpac-uat",
  "userToken": "<customer-sso-id-token>",
  "requestedScopes": [
    {
      "apiId": "partner-payments",
      "environment": "uat",
      "relayId": "relay-westpac-uat-01"
    },
    {
      "apiId": "customer-profile",
      "environment": "uat",
      "relayId": "relay-westpac-uat-01"
    }
  ]
}
```

**Response**

```json
{
  "sessionDelegationJWT": "<customer-signed-jwt>",
  "expiresAt": "2026-03-22T10:30:00Z",
  "grantedScopes": [
    {
      "apiId": "partner-payments",
      "environment": "uat",
      "allowedMethods": ["GET", "POST"],
      "pathPatterns": ["/v1/payments/*"],
      "relayIds": ["relay-westpac-uat-01"],
      "maxBodyBytes": 262144
    },
    {
      "apiId": "customer-profile",
      "environment": "uat",
      "allowedMethods": ["GET"],
      "pathPatterns": ["/v2/profile/*"],
      "relayIds": ["relay-westpac-uat-01"]
    }
  ],
  "deniedScopes": []
}
```

### 19.2 Revoke session

```http
DELETE /v1/sessions/{jti}
```

### 19.3 List user entitlements

```http
GET /v1/entitlements?tenantId=westpac-uat&userId=derrick@example.com
```

**Response**

```json
{
  "tenantId": "westpac-uat",
  "userId": "derrick@example.com",
  "apis": [
    {
      "apiId": "partner-payments",
      "displayName": "Partner Payments API",
      "environments": ["sandbox", "uat"],
      "allowedMethods": ["GET", "POST"],
      "pathPatterns": ["/v1/payments/*"],
      "relayIds": ["relay-westpac-uat-01"]
    },
    {
      "apiId": "customer-profile",
      "displayName": "Customer Profile API",
      "environments": ["uat"],
      "allowedMethods": ["GET"],
      "pathPatterns": ["/v2/profile/*"],
      "relayIds": ["relay-westpac-uat-01"]
    }
  ]
}
```

### 19.4 Admin policy APIs

#### Upsert policy rule

```http
PUT /v1/admin/policies/{policyId}
```

#### Get policies

```http
GET /v1/admin/policies
```

#### Test decision

```http
POST /v1/admin/policy-decisions/test
```

---

## 20. Job payload format

The Vendor Job Envelope should be explicit, auditable, and signed. The session delegation JWT replaces per-request relay tokens.

### Canonical job format

```json
{
  "jobId": "job_01JX...",
  "version": "2.0",
  "tenantId": "westpac-uat",
  "workspaceId": "payments-team",
  "relayId": "relay-westpac-uat-01",
  "user": {
    "userId": "derrick@example.com",
    "displayName": "Derrick Futschik"
  },
  "request": {
    "method": "POST",
    "url": "https://api.partner.com/v1/payments",
    "headers": {
      "content-type": "application/json",
      "accept": "application/json"
    },
    "body": {
      "contentType": "application/json",
      "encoding": "utf-8",
      "content": "{\"amount\":100}"
    },
    "timeoutMs": 15000,
    "followRedirects": false,
    "maxResponseBodyBytes": 1048576
  },
  "sessionDelegationJWT": "<customer-signed-jwt>",
  "submittedAt": "2026-03-22T10:00:00Z",
  "expiresAt": "2026-03-22T10:01:00Z",
  "trace": {
    "requestId": "6c7b8408-...",
    "correlationId": "6c7b8408-..."
  },
  "vendorJobSignature": "<vendor-signed-jws>"
}
```

### Design notes

- `jobId` is unique per execution.
- `relayId` binds the request to a specific Relay.
- `sessionDelegationJWT` is opaque to the SaaS control plane except for transport — it cannot mint or extend it.
- `expiresAt` keeps jobs short-lived even when the session delegation JWT is longer-lived.
- `vendorJobSignature` protects request integrity.
- `trace` supports auditability.
- **No per-request Aegis call** — the Relay verifies the delegation JWT locally against Broker's published key set.

---

## 21. Session Delegation JWT format

### Suggested JWT claims

```json
{
  "iss": "https://broker.customer.example",
  "sub": "derrick@example.com",
  "aud": "slaops-control-plane",
  "iat": 1774068000,
  "exp": 1774069800,
  "jti": "7db3d2af-0f90-44b2-b98e-6f17f5f9a1df",
  "tenantId": "westpac-uat",
  "workspaceId": "payments-team",
  "scopes": [
    {
      "apiId": "partner-payments",
      "environment": "uat",
      "relayIds": ["relay-westpac-uat-01"],
      "allowedHosts": ["api.partner.com"],
      "allowedMethods": ["GET", "POST"],
      "pathPatterns": ["/v1/payments/*"],
      "maxBodyBytes": 262144
    },
    {
      "apiId": "customer-profile",
      "environment": "uat",
      "relayIds": ["relay-westpac-uat-01"],
      "allowedHosts": ["api.internal.westpac.com"],
      "allowedMethods": ["GET"],
      "pathPatterns": ["/v2/profile/*"],
      "maxBodyBytes": 65536
    }
  ]
}
```

### Recommended properties

- TTL of 15–60 minutes (session-length, not request-length)
- `jti` for session revocation lookups
- audience bound to the SaaS control plane (not the Relay directly)
- scoped to specific APIs, environments, relay IDs
- the Relay validates the JWT against Broker's published JWKS without calling Aegis

---

## 22. Validation flow step-by-step

### Step 1: Receive job

Relay receives `POST /v1/jobs/execute`.

### Step 2: Validate job envelope shape

Check schema, required fields, and version.

### Step 3: Validate job freshness

Reject if:

- `expiresAt` is in the past
- job timestamp outside tolerated skew

### Step 4: Validate vendor signature

Verify the `vendorJobSignature` using the vendor trust key set.

Checks:

- signature valid
- issuer trusted
- relay ID matches this Relay
- tenant binding valid
- job payload not tampered with

### Step 5: Validate Session Delegation JWT signature

Verify `sessionDelegationJWT` using Broker / customer trust key set (fetched from Broker's JWKS endpoint at startup, cached with TTL rotation).

Checks:

- signature valid
- issuer trusted
- token not expired
- token issued for correct tenant / workspace

### Step 6: Session revocation check (optional)

If the customer configures revocation, check the `jti` against Broker's revocation list. For most deployments, short TTL (15–30 min) makes this optional.

### Step 7: Validate request against delegation JWT scopes

Compare the requested execution against the scopes in the delegation JWT:

- method allowed for this apiId
- host allowed
- path allowed
- body size within limit
- relay ID is in the allowed relay list
- redirect behavior allowed

### Step 8: Apply Relay local hard safety rules

These rules are non-bypassable.

Examples:

- block localhost
- block private / loopback / link-local IPs unless explicitly allowed for private relay mode
- block metadata endpoints
- enforce protocol and port restrictions
- strip dangerous headers

### Step 9: Resolve destination and perform safety checks

Resolve DNS if required and evaluate destination safety based on local configuration.

### Step 10: Attach customer-managed downstream credentials

Relay injects the credential mode configured for this target:

- API key
- OAuth client credential token
- mTLS certificate
- internal service identity

### Step 11: Execute outbound HTTP request

Relay sends the request to the target API.

### Step 12: Capture response and audit event

Record:

- status code
- duration
- response size
- allow / deny decision
- matching policy scope
- session delegation JWT `jti`

### Step 13: Return result

Send the response back to the SaaS control plane for presentation to the browser.

---

## 23. Detailed validation sequence diagram

```mermaid
sequenceDiagram
    autonumber
    participant CP as SaaS Control Plane
    participant R as Relay
    participant VKS as Vendor Key Set
    participant BKS as Broker Key Set (cached)
    participant API as Target API

    CP->>R: Submit Vendor Job Envelope\n(contains sessionDelegationJWT)
    R->>R: Validate schema and freshness
    R->>VKS: Verify vendor job signature
    VKS-->>R: Signature valid
    R->>BKS: Verify session delegation JWT signature\n(local cache, no Aegis call)
    BKS-->>R: Signature valid
    R->>R: Check delegation JWT not expired
    R->>R: Check method / host / path / body against delegation scopes
    R->>R: Apply local hard safety rules
    R->>API: Execute HTTP request
    API-->>R: Response
    R-->>CP: Response + audit metadata
```

---

## 24. Entitlement discovery flow

```mermaid
sequenceDiagram
    autonumber
    participant WB as Web Browser / Cloud Relay
    participant CP as SaaS Control Plane
    participant BR as Aegis Broker

    WB->>CP: Open API catalog
    CP->>BR: Request entitlements for user
    BR->>BR: Resolve user groups and policy
    BR-->>CP: List allowed APIs / methods / environments / relays
    CP-->>WB: Show entitled APIs in catalog
```

---

## 25. Policy model

### Recommended coarse-to-fine approach

#### Coarse access

Managed through customer IdP groups, such as:

- `payments-read`
- `payments-write`
- `uat-users`
- `prod-approvers`

#### Fine-grained access

Managed in Broker policy, such as:

- allowed API IDs
- allowed environments
- allowed methods
- allowed path patterns
- allowed Relay IDs
- max body size
- time windows
- session TTL

### Example policy rule

```json
{
  "policyId": "payments-uat-post",
  "groups": ["payments-write", "uat-users"],
  "apiId": "partner-payments",
  "environment": "uat",
  "relayIds": ["relay-westpac-uat-01"],
  "allowedHosts": ["api.partner.com"],
  "allowedMethods": ["POST"],
  "pathPatterns": ["/v1/payments/*"],
  "maxBodyBytes": 262144,
  "sessionTtlSeconds": 1800
}
```

---

## 26. Suggested admin UI capabilities

If an admin UI is later added, recommended capabilities are:

- view APIs known from the global catalog
- map customer groups to APIs / environments
- assign Relay IDs to environments
- define path / method constraints
- test policy decisions
- inspect denied requests
- revoke active sessions
- rotate Broker signing keys
- view Relay health and version

---

## 27. Security recommendations

- Use short-to-medium TTL session delegation JWTs (15–60 minutes).
- Broker signing keys published via JWKS and cached by the Relay at startup.
- Rotate JWKS keys on a schedule; Relay re-fetches on key ID miss.
- Bind session delegation JWT to tenant and workspace.
- Keep downstream credentials only in the Relay.
- Treat Relay safety rules as immutable local controls.
- Use signed job envelopes rather than unsigned requests.
- Log metadata by default, not raw secrets or bodies.
- Separate global catalog visibility from local execution permission.
- Support session revocation via `jti` list for high-security tenants.

---

## 28. Recommended product positioning

### Main platform

- global API catalog
- search and discovery
- browser request builder
- execution history
- audit and reporting
- user experience and workflow

### Aegis Broker

- customer authorization authority
- session delegation grant issuer
- entitlement provider
- JWKS publisher for Relay validation
- optional admin policy plane

### Relay

- execution engine
- credential holder
- network boundary
- policy enforcement point
- validates delegation JWT locally (no Aegis call per request)

---

## 29. Final recommendation

Use **Aegis Broker** as the customer-controlled authorization and session delegation service, paired with a customer-hosted Relay.

The dual-authorization model is preserved: neither the SaaS control plane nor the Relay can act without a valid customer-issued session delegation JWT. Aegis is in the critical path **once per session**, not once per request.

This design gives:

- strong enterprise trust boundaries
- customer control over authorization
- no per-request Aegis latency in the interactive request path
- browser usability without target-side CORS dependency
- clean separation between vendor control plane and customer execution plane
- a path to rich entitlement-aware catalog UX in the main platform
- session revocation capability for high-security tenants
