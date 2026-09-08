// T3-m1-recruitment-demo §3: same-origin adapter for progressive demo
// answer submission. Parses, validates shape/ref, records under the
// DB-backed writer, and serialises — nothing more.
import type { RequestHandler } from './$types';
import { dbDemoStageWriter } from '$lib/server/demo/demoAnswers';
import { createDemoAnswerHandler } from '$lib/server/demo/demoRoute';

export const POST: RequestHandler = createDemoAnswerHandler({ writer: dbDemoStageWriter });
