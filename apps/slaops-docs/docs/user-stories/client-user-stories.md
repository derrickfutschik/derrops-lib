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

## OpenAPI Repository Functionality

As a Requester

- [ ] search for an OpenAPI specification by name or description
- [ ] search for an OpenAPI specification by what SAAS products I observe
- [x] see a list of all the OpenAPI specifications
- [x] see the details of an OpenAPI specification
- [x] add an OpenAPI specification
- [ ] edit an OpenAPI specification
- [ ] delete an OpenAPI specification

## OpenAPI Functionality

As a Requester

- [x] make requests according to the OpenAPI specification.
- [x] see the request including the default parameter values what they end up being
- [x] validate the request against the OpenAPI specification
- [x] validate the response against the OpenAPI specification
- [x] see OpenAPI documentation whenever applicable
- [x] jump to API documentation from hovering over a help link

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

- [ ] grant API access to individuals or teams without sharing the API key
- [ ] revoke API access to individuals or teams
