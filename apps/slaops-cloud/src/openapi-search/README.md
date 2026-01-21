Prefer to use the opensearch-ts client for the openapi-search service.

This involves first constructing the cilent if not done so already, then using the client to search the index.

```ts
    const tsClient = new TypescriptOSProxyClient(this.client);
```

For each search, first construct type representing the shape of the search:

```ts
type OpenAPISearch = Search<OpenApiIndexDocument,
  {

    providers: {
      agg: "terms"
    },

    tags: {
      agg: "terms"
    },

    methods: {
      agg: "terms"
    },

    pathPrefixes: {
      agg: "terms"
    }

  }>
```

Then use the client to search the index:

```ts
const response = await tsClient.searchTS({ body: searchBody, index: this.indexName });
```

The response is a SearchResponse<OpenApiIndexDocument, OpenAPISearch> object, which is strongly typed and can be destructured to get the data you need.