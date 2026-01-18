"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import React, { useState } from "react";

import { AzureButton } from "@/components/auth/azure-button";
import { EmailSignInButton } from "@/components/auth/email-sign-in";
import { GitHubButton } from "@/components/auth/github-button";
import { GoogleButton } from "@/components/auth/google-button";
import { cn } from "@/lib/utils";

interface SignInProps {
  callbackUrl: string;
  enableGoogle?: boolean;
  enableGithub?: boolean;
  enableAzure?: boolean;
  enableCredentials?: boolean;
}

type Provider = "github" | "google" | "azure-ad";

const defaultErrorMessage = `Failed to sign in. Please try again.`;

const SignIn = ({ callbackUrl, enableGoogle, enableGithub, enableAzure, enableCredentials }: SignInProps) => {
  const searchParams = useSearchParams();
  const [error, setError] = useState(searchParams.get("error"));
  const [isLoading, setIsLoading] = useState<Provider | string>("");

  const handleSignIn = async (provider: Provider) => {
    try {
      setIsLoading(provider);
      const result = await signIn(provider, { callbackUrl });

      if (result && !result.ok) {
        setError(result?.error || defaultErrorMessage);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : defaultErrorMessage;
      setError(errorMessage);
    } finally {
      setIsLoading("");
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-screen w-full relative">
      <div className="flex flex-1 justify-center items-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo and Welcome Section */}
          <div className="text-center mb-10">
            <Link className="inline-block mb-6" href="/">
              <Image 
                alt="Hipocap Logo" 
                src="/images/logo.webp" 
                width={180} 
                height={80}
                className="mx-auto"
              />
            </Link>
            <h1 className="text-3xl font-semibold mb-2 text-foreground">
              Welcome Back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to your account
            </p>
          </div>

          {/* Sign In Form Card */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-8 shadow-lg">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-destructive text-sm">{defaultErrorMessage}</span>
              </div>
            )}

            <div className="space-y-4">
              {enableCredentials && <EmailSignInButton callbackUrl={callbackUrl} />}
              
              {(enableGoogle || enableGithub || enableAzure) && enableCredentials && (
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card/50 px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
              )}

              {enableGoogle && (
                <GoogleButton
                  onClick={() => handleSignIn("google")}
                  isLoading={isLoading === "google"}
                  isDisabled={!!isLoading}
                  className={cn({
                    "w-full": enableCredentials,
                  })}
                />
              )}
              {enableGithub && (
                <GitHubButton
                  onClick={() => handleSignIn("github")}
                  isLoading={isLoading === "github"}
                  isDisabled={!!isLoading}
                  className={cn({
                    "w-full": enableCredentials,
                  })}
                />
              )}
              {enableAzure && (
                <AzureButton
                  onClick={() => handleSignIn("azure-ad")}
                  isLoading={isLoading === "azure-ad"}
                  isDisabled={!!isLoading}
                  className={cn({
                    "w-full": enableCredentials,
                  })}
                />
              )}
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <span className="text-sm text-muted-foreground">
              Don&#39;t have an account?{" "}
              <Link 
                className="text-primary hover:text-primary/80 font-medium transition-colors" 
                href={{ pathname: "/sign-up", query: { callbackUrl } }}
              >
                Create one
              </Link>
            </span>
          </div>

          {/* Footer */}
          {!enableCredentials && (
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                By continuing you agree to our{" "}
                <a href="/policies/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/policies/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
