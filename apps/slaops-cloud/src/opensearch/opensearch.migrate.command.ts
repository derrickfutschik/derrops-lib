import { Injectable } from '@nestjs/common';
import { OpenSearchService } from './opensearch.service';

@Injectable()
export class OpenSearchMigrateCommand {
    constructor(private readonly os: OpenSearchService) { }

    async run(): Promise<void> {
        await this.os.migrateOpenApiSearchResources();
    }
}
