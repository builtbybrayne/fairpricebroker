// T3-m1-data-core §2.7: the caller's AUTHORITY is derived server-side from
// persisted state, in one query, as the caller's own authenticated role.
// This module is the SOLE authority that ever computes `hostFull`.
import type { Role } from '$lib/server/engine';
import type { CallerSql } from './db';

export type InvitedViewer =
	| { kind: 'party'; role: Role }
	| { kind: 'host'; hostFull: boolean }
	| { kind: 'developer' }
	| { kind: 'none' };

export async function resolveInvitedViewer(
	caller: CallerSql,
	sessionId: string
): Promise<InvitedViewer> {
	const rows = await caller<
		{
			direction: Role | null;
			is_host: boolean;
			host_visibility: string | null;
			is_developer: boolean;
		}[]
	>`
		select
			session_role_for(${sessionId}::uuid) as direction,
			is_session_host(${sessionId}::uuid) as is_host,
			(select host_visibility from sessions where id = ${sessionId}::uuid) as host_visibility,
			is_developer() as is_developer
	`;
	const r = rows[0];
	if (!r) return { kind: 'none' };
	if (r.is_developer) return { kind: 'developer' };
	if (r.is_host) return { kind: 'host', hostFull: r.host_visibility === 'host-visible' };
	if (r.direction) return { kind: 'party', role: r.direction };
	return { kind: 'none' };
}
