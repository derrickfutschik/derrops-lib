# Client Controller

- Another product could be to control REST clients remotely from the platform, or for example have them add headers as needed for a given API such as an API key header.
- Generate trace or request IDs. Be able to replay requests if the credentials are provided for a given REST API.

## Dangerous

- Modify the request and response (Fix production issues before a deployment happens for quick bug fixes, handle deprecation etc. changes in a location)
- Cause a waits before & after request & response
- Rate Limit the requests some how
