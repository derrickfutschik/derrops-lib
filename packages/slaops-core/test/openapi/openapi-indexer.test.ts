import { hostShape, indexServer } from '../../src/openapi/openapi-indexer';
import { OpenAPIV3_1 } from 'openapi-types';

describe('openapi-indexer', () => {
    describe('hostShape', () => {
        it('should replace single variable with asterisk', () => {
            expect(hostShape('cloudtrail.{region}.amazonaws.com')).toBe('cloudtrail.*.amazonaws.com');
        });

        it('should replace multiple variables with asterisks', () => {
            expect(hostShape('{bucket}.s3.{region}.amazonaws.com')).toBe('*.s3.*.amazonaws.com');
        });

        it('should handle hostname with no variables', () => {
            expect(hostShape('cloudfront.amazonaws.com')).toBe('cloudfront.amazonaws.com');
        });

        it('should handle hostname with only domain', () => {
            expect(hostShape('sts.amazonaws.com')).toBe('sts.amazonaws.com');
        });

        it('should handle complex variable patterns', () => {
            expect(hostShape('{restapi-id}.execute-api.{region}.amazonaws.com')).toBe('*.execute-api.*.amazonaws.com');
        });

        it('should handle AWS account variables', () => {
            expect(hostShape('{aws_account}.dkr.ecr.{region}.amazonaws.com')).toBe('*.dkr.ecr.*.amazonaws.com');
        });

        it('should handle domain-only patterns', () => {
            expect(hostShape('search-{domain}.{region}.es.amazonaws.com')).toBe('search-*.*.es.amazonaws.com');
        });

        it('should handle Lambda function URLs', () => {
            expect(hostShape('{api-id}.lambda-url.{region}.on.aws')).toBe('*.lambda-url.*.on.aws');
        });

        it('should preserve static subdomains', () => {
            expect(hostShape('pipes.{region}.amazonaws.com')).toBe('pipes.*.amazonaws.com');
            expect(hostShape('bedrock-runtime.{region}.amazonaws.com')).toBe('bedrock-runtime.*.amazonaws.com');
            expect(hostShape('bedrock-agents-runtime.{region}.amazonaws.com')).toBe('bedrock-agents-runtime.*.amazonaws.com');
        });

        it('should handle dualstack pattern', () => {
            expect(hostShape('s3.dualstack.{region}.amazonaws.com')).toBe('s3.dualstack.*.amazonaws.com');
        });
    });

    describe('indexServer', () => {
        describe('AWS S3 - Legacy path-style', () => {
            it('should index S3 regional endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://s3.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 's3.*.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS S3 - Virtual Host style', () => {
            it('should index S3 virtual host style endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{bucket}.s3.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.s3.*.amazonaws.com',
                    base_path: '/',
                });
            });

            it('should handle S3 with base path', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{bucket}.s3.{region}.amazonaws.com/v1/files',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.s3.*.amazonaws.com',
                    base_path: '/v1/files',
                });
            });
        });

        describe('AWS S3 - Dualstack', () => {
            it('should index S3 dualstack endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://s3.dualstack.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 's3.dualstack.*.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS API Gateway REST API', () => {
            it('should index REST API endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{restapi-id}.execute-api.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.execute-api.*.amazonaws.com',
                    base_path: '/',
                });
            });

            it('should index REST API with stage', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{restapi-id}.execute-api.{region}.amazonaws.com/prod',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.execute-api.*.amazonaws.com',
                    base_path: '/prod',
                });
            });
        });

        describe('AWS STS', () => {
            it('should index global STS endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://sts.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'sts.amazonaws.com',
                    base_path: '/',
                });
            });

            it('should index regional STS endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://sts.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'sts.*.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS OpenSearch', () => {
            it('should index OpenSearch endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://search-{domain}.{region}.es.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'search-*.*.es.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS EventBridge Pipes', () => {
            it('should index EventBridge Pipes endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://pipes.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'pipes.*.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS Bedrock', () => {
            it('should index Bedrock Runtime endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://bedrock-runtime.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'bedrock-runtime.*.amazonaws.com',
                    base_path: '/',
                });
            });

            it('should index Bedrock Agents Runtime endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://bedrock-agents-runtime.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'bedrock-agents-runtime.*.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS CloudFront', () => {
            it('should index global CloudFront endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://cloudfront.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'cloudfront.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS ECR', () => {
            it('should index ECR Docker Registry endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{aws_account}.dkr.ecr.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.dkr.ecr.*.amazonaws.com',
                    base_path: '/',
                });
            });

            it('should index ECR Registries API endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{account}.dkr.ecr.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.dkr.ecr.*.amazonaws.com',
                    base_path: '/',
                });
            });
        });

        describe('AWS Lambda', () => {
            it('should index Lambda Invoke URL endpoint', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{api-id}.lambda-url.{region}.on.aws',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.lambda-url.*.on.aws',
                    base_path: '/',
                });
            });
        });

        describe('Base path handling', () => {
            it('should extract base path from URL', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com/v1/customers',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'api.example.com',
                    base_path: '/v1/customers',
                });
            });

            it('should handle nested base paths', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com/v1/shipping/customers',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'api.example.com',
                    base_path: '/v1/shipping/customers',
                });
            });

            it('should default to / when no base path', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'api.example.com',
                    base_path: '/',
                });
            });

            it('should handle trailing slash in base path', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com/v1/',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'api.example.com',
                    base_path: '/v1/',
                });
            });
        });

        describe('Edge cases', () => {
            it('should handle HTTP (non-HTTPS) URLs', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'http://api.example.com/v1',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'api.example.com',
                    base_path: '/v1',
                });
            });

            it('should handle port numbers', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com:8080/v1',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: 'api.example.com',
                    base_path: '/v1',
                });
            });

            it('should handle complex variable names', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{service_name}.{environment}.{region}.example.com/api',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.*.*.example.com',
                    base_path: '/api',
                });
            });

            it('should handle variables with underscores and hyphens', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://{tenant_id}.{region-code}.example.com',
                };

                const result = indexServer(server);

                expect(result).toEqual({
                    host_shape: '*.*.example.com',
                    base_path: '/',
                });
            });
        });

        describe('Real-world examples from documentation', () => {
            it('should handle CloudTrail example from docs', () => {
                const server: OpenAPIV3_1.ServerObject = {
                    url: 'https://cloudtrail.{region}.amazonaws.com',
                };

                const result = indexServer(server);

                expect(result.host_shape).toBe('cloudtrail.*.amazonaws.com');

                // This should match the actual request: cloudtrail.ap-southeast-9.amazonaws.com
                const actualHost = 'cloudtrail.ap-southeast-9.amazonaws.com';
                const hostPattern = result.host_shape.replace(/\*/g, '[^.]+');
                const regex = new RegExp(`^${hostPattern}$`);
                expect(regex.test(actualHost)).toBe(true);
            });

            it('should generate correct host_shape for multi-API domains', () => {
                // Example: Multiple APIs on same domain with different base paths
                const customerServer: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com/v1/shipping/customers',
                };
                const ordersServer: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com/v1/shipping/orders',
                };
                const productsServer: OpenAPIV3_1.ServerObject = {
                    url: 'https://api.example.com/v1/shipping/products',
                };

                const customerResult = indexServer(customerServer);
                const ordersResult = indexServer(ordersServer);
                const productsResult = indexServer(productsServer);

                // All should have same host_shape
                expect(customerResult.host_shape).toBe('api.example.com');
                expect(ordersResult.host_shape).toBe('api.example.com');
                expect(productsResult.host_shape).toBe('api.example.com');

                // But different base paths
                expect(customerResult.base_path).toBe('/v1/shipping/customers');
                expect(ordersResult.base_path).toBe('/v1/shipping/orders');
                expect(productsResult.base_path).toBe('/v1/shipping/products');
            });
        });
    });
});
