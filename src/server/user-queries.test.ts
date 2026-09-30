import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getUserData } from "./user-queries";

describe("getUserData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches /api/user and returns the parsed body", async () => {
    const mockUser = { id: "123", email: "test@example.com" };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    const result = await getUserData();

    expect(fetch).toHaveBeenCalledWith("/api/user");
    expect(result).toEqual(mockUser);
  });

  it("throws when the request fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: "Unauthorized",
    });

    await expect(getUserData()).rejects.toThrow("Unauthorized");
  });
});
