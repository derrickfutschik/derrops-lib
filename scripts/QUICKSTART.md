# Dev Environment Quick Start

Start the full SLAOps dev environment with a single command.

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
| `slaops-docs`                                                      | Docusaurus dev server (`DOCS_PORT`)                    |
| `slaops-portal`                                                    | Vite dev server (`PORTAL_PORT`)                        |
| `slaops-cloud`                                                     | OpenSearch migrate → NestJS API (`CLOUD_PORT`)         |
| `slaops-relay`                                                     | Relay service (`RELAY_PORT`)                           |
| `slaops-aegis`                                                     | Aegis auth service (`AEGIS_PORT`)                      |
| `relay-aegis-setup`                                                | Polls until both services are up, then runs smoke test |
| `slaops-tests`                                                     | Vitest watch mode                                      |
| `devserver`                                                        | SSH shell into dev server                              |
| `opensearch` / `opensearch-dashboards` / `localstack` / `postgres` | Docker Compose log tails (remote)                      |
| `slaops-cloudflared`                                               | Cloudflare tunnel                                      |

## Configuring `.tmuxinator.env`

| Variable               | Default                                | Description                         |
| ---------------------- | -------------------------------------- | ----------------------------------- |
| `DEVSERVER_IP`         | `192.168.7.233`                        | Dev server IP for SSH windows       |
| `DEVSERVER_USER`       | `derrick`                              | SSH username                        |
| `DEVSERVER_PATH`       | `/home/derrick/slaops/slaops-platform` | Remote repo path                    |
| `DOCS_PORT`            | `3001`                                 | slaops-docs port                    |
| `PORTAL_PORT`          | `3000`                                 | slaops-portal port                  |
| `CLOUD_PORT`           | `8080`                                 | slaops-cloud port                   |
| `RELAY_PORT`           | `8081`                                 | slaops-relay port                   |
| `AEGIS_PORT`           | `8082`                                 | slaops-aegis port                   |
| `RELAY_QUEUE_BACKEND`  | `memory`                               | Queue backend for relay             |
| `RELAY_SECRET_BACKEND` | `env`                                  | Secret backend for relay            |
| `AEGIS_SIGNING_KEY_ID` | `aegis-dev-1`                          | Aegis signing key ID                |
| `ALLOWED_RELAY_IDS`    | `00000000-...relay1`                   | Relay IDs Aegis will issue JWTs for |

## Stop

```bash
tmuxinator stop slaops-apps
```
