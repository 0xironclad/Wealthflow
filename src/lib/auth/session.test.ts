import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionUserId } from "./session";
import { createClient } from "@/utils/superbase/server";

vi.mock("@/utils/superbase/server", () => ({
  createClient: vi.fn(),
}));

const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const supabaseWith = (user: { id: string } | null) => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
});

describe("getSessionUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the id Supabase verifies", async () => {
    mockCreateClient.mockResolvedValueOnce(supabaseWith({ id: "user-456" }));

    await expect(getSessionUserId()).resolves.toBe("user-456");
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it("returns null when there is no Supabase session", async () => {
    mockCreateClient.mockResolvedValueOnce(supabaseWith(null));

    await expect(getSessionUserId()).resolves.toBeNull();
  });
});
