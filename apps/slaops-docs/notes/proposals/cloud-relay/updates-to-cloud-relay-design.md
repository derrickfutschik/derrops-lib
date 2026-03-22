# Update the Component Proposal for the Cloud Relay

@apps/slaops-docs/notes/proposals/component-cloud-relay.md

- I've changed my mind in having this part of the slaops-cloud, should be a separate application @apps/slaops-cloud-relay (also a nestjs module).
- @apps/slaops-cloud can then import the modules so to embed the cloud-relay into it's application, to reduce the amounts of artifacts to deploy, as well as reducing the remote calls made

# customers will be able to deploy the cloud-relay themselves

- support multiple deployment methods: Docker, Lambda
- customer can store secrets themselves and credentials maintaining sovereignty
- customers will then be able to control the network themselves

# Module Structure

- Therefore the code needs to be also in it's own repo, so it can be hosted publicly online.
- I want the same workflow as what I have currently with @apps/slaops-portal/, which has a subtree workflow. Reason being that this code may be potentially open-sourced, so customers can review and deploy themselves.
- Whilst I will be implementing this for AWS first (backed by secrets manager), I want the base application cloud agnostic, and then have implementations for different cloud providers.
- Unlike the other parts of the application, it should not follow the normal config approach, and rely on solely environmental variables, as to not need to use the config module etc, and minimize dependencies.

# Suggested module structure

- @apps/slaops-cloud-relay git subtree repo, same way @apps/slaops-portal/ is a subtree
- @apps/slaops-cloud-relay/app, should contain the nestjs application, and be agnostic of any cloud provider
- @apps/slaops-cloud-relay/app-aws, Amazon AWS Implementation, using aws sam.
- @apps/slaops-cloud-relay/app-cp, Google Cloud GCP implementation.
- @apps/slaops-cloud-relay/app-azure, Microsoft Azure Implementation
