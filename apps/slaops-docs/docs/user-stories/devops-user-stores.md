---
slug: devops-stories
title: Devops User Stories
authors: [derrops]
---

## Infrastructure

### Folder Structure

- [ ] separate infrastructure folder from the backend folder
- [ ] backend folder to contain only the amplify/cdk code needed for the lambda function
- [ ] infrastructure folder to contain the code needed for various stacks (api gateway, rds, cognito, etc):

### Requester Deploys

- [ ] Deploy requester to AWS
- [ ] Deploy requester to local

### API Gateway

- [ ] Be defined in OpenAPI and CDK (backend module)
- [ ] Have Cognito auth configured
- [ ] Support features deploys by selecting different lambdas based off of the header

### RDS

- [ ] Defined by CDK (backend module)
- [ ] Serverless
- [ ] IAM Auth
- [ ] Feature Deploys per Schema

### Sign in

- [x] Sign in with Email configured
- [ ] Sign in with Google configured

### Local Proxy

- [ ] Landing page for all services that are used with the location where they are setup and links to documentation
- [ ] Proxy setup to switch between AWS and local environments for each service
