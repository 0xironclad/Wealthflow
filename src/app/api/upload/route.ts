import { NextResponse } from "next/server";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import fs from "fs";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return unauthorizedResponse();
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file received." },
                { status: 400 }
            );
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "Only image uploads are allowed." },
                { status: 415 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "File is too large. Maximum size is 5MB." },
                { status: 413 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Basename and safe characters only, so a name like "../x" can't leave uploads/.
        const safeName = path
            .basename(file.name)
            .replace(/[^A-Za-z0-9._-]/g, "_");
        const filename = `${Date.now()}_${safeName}`;

        // Ensure uploads directory exists
        const uploadDir = path.join(process.cwd(), "public/uploads");
        if (!fs.existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        const filepath = path.join(uploadDir, filename);

        // Belt and braces: the resolved path must stay inside uploadDir.
        if (path.dirname(filepath) !== uploadDir) {
            return NextResponse.json(
                { error: "Invalid file name." },
                { status: 400 }
            );
        }

        await writeFile(filepath, buffer);

        return NextResponse.json({
            success: true,
            url: `/uploads/${filename}`
        });
    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json(
            { error: "Error uploading file." },
            { status: 500 }
        );
    }
}
