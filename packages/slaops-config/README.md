### Where does configuration live?

## Git (policy layer)

### Answers

- What is allowed?
- Who approved it?
- When did it change?
- Why did it change?

### Rules

## SSM (Active Layer):

- What is the current value?
- What is the current status?
- What is the current lifecycle?
- What features are enabled?

## Tags (Metadata Layer):

- What is the current owner?

## Secrets Manager (Secrets Layer):

### Rules

- must be injected at runtime
- must not require rebuild
- must not be hardcoded
- must not leak secrets

# Codebase

## Codebase can depend on:

- configuration keys
- schemas
- allowed ranges
- environment shapes

Opinion
Should not have defaults!
(I think there shouldn't be any defaults in the codebase, and should alway be defined in the )

- runtime values
- secrets
- live endpoints

## Where should configuration live?

| Value type       | Where it lives   |
| ---------------- | ---------------- |
| Runtime behavior | SSM / Secrets    |
| System shape     | Git (IaC config) |
| Secrets          | Secrets Manager  |
| Feature flags    | SSM              |
