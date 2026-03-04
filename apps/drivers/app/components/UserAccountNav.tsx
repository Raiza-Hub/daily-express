"use client"

import { useRouter } from "next/navigation"
import { QuestionIcon, SignOutIcon } from "@phosphor-icons/react"
import { UserAccountNav as SharedUserAccountNav } from "@repo/ui/UserAccountNav"

// TODO: replace with real user from your auth provider (e.g. WorkOS, NextAuth)
const mockUser = {
    firstName: "Daniel",
    lastName: "Okafor",
    email: "daniel.okafor24@example.com",
    profilePictureUrl:
        "https://images.unsplash.com/photo-1617244147030-8bd6f9e21d1e?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
}

export function UserAccountNav() {
    const router = useRouter()

    const signOut = () => {
        console.log("User signed out")
    }

    return (
        <SharedUserAccountNav
            user={mockUser}
            menuItems={[
                {
                    key: "support",
                    icon: <QuestionIcon weight="bold" />,
                    label: "Support",
                    href: "mailto:support@yourdomain.com",
                },
            ]}
            footerItems={[
                {
                    key: "signout",
                    icon: <SignOutIcon weight="bold" />,
                    label: "Log out",
                    onClick: signOut,
                },
            ]}
        />
    )
}
