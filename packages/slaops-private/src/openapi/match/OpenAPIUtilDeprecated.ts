import * as t from "./types"

import * as _ from 'lodash';

import { OpenAPIV3, OpenAPIV3_1, } from "openapi-types";
// var Url = require('url-parse');

import OpenAPIRequestValidator from 'openapi-request-validator';



import { EnrichedOperationObject, EnrichedOperationObjectWithValidation, HttpRequest, ParamInRequest, RelativeRequest, RequestParameterObject } from "./types";


function flatMapOperations<T extends {} = {}>(doc: OpenAPIV3_1.Document<T>) {
    return Object.entries(doc.paths!)
        .flatMap(([path, pathObj]) =>
            Object.entries(pathObj!)
                .flatMap(([method, operation]) => ({
                    path,
                    method: method as OpenAPIV3_1.HttpMethods,
                    operation: operation as OpenAPIV3_1.OperationObject
                }))
        )
}

const cleanPath = (path: string) =>
    "/" + path
        .replace(" ", "")
        .split("/").filter(t => t !== "")
        .join("/")


export function calculatePath(url: string, serverUrl: string) {

    const urlSplit = url.split("/")
    const serverSplit = serverUrl.split("/")

    const sLength = serverSplit.length
    const rLength = urlSplit.length

    return urlSplit.slice(sLength, rLength).join("/");

}

export function findOperation<T extends {} = {}>(request: HttpRequest, doc: OpenAPIV3_1.Document<T>): EnrichedOperationObject {
    const url = new URL(request.url)
    const path = doc.servers && doc.servers.length > 0 ? calculatePath(request.url, doc.servers?.[0]!.url) : new URL(url).pathname
    const operation = matchPath({ ...request, path }, doc)?.operation
    // defaults for operations
    return {
        ...operation,
        parameters: operation?.parameters ?? [],
        restops: {
            path: findPath(doc, operation!.operationId!)?.path!
        }
    } as EnrichedOperationObject
}

export function validateRequest<T extends {} = {}>(request: HttpRequest, operation: OpenAPIV3_1.OperationObject, doc: OpenAPIV3_1.Document<T>): t.Validation {

    // const schemas = Object.entries(doc.components?.schemas!).map(([key, value]) => ({ id: `#/definitions/${key}`, properties: value.properties }))
    // const validatorInput = { ...operation, schemas }

    const url = new URL(request.url)

    const newRequest = {
        ...request,
        headers: { ...(request.headers || []), "content-type": "application/json" },
        url: `${url.protocol}//${url.host}/${calculatePath(request.url, doc.servers?.[0]!.url!)}`,

        // TODO - populate path parameters based off API spec
        query: request.query,

        // TODO - populate path parameters based off API spec and url if params not specified
        params: request.params
    }
    // Destructure requestBody separately to handle potential ReferenceObject
    const { requestBody, ...operationWithoutBody } = operation;
    const validatorInput = {
        ...operationWithoutBody,
        schemas: doc.components?.schemas!,
        // Only include requestBody if it's not a ReferenceObject (doesn't have $ref)
        // Cast to any to handle OpenAPIV3_1 -> OpenAPIV3 type compatibility
        requestBody: requestBody && '$ref' in requestBody ? undefined : requestBody
    } as any;
    const requestValidator = new OpenAPIRequestValidator(validatorInput)
    return requestValidator.validateRequest(newRequest) as t.Validation
}



export function buildRequestObjects(p: OpenAPIV3.ParameterObject, validation: t.Validation, request: HttpRequest): RequestParameterObject {

    const path = (p.in + "." + p.name)
    const input = (p.in === "header" ? request.headers![p.name] : request.query![p.name])
    const value = input ?? (p.schema as OpenAPIV3_1.SchemaObject)?.default
    const validationP = validation.errors.find(er => (er.location.replace("headers", "header") + "." + er.path).toLowerCase() === path.toLowerCase())

    return {
        path,
        input,
        value,
        validation: validationP
    }
}


// find a list of all parameters, mark if they exist or not in the schema





export function mapErrorToParamRequest(err: t.ValidationError, request: HttpRequest, operation: OpenAPIV3_1.OperationObject): RequestParameterObject {

    switch (err.location) {
        case "body":
            return mapBody(err, request)
        case "query":
            return mapQuery(err, request, operation)
        case "headers":
            return mapHeader(err, request, operation)
    }

}




function validParam(path: string, location: "body" | "query" | "headers"): t.ValidationError {
    return {
        path,
        errorCode: "valid",
        message: "valid",
        location
    }
}

export function enrichOperationWithValidation(request: HttpRequest, operation: EnrichedOperationObject, validation: t.Validation = { status: 200, errors: [] }, buildInfo?: t.BuildInfo): EnrichedOperationObjectWithValidation {

    const parameters: ParamInRequest[] = operation.parameters
        ?.map(p => p as OpenAPIV3_1.ParameterObject)
        .map(param => ({ param, input: findInput(operation.restops.path, param.in, param.name, request) }))
        .map(({ param, input }) => ({
            ...param,
            restops: {
                defined: input !== undefined,
                input: {
                    input: String(input),
                    value: input ?? (param.schema as OpenAPIV3.SchemaObject).default,
                } as t.ParameterInput,
                // TODO
                validation: validation.errors.find(error => error.location === param.in && error.path == param.name) ?? { errorCode: "valid", message: "valid" }
            }
        }))!

    return {
        ...operation,
        parameters
    }
}

export function mapRequestToParamRequest(request: HttpRequest, operation: OpenAPIV3_1.OperationObject, validation: t.Validation = { status: 200, errors: [] }) {

    // maybe do not need validation in this step

    // TODO - case sensitivity param check
    const queryParams = request.query == undefined ? [] : Object.entries(request.query!)
        .map(([name, value]) => createRequestParam(
            findQuery(operation.parameters!, name.toLowerCase()),
            name,
            value,
            value, // todo parse if need
            validation.errors.find(err => err.location === "query" && err.path.toLowerCase() === name.toLowerCase()) ?? validParam(name, "query"),
            "query"
        ))


    const headerParams = Object.entries(request.headers!)
        .map(([name, value]) => createRequestParam(
            findHeader(operation.parameters!, name.toLowerCase()),
            name,
            value,
            value, // todo parse if need
            validation.errors.find(err => err.location === "headers" && err.path.toLowerCase() === name.toLowerCase()) ?? validParam(name, "headers"),
            "headers"
        ))


    const bodyValidations = validation.errors.filter(err => err.location === "body")



    return [
        ...queryParams,
        ...headerParams,
        ...bodyValidations,
    ]

}




export function openAPI<T extends {} = {}>(requestRaw: HttpRequest, openApiDoc: OpenAPIV3_1.Document<T>) {

    const request: HttpRequest = {
        headers: [],
        query: {},
        ...requestRaw
    }

    const operation = findOperation(request, openApiDoc)
    const validation = validateRequest(request, operation!, openApiDoc)


    // TODO - handle body
    console.log({ validation })

    const paramsIn = (inn: "headers" | "query") => operation?.parameters
        ?.map(p => p as OpenAPIV3_1.ParameterObject)
        ?.filter(p => p.in === (inn === "headers" ? "header" : inn))
        .map(p => ({
            ...p,
            request: buildRequestObjects(p, validation, request)
        }))

    const parameters = []
    parameters.push(paramsIn("headers"))
    parameters.push(paramsIn("query"))

    // operation?.requestBody = {...operation?.requestBody, request : {

    // }}

    // parameters = [...paramsIn("headers")!, ...paramsIn("query")!]

    return {
        ...operation,
        parameters: parameters.flat()
    }

}


/** 
export function matchUrl<T extends {} = {}>(request: HttpRequest, doc: OpenAPIV3_1.Document<T>) {

    const url = new URL(request.url)

    const operation = matchPath({ ...request, path: url.pathname }, doc)?.operation

    // consider using kogo open-api
    // https://github.com/kogosoftwarellc/open-api

    // const query = qstring.fromQuery(request.url)

    // const params = Object.entries(query).map(([name, value]) => ({
    //     paramObject: operation?.operation.parameters?.find(p => (p as OpenAPIV3.ParameterObject).name === name) as OpenAPIV3.ParameterObject,
    //     name,
    //     value
    // }))


    // validation
    var requestValidator = new OpenAPIRequestValidator(operation)
    var validation = requestValidator.validateRequest(request) as Validation

    return {
        operation,
        validation,
        // request,
    }

}

**/

export type MatchURL = ReturnType<typeof findOperation>


const exactMatch = (
    request: RelativeRequest,
    operations: {
        path: string;
        method: OpenAPIV3_1.HttpMethods;
        operation: OpenAPIV3_1.OperationObject;
    }[]) => operations.find(operation => operation.method === request.method && operation.path === request.path)

export function matchPath<T extends {} = {}>(requestRaw: RelativeRequest, doc: OpenAPIV3_1.Document<T>) {

    const request = {
        ...requestRaw,
        path: cleanPath(requestRaw.path)
    }

    console.log({ request })

    const operations = flatMapOperations(doc)

    return exactMatch(request, operations) ?? operations.find(operation => pathsMatch(request, operation)) ?? operations.find(operation => pathsMatch(request, operation, true))
}


function isNumber(value: any) {
    return typeof value === 'number';
}


export function isInteger(value: string) {
    return Number.isInteger(Number(value))
}



function pathsMatch<T extends {} = {}>(
    request: { path: string; method: OpenAPIV3_1.HttpMethods; },
    match: { path: string, method: OpenAPIV3_1.HttpMethods, operation: OpenAPIV3_1.OperationObject<T> },
    anyType: boolean = false
): boolean {

    if (request.method !== match.method) {
        return false
    }

    // not accounting for {id} matching path name
    if (request.path === match.path) {
        return request.method === match.method
    }

    const pathParams = (match.operation.parameters && match.operation.parameters!
        .filter(po => (po as OpenAPIV3_1.ParameterObject).in == "path")
        .map(po => po as OpenAPIV3_1.ParameterObject)) ?? []

    if (pathParams.length === 0) {
        return request.path === match.path
    }


    const requestSplit = request.path.split("/").filter(t => t.trim() !== "")
    const pathSplit = match.path.split("/").filter(t => t.trim() !== "")

    if (requestSplit.length != pathSplit.length) {
        return false
    }

    for (var i = 0; i < requestSplit.length; i++) {
        const r = requestSplit[i]
        const p = pathSplit[i]

        if (p === undefined || r === undefined) {
            continue
        }

        if (r != p) {
            if (p.startsWith("{") && p.endsWith("}")) {

                const parameterName = p.replace("{", "").replace("}", "")
                const parameter = pathParams.find(param => param.name === parameterName)

                // 'boolean' | 'object' | 'number' | 'string' | 'integer'

                if (anyType) {
                    return true
                }

                const type = (parameter!.schema as OpenAPIV3_1.SchemaObject)!.type

                if (type == "boolean") {
                    if (!(r == "false" || r == "true")) {
                        return false
                    }
                } else if (type == "integer") {
                    if (!isInteger(r)) {
                        return false
                    }
                } else if (type == "number") {
                    if (!isNumber(r)) {
                        return false
                    }
                } else if (type == "string") {
                    continue
                } else {
                    return false
                }
            } else if (r == p) {
                continue
            } else {
                return false
            }
        }
    }

    return true
}


function mapBody(err: t.ValidationError, request: HttpRequest): RequestParameterObject {

    const path = err.path
    const input = _.get(request.body, err.path)
    const value = input
    const validationP = err

    return {
        path,
        input,
        value,
        validation: {
            message: validationP.message,
            errorCode: validationP.errorCode,
        }
    }
}

function findParam(parameters: (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject)[], param: string, inn: string) {
    return parameters
        .map(p => p as OpenAPIV3_1.ParameterObject)
        .filter(p => p.in === inn)
        ?.find(p => p.name.toLowerCase() === param)!
}

function findHeader(parameters: (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject)[], header: string) {
    return findParam(parameters, header, "header")
}

function findQuery(parameters: (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject)[], query: string) {
    return findParam(parameters, query, "query")
}


function mapHeader(err: t.ValidationError, request: HttpRequest, operation: OpenAPIV3_1.OperationObject): RequestParameterObject {

    const p = findHeader(operation.parameters!, err.path.toLowerCase())!

    const path = (p.in + "." + p.name)
    const input = request.headers![p.name]
    const value = input ?? (p.schema as OpenAPIV3_1.SchemaObject)?.default

    return {
        path,
        input,
        value,
        validation: {
            message: err.message,
            errorCode: err.errorCode,
        }
    }
}

function valueParser(type: string): (a: any) => any {
    switch (type) {
        case "integer":
            return x => parseInt(x)
        case "double":
            return x => parseFloat(x)
        case "date":
            return x => new Date(x)
        case "string":
        default:
            return x => x
    }
}

function mapQuery(err: t.ValidationError, request: HttpRequest, operation: OpenAPIV3_1.OperationObject): RequestParameterObject {

    const p = findQuery(operation.parameters!, err.path)

    const path = (p.in + "." + p.name)
    const input = request.query![p.name]
    const value = input ?? (p.schema as OpenAPIV3_1.SchemaObject)?.default

    return {
        path,
        input,
        value,
        validation: {
            message: err.message,
            errorCode: err.errorCode,
        }
    }
}

function createRequestParam(p: OpenAPIV3.ParameterObject, name: string, input: any, value: any, validation?: t.ValidationError, inn?: string): RequestParameterObject {

    const path = ((inn ?? p.in) + "." + name)

    return {
        path,
        input,
        value,
        validation
    }

}


export function findPath(doc: OpenAPIV3_1.Document<{}>, operationId: string) {
    const operations = flatMapOperations(doc)
    return operations.find(operation => operation.operation.operationId === operationId)
}

export function findInput(path: string, paramLocation: string, paramName: string, request: t.HttpRequest): any | undefined {

    switch (paramLocation) {
        case "header":
            return request.headers !== undefined ? request.headers![paramName] : undefined
        case "body":
            return request.body
        case "query":
            return request.query !== undefined ? request.query![paramName] : undefined
        case "path":
            const splitPath = path.split("/")
            const requestSplit = request.url.split("/")
            const index = splitPath.reverse().findIndex(n => n === `{${paramName}}`)
            return requestSplit.reverse()[index]
        default:
            return undefined
    }
}

