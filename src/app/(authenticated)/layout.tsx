"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/header";
import { useUser } from "@/context/UserContext";
import QuickActions from "@/components/quick-actions";
import FloatingChatbot from "@/components/chatbot";


import { useUserData } from "@/hooks/useUserData";

function AuthenticatedLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading } = useUser();
    const { data: userData } = useUserData();

    return (
        <SidebarProvider>
            <div className="flex h-screen w-screen overflow-x-hidden">
                <AppSidebar />
                <SidebarInset className="flex-1 w-full flex flex-col">
                    <header className="flex h-9 shrink-0 items-center px-2">
                        <SidebarTrigger className="h-7 w-7" />
                        <Separator orientation="vertical" className="mx-2 h-4" />
                        {/* header */}
                        <div className="flex items-center gap-2 ml-auto">
                            {!isLoading && user && <Header user={{
                                name: userData?.fullname || userData?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                                email: user.email || '',
                                avatar: userData?.avatar_url || user.user_metadata?.avatar_url || ''
                            }} />}
                        </div>
                    </header>
                    <main className="flex-1">
                        {children}
                    </main>
                </SidebarInset>

                {!isLoading && user && (
                    <>
                        <QuickActions />
                        <FloatingChatbot />
                    </>
                )}
            </div>
        </SidebarProvider>
    );
}

export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // UserProvider is already mounted once in the root layout (src/app/layout.tsx),
    // which passes it the server-resolved user; no need for a second one here.
    return (
        <AuthenticatedLayoutContent>
            {children}
        </AuthenticatedLayoutContent>
    );
}
