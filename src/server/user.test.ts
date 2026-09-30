import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateUserProfile } from "./user";
import pool from "@/database/db";
import { getSessionUserId } from "@/lib/auth/session";

vi.mock("@/database/db", () => ({
  default: {
    query: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUserId: vi.fn(),
}));

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn> };
const mockGetSessionUserId = getSessionUserId as unknown as ReturnType<typeof vi.fn>;

describe("updateUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw Unauthorized when there is no signed-in user", async () => {
    mockGetSessionUserId.mockResolvedValueOnce(null);

    await expect(
      updateUserProfile({
        fullname: "Test",
        avatarUrl: "https://example.com/avatar.jpg",
      })
    ).rejects.toThrow("Unauthorized");
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("should update user profile successfully", async () => {
    const mockUpdatedUser = {
      id: "123",
      email: "test@example.com",
      fullname: "Updated Name",
      avatar_url: "https://example.com/avatar.jpg",
    };

    mockGetSessionUserId.mockResolvedValueOnce("123");
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...mockUpdatedUser, password: "$2b$10$hash" }],
    });

    const result = await updateUserProfile({
      fullname: "Updated Name",
      avatarUrl: "https://example.com/avatar.jpg",
    });

    expect(result).toEqual(mockUpdatedUser);
    expect(result).not.toHaveProperty("password");
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users"),
      ["Updated Name", "https://example.com/avatar.jpg", "123"]
    );
  });

  it("should handle database errors", async () => {
    mockGetSessionUserId.mockResolvedValueOnce("123");
    const dbError = new Error("Update failed");
    mockPool.query.mockRejectedValueOnce(dbError);

    await expect(
      updateUserProfile({
        fullname: "Test",
        avatarUrl: "https://example.com/avatar.jpg",
      })
    ).rejects.toThrow("Update failed");
  });
});
