// Reads go through GET routes so they run in parallel; Next.js runs server actions one at a time.

export const getUserData = async () => {
  const response = await fetch(`/api/user`);
  if (!response.ok) {
    throw new Error(`Error fetching user data: ${response.statusText}`);
  }
  return response.json();
};
