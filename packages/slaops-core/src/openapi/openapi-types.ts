import { OpenAPIV3_1 } from "openapi-types";


/**
 * Type for the server doc to be indexed into KeyValueStore.
 */
export type IndexedServerDoc = {
    api_id: string;
    host_template: string;
    base_path: string;
}


/**
 * Type for the operation doc to be indexed into KeyValueStore.
 */
export type IndexedOperationDoc = {
    api_id: string;
    operation_id: string;
    operation_path: string;
    method: OpenAPIV3_1.HttpMethods;
    total_components: number;
    // fixed_components: number;
    // var_components: number;
}


/**
 * 
 */
export type ServerIndexed = {
    server_id: string,
    server_scheme: string,
    server_index: number,
    server_path: string,
}

/**
 * Type for the operation item with the path and method from the OpenAPI specification
 */
export type OpenAPIOperationWithPathAndMethod = {
    method: OpenAPIV3_1.HttpMethods,
    path: string,
    operation: OpenAPIV3_1.OperationObject
}



// labels are fixed
// variables are dynamic

type PathComponent = "string" | "number" | "integer" | "boolean";

export type PathPart = {

    /** Fixed part of a controller path i.e. `user_id` in:  `users/{user_id}` */
    labels: string[],

    /** Fixed part of a controller path i.e. `user` in:  `users/{user_id}` */
    variables: string[],

    /** Assuming user_id is an integer then: [label,integer] */
    component: string,



}



export type OpenAPIIndexDoc = {

    "api_id": string,
    "api_version": string,
    "api_version_id": string,

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