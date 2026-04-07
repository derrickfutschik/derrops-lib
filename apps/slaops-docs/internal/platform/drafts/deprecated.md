```json
{

        "api_id": api.info.title + "-" + api.info.version,
        "api_version": "1.0.0",

        // server
        "server_id": "aws-cloudtrail-https-1", // id of the server, this is the id of the server in the API specification if exists otherwise we generate it
        "server_scheme": "https", // schema/protocol
        "server_index": 0, // index of the server in the API specification
        "server_path": undefined, // path of the server, undefined if not specified

        //raw URL
        "raw_url": "https://cloudtrail.{region}.amazonaws.com",
        "raw_domain": "https://cloudtrail.{region}.amazonaws.com",

        // public suffix + one label
        "dns_suffix": "amazonaws.com",

        // labels *before* the dns_suffix
        "subdomain_labels": ["cloudtrail", "{region}"],

        // which positions are fixed vs variable
        "fixed_labels": ["cloudtrail"],
        "var_labels": ["region"],

        // optional, for debugging/extra matching
        "host_template": "cloudtrail.{region}.amazonaws.com",

        // any variables are replaced with *
        "host_shape": "cloudtrail.*.amazonaws.com",

        // base path of the API
        "base_path": "/v1/cloudtrail"
    }
```
