// T3-m1-casual-mode §2/§4: same-origin UI adapter over the shared casual
// capability (handleCasualReconcile). It parses, validates shape/ref,
// calls the shared handler, and serialises — nothing more. Stage-2 wiring
// (§6): the DB-backed completer is the default; the in-memory stand-in
// remains selectable by constructing the handler directly in tests.
import type { RequestHandler } from './$types';
import { dbCasualPlayCompleter } from '$lib/server/casual/casualCompletionSeam';
import { createCasualReconcileHandler } from '$lib/server/casual/casualRoute';

export const POST: RequestHandler = createCasualReconcileHandler({
	completer: dbCasualPlayCompleter
});
