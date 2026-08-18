import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Requires a real DATABASE_URL in the environment — PrismaService connects to
// the real Postgres on module init, same as running the app.
describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) is public', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/me (GET) rejects requests with no token', () => {
    return request(app.getHttpServer()).get('/me').expect(401);
  });

  it('/admin/users (GET) rejects requests with no token', () => {
    return request(app.getHttpServer()).get('/admin/users').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
