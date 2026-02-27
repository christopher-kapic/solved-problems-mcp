"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md border bg-background p-1.5 text-muted-foreground hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="relative">
      <CopyButton text={code} />
      <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
        <code className={language ? `language-${language}` : undefined}>
          {code}
        </code>
      </pre>
    </div>
  );
}

function getClaudeCodeConfig(origin: string) {
  return `{
  "mcpServers": {
    "solved-problems": {
      "type": "streamable-http",
      "url": "${origin}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;
}

function getCursorConfig(origin: string) {
  return `{
  "mcpServers": {
    "solved-problems": {
      "url": "${origin}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;
}

function getOpencodeConfig(origin: string) {
  return `{
  "mcp": {
    "solved-problems": {
      "type": "remote",
      "url": "${origin}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;
}

function getGenericConfig(origin: string) {
  return `POST ${origin}/mcp
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json`;
}

export default function McpSetupPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "YOUR_SERVER_URL";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">MCP Setup Guide</h1>
        <p className="mt-1 text-muted-foreground">
          Connect your AI tools to the Solved Problems MCP server to let AI
          agents access and manage your solved problems.
        </p>
      </div>

      {/* Step 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 1: Create an API Key</CardTitle>
          <CardDescription>
            API keys authenticate your AI tools with the MCP server. Each key
            can be scoped to specific solved problems and groups.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              Go to the{" "}
              <Link
                href="/api-keys/new"
                className="font-medium text-primary underline underline-offset-4"
              >
                Create API Key
              </Link>{" "}
              page.
            </li>
            <li>Enter a descriptive name (e.g., &quot;Claude Code&quot;).</li>
            <li>
              Select which solved problems and/or groups this key should have
              access to.
            </li>
            <li>
              Click <strong>Create API Key</strong>.
            </li>
            <li>
              <strong>Copy the generated key immediately</strong> &mdash; it
              will only be shown once.
            </li>
          </ol>
          <div className="pt-2">
            <Link
              href="/api-keys/new"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Create API Key
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Step 2: Configure Claude Code
          </CardTitle>
          <CardDescription>
            Add the following to your Claude Code MCP configuration file (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              .mcp.json
            </code>{" "}
            in your project root or{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              ~/.claude/mcp.json
            </code>{" "}
            for global config).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodeBlock code={getClaudeCodeConfig(origin)} language="json" />
          <p className="text-sm text-muted-foreground">
            Replace{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              YOUR_API_KEY
            </code>{" "}
            with the key from Step 1.
          </p>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Step 3: Configure Other MCP Tools
          </CardTitle>
          <CardDescription>
            For other MCP-compatible AI tools (Cursor, Windsurf, etc.), use a
            similar configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Cursor / Windsurf</h4>
            <CodeBlock code={getCursorConfig(origin)} language="json" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">OpenCode</h4>
            <CodeBlock code={getOpencodeConfig(origin)} language="json" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Generic HTTP Client</h4>
            <CodeBlock code={getGenericConfig(origin)} />
          </div>
          <p className="text-sm text-muted-foreground">
            The MCP server uses the Streamable HTTP transport at the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              /mcp
            </code>{" "}
            endpoint. Authenticate with a Bearer token in the Authorization
            header.
          </p>
        </CardContent>
      </Card>

      {/* Available Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available MCP Tools</CardTitle>
          <CardDescription>
            Once connected, your AI agent will have access to these tools:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium">
                <code className="rounded bg-muted px-1.5 py-0.5">
                  list_solved_problems
                </code>
              </dt>
              <dd className="mt-1 text-muted-foreground">
                Search and filter solved problems by tags, server dependencies,
                client dependencies. Returns name, ID, description, and app
                type.
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                <code className="rounded bg-muted px-1.5 py-0.5">
                  get_solved_problems
                </code>
              </dt>
              <dd className="mt-1 text-muted-foreground">
                Get full details for one or more solved problems by ID,
                including the latest version content, tags, and dependencies.
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                <code className="rounded bg-muted px-1.5 py-0.5">
                  draft_solved_problem
                </code>
              </dt>
              <dd className="mt-1 text-muted-foreground">
                Propose a new solved problem or update to an existing one. Creates
                a draft for you to review and approve in the{" "}
                <Link
                  href="/drafts"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Drafts
                </Link>{" "}
                page.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* AGENTS.md Suggestion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tip: Add to Your AGENTS.md</CardTitle>
          <CardDescription>
            Help AI agents discover your solved problems by adding a reference in
            your project&apos;s AGENTS.md file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add this to your project&apos;s AGENTS.md to remind agents to check
            for relevant solved problems before implementing new features:
          </p>
          <CodeBlock
            code={`Make sure to check if there are any relevant solved problems with the solved-problems mcp server before implementing any new features.`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
