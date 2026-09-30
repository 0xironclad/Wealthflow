"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/utils/superbase/client";
import { User } from "@supabase/supabase-js";

interface UserContextType {
    user: User | null;
    isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode; initialUser: User | null }> = ({ children, initialUser }) => {
    // Resolved on the server by the root layout, so there's nothing to load.
    const [user, setUser] = useState<User | null>(initialUser);
    const [isLoading] = useState(false);

    useEffect(() => {
        const supabase = createClient();

        // Keeps user in sync with client-side sign-in/sign-out.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <UserContext.Provider value={{ user, isLoading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};
