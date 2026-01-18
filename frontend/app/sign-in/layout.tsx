import React from "react";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: '#141414' }}>
      {children}
    </div>
  );
}
