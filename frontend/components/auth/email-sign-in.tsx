"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface EmailSignInProps {
  callbackUrl: string;
  buttonText?: string;
}

const validateEmailAddress = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function EmailSignInButton({ callbackUrl, buttonText = "Sign in" }: EmailSignInProps) {
  const [email, setEmail] = useState("");

  return (
    <div className="flex flex-col space-y-4 w-full">
      <div className="space-y-3">
        <Label htmlFor="email" className="text-sm font-medium text-foreground block mb-2">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          className="w-full h-11"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {!validateEmailAddress(email) && email && (
          <p className="text-sm text-destructive mt-1">
            Please enter a valid email address
          </p>
        )}
      </div>
      <Button
        disabled={!email || !validateEmailAddress(email)}
        className="w-full h-11 font-medium"
        variant={"default"}
        onClick={() => {
          signIn("email", {
            callbackUrl,
            email,
            name: email,
          });
        }}
        handleEnter
      >
        {buttonText}
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        This is a local-only feature. Simply enter any email.
      </p>
    </div>
  );
}
