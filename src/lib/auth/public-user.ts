// A users row carries the bcrypt password hash; strip it before the row leaves the server.
export function withoutPassword<T extends object>(row: T): Omit<T, "password"> {
    const user = { ...row } as Record<string, unknown>;
    delete user.password;
    return user as Omit<T, "password">;
}
