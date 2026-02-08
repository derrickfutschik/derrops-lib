import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { config } from '@slaops/config';


const isSecret = (key: string) => {
    const k = key.toLowerCase()
    return k &&
        k.includes("secret") ||
        k.includes("password") ||
        k.includes("token") ||
        k.includes("email") ||
        k.includes("account") ||
        k.includes("credentials") ||
        (k.includes("database") && k.includes("user")) ||
        (k.includes("db") && k.includes("user")) ||
        (k.includes("opensearch") && k.includes("user"))
}



function maskConfig<T extends Record<string, unknown>>(obj: T): Record<string, string | undefined> {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            key,
            isSecret(key) ? "********" : String(value),
        ])
    );
}

@ApiTags('Config')
@Controller('config')
export class ConfigController {
    constructor() { }

    @Get()
    @ApiOperation({ summary: 'Get the config' })
    @ApiResponse({ status: 200, description: 'The config' })
    getConfig() {
        return maskConfig(config);
    }
}
