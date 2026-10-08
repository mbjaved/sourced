/**
 * Evaluation suite: ingests eval/corpus into a fresh tenant, asks every question in
 * eval/questions.json, scores retrieval, answers and refusals, and writes eval/report.md.
 * Exits non-zero when a score drops below its threshold, so CI catches regressions
 * from a prompt, chunking or model change.
 *
 * Usage: npm run eval   (AI_PROVIDER=openai npm run eval for the real models)
 */
import { NestFactory } from '@nestjs/core';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { NOT_FOUND } from './ai/ai.types';
import { AppModule } from './app.module';
import { AskService } from './ask/ask.service';
import { DbService } from './db/db.service';
import { DocumentsService } from './documents/documents.service';
import { TenantsService } from './tenants/tenants.service';

interface Case {
  q: string;
  doc: string | null; // expected source file, or null when the answer is not in the corpus
  expect?: string;
}

const THRESHOLDS = { retrieval: 0.9, answers: 0.8, refusals: 1 };
const dir = resolve(process.env.EVAL_DIR ?? join(process.cwd(), '..', 'eval'));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const percentile = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const docs = app.get(DocumentsService);
  const ask = app.get(AskService);
  const { tenant } = await app.get(TenantsService).create(`eval-${Date.now()}`);

  try {
    for (const file of readdirSync(join(dir, 'corpus'))) {
      await docs.create(tenant.id, {
        title: file,
        content: readFileSync(join(dir, 'corpus', file), 'utf8'),
      });
    }
    for (let i = 0; ; i++) {
      const list = await docs.list(tenant.id);
      if (list.some((d) => d.status === 'failed')) throw new Error('ingestion failed');
      if (list.every((d) => d.status === 'ready')) break;
      if (i > 300) throw new Error('ingestion timed out');
      await new Promise((r) => setTimeout(r, 100));
    }

    const cases: Case[] = JSON.parse(readFileSync(join(dir, 'questions.json'), 'utf8'));
    const rows: string[] = [];
    const latencies: number[] = [];
    let hits = 0;
    let correct = 0;
    let refused = 0;
    let tokens = 0;

    for (const c of cases) {
      const retrieved = (await ask.retrieve(tenant.id, c.q)).map((h) => h.title);
      const res = await ask.ask(tenant.id, c.q);
      latencies.push(res.latencyMs);
      tokens += (res.usage?.inputTokens ?? 0) + (res.usage?.outputTokens ?? 0);

      let pass: boolean;
      if (c.doc === null) {
        pass = res.answer === NOT_FOUND;
        if (pass) refused++;
      } else {
        if (retrieved.includes(c.doc)) hits++;
        pass =
          res.answer.toLowerCase().includes(c.expect!.toLowerCase()) &&
          res.citations.some((cit) => cit.title === c.doc);
        if (pass) correct++;
      }
      rows.push(`| ${pass ? 'pass' : '**FAIL**'} | ${c.q} | ${res.answer.replace(/\|/g, '/')} |`);
    }

    const answerable = cases.filter((c) => c.doc !== null).length;
    const scores = {
      retrieval: hits / answerable,
      answers: correct / answerable,
      refusals: refused / (cases.length - answerable),
    };
    const report = [
      `# Evaluation report`,
      ``,
      `Provider: \`${process.env.AI_PROVIDER ?? 'local'}\` · ${cases.length} questions · ${new Date().toISOString().slice(0, 10)}`,
      ``,
      `| Metric | Score | Threshold |`,
      `| --- | --- | --- |`,
      `| Retrieval: right document in top 5 | ${pct(scores.retrieval)} | ${pct(THRESHOLDS.retrieval)} |`,
      `| Answers: correct and cites the right document | ${pct(scores.answers)} | ${pct(THRESHOLDS.answers)} |`,
      `| Refusals: says "not found" when the answer isn't there | ${pct(scores.refusals)} | ${pct(THRESHOLDS.refusals)} |`,
      `| Latency p50 / p95 | ${percentile(latencies, 0.5)} ms / ${percentile(latencies, 0.95)} ms | |`,
      `| Tokens used | ${tokens} | |`,
      ``,
      `| Result | Question | Answer |`,
      `| --- | --- | --- |`,
      ...rows,
      ``,
    ].join('\n');
    writeFileSync(join(dir, 'report.md'), report);
    console.log(report);

    const failed = (Object.keys(THRESHOLDS) as (keyof typeof THRESHOLDS)[]).filter(
      (k) => scores[k] < THRESHOLDS[k],
    );
    if (failed.length) {
      console.error(`Below threshold: ${failed.join(', ')}`);
      process.exitCode = 1;
    }
  } finally {
    await app.get(DbService).query('delete from tenants where id = $1', [tenant.id]);
    await app.close();
  }
}

main();
