# DevOps

This document contains information about things I have to do in the Devops Platform.

# Today TODO

```javascript
// @nestjs/event-emitter

// emit
this.eventEmitter.emit('user.created', { userId: 123 });

// listen
@OnEvent('user.created')
handleUserCreated(payload: any) {
  // do something
}
```

- [ ] Go to Gym
- [ ] Whole, create, update, delete, import OpenAPI Specs on the Platform. API Spec Indexing and Searching on the Platform
      API Specs will need to have multiple indexes:
- Operations
- API Itself
- Servers to find the correct server
  I also need to decide if they will also live in the database, my feeling is that all application entities should live in the database, and maintain a list for the most up-to-date API Spec, although there is an argument to be made that again, this should be done in opensearch to keep all datasources needed by observability entirely in opensearch. This will need to be decided.

- [ ] Match a request based off of the indexed API specs
- [ ] Redesign of the OpenAPI Operation Panel
- [ ] Show matching in the OpenAPI Operation Panel
- [ ] If there is a fuzzy match, provide a mechanism to select the correct operation and correct the spec

# Next TODO

- [ ] OpenAPI OpenAPI Logging into OpenSearch
- [ ] View the OpenAPI Logging into Opensearch

# Next Next TODO

- [ ] Proper Job monitoring and management, handling failed jobs, configure retries, configuring jobs in parallel, etc.

# TODO after that

- [ ] The OpenAPI App Logging into OpenSearch

# TODO Nice to have

- [ ] Derrops Docs, quick knowledge-base indexing for opensearch, in local development.
- [ ] Mono repo for the Blog

# Must do before the first release

- [ ] Create New AWS Account
- [ ] Rename Platform to Derrops Platform
- [ ] Host the needed NPM Registries
- [ ] Host the Opensource Registries
- [ ] Some sort of Roadmap
