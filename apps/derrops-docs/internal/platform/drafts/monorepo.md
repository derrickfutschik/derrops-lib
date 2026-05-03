# Derrops Monorepo

The following diagram shows the dependencies between the packages in the Derrops monorepo.

```mermaid
graph TD
    %% Packages
    public["@derrops/public<br/>(shared utilities)<br/>No workspace deps"]
    private["@derrops/private<br/>(core types & utilities)<br/>Private package"]
    client["@derrops/client<br/>(base HTTP client)"]
    axios["@derrops/client-nodejs-axios<br/>(Axios client)"]
    test["@derrops/test<br/>(integration tests)<br/>Dev deps on all packages"]

    %% Apps
    docs["derrops-docs<br/>(Docusaurus)"]
    portal["derrops-portal<br/>(React dashboard)"]

    %% Dependencies (edges point from dependent to dependency)
    private --> public
    client --> public
    axios --> client
    axios --> public
    test -.-> public
    test -.-> private
    test -.-> client
    test -.-> axios

    %% Styling
    classDef baseStyle fill:#90EE90,stroke:#228B22,stroke-width:3px
    classDef packageStyle fill:#e1f5ff,stroke:#0066cc,stroke-width:2px
    classDef appStyle fill:#fff4e1,stroke:#cc6600,stroke-width:2px
    classDef privateStyle fill:#ffe1e1,stroke:#cc0000,stroke-width:2px
    classDef testStyle fill:#f0e1ff,stroke:#6600cc,stroke-width:2px

    class public baseStyle
    class client,axios packageStyle
    class docs,portal appStyle
    class private privateStyle
    class test testStyle

```

Clean Dependency Structure:

1. @derrops/public (base foundation) - No workspace dependencies ✅
2. @derrops/private → depends on @derrops/public
3. @derrops/client → depends on @derrops/public
4. @derrops/client-nodejs-axios → depends on @derrops/client + @derrops/public
5. @derrops/test → dev dependencies on all packages (built last)
6. Apps (docs, portal) - No workspace dependencies, standalone

Build Order:

`@derrops/public` → `@derrops/private` → `@derrops/client` → `@derrops/client-nodejs-axios` → `@derrops/test`
