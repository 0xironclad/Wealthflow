import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { ChaBotPrompt } from "@/lib/prompts/financial";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not defined')
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
export async function POST(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        const { messages, userData } = await request.json()
        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({
                success: false,
                message: "Invalid messages"
            }, { status: 400 })
        }
        const prompt = ChaBotPrompt(userData);

        const formattedMessages = messages.map(msg => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
        }));

        if (formattedMessages.length > 0 && formattedMessages[0].role !== "user") {
            while (formattedMessages.length > 0 && formattedMessages[0].role !== "user") {
                formattedMessages.shift();
            }

            if (formattedMessages.length === 0 || formattedMessages[0].role !== "user") {
                formattedMessages.unshift({
                    role: "user",
                    parts: [{ text: "Hello" }]
                });
            }
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const chat = model.startChat({
            history: formattedMessages,
            systemInstruction: prompt,
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });

        const result = await chat.sendMessage(messages[messages.length - 1].content);
        const response = result.response;
        const responseText = response.text();

        return NextResponse.json({
            success: true,
            message: responseText
        }, { status: 200 })
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({
            success: false,
            message: "Error generating response",
            error: String(error)
        }, { status: 500 })
    }
}
