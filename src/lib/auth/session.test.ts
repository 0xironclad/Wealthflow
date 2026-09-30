import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionUserId } from "./session";
import { headers } from "next/headers";
import { createClient } from "@/utils/superbase/server";
import { SESSION_USER_ID_HEADER } from "./session-header";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/utils/superbase/server", () => ({
  createClient: vi.fn(),
}));

const mockHeaders = headers as unknown as ReturnType<typeof vi.fn>;
const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const headersWith = (value: string | null) => ({
  get: (name: string) => (name === SESSION_USER_ID_HEADER ? value : null),
});

describe("getSessionUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the id from the middleware header without calling Supabase", async () => {
    mockHeaders.mockResolvedValueOnce(headersWith("user-123"));

    const result = await getSessionUserId();

    expect(result).toBe("user-123");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("falls back to supabase.auth.getUser() when the header is missing", async () => {
    mockHeaders.mockResolvedValueOnce(headersWith(null));
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-456" } } }),
      },
    });

    const result = await getSessionUserId();

    expect(result).toBe("user-456");
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it("returns null when the header is missing and there is no Supabase session", async () => {
    mockHeaders.mockResolvedValueOnce(headersWith(null));
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const result = await getSessionUserId();

    expect(result).toBeNull();
  });
});
