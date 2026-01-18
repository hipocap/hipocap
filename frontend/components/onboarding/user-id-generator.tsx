"use client";

import { useUserContext } from "@/contexts/user-context";

import CodeHighlighter from "@/components/ui/code-highlighter.tsx";

interface UserIdGeneratorProps {
  title?: string;
}

export default function UserIdGenerator({ title = "Get your User ID" }: UserIdGeneratorProps) {
  const user = useUserContext();
  
  // Always try to get the user ID from context
  const userId = user?.id;
  
  // If user ID is available, display it; otherwise show placeholder
  const displayValue = userId
    ? `HIPOCAP_USER_ID=${userId}`
    : "HIPOCAP_USER_ID=<YOUR_USER_ID>";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-medium">{title}</h2>
      </div>
      <CodeHighlighter className="text-xs bg-background p-4 rounded-md border [&_code]:break-all" copyable code={displayValue} />
      {userId && (
        <p className="text-xs text-muted-foreground">
          Your User ID has been automatically retrieved from your account.
        </p>
      )}
    </div>
  );
}
