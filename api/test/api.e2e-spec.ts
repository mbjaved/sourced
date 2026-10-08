import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { NOT_FOUND } from '../src/ai/ai.types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { TenantsService } from '../src/tenants/tenants.service';

const HANDBOOK = `Remote work policy.

Employees may work remotely up to three days a week. Core hours are 11am to 3pm in the office time zone.

Expenses.

Travel must be approved by your manager before booking. Receipts are due within 30 days.`;

describe('Sourced API (e2e)', () => {
  let app: INestApplication;
  let keyA: string;
  let keyB: string;

  const api = () => request(app.getHttpServer());

  async function waitUntilReady(key: string, id: string) {
    for (let i = 0; i < 50; i++) {
      const res = await api().get(`/documents/${id}`).set('x-api-key', key);
      if (res.body.status !== 'processing') return res.body;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('document never finished processing');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const tenants = app.get(TenantsService);
    keyA = (await tenants.create('Tenant A')).apiKey;
    keyB = (await tenants.create('Tenant B')).apiKey;
  });

  afterAll(() => app.close());

  it('rejects requests without a valid API key', async () => {
    await api().get('/documents').expect(401);
    await api().get('/documents').set('x-api-key', 'sk_wrong').expect(401);
    await api().get('/health').expect(200);
  });

  it('validates input', async () => {
    await api().post('/documents').set('x-api-key', keyA).send({ title: '' }).expect(400);
    await api()
      .post('/documents')
      .set('x-api-key', keyA)
      .send({ title: 'x', content: 'y', admin: true })
      .expect(400);
    await api().get('/documents/not-a-uuid').set('x-api-key', keyA).expect(400);
  });

  it('indexes a document in the background and answers with a citation to it', async () => {
    const created = await api()
      .post('/documents')
      .set('x-api-key', keyA)
      .send({ title: 'Handbook', content: HANDBOOK })
      .expect(202);
    expect(created.body.status).toBe('processing');

    const doc = await waitUntilReady(keyA, created.body.id);
    expect(doc.status).toBe('ready');
    expect(doc.chunks).toBeGreaterThan(0);

    const res = await api()
      .post('/ask')
      .set('x-api-key', keyA)
      .send({ question: 'How many days a week can I work remotely?' })
      .expect(200);
    expect(res.body.answer).toContain('three days a week');
    expect(res.body.citations[0]).toMatchObject({ documentId: created.body.id, title: 'Handbook' });
  });

  it("never shows one tenant another tenant's documents", async () => {
    const list = await api().get('/documents').set('x-api-key', keyB).expect(200);
    expect(list.body).toEqual([]);

    const res = await api()
      .post('/ask')
      .set('x-api-key', keyB)
      .send({ question: 'How many days a week can I work remotely?' })
      .expect(200);
    expect(res.body.answer).toBe(NOT_FOUND);
    expect(res.body.citations).toEqual([]);

    const [docA] = (await api().get('/documents').set('x-api-key', keyA)).body;
    await api().get(`/documents/${docA.id}`).set('x-api-key', keyB).expect(404);
    await api().delete(`/documents/${docA.id}`).set('x-api-key', keyB).expect(404);
  });

  it('says so when the answer is not in the documents', async () => {
    const res = await api()
      .post('/ask')
      .set('x-api-key', keyA)
      .send({ question: 'What is the parental leave policy?' })
      .expect(200);
    expect(res.body.answer).toBe(NOT_FOUND);
  });

  it('deletes a document and its chunks', async () => {
    const [doc] = (await api().get('/documents').set('x-api-key', keyA)).body;
    await api().delete(`/documents/${doc.id}`).set('x-api-key', keyA).expect(204);
    await api().get(`/documents/${doc.id}`).set('x-api-key', keyA).expect(404);
  });
});
