"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Bot, User, X, MessageSquare } from 'lucide-react';
import { useUser } from "@/context/UserContext";
import { useQuery } from "@tanstack/react-query";
import { getFinancialHealth, getMonthlyCashFlow, getSpendingByCategory, getCategoryTrends } from "@/server/analytics";
import { getUserData } from "@/server/user";

interface Message {
    role: "user" | "assistant";
    content: string;
    error?: boolean;
}

function FloatingChatbot() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { user } = useUser();
    const userId = user?.id;

    const { data: savingsData } = useQuery({
        queryKey: ['savings', userId],
        queryFn: () => fetch(`/api/savings?userId=${userId}`).then(res => res.json()),
        enabled: !!userId
    });

    const { data: transactionsData } = useQuery({
        queryKey: ['expenses', userId],
        queryFn: () => fetch(`/api/expenses?userId=${userId}`).then(res => res.json()),
        enabled: !!userId
    });

    const { data: savingHistoryData } = useQuery({
        queryKey: ['savingsHistory', userId],
        queryFn: () => fetch(`/api/savings/history?userId=${userId}`).then(res => res.json()),
        enabled: !!userId
    });

    const { data: incomeData } = useQuery({
        queryKey: ['income', userId],
        queryFn: () => fetch(`/api/income?userId=${userId}`).then(res => res.json()),
        enabled: !!userId
    });

    const { data: budgetData } = useQuery({
        queryKey: ['budget', userId],
        queryFn: () => fetch(`/api/budget?userId=${userId}`).then(res => res.json()),
        enabled: !!userId
    });

    const { data: balanceData } = useQuery({
        queryKey: ['balance', userId],
        queryFn: () => fetch(`/api/balance?userId=${userId}`).then(res => res.json()),
        enabled: !!userId
    });

    const { data: userProfileData } = useQuery({
        queryKey: ['userProfile', userId],
        queryFn: () => userId ? getUserData() : Promise.resolve(null),
        enabled: !!userId
    });

    const { data: financialHealthData } = useQuery({
        queryKey: ['financialHealth', userId],
        queryFn: () => userId ? getFinancialHealth() : Promise.resolve(null),
        enabled: !!userId
    });

    const { data: monthlyCashFlowData } = useQuery({
        queryKey: ['monthlyCashFlow', userId],
        queryFn: () => userId ? getMonthlyCashFlow() : Promise.resolve([]),
        enabled: !!userId
    });

    const { data: spendingByCategoryData } = useQuery({
        queryKey: ['spendingByCategory', userId],
        queryFn: () => userId ? getSpendingByCategory() : Promise.resolve([]),
        enabled: !!userId
    });

    const { data: categoryTrendsData } = useQuery({
        queryKey: ['categoryTrends', userId],
        queryFn: () => userId ? getCategoryTrends() : Promise.resolve({ data: [], categories: [] }),
        enabled: !!userId
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(() => {
        const smileEmojis = ['😊', '🙂', '😺']
        scrollToBottom();
        if (isOpen && messages.length === 0) {
            setMessages([{
                role: "assistant",
                content: "Hello! I'm WealthFlow AI, your financial assistant. How can I help you today?" + smileEmojis[Math.floor(Math.random() * smileEmojis.length)]
            }]);
        }
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = {
            role: "user",
            content: input
        };

        setMessages((prev) => [...prev, userMessage as Message]);
        setInput("");
        setLoading(true);

        try {
            const messagesToSend = messages
                .filter(msg => !(msg.role === "assistant" && msg.content.includes("Hello! I'm your financial assistant")))
                .concat([userMessage as Message]);

            const response = await fetch(`/api/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: messagesToSend,
                    userData: {
                        savings: savingsData?.data,
                        transactions: transactionsData?.data,
                        savingHistory: savingHistoryData?.data,
                        income: incomeData?.data,
                        budget: budgetData?.data,
                        balance: balanceData?.data,
                        userProfile: userProfileData,
                        financialHealth: financialHealthData,
                        monthlyCashFlow: monthlyCashFlowData,
                        spendingByCategory: spendingByCategoryData,
                        categoryTrends: categoryTrendsData
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || "Failed to generate response");
            }

            setMessages((prev) => [...prev, {
                role: "assistant",
                content: data.message
            }]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, {
                role: "assistant",
                content: "Sorry, I encountered an error processing your request. Please try again later.",
                error: true
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Chat toggle button */}
            <button
                onClick={toggleChat}
                className="fixed bottom-6 right-6 p-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50"
                aria-label="Toggle chat"
            >
                {isOpen ? (
                    <X className="h-6 w-6" />
                ) : (
                    <MessageSquare className="h-6 w-6" />
                )}
            </button>

            {/* Chat window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-background border border-border rounded-xl shadow-xl flex flex-col z-40 overflow-hidden">
                    {/* Chat header */}
                    <div className="border-b border-border py-3 px-4 flex items-center justify-between bg-secondary/20">
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <h3 className="font-medium">Wealthflow AI</h3>
                        </div>
                        <button
                            onClick={toggleChat}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message, index) => (
                            <div key={index} className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                                {message.role === "assistant" && (
                                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                        <Bot className="h-4 w-4 text-primary" />
                                    </div>
                                )}
                                <div className={`p-3 rounded-lg ${message.role === "user"
                                    ? "bg-primary text-primary-foreground ml-12"
                                    : message.error
                                        ? "bg-destructive/10 border border-destructive/50"
                                        : "bg-secondary/50 mr-12"
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>
                                {message.role === "user" && (
                                    <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <User className="h-4 w-4 text-zinc-400" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="flex items-start gap-2">
                                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Bot className="h-4 w-4 text-primary" />
                                </div>
                                <div className="p-3 rounded-lg bg-secondary/50 mr-12">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"></div>
                                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse delay-75"></div>
                                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse delay-150"></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <form onSubmit={handleSubmit} className="border-t border-border p-3">
                        <div className="flex gap-2 items-center">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-1 bg-secondary/20 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className={`p-2 rounded-full bg-primary text-primary-foreground ${!input.trim() || loading ? 'opacity-50' : 'hover:bg-primary/90'}`}
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}

export default FloatingChatbot;
