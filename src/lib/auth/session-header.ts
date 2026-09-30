// Header middleware (src/utils/superbase/middleware.ts) sets on every matched
// request, after it has verified the session, so getSessionUserId() doesn't
// need a second Supabase Auth round trip. Shared as a constant so the two
// sides can't drift; kept in its own file with no other imports so it's safe
// to pull into the edge middleware bundle.
export const SESSION_USER_ID_HEADER = "x-wf-user-id";
