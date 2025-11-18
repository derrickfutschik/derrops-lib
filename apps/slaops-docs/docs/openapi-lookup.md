# OpenAPI Lookup

Looking up the OpenAPI emphasizes the importance speed over completeness. This method facilitates rapid enrichment of logs in near-real-time. Using DynamoDB, most lookups can be done in single digit milliseconds, making Lambda Functions cheap and fast to run.

**Pseudocode**

```
match(API) = host_shape(request.host)
          AND request.path starts with API.base_path

choose the API with the longest base_path

```

## Indexing Strategy

###

Only the `host_shape` and the `base_path` are indexed.

| Field        | Key Type      | Description                                    | Example                      |
| ------------ | ------------- | ---------------------------------------------- | ---------------------------- |
| `host_shape` | Partition Key | The shape of the domain (replace vars with \*) | `cloudtrail.*.amazonaws.com` |
| `base_path`  | Sort Key      | The base path from the OpenAPI specification   | `/v1/cloudtrail`             |

**Example Cloudtrail**

| URL in OpenAPI Specification                 | Host Shape                   | Base Path |
| -------------------------------------------- | ---------------------------- | --------- |
| `https://cloudtrail.{region}.amazonaws.com/` | `cloudtrail.*.amazonaws.com` | `/`       |
| `https://cloudtrail.{region}.amazonaws.cn/`  | `cloudtrail.*.amazonaws.cn`  | `/`       |

**Example FooBar**

| URL in OpenAPI Specification              | Host Shape             | Base Path       |
| ----------------------------------------- | ---------------------- | --------------- |
| `https://checkout.adyen.com/`             | `checkout.*.adyen.com` | `/`             |
| `https://checkout.adyen.com/v6/payments/` | `checkout.*.adyen.com` | `/v6/payments/` |
| `https://checkout.adyen.com/v7/checkout/` | `checkout.*.adyen.com` | `/v7/checkout`  |
| `https://checkout.adyen.com/v6/refunds/`  | `checkout.*.adyen.com` | `/v6/refunds/`  |

Then the following requests will be matched:

| Request URL                                           | Matched API                               |
| ----------------------------------------------------- | ----------------------------------------- |
| `https://checkout.adyen.com/`                         | `https://checkout.adyen.com/`             |
| `https://checkout.adyen.com/v6/payments/largepayment` | `https://checkout.adyen.com/v6/payments/` |
| `https://checkout.adyen.com/v7/checkout/`             | `https://checkout.adyen.com/v7/checkout/` |
| `https://checkout.adyen.com/v6/refunds/smallrefund`   | `https://checkout.adyen.com/v6/refunds/`  |
