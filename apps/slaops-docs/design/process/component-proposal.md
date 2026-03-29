---
sidebar_position: 2
title: Component Proposals
tags: [process]
---

# Component Proposals

This directory contains component proposals for the SLAOps platform. Each proposal follows the [Component Proposal Standard](./component-proposal-standard.md) and uses the [Component Proposal Template](https://github.com/derrickfutschik/slaops-platform/blob/main/COMPONENT_PROPOSAL_TEMPLATE.md).

## Purpose

Component proposals serve to:

- Document the design and architecture of new components before implementation
- Facilitate team review and discussion
- Capture decisions and trade-offs
- Provide implementation specifications
- Serve as historical documentation

## Creating a New Proposal

1. Copy the template from the repository root:

   ```bash
   cp COMPONENT_PROPOSAL_TEMPLATE.md apps/slaops-docs/docs/proposals/my-component-name.md
   ```

2. Add Docusaurus frontmatter at the top:

   ```yaml
   ---
   sidebar_position: [number]
   title: [Component Name]
   ---
   ```

3. Fill in all sections of the template

4. Review the [Example Component Proposal](./example-component-proposal.md) for guidance

5. Submit for review

## Proposal Lifecycle

Proposals go through these stages:

1. **Draft** - Initial proposal being written
2. **Under Review** - Shared with team for feedback
3. **Approved** - Accepted for implementation
4. **Implemented** - Completed and deployed
5. **Rejected** - Not moving forward (with rationale)

Update the `Status` field in your proposal to reflect the current stage.

## Active Proposals

Check the sidebar navigation to see all proposals in this directory.

## Resources

- [Component Proposal Standard](./component-proposal-standard.md) - How to write proposals
- [Example Component Proposal](./example-component-proposal.md) - Complete example
- [COMPONENT_PROPOSAL_TEMPLATE.md](https://github.com/derrickfutschik/slaops-platform/blob/main/COMPONENT_PROPOSAL_TEMPLATE.md) - Blank template

---

For questions about the proposal process, see the [Component Proposal Standard guide](./component-proposal-standard.md#getting-help).
