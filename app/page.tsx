"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { StudySessionForm } from "@/components/StudySessionForm";
import { StudySessionsList } from "@/components/StudySessionsList";

export default function HomePage() {
  const { user, signOut, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="mb-4 text-4xl font-bold">Welcome to Silent Study</h1>
          <p className="text-xl text-muted-foreground">Please sign in to start your study sessions</p>
          <Link href="/auth">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold mb-4">Silent Study App</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Schedule your study sessions and get timely reminders 10 minutes before they start.
          </p>
        </div>

        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Your Study Sessions</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Signed in as: {user.email}
              </span>
              <Button onClick={signOut} variant="outline">
                Sign Out
              </Button>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <StudySessionForm />
            </div>
            <div>
              <StudySessionsList />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}