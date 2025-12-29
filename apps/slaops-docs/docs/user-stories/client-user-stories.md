---
slug: requester-stories
title: Requester User Stories
authors: [derrops]
tags: [requester, user-stories]
---

## General Functionality

As a Requester

- [x] sign in with AWS Cognito
- [x] sign out with AWS Cognito

## OpenAPI Functionality

As a Requester

- [x] make requests according to the OpenAPI specification.
- [x] see the request including the default parameter values what they end up being
- [x] validate the request against the OpenAPI specification
- [ ] validate the response against the OpenAPI specification
- [x] see OpenAPI documentation whenever applicable
- [ ] jump to API documentation from hovering over a help link

## Request Functionality

As a Requester

- [x] make requests according to the OpenAPI specification.
- [x] make requests in free form mode (Standard mode).
- [x] see a preview of the raw HTTP request

## Response Functionality

As a Requester

- [x] format the response as JSON, XML, or YAML
- [x] copy the response to the clipboard
- [x] save the response to a file
- [x] print the response
- [x] be able to filter the response via a JMESPath query
- [x] be able to highlight the response via a JMESPath query

## Secret Management

- [x] grant API access to individuals or teams without sharing the API key
- [x] revoke API access to individuals or teams
