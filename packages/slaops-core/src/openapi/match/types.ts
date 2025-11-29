import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types"



export type RelativeRequest = {
    path: string
    method: OpenAPIV3.HttpMethods,
}


/**
 * Need to find better open standards
 */
export type BuildInfo = {

    /** Region/Location of the deployment*/
    region?: string,

    /** The stage/environment of the deployment */
    stage?: string,

    /** The build which is running right now (could be code hash) */
    build?: string,

    /** The release which is running */
    release?: string,

    /** Incremental Build Id */
    buildId: number,

    /** Incremental Release Id */
    releaseId: number,

    /** Date of Deploy */
    deployDate?: Date

    /** Identify the instance making the call */
    instanceId?: string

}



export type HttpRequest = {
    url: string
    method: OpenAPIV3.HttpMethods,
    headers?: {
        [k: string]: any
    },
    query?: {
        [k: string]: any
    },
    params?: { // path params
        [k: string]: any
    },
    body?: any,
    status?: number,
}


export type RequestParameterObject = {
    path: string,
    input?: any,
    value?: any,
    validation?: {
        message: string,
        errorCode?: string,
    }
}


export type ParameterRequestInput = {
    input?: any,
    value?: any,
}


export enum ParameterValidationStatus {
    VALID = "VALID",
    INVALID = "INVALID"
}


export type ErrorMessage = {
    message: string,
    errorCode?: string,
}


export type ParameterValidation = {
    status: ParameterValidationStatus,
    /** TODO consider arrays of errors */
    error?: ErrorMessage,
}

export type ParameterInput = {
    input?: any,
    value?: any,
}

export type ParamInRequest = OpenAPIV3_1.ParameterObject & {
    restops: {
        /** The input from the user */
        input: ParameterInput,
        /** Validation of the parameter */
        validation: ValidationErrorBase,
        /** Was the parameter defined in the documentation */
        defined: boolean,
    }
}

export type ValidationErrorBase = {
    "errorCode": string,
    "message": string,
}


export type ValidationError = ValidationErrorBase & {
    "path": string,
    "location": "body" | "query" | "headers"
}


export type Validation = {
    "status": number,
    "errors": ValidationError[]
}



export type ClientSideLog = {
    openApi: {
        summary: {
            errorsQuery: number,
            errorsHeaders: number,
            errorsBody: number,
            errorsTotal: number,
        }

    }
}



export type EnrichedOperationObjectWithValidation = EnrichedOperationObject & {
    parameters: ParamInRequest[],
}






export type AvailabilitySLA = {
    /** */
    period: string,
    definition: {
        badStatus: number[],
        successRatio: number, // 0-100%
    },
    // Alarm Things
}


export type PerformanceSLA = {
    metric: "avg",
    max: number
}

export type RestopsSLARoot = {

    availability?: AvailabilitySLA,

    performance?: {
        [OpenAPIV3.HttpMethods.GET]?: PerformanceSLA,
        [OpenAPIV3.HttpMethods.POST]?: PerformanceSLA,
        [OpenAPIV3.HttpMethods.PUT]?: PerformanceSLA,
        [OpenAPIV3.HttpMethods.DELETE]?: PerformanceSLA,
        [OpenAPIV3.HttpMethods.OPTIONS]?: PerformanceSLA,
        [OpenAPIV3.HttpMethods.HEAD]?: PerformanceSLA,
        [OpenAPIV3.HttpMethods.PATCH]?: PerformanceSLA,
        [OpenAPIV3.HttpMethods.TRACE]?: PerformanceSLA,
    }

}




export type SLARoot = {
    "x-restops-sla"?: RestopsSLARoot
}

export type SLAPath = {
    "x-restops-sla-path"?: RestopsSLARoot
}

export type RestopsSLA = {
    performance?: PerformanceSLA,
    availability?: AvailabilitySLA,
}

export type SLAMethod = {
    "x-restops-sla-operation"?: RestopsSLA
}

export type Modify<T, R> = Omit<T, keyof R> & R

export type RestopsPathItemObject<T extends {} = {}> = Modify<OpenAPIV3.PathItemObject<T>, {
    servers?: OpenAPIV3_1.ServerObject[];
    parameters?: (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject)[];
}> & {
    [method in OpenAPIV3_1.HttpMethods]?: (OpenAPIV3_1.OperationObject<T> & SLAMethod);
} & SLAPath


type RestopsInfo = OpenAPIV3_1.InfoObject & SLARoot


type RestopsPaths<T extends {} = {}, P extends {} = {}> = OpenAPIV3_1.PathsObject<T, P & RestopsPathItemObject<T>>


export type RestopsDocument = OpenAPIV3_1.Document & {
    "paths": RestopsPaths
} & SLARoot

export type EnrichedOperationObject = OpenAPIV3_1.OperationObject & {
    restops: {
        path: string,
    }
} & SLAMethod
