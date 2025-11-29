# SLAOps Monorepo

The following diagram shows the dependencies between the packages in the SLAOps monorepo.

```mermaid
graph TD
    %% Packages
    public["@slaops/public<br/>(shared utilities)<br/>No workspace deps"]
    private["@slaops/private<br/>(core types & utilities)<br/>Private package"]
    client["@slaops/client<br/>(base HTTP client)"]
    axios["@slaops/client-nodejs-axios<br/>(Axios client)"]

    %% Apps
    docs["slaops-docs<br/>(Docusaurus)"]
    portal["slaops-portal<br/>(React dashboard)"]

    %% Dependencies (edges point from dependent to dependency)
    private --> public
    client --> public
    axios --> client
    axios --> public

    %% Styling
    classDef baseStyle fill:#90EE90,stroke:#228B22,stroke-width:3px
    classDef packageStyle fill:#e1f5ff,stroke:#0066cc,stroke-width:2px
    classDef appStyle fill:#fff4e1,stroke:#cc6600,stroke-width:2px
    classDef privateStyle fill:#ffe1e1,stroke:#cc0000,stroke-width:2px

    class public baseStyle
    class client,axios packageStyle
    class docs,portal appStyle
    class private privateStyle

```

Clean Dependency Structure:

1. @slaops/public (base foundation) - No workspace dependencies ✅
2. @slaops/private → depends on @slaops/public
3. @slaops/client → depends on @slaops/public
4. @slaops/client-nodejs-axios → depends on @slaops/client + @slaops/public
5. Apps (docs, portal) - No workspace dependencies, standalone

Build Order:

Build Order:
`@slaops/public` → `@slaops/private` → `@slaops/client` → `@slaops/client-nodejs-axios`
