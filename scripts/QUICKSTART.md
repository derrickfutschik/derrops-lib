# Dev Environment Quick Start

Start the full Derrops dev environment with a single command.

## First-time setup

The tmuxinator config reads all ports, hostnames, and service config from `.tmuxinator.env`. This file is not generated — it ships with defaults you can override.

```bash
# From the repo root — nothing to change for a standard local setup
cat .tmuxinator.env
```

If you need a non-default devserver IP or different ports, edit `.tmuxinator.env` before starting.

## Start

```bash
# From the repo root
./scripts/quickstart.sh
```

Or manually, if you prefer:

```bash
source .tmuxinator.env && tmuxinator start -p .tmuxinator.yml
```

## What opens

| Window                                                             | What it runs                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `root`                                                             | Git / build shell                                      |
| `derrops-docs`                                                     | Docusaurus dev server (`DOCS_PORT`)                    |
| `derrops-portal`                                                   | Vite dev server (`PORTAL_PORT`)                        |
| `derrops-cloud`                                                    | OpenSearch migrate → NestJS API (`CLOUD_PORT`)         |
| `derrops-relay`                                                    | Relay service (`RELAY_PORT`)                           |
| `derrops-aegis`                                                    | Aegis auth service (`AEGIS_PORT`)                      |
| `relay-aegis-setup`                                                | Polls until both services are up, then runs smoke test |
| `derrops-tests`                                                    | Vitest watch mode                                      |
| `devserver`                                                        | SSH shell into dev server                              |
| `opensearch` / `opensearch-dashboards` / `localstack` / `postgres` | Docker Compose log tails (remote)                      |
| `derrops-cloudflared`                                              | Cloudflare tunnel                                      |

## Configuring `.tmuxinator.env`

| Variable               | Default                                  | Description                         |
| ---------------------- | ---------------------------------------- | ----------------------------------- |
| `DEVSERVER_IP`         | `192.168.7.233`                          | Dev server IP for SSH windows       |
| `DEVSERVER_USER`       | `derrick`                                | SSH username                        |
| `DEVSERVER_PATH`       | `/home/derrick/derrops/derrops-platform` | Remote repo path                    |
| `DOCS_PORT`            | `3001`                                   | derrops-docs port                   |
| `PORTAL_PORT`          | `3000`                                   | derrops-portal port                 |
| `CLOUD_PORT`           | `8080`                                   | derrops-cloud port                  |
| `RELAY_PORT`           | `8081`                                   | derrops-relay port                  |
| `AEGIS_PORT`           | `8082`                                   | derrops-aegis port                  |
| `RELAY_QUEUE_BACKEND`  | `memory`                                 | Queue backend for relay             |
| `RELAY_SECRET_BACKEND` | `env`                                    | Secret backend for relay            |
| `AEGIS_SIGNING_KEY_ID` | `aegis-dev-1`                            | Aegis signing key ID                |
| `ALLOWED_RELAY_IDS`    | `00000000-...relay1`                     | Relay IDs Aegis will issue JWTs for |

## Stop

```bash
tmuxinator stop derrops-apps
```
