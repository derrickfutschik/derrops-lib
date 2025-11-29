import { hostTemplate, buildServerDoc } from '../../src/openapi/openapi-indexer';
import {
    HOST_SHAPE_CASES,
    AWS_S3_LEGACY_CASES,
    AWS_S3_VIRTUAL_HOST_CASES,
    AWS_S3_DUALSTACK_CASES,
    AWS_API_GATEWAY_REST_CASES,
    AWS_STS_CASES,
    AWS_OPENSEARCH_CASES,
    AWS_EVENTBRIDGE_PIPES_CASES,
    AWS_BEDROCK_CASES,
    AWS_CLOUDFRONT_CASES,
    AWS_ECR_CASES,
    AWS_LAMBDA_CASES,
    BASE_PATH_CASES,
    EDGE_CASES,
    DOC_EXAMPLE_CASES,
} from './openapi-indexer.fixture';

describe('openapi-indexer', () => {
    describe('hostShape', () => {
        test.each(HOST_SHAPE_CASES)('$name', ({ host, expected }) => {
            expect(hostTemplate(host)).toBe(expected);
        });
    });

    describe('buildServerDoc', () => {
        describe('AWS S3 - Legacy path-style', () => {
            test.each(AWS_S3_LEGACY_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS S3 - Virtual Host style', () => {
            test.each(AWS_S3_VIRTUAL_HOST_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS S3 - Dualstack', () => {
            test.each(AWS_S3_DUALSTACK_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS API Gateway REST API', () => {
            test.each(AWS_API_GATEWAY_REST_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS STS', () => {
            test.each(AWS_STS_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS OpenSearch', () => {
            test.each(AWS_OPENSEARCH_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS EventBridge Pipes', () => {
            test.each(AWS_EVENTBRIDGE_PIPES_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS Bedrock', () => {
            test.each(AWS_BEDROCK_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS CloudFront', () => {
            test.each(AWS_CLOUDFRONT_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS ECR', () => {
            test.each(AWS_ECR_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('AWS Lambda', () => {
            test.each(AWS_LAMBDA_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('Base path handling', () => {
            test.each(BASE_PATH_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('Edge cases', () => {
            test.each(EDGE_CASES)('$name', ({ server, expected }) => {
                expect(buildServerDoc(server)).toEqual(expected);
            });
        });

        describe('Real-world examples from documentation', () => {
            test.each(DOC_EXAMPLE_CASES)('$name', (testCase) => {
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
