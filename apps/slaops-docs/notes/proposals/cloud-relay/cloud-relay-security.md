---
sidebar_position: 13
title: Cloud Relay Security
---

# Authentication Methods

Customers have varying authentication methods which they need to support given their approved security patterns.

## MTLS

- From Cloud Relay back to SLAOps
- Customers will get a custom domain to make calls back to the SLAOps platform
- Customers can then upload a Certificate Authority certificate, which will be used as the truststore for their dedicated subdomain

## Private JWT Auth private_key_jwt

- When the SLAOps platform makes calls too the Cloud-Relay, it will use `private_key_jwt` to authenticate
- SLAOPs will host a public key for private Auth so it can authenticate with the Cloud-Relay.
- SLAOps will also host a auth endpoint for the Cloud-Relay to get a JWT token to authenticate with the SLAOps platform.

## AWS IAM Authentication

- Customers on AWS can host their own AWS Gateway and use IAM authentication for Cloud-Relay to authenticate

## JWT

- Customers can use an OAuth provider such as AWS Cognito, and share the Client ID and Client Secret with the SLAOps platform
- SLAOps will use the Client ID and Client Secret to authenticate with the OAuth provider and get a JWT token
- SLAOps will use the JWT token to authenticate with Cloud-Relay and make calls

## HMAC

- Customers can use a HMAC key to authenticate with the Cloud-Relay
- SLAOps will use the HMAC key to authenticate with Cloud-Relay and make calls
