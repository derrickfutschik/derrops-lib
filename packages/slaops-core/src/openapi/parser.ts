import { OpenAPIV3_1 } from "openapi-types"
import SwaggerParser from "@apidevtools/swagger-parser"

export async function loadSpec(path: string): Promise<OpenAPIV3_1.Document> {
    const api = await SwaggerParser.bundle(path);
    return api as OpenAPIV3_1.Document
}