// Read-only user helper, fetched from the client. See src/server/income-queries.ts
// for why: server actions (src/server/user.ts) are invoked one at a time by
// Next.js, which was serializing this alongside the other dashboard reads.

export const getUserData = async () => {
  const response = await fetch(`/api/user`);
  if (!response.ok) {
    throw new Error(`Error fetching user data: ${response.statusText}`);
  }
  return response.json();
};
