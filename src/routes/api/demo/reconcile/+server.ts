// T3-m1-recruitment-demo §3: same-origin adapter for the demo's stage-4
// reconciliation. Pure compute over the engine — no persistence.
import type { RequestHandler } from './$types';
import { createDemoReconcileHandler } from '$lib/server/demo/demoRoute';

export const POST: RequestHandler = createDemoReconcileHandler();
