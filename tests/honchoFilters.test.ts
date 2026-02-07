import { describe, expect, it } from 'bun:test';
import { buildSearchFilters, filtersForSession } from '../src/honcho/filters';

describe('honcho filters', () => {
  it('uses session_id for single-session filters', () => {
    expect(filtersForSession('auth-system')).toEqual({ session_id: 'auth-system' });
  });

  it('builds session_id as a scalar when one session is provided', () => {
    expect(buildSearchFilters({ sessionIds: ['auth-system'] })).toEqual({ session_id: 'auth-system' });
  });

  it('builds session_id as an array when multiple sessions are provided', () => {
    expect(buildSearchFilters({ sessionIds: ['auth-system', 'authz-system'] })).toEqual({
      session_id: ['auth-system', 'authz-system'],
    });
  });
});
