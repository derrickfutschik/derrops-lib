# Update the Component Proposal for the Cloud Requester

@apps/slaops-docs/notes/proposals/component-cloud-requester.md

- I've changed my mind in having this part of the slaops-cloud, should be a separate application @apps/slaops-cloud-requester (also a nestjs module).
- @apps/slaops-cloud can then import the modules so to embed the cloud-requester into it's application, to reduce the amounts of artifacts to deploy, as well as reducing the remote calls made

# customers will be able to deploy the cloud-requester themselves

- support multiple deployment methods: Docker, Lambda
- customer can store secrets themselves and credentials maintaining sovereignty
- customers will then be able to control the network themselves

# Module Structure

- Therefore the code needs to be also in it's own repo, so it can be hosted publicly online.
- I want the same workflow as what I have currently with @apps/slaops-portal/, which has a subtree workflow. Reason being that this code may be potentially open-sourced, so customers can review and deploy themselves.
- Whilst I will be implementing this for AWS first (backed by secrets manager), I want the base application cloud agnostic, and then have implementations for different cloud providers.
- Unlike the other parts of the application, it should not follow the normal config approach, and rely on soley environmental variables, as to not need to use the config module etc, and minimize dependencies.

# Suggested module structure

- @apps/slaops-cloud-requester (git subtree repo, same way @apps/slaops-portal/ is a subtree
- @apps/slaops-cloud-requester/app, should contain the nestjs application, and be agnostic of any cloud provider
- @apps/slaops-cloud-requester/app-aws, Amazon AWS Implementation, using aws sam.
- @apps/slaops-cloud-requester/app-cp, Google Cloud GCP implementation.
- @apps/slaops-cloud-requester/app-azure, Microsoft Azure Implementation

# Token Exchange

What is a way using open standards out there ? Oauth, SSO, SAML APIkeys etc, in which I can create this postman style browser app, but minimize the amount the customer will need to trust it?
Thought for 26s

Yes. The best open-standards approach is usually:

Browser app + customer-controlled OAuth/OIDC backend proxy (BFF or token-mediating backend)

That is the cleanest way to let the browser app act like Postman while keeping long-lived credentials and refresh tokens out of the app itself. The current OAuth guidance for browser-based apps explicitly describes BFF and token-mediating backend patterns for this reason. In the BFF pattern, the backend is the confidential OAuth client, stores tokens server-side, and forwards API requests on behalf of the browser; in the token-mediating pattern, the backend still handles the sensitive OAuth work, but may return short-lived access tokens to the browser in some designs.

For your trust model, I would rank the options like this:

1. Best fit: customer-hosted BFF/proxy using OAuth 2.0 / OpenID Connect

Use:

OAuth 2.0 Authorization Code + PKCE
OpenID Connect for login/session
Backend as confidential client
HttpOnly, SameSite cookies between browser and proxy
Proxy injects access token when calling target API

Why this fits your requirement:

The browser never receives client secrets
The browser does not need refresh tokens
The customer can host the proxy themselves
Your app can be treated as mostly untrusted UI code
The proxy can enforce allowlists, audit logging, rate limits, outbound controls

This is very close to the standard BFF model described in the browser-based apps guidance: the BFF acts as a confidential client, keeps tokens out of the browser, and forwards API calls to the resource server.

2. Good fit when direct browser calls are required: token-mediating backend

Use:

Same OAuth/OIDC login flow
Backend performs token exchange and session handling
Browser may get only a short-lived access token
Refresh token stays on backend

This reduces trust compared with a full SPA-only model, but it is still weaker than a pure BFF because the access token can still reach the browser in some variants. The browser-based apps guidance explicitly notes that once the access token is exposed to browser code, it becomes vulnerable to theft by malicious code running in the browser.

3. Optional hardening: sender-constrained tokens

If the customer’s API gateway / auth stack supports it, add:

DPoP for browser-capable proof-of-possession tokens
or mTLS-bound tokens for server-side proxy cases

DPoP is an IETF standard for sender-constraining OAuth tokens, which helps detect replay attacks with stolen access or refresh tokens.

mTLS-bound tokens are stronger, but usually fit better when the proxy is server-side and customer-hosted, because browsers are awkward for mutual TLS at application scale. RFC 8705 covers certificate-bound access and refresh tokens.

4. For downstream APIs or customer-specific credentials: token exchange

If the proxy must call many customer APIs, or translate one identity into another, use:

OAuth 2.0 Token Exchange (RFC 8693)

This is useful when the proxy receives one token and needs a narrower, audience-specific token for a downstream API.

# Considerations

# Files

There also need to be integration to a file storage, as files are often needed in the uploads, 5MB payloads will not work alone
Being able to upload files via front-end presigned URLs will be needed.

# Secrets

# DSL

- There needs to be a DSL for secrete access, Har file requests will be sent from the SLAOPs Platform -> and then when the proxy in the customer accounts is sending a request, it will need to populate the secrets.

# Other requirements

- The cloud-requester should also have the abililty to retrieve secrets in an account, to be able to support OAuth Authorization, OAuth ID + Secret flows, retrieve API Keys, or even other planned less commonly used patterns such as Private JWT. There should be an interface in th
  e base app to cover the retrieval of secrets, with a standard for each.
- In the AWS SAM project should be configureable to use (Completely configuable VPC settings, either in a VPC or not, which subnets security groups etc. What timeout to use etc.
