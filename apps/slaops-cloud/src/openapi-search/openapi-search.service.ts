import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { OpenApiSearchQueryDto } from './dto/openapi-search-query.dto';
import {
  OpenApiSearchResponseDto,
  OpenApiSearchHit,
  ProviderListResponseDto,
  IndexStatsResponseDto,
  SearchAggregations,
} from './dto/openapi-search-response.dto';
import { OpenApiIndexDocument } from './types';
import { Search, SearchResponse, TypescriptOSProxyClient } from 'opensearch-ts';

import { config } from '@slaops/slaops-config';

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

type ProviderListSearch = Search<OpenApiIndexDocument,
  {
    providers: {
      agg: "terms"
    }
  }>

type StatsSearch = Search<OpenApiIndexDocument,
  {
    totalOperations: {
      agg: "sum"
    },
    uniqueProviders: {
      agg: "cardinality"
    },
    uniqueTags: {
      agg: "cardinality"
    },
    lastIndexed: {
      agg: "max"
    }
  }>



/**
 * Service for searching OpenAPI specifications in OpenSearch
 */
@Injectable()
export class OpenApiSearchService implements OnModuleInit {
  private readonly logger = new Logger(OpenApiSearchService.name);
  private readonly indexName = config['opensearch.index.openapis']

  private client: Client;
  private tsClient: TypescriptOSProxyClient


  async onModuleInit() {
    const endpoint = config['opensearch.endpoint'];
    const region = config['aws.region'];

    if (!endpoint) {
      this.logger.warn('OPENSEARCH_ENDPOINT not configured, OpenAPI search will not be available');
      return;
    }

    try {
      this.client = new Client({
        ...AwsSigv4Signer({
          region,
          service: 'aoss', // OpenSearch Serverless
          getCredentials: () => {
            const credentialsProvider = defaultProvider();
            return credentialsProvider();
          },
        }),
        node: endpoint,
      });

      this.tsClient = new TypescriptOSProxyClient(this.client);

      this.logger.log(`Connected to OpenSearch at ${endpoint}`);
    } catch (error) {
      this.logger.error('Failed to initialize OpenSearch client', error);
    }
  }

  /**
   * Search OpenAPI specifications with filters and full-text search
   */
  async search(query: OpenApiSearchQueryDto): Promise<OpenApiSearchResponseDto> {
    if (!this.client) {
      return { total: 0, hits: [], took: 0 };
    }

    const searchBody = this.buildSearchQuery(query);
    const startTime = Date.now();

    try {
      const response = await this.tsClient.searchTS({ body: searchBody, index: this.indexName });

      const took = Date.now() - startTime;
      return this.transformSearchResponse(response, took);
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  /**
   * Get a single document by ID
   */
  async getById(id: string): Promise<OpenApiIndexDocument | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.get({
        index: this.indexName,
        id,
      });

      if (response.body.found) {
        return response.body._source as OpenApiIndexDocument;
      }
      return null;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      this.logger.error(`Failed to get document ${id}`, error);
      throw error;
    }
  }

  /**
   * List all unique providers with document counts
   */
  async listProviders(): Promise<ProviderListResponseDto[]> {
    if (!this.client) {
      return [];
    }

    try {
      const searchBody: ProviderListSearch = {
        size: 0,
        aggs: {
          providers: {
            terms: {
              field: 'provider',
              size: 1000,
            },
          },
        },
      };

      const response = await this.tsClient.searchTS({ body: searchBody, index: this.indexName });

      const buckets = response.aggregations?.providers?.buckets || [];
      return buckets.map((bucket: any) => ({
        provider: bucket.key,
        count: bucket.doc_count,
      }));
    } catch (error) {
      this.logger.error('Failed to list providers', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStatsResponseDto> {
    if (!this.client) {
      return {
        totalDocuments: 0,
        totalOperations: 0,
        uniqueProviders: 0,
        uniqueTags: 0,
      };
    }

    try {
      const searchBody: StatsSearch = {
        size: 0,
        aggs: {
          totalOperations: {
            sum: {
              field: 'operationStats.total',
            },
          },
          uniqueProviders: {
            cardinality: {
              field: 'provider',
            },
          },
          uniqueTags: {
            cardinality: {
              field: 'tags',
            },
          },
          lastIndexed: {
            max: {
              field: 'indexedAt' as any,
            },
          },
        },
      };

      const response = await this.tsClient.searchTS({ body: searchBody, index: this.indexName });

      const aggs = response.aggregations;
      return {
        totalDocuments: response.hits.total.value,
        totalOperations: aggs?.totalOperations?.value || 0,
        uniqueProviders: aggs?.uniqueProviders?.value || 0,
        uniqueTags: aggs?.uniqueTags?.value || 0,
        lastIndexedAt: aggs?.lastIndexed?.value_as_string,
      };
    } catch (error) {
      this.logger.error('Failed to get stats', error);
      throw error;
    }
  }



  /**
   * Build OpenSearch query DSL from search parameters
   */
  private buildSearchQuery(params: OpenApiSearchQueryDto): OpenAPISearch {

    /**
     * aggs: {
        providers: { terms: { field: 'provider', size: 50 } },
        tags: { terms: { field: 'tags', size: 100 } },
        methods: { terms: { field: 'operationStats.methods', size: 10 } },
        pathPrefixes: { terms: { field: 'operationStats.pathPrefixes', size: 50 } },
      },
     */



    const must: any[] = [];
    const filter: any[] = [];

    // Free-text search across multiple fields
    if (params.query) {
      must.push({
        multi_match: {
          query: params.query,
          fields: ['title^3', 'description^2', 'operationSearchText', 'tags^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Provider filter
    if (params.provider) {
      filter.push({
        term: { provider: params.provider },
      });
    }

    // Tags filter
    if (params.tags && params.tags.length > 0) {
      filter.push({
        terms: { tags: params.tags },
      });
    }

    // Method filter
    if (params.method) {
      filter.push({
        term: { 'operationStats.methods': params.method },
      });
    }

    // Path prefix filter
    if (params.pathPrefix) {
      filter.push({
        term: { 'operationStats.pathPrefixes': params.pathPrefix },
      });
    }

    // Operation ID filter
    if (params.operationId) {
      filter.push({
        term: { 'operationStats.operationIds': params.operationId },
      });
    }

    // Server pattern filter (wildcard)
    if (params.serverPattern) {
      filter.push({
        nested: {
          path: 'servers',
          query: {
            wildcard: { 'servers.url': `*${params.serverPattern}*` },
          },
        },
      });
    }

    // Build the query
    const query: any = {
      bool: {},
    };

    if (must.length > 0) {
      query.bool.must = must;
    }
    if (filter.length > 0) {
      query.bool.filter = filter;
    }

    // If no constraints, match all
    if (must.length === 0 && filter.length === 0) {
      query.bool.must = [{ match_all: {} }];
    }

    // Build sort
    let sort: any[] = [];
    if (params.sortField === '_score') {
      sort = [{ _score: { order: params.sortOrder } }];
    } else {
      sort = [{ [params.sortField!]: { order: params.sortOrder } }];
    }

    return {
      query,
      from: params.from || 0,
      size: params.size || 20,
      sort,
      aggs: {
        providers: { terms: { field: 'provider', size: 50 } },
        tags: { terms: { field: 'tags', size: 100 } },
        methods: { terms: { field: 'operationStats.methods', size: 10 } },
        pathPrefixes: { terms: { field: 'operationStats.pathPrefixes', size: 50 } },
      },
      highlight: {
        fields: {
          description: { number_of_fragments: 2 },
          operationSearchText: { number_of_fragments: 3 },
        },
      },
    };
  }

  /**
   * Transform OpenSearch response to our DTO format
   */
  private transformSearchResponse(response: SearchResponse<OpenApiIndexDocument, {
    providers: {
      agg: "terms";
    };
    tags: {
      agg: "terms";
    };
    methods: {
      agg: "terms";
    };
    pathPrefixes: {
      agg: "terms";
    };
  }>, took: number): OpenApiSearchResponseDto {

    const hits: OpenApiSearchHit[] = response.hits.hits.map((hit) => ({
      document: hit._source as OpenApiIndexDocument,
      score: hit._score,
      highlights: hit.highlight,
    }));

    const aggregations: SearchAggregations | undefined = response.aggregations
      ? {
        providers: (response.aggregations.providers?.buckets || []).map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
        tags: (response.aggregations.tags?.buckets || []).map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
        methods: (response.aggregations.methods?.buckets || []).map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
        pathPrefixes: (response.aggregations.pathPrefixes?.buckets || []).map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        })),
      }
      : undefined;

    return {
      total: response.hits.total.value,
      hits,
      aggregations,
      took,
    };
  }
}
