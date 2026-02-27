I want to iterate on my current solved-problems strategy.

Right now, I have a repo called solved-problems, and I clone the solved problems markdown files to @.ktg/ and agents can reference them there. I want to switch to a MCP, so I can install the solved problems mcp and my agent can reference solved problems no matter what project it is working on.

I want to use NextJS as middleware for Hono (so that I don't have to have separate subdomains for my API and for my frontend), and this is how it should work.

This will be an open-source project, and users will be able to self-host it.

The first user to sign up should be an admin user. Let's just use better-auth credentials for now (no oauth implementation yet). Every user that signs up after that should be a regular user.

Admins should be able to configure settings, such as enabling/disabling user sign up.

When a user signs up, they should be able to create solved-problem groups, solved problems, and API keys.

solved-problems should have the following:

- `server dependencies`
- `client dependencies`
  Note: server and client dependencies should store the name and the version and package manager (eg: cargo, npm, etc)
- `versions` (so users can iterate)
- `copied from` (so users/agents can duplicate solved-problems)
- `tags`
- `description`
- `name`
- `id` (matches name but lowercase and replace " " with "-", globally unique)
- `app_type` (eg: CLI, Web app, React native app, desktop app, API, MCP... or anything really)
- `details` (full implementation of the solved problem, as markdown)

There should be an MCP server hosted in the hono app. AI agents can authenticate to the MCP with the user's API key.

Here are the tools that the MCP server should expose:

`list_solved_problems`: lists all of the solved problems that the API key has access to. Optional params: server_dependencies: string[], client_dependencies: string[], tags: string[] - if any/all of the optional params are included, it should filter and return the solved problems to which that API key has access with case-insensitive matches for each of the params (eg: server_dependencies: ["next"] would return solved_problems where nextjs is a server dependency). list_solved_problems should return the name, id, description, and app type of all of the matching solved problems.

`get_solved_problems`: required param: ids: string[] - returns all of the solved problems to which the API key has access, all fields.

`draft_solved_problem`: optional param: id: string, required params: all of the params for the solved problem. This will be useful in case the agent finds that a solved problem is out of date or needs updating. Users should be able to edit and approve drafts that their agents propose in the web app. If the user doesn't own a solved-problem and wants to approve it, they should be able to copy that solved problem into one that they own. Note that solved problems should be project-agnostic (so agents should make sure the proposed solved problem is generalizable and can be reused in other projects. Project specific details should go in that project's AGENTS.md file (or wherever the user says it should go)).

---

## Clarifications & Additional Details

### Database & ORM

- **PostgreSQL** with **Prisma** (already scaffolded in `packages/db/`)
- Prisma 7 with `@prisma/adapter-pg`, ESM output, multi-file schema (`prisma/schema/`)
- Better Auth tables already exist in `auth.prisma`

### Access & Ownership Model

- Every solved problem has exactly **one owner** (the user who created it)
- Solved problems can belong to **groups** (collections/folders for organizing solved problems)
- Groups also have exactly one owner
- Owners can **share** groups or individual solved problems with other users, specifying **read** or **write** permission:
  - **Read**: can view the solved problem / group contents
  - **Write**: can edit existing solved problems and create new ones within that group
- If a user with read-only access wants to modify a shared solved problem, they can **copy/fork** it into their own ownership

### API Keys

- Each API key belongs to one user
- Users specify which **solved problems** and/or **groups** an API key can access
- API keys inherit the user's permission level for the resources they're scoped to (if the user has read on a group, the key gets read)
- API key management: create, name, revoke (no expiration for now)
- MCP authenticates via API key passed in HTTP headers

### Solved Problem Groups

- Groups are named collections of solved problems
- A solved problem can belong to multiple groups
- Groups can be shared independently of their individual solved problems
- Users can create, rename, and delete groups they own

### Versioning

- Each solved problem has an ordered list of **versions** (like the current numbered file system: 1.md, 2.md, etc.)
- Each version stores the full `details` markdown content and a timestamp
- The latest version is the default when viewing/returning a solved problem
- Previous versions are viewable in the web UI for history

### Forking / "Copied From"

- When a user copies a solved problem, the new one stores a `copiedFromId` linking back to the original
- This is a simple reference — no upstream change tracking

### MCP Transport

- Streamable HTTP via `@hono/mcp` at the `/mcp` endpoint
- API key authentication via HTTP headers (e.g., `Authorization: Bearer <api-key>`)
- Reference solved problem: `mcp-with-dashboard` in `.ktg/sp/` covers the Hono + MCP + oRPC + dashboard pattern

### Web UI Pages

- **Sign up / Sign in** (better-auth credentials)
- **Dashboard** — overview of user's solved problems, groups, recent drafts
- **Solved Problems** — list/search/filter view (by tags, dependencies, app_type, name), create/edit with plain textarea (shadcn) for markdown details
- **Groups** — create, manage, assign solved problems to groups
- **Sharing** — manage who has access to your groups/solved problems and at what permission level
- **API Keys** — create, name, revoke, configure which resources each key can access
- **Drafts** — review agent-proposed drafts, approve (applies changes), reject, or copy-to-own
- **Admin Settings** (admin only) — enable/disable user sign up, other site-wide config
- Search/filtering in the web UI mirrors MCP filtering (tags, dependencies, app_type, text search)

### Deployment

- Self-hosted with **Docker** (docker-compose with PostgreSQL + app container)
- NextJS as Hono middleware (single port serves both API and frontend)
- Reference: `astro-hono-setup` solved problem in `.ktg/sp/` covers the Hono middleware + Docker pattern (applicable to NextJS too)
- **Database schema**: The Docker CMD should conditionally apply the Prisma schema on startup via an `APPLY_SCHEMA` environment variable: `CMD ["sh", "-c", "[ \"$APPLY_SCHEMA\" = \"true\" ] && pnpm --filter @solved-problems/db db:push; node dist/index.mjs"]`. This allows first-time setup and schema updates on deploy without requiring manual migration steps.

### Existing Project Structure

```
apps/
  server/       # Hono server
  web/          # Frontend (NextJS as middleware)
  docs/         # Documentation
packages/
  api/          # oRPC routers
  auth/         # Better Auth config
  config/       # Shared config
  db/           # Prisma + PostgreSQL
  env/          # Environment variable schemas
```

### Not In Scope (for now)

- OAuth providers (credentials only)
- Import/migration from file-based solved problems
- Rate limiting
- API key expiration
