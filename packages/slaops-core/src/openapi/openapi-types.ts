export type OpenAPIIndexDoc = {
    "api_id": string,
    "api_version": string,

    // server
    "server_id": string, // id of the server, this is the id of the server in the API specification if exists otherwise we generate it
    "server_scheme": string, // schema/protocol
    "server_index": number, // index of the server in the API specification
    "server_path": string | undefined, // path of the server, undefined if not specified

    //raw URL
    "raw_url": string,
    "raw_domain": string,

    // public suffix + one label
    "dns_suffix": string,

    // labels *before* the dns_suffix
    "subdomain_labels": string[],

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