import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { setupE2EApp } from './common/setup-e2e';
// import { seedData } from '../src/seed';

describe('AppController (e2e)', () => {

    let app: INestApplication

    beforeAll(async () => {
        app = await setupE2EApp()
        // await seedData(app)
    });

    afterAll(async () => {
        await app.close();
    });

    it('/openapi.json (GET)', async () => {
        const res = await request(app.getHttpServer())
            .get('/openapi.json')
            .expect('Content-Type', /json/)
            .expect(200);

        const responseBody = JSON.parse(res.text);

        // Verify the basic structure
        expect(responseBody).toHaveProperty('openapi');
        expect(responseBody).toHaveProperty('components');

    });

    it('/openapi.yaml (GET)', async () => {
        const res = await request(app.getHttpServer())
            .get('/openapi.yaml')
            .expect('Content-Type', /yaml/)
            .expect(200);

        const responseText = res.text;

        // Verify the basic structure
        expect(responseText).toContain('openapi:');
        expect(responseText).toContain('components:');

    });
});