---
title: API Tester
sidebar_position: 6
description: Send HTTP requests through a relay from the Derrops Portal and inspect the results.
tags:
  - quickstart
  - api-tester
  - relay
---

# API Tester

The API Tester is the Portal's interface for sending HTTP requests. Unlike a browser-based tool, requests are executed by a relay running in your own infrastructure — which means they can reach private services, avoid CORS restrictions, measure real-world timing, and inject credentials without exposing secrets to the browser.

:::note Work in progress
The API Tester is under active development. This guide documents the intended behaviour and available features. Some capabilities may not yet be available in the current release.
:::

**Prerequisites**: A relay running and connected to the Portal ([local relay](./local-relay) or [cloud relay](./cloud-relay)).

---

## Opening the API Tester

In the Portal, select **API Tester** from the left sidebar.

The tester has three main areas:

```
┌────────────────────────────────────────────────────────┐
│  Relay selector        [Local relay ▼]  [Manage]       │
├────────────────────────────────────────────────────────┤
│  Method  │  URL                              [Send]    │
├──────────┴────────────────────────────────────────────-┤
│  Headers │ Query params │ Body │ Auth                  │
├────────────────────────────────────────────────────────┤
│  Response                                              │
│  Status │ Time │ Size │ Headers │ Body                 │
└────────────────────────────────────────────────────────┘
```

---

## Step 1 — Select a relay

Use the relay selector at the top of the page to choose which relay executes the request. Relays you have connected appear in the dropdown.

| Relay type        | Badge       | Use when                                                  |
| ----------------- | ----------- | --------------------------------------------------------- |
| Local dev relay   | **Local**   | Target is `localhost` or a service on your machine        |
| Self-hosted relay | _(none)_    | Target is in your cloud or private network                |
| Managed relay     | **Managed** | Target is publicly accessible and you want zero-ops setup |

:::tip Local targets
If you enter a `localhost` or `127.0.0.1` URL without a local relay selected, the Portal will prompt you to start one: run `derrops relay start` in your terminal.
:::

---

## Step 2 — Build your request

### Method and URL

Select an HTTP method from the dropdown (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) and enter the full target URL.

```
GET   https://api.example.com/v1/users
```

Path variables are supported using `{variable}` syntax. The tester resolves them from the params panel below the URL bar.

### Headers

Add request headers in the **Headers** tab. Each row has a key and value field. Toggle the checkbox at the start of a row to disable a header without deleting it.

Common headers are pre-populated for convenience (e.g. `Content-Type: application/json`).

### Query parameters

Add query string parameters in the **Query params** tab. Parameters are URL-encoded and appended to the request URL automatically. You can also type them directly in the URL bar — the tester keeps both in sync.

### Request body

Select the **Body** tab to add a request body. Choose a content type from the dropdown:

| Content type                        | When to use             |
| ----------------------------------- | ----------------------- |
| `application/json`                  | JSON APIs               |
| `application/x-www-form-urlencoded` | HTML form submissions   |
| `multipart/form-data`               | File uploads            |
| `text/plain`                        | Plain text body         |
| Raw                                 | Any custom content type |

The body editor provides syntax highlighting for JSON and XML.

---

## Step 3 — Use template expressions

Template expressions let you inject values at execution time — inside the relay, before the request leaves your network. The Portal user never sees the resolved values.

Expressions use double-brace syntax: `{{type:qualifier}}`.

### Secrets

Inject a secret from your relay's configured secret store:

```
Authorization: Bearer {{secret:MY_API_KEY}}
```

For structured (JSON) secrets, access a specific field:

```
Authorization: Bearer {{secret:stripe/api-key.secretKey}}
```

Secret backends supported:

| Expression                                      | Secret resolved from                               |
| ----------------------------------------------- | -------------------------------------------------- |
| `{{secret:MY_KEY}}`                             | Relay environment variable or default secret store |
| `{{secret:env:MY_KEY}}`                         | Relay environment variable explicitly              |
| `{{secret:aws-secrets-manager:path/to/secret}}` | AWS Secrets Manager                                |
| `{{secret:vault:secret/data/my-secret}}`        | HashiCorp Vault                                    |

### Just-in-time generated values

Generate dynamic values on each execution:

| Expression                  | Resolved to                                                 |
| --------------------------- | ----------------------------------------------------------- |
| `{{jit:uuid}}`              | Fresh UUID v4 (e.g. `f47ac10b-58cc-4372-a567-0e02b2c3d479`) |
| `{{jit:uuid-short}}`        | First 8 hex chars (e.g. `f47ac10b`)                         |
| `{{jit:timestamp}}`         | Current UTC timestamp (e.g. `2026-03-22T10:00:00.000Z`)     |
| `{{jit:timestamp-unix}}`    | Unix epoch in seconds                                       |
| `{{jit:timestamp-unix-ms}}` | Unix epoch in milliseconds                                  |
| `{{jit:random-hex:N}}`      | `N` random hex characters                                   |

Example — add a unique correlation ID to every request:

```
X-Request-Id: {{jit:uuid}}
```

### Named variables

Define reusable named variables in the **Variables** panel and reference them throughout your request:

```
{{var:BASE_URL}}/v1/users
```

Variables can be sourced from secrets, relay environment variables, or static literals. This is useful for parameterising shared request templates across environments.

Template expressions are resolved in:

- URL
- Header values
- Query parameter values
- Cookie values
- Request body

---

## Step 4 — Send the request

Click **Send**. The Portal dispatches the job to your selected relay. The relay executes the HTTP request from its network and returns the result.

While the request is in flight you will see a loading state in the response panel. Response time is measured from the relay's perspective — it represents actual network latency to the target service, not browser-to-portal latency.

---

## Reading the response

The response panel shows:

| Field       | Description                                                         |
| ----------- | ------------------------------------------------------------------- |
| **Status**  | HTTP status code and reason phrase (e.g. `200 OK`, `404 Not Found`) |
| **Time**    | Round-trip duration measured by the relay in milliseconds           |
| **Size**    | Response body size                                                  |
| **Headers** | Response headers, formatted as a key/value table                    |
| **Body**    | Response body with syntax highlighting (JSON, XML, HTML)            |

### Redacted secrets

If your request contained `{{secret:*}}` expressions, the response panel will show which secrets were used and confirm they were resolved — but will not display the resolved values. Any secret value that appears in the response body is automatically replaced with `[REDACTED:SECRET_NAME]` before it is sent back to the Portal.

---

## Importing requests

### From the browser network tab

The API Tester accepts requests pasted in [HAR format](http://www.softwareishard.com/blog/har-12-spec/#request). To import a request from Chrome or Firefox DevTools:

1. Open DevTools → Network tab.
2. Right-click a request and select **Copy → Copy as HAR** (Chrome) or **Copy Value → Copy as HAR** (Firefox).
3. In the API Tester, click **Import → Paste HAR** and paste the clipboard contents.

The tester will populate the method, URL, headers, query parameters, and body from the HAR entry.

### From an OpenAPI spec

If you have indexed your API's OpenAPI specification in [OASpec Bucket](/docs/oaspec-bucket), operations from your spec appear in the **Endpoints** panel on the left side of the tester. Click any operation to pre-fill the method, URL, and parameters.

---

## Managing relay connections

Click **Manage** next to the relay selector to open the connection manager. From here you can:

- **Add** a new relay connection (self-hosted or managed)
- **View** existing connections and their status
- **Delete** connections you no longer need

Changes to relay connections are stored per-tenant in the platform and apply to all team members.

---

## Troubleshooting

**Request times out**

- Confirm the relay process is running (`docker logs derrops-relay` or check the relay status in the Portal).
- Verify the target URL is reachable from the relay's network.
- Increase the timeout for slow upstream services (available in **Advanced** settings in the request panel).

**"No relay selected" error**

- Open the relay selector and choose a connected relay.
- If no relays are listed, add one via **Manage** or follow the [cloud relay guide](./cloud-relay).

**Secret not resolved**

- Confirm the secret ID matches the name in your relay's secret store.
- Check relay logs for `SecretStoreError` entries — the error code (`NOT_FOUND`, `ACCESS_DENIED`, `STORE_UNAVAILABLE`) tells you what went wrong.
- For `STORE_UNAVAILABLE`, check that the relay can reach your secret backend (AWS Secrets Manager endpoint, Vault URL, etc.).

**Aegis denied the request**

- Review the Aegis logs to see which policy evaluation failed.
- Confirm the user's IdP group membership maps to a `permit` policy covering the target host and action.
- See the [Aegis quickstart](./aegis) for policy configuration help.

**Response body is empty**

- Some APIs return a `204 No Content` or `304 Not Modified` with no body — this is correct behaviour.
- If you expected a body, check the `Content-Length` and `Transfer-Encoding` headers in the response panel.

---

## What's next

- **Set up SLA monitoring** → Portal → Monitoring
- **Configure alerts** → Portal → Alerts
- **Index your OpenAPI specs** for endpoint autocomplete → [OASpec Bucket](/docs/oaspec-bucket)
- **Add credential injection** → [Aegis quickstart](./aegis)
