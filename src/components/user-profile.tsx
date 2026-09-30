"use client"

import { useState } from "react"
import { useUser } from "@/context/UserContext"
import { useUserData } from "@/hooks/useUserData"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Mail, Calendar, Shield, CheckCircle2, XCircle, Pencil, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { updateUserProfile } from "@/server/user"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface UserProfileProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const profileSchema = z.object({
    fullname: z.string().min(2, "Name must be at least 2 characters"),
    avatarUrl: z.string().refine((val) => {
        if (!val) return true; // Optional
        if (val.startsWith('/uploads/')) return true; // Allow local uploads
        try {
            new URL(val);
            return true;
        } catch {
            return false;
        }
    }, "Please enter a valid URL").optional().or(z.literal("")),
})

export function UserProfile({ open, onOpenChange }: UserProfileProps) {
    const { user, isLoading: isAuthLoading } = useUser()
    const { data: userData, isLoading: isLoadingUserData } = useUserData()
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const queryClient = useQueryClient()

    const isLoading = isAuthLoading || isLoadingUserData

    const initials = user?.email
        ?.split("@")[0]
        .split("")
        .slice(0, 2)
        .map((c) => c.toUpperCase())
        .join("") || "U"

    const displayName = userData?.fullname || userData?.name || user?.email?.split("@")[0] || "User"
    const email = user?.email || ""
    const isEmailVerified = user?.email_confirmed_at || userData?.is_email_verified
    const createdAt = user?.created_at || userData?.created_at
    const lastLogin = userData?.last_login
    const avatarUrl = userData?.avatar_url || user?.user_metadata?.avatar_url

    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            fullname: displayName,
            avatarUrl: avatarUrl || "",
        },
        values: { // Update form when data loads
            fullname: displayName,
            avatarUrl: avatarUrl || "",
        }
    })

    const [isUploading, setIsUploading] = useState(false)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) throw new Error("Upload failed")

            const data = await response.json()
            form.setValue("avatarUrl", data.url)
            toast.success("Image uploaded successfully")
        } catch (error) {
            console.error("Upload error:", error)
            toast.error("Failed to upload image")
        } finally {
            setIsUploading(false)
        }
    }

    async function onSubmit(values: z.infer<typeof profileSchema>) {
        if (!user?.id) return

        setIsSaving(true)
        try {
            await updateUserProfile({
                fullname: values.fullname,
                avatarUrl: values.avatarUrl || "",
            })
            await queryClient.invalidateQueries({ queryKey: ['userData', user.id] })
            toast.success("Profile updated successfully")
            setIsEditing(false)
        } catch (error) {
            console.error(error)
            toast.error("Failed to update profile")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val)
            if (!val) setIsEditing(false)
        }}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                        <span>Profile</span>
                        {!isEditing && !isLoading && (
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-20 w-20 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : isEditing ? (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <div className="flex items-center gap-4 mb-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={form.watch("avatarUrl") || avatarUrl} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-2">
                                    <FormLabel>Profile Picture</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            className="w-full max-w-xs"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                        />
                                        {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Upload a new picture or paste a URL below.
                                    </p>
                                </div>
                            </div>

                            <FormField
                                control={form.control}
                                name="fullname"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="avatarUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Avatar URL</FormLabel>
                                        <FormControl>
                                            <Input placeholder="https://example.com/avatar.png" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSaving || isUploading}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </Form>
                ) : (
                    <div className="space-y-6 py-4">
                        {/* Profile Header */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-20 w-20">
                                        <AvatarImage src={avatarUrl} alt={displayName} />
                                        <AvatarFallback className="text-lg">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <CardTitle className="text-2xl mb-1">{displayName}</CardTitle>
                                        <CardDescription className="flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            {email}
                                        </CardDescription>
                                        {isEmailVerified ? (
                                            <Badge variant="default" className="mt-2">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Email Verified
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="mt-2">
                                                <XCircle className="h-3 w-3 mr-1" />
                                                Email Not Verified
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>

                        {/* Account Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Account Information</CardTitle>
                                <CardDescription>Your account details and settings</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between py-2 border-b">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">Email Address</p>
                                            <p className="text-xs text-muted-foreground">{email}</p>
                                        </div>
                                    </div>
                                    {isEmailVerified && (
                                        <Badge variant="outline" className="text-xs">
                                            Verified
                                        </Badge>
                                    )}
                                </div>

                                {createdAt && (
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">Member Since</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(createdAt), "MMMM dd, yyyy")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {lastLogin && (
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">Last Login</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(lastLogin), "MMMM dd, yyyy 'at' h:mm a")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">Account ID</p>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {user?.id?.substring(0, 8)}...
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
