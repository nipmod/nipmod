# Site Map

## App Shell

```text
site/app/layout.tsx
site/app/site-header.tsx
site/app/globals.css
site/app/content.ts
```

`layout.tsx` controls metadata, icons, alternate agent files and the global header.

`site-header.tsx` controls the top navigation and social buttons.

`content.ts` contains the main homepage copy and shared links.

## Primary Routes

```text
site/app/page.tsx
site/app/packages/page.tsx
site/app/packages/[packageName]/page.tsx
site/app/setup/page.tsx
site/app/mcp/page.tsx
site/app/platforms/page.tsx
site/app/status/page.tsx
site/app/trust/page.tsx
site/app/security/page.tsx
```

These are the pages most users and agents will inspect first.

## Product Flow Pages

```text
site/app/demo/page.tsx
site/app/agents/page.tsx
site/app/agents/codex-claude/page.tsx
site/app/package/page.tsx
site/app/audit/page.tsx
site/app/evidence/page.tsx
site/app/evidence/package/[packageName]/page.tsx
site/app/proof/page.tsx
```

These explain how agents use packages, how repo owners prepare packages and where proof lives.

## Ecosystem Pages

```text
site/app/bankr/page.tsx
site/app/launch/page.tsx
site/app/launch-kit/page.tsx
site/app/examples/page.tsx
site/app/gitlawb/[owner]/page.tsx
site/app/gitlawb/[owner]/[repo]/page.tsx
```

Keep ecosystem claims scoped. Bankr is under review. Gitlawb is the first source network. GitHub is a public mirror and review surface.

## Machine and Agent Files

```text
site/public/.well-known/nipmod.json
site/public/llms.txt
site/public/agent-prompts.json
site/public/compatibility/system-readiness.json
site/public/compatibility/platform-readiness.json
site/public/compatibility/platform-connections.json
site/app/api/mcp/route.ts
```

These are not decorative. If design copy changes a product fact, update these only when the backing facts are still true and tests pass.

## Tests That Catch Broken Navigation

```text
site/e2e/readiness.spec.ts
site/test/discovery-manifest.test.ts
site/test/platform-readiness.test.ts
site/test/system-readiness.test.ts
site/test/mcp-content.test.ts
site/test/remote-mcp-route.test.ts
```

If changing navigation, buttons, routes or machine files, update tests intentionally.
