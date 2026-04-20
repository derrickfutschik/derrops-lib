---
id: index
title: Cloud Relay
sidebar_label: Overview
sidebar_position: 1
tags: [cloud-relay, architecture]
---

# Cloud Relay

The Cloud Relay is a customer-deployed HTTP proxy that sits between the SLAOps portal and the customer's API endpoints. It solves four core problems for API testing: CORS restrictions, inconsistent timing, fixed egress IP requirements, and credential exposure.

## Documents in This Section

| Document                                                             | Description                                                                                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Component Design](./component-cloud-relay)                          | Full component design — scope, delivery modes, architecture                                                                      |
| [Network Topology](./network-topology)                               | Topology options, delivery mode selection, why Relay and Aegis are separate                                                      |
| [Relay Connection Design](./relay-connection)                        | How connections and trust are established between runtime components                                                             |
| [Aegis Token Broker](./aegis-token-broker-design)                    | Customer-controlled credential injection and session delegation                                                                  |
| [Local Relay](./local-relay)                                         | Local development relay for reaching `localhost` services                                                                        |
| [Security](./cloud-relay-security)                                   | Authentication methods between Relay and SLAOps control plane                                                                    |
| [Portal UI — Connection Management](./portal-connections-ui)         | UI design brief for managing relay and Aegis connections in the portal                                                           |
| [Aegis — Cedar Policy Authorization](./aegis-cedar-policy)           | Cedar Policy engine integration: entity model, schema, example policies, and session grant flow                                  |
| [API Tester — Relay Execution](./api-tester-relay-execution)         | End-to-end job execution flow: portal → slaops-cloud → SQS → relay → result                                                      |
| [API Tester — Connection Switcher](./api-tester-connection-switcher) | UX design for switching between relay connections and browser-direct mode in the API Tester                                      |
| [Secret Injection](./relay-secret-injection)                         | URI-based secret injection at request execution time — AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, HashiCorp Vault |

## Runtime Components

The SLAOps edge consists of three runtime components:

| Component                          | Deployed By          | Purpose                                     |
| ---------------------------------- | -------------------- | ------------------------------------------- |
| `slaops-cloud`                     | SLAOps (vendor SaaS) | Control plane, job scheduling, portal       |
| Cloud Relay (`apps/slaops-relay`)  | Customer             | HTTP proxy, job execution, network boundary |
| Aegis Broker (`apps/slaops-aegis`) | Customer (optional)  | Credential injection, session delegation    |

## Delivery Modes

| Mode             | Description                                | Relay Network Requirement                 |
| ---------------- | ------------------------------------------ | ----------------------------------------- |
| `direct`         | SLAOps calls relay synchronously           | Relay must accept inbound connections     |
| `relay-queue`    | SLAOps enqueues job, relay processes async | Relay must accept inbound connections     |
| `platform-queue` | Relay polls for jobs                       | Outbound-only — works behind NAT/firewall |
