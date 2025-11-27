import { hostTemplate, buildServerDoc } from '../../src/openapi/openapi-indexer';
import { OpenAPIV3_1 } from 'openapi-types';

describe('openapi-indexer', () => {
    describe('hostShape', () => {
        const cases = [
            {
                name: 'should replace single variable with asterisk',
                host: 'cloudtrail.{region}.amazonaws.com',
                expected: 'cloudtrail.*.amazonaws.com',
            },
            {
                name: 'should replace multiple variables with asterisks',
                host: '{bucket}.s3.{region}.amazonaws.com',
                expected: '*.s3.*.amazonaws.com',
            },
            {
                name: 'should handle hostname with no variables',
                host: 'cloudfront.amazonaws.com',
                expected: 'cloudfront.amazonaws.com',
            },
            {
                name: 'should handle hostname with only domain',
                host: 'sts.amazonaws.com',
                expected: 'sts.amazonaws.com',
            },
            {
                name: 'should handle complex variable patterns',
                host: '{restapi-id}.execute-api.{region}.amazonaws.com',
                expected: '*.execute-api.*.amazonaws.com',
            },
            {
                name: 'should handle AWS account variables',
                host: '{aws_account}.dkr.ecr.{region}.amazonaws.com',
                expected: '*.dkr.ecr.*.amazonaws.com',
            },
            {
                name: 'should handle domain-only patterns',
                host: 'search-{domain}.{region}.es.amazonaws.com',
                expected: 'search-*.*.es.amazonaws.com',
            },
            {
                name: 'should handle Lambda function URLs',
                host: '{api-id}.lambda-url.{region}.on.aws',
                expected: '*.lambda-url.*.on.aws',
            },
            {
                name: 'should preserve static subdomains (pipes)',
                host: 'pipes.{region}.amazonaws.com',
                expected: 'pipes.*.amazonaws.com',
            },
            {
                name: 'should preserve static subdomains (bedrock-runtime)',
                host: 'bedrock-runtime.{region}.amazonaws.com',
                expected: 'bedrock-runtime.*.amazonaws.com',
            },
            {
                name: 'should preserve static subdomains (bedrock-agents-runtime)',
                host: 'bedrock-agents-runtime.{region}.amazonaws.com',
                expected: 'bedrock-agents-runtime.*.amazonaws.com',
            },
            {
                name: 'should handle dualstack pattern',
                host: 's3.dualstack.{region}.amazonaws.com',
                expected: 's3.dualstack.*.amazonaws.com',
            },
        ];

        test.each(cases)('$name', ({ host, expected }) => {
            expect(hostTemplate(host)).toBe(expected);
        });
    });

    describe('buildServerDoc', () => {
        describe('AWS S3 - Legacy path-style', () => {
            const cases: Array<{
                name: string;
                server: OpenAPIV3_1.ServerObject;
                expected: { host_template: string; base_path: string };
            }> = [
                    {
                        name: 'should index S3 regional endpoint',
                        server: { url: 'https://s3.{region}.amazonaws.com' },
                        expected: { host_template: 's3.*.amazonaws.com', base_path: '/' },
                    },
                ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS S3 - Virtual Host style', () => {
            const cases = [
                {
                    name: 'should index S3 virtual host style endpoint',
                    server: { url: 'https://{bucket}.s3.{region}.amazonaws.com' },
                    expected: { host_template: '*.s3.*.amazonaws.com', base_path: '/' },
                },
                {
                    name: 'should handle S3 with base path',
                    server: { url: 'https://{bucket}.s3.{region}.amazonaws.com/v1/files' },
                    expected: { host_template: '*.s3.*.amazonaws.com', base_path: '/v1/files' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS S3 - Dualstack', () => {
            const cases = [
                {
                    name: 'should index S3 dualstack endpoint',
                    server: { url: 'https://s3.dualstack.{region}.amazonaws.com' },
                    expected: { host_template: 's3.dualstack.*.amazonaws.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS API Gateway REST API', () => {
            const cases = [
                {
                    name: 'should index REST API endpoint',
                    server: { url: 'https://{restapi-id}.execute-api.{region}.amazonaws.com' },
                    expected: { host_template: '*.execute-api.*.amazonaws.com', base_path: '/' },
                },
                {
                    name: 'should index REST API with stage',
                    server: { url: 'https://{restapi-id}.execute-api.{region}.amazonaws.com/prod' },
                    expected: { host_template: '*.execute-api.*.amazonaws.com', base_path: '/prod' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS STS', () => {
            const cases = [
                {
                    name: 'should index global STS endpoint',
                    server: { url: 'https://sts.amazonaws.com' },
                    expected: { host_template: 'sts.amazonaws.com', base_path: '/' },
                },
                {
                    name: 'should index regional STS endpoint',
                    server: { url: 'https://sts.{region}.amazonaws.com' },
                    expected: { host_template: 'sts.*.amazonaws.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS OpenSearch', () => {
            const cases = [
                {
                    name: 'should index OpenSearch endpoint',
                    server: { url: 'https://search-{domain}.{region}.es.amazonaws.com' },
                    expected: { host_template: 'search-*.*.es.amazonaws.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS EventBridge Pipes', () => {
            const cases = [
                {
                    name: 'should index EventBridge Pipes endpoint',
                    server: { url: 'https://pipes.{region}.amazonaws.com' },
                    expected: { host_template: 'pipes.*.amazonaws.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS Bedrock', () => {
            const cases = [
                {
                    name: 'should index Bedrock Runtime endpoint',
                    server: { url: 'https://bedrock-runtime.{region}.amazonaws.com' },
                    expected: { host_template: 'bedrock-runtime.*.amazonaws.com', base_path: '/' },
                },
                {
                    name: 'should index Bedrock Agents Runtime endpoint',
                    server: { url: 'https://bedrock-agents-runtime.{region}.amazonaws.com' },
                    expected: { host_template: 'bedrock-agents-runtime.*.amazonaws.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS CloudFront', () => {
            const cases = [
                {
                    name: 'should index global CloudFront endpoint',
                    server: { url: 'https://cloudfront.amazonaws.com' },
                    expected: { host_template: 'cloudfront.amazonaws.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS ECR', () => {
            const cases = [
                {
                    name: 'should index ECR Docker Registry endpoint',
                    server: { url: 'https://{aws_account}.dkr.ecr.{region}.amazonaws.com' },
                    expected: { host_template: '*.dkr.ecr.*.amazonaws.com', base_path: '/' },
                },
                {
                    name: 'should index ECR Registries API endpoint',
                    server: { url: 'https://{account}.dkr.ecr.{region}.amazonaws.com' },
                    expected: { host_template: '*.dkr.ecr.*.amazonaws.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS Lambda', () => {
            const cases = [
                {
                    name: 'should index Lambda Invoke URL endpoint',
                    server: { url: 'https://{api-id}.lambda-url.{region}.on.aws' },
                    expected: { host_template: '*.lambda-url.*.on.aws', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('Base path handling', () => {
            const cases = [
                {
                    name: 'should extract base path from URL',
                    server: { url: 'https://api.example.com/v1/customers' },
                    expected: { host_template: 'api.example.com', base_path: '/v1/customers' },
                },
                {
                    name: 'should handle nested base paths',
                    server: { url: 'https://api.example.com/v1/shipping/customers' },
                    expected: { host_template: 'api.example.com', base_path: '/v1/shipping/customers' },
                },
                {
                    name: 'should default to / when no base path',
                    server: { url: 'https://api.example.com' },
                    expected: { host_template: 'api.example.com', base_path: '/' },
                },
                {
                    name: 'should handle trailing slash in base path',
                    server: { url: 'https://api.example.com/v1/' },
                    expected: { host_template: 'api.example.com', base_path: '/v1/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('Edge cases', () => {
            const cases = [
                {
                    name: 'should handle HTTP (non-HTTPS) URLs',
                    server: { url: 'http://api.example.com/v1' },
                    expected: { host_template: 'api.example.com', base_path: '/v1' },
                },
                {
                    name: 'should handle port numbers',
                    server: { url: 'https://api.example.com:8080/v1' },
                    expected: { host_template: 'api.example.com', base_path: '/v1' },
                },
                {
                    name: 'should handle complex variable names',
                    server: { url: 'https://{service_name}.{environment}.{region}.example.com/api' },
                    expected: { host_template: '*.*.*.example.com', base_path: '/api' },
                },
                {
                    name: 'should handle variables with underscores and hyphens',
                    server: { url: 'https://{tenant_id}.{region-code}.example.com' },
                    expected: { host_template: '*.*.example.com', base_path: '/' },
                },
            ];

            test.each(cases)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('Real-world examples from documentation', () => {
            type DocExampleCase =
                | {
                    name: string;
                    server: OpenAPIV3_1.ServerObject;
                    expectedHostShape: string;
                    actualHost?: string;
                }
                | {
                    name: string;
                    servers: Array<{ url: string; expectedBasePath: string }>;
                    expectedHostShape: string;
                };

            const cases: DocExampleCase[] = [
                {
                    name: 'should handle CloudTrail example from docs',
                    server: { url: 'https://cloudtrail.{region}.amazonaws.com' },
                    expectedHostShape: 'cloudtrail.*.amazonaws.com',
                    actualHost: 'cloudtrail.ap-southeast-9.amazonaws.com',
                },
                {
                    name: 'should generate correct host_template for multi-API domains',
                    servers: [
                        { url: 'https://api.example.com/v1/shipping/customers', expectedBasePath: '/v1/shipping/customers' },
                        { url: 'https://api.example.com/v1/shipping/orders', expectedBasePath: '/v1/shipping/orders' },
                        { url: 'https://api.example.com/v1/shipping/products', expectedBasePath: '/v1/shipping/products' },
                    ],
                    expectedHostShape: 'api.example.com',
                },
            ];

            test.each(cases)('$name', (testCase) => {
                if ('server' in testCase) {
                    const result = buildServerDoc(testCase.server);
                    expect(result.host_template).toBe(testCase.expectedHostShape);

                    if (testCase.actualHost) {
                        const hostPattern = result.host_template.replace(/\*/g, '[^.]+');
                        const regex = new RegExp(`^${hostPattern}$`);
                        expect(regex.test(testCase.actualHost)).toBe(true);
                    }
                } else {
                    const results = testCase.servers.map(({ url }) => buildServerDoc({ url }));

                    results.forEach((result) => {
                        expect(result.host_template).toBe(testCase.expectedHostShape);
                    });

                    results.forEach((result, index) => {
                        expect(result.base_path).toBe(testCase.servers[index]!.expectedBasePath);
                    });
                }
            });
        });
    });
});
