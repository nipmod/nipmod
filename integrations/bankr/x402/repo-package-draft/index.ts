const gitlawbRepoPattern = /^gitlawb:\/\/did:key:z[1-9A-HJ-NP-Za-km-z]+\/[A-Za-z0-9._-]+$/;

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const repo = (url.searchParams.get("repo") ?? "").trim();

  if (!repo) {
    return Response.json({ error: "repo is required" }, { status: 400 });
  }

  if (!gitlawbRepoPattern.test(repo)) {
    return Response.json({ error: "repo must be a gitlawb://did:key:.../repo URL" }, { status: 400 });
  }

  const draftUrl = `https://nipmod.com/scout/draft?repo=${encodeURIComponent(repo)}`;
  const draftResponse = await fetch(draftUrl, { headers: { Accept: "application/json" } });

  if (!draftResponse.ok) {
    return Response.json(
      {
        claimUrl: `https://nipmod.com/package?repo=${encodeURIComponent(repo)}`,
        error: "draft not found",
        repo
      },
      { status: draftResponse.status === 404 ? 404 : 502 }
    );
  }

  const draft = (await draftResponse.json()) as unknown;

  return {
    claimUrl: `https://nipmod.com/package?repo=${encodeURIComponent(repo)}`,
    draft,
    packagePr: `nipmod package pr ${repo} --dir repo-package-pr --json`,
    packagePrArgs: ["nipmod", "package", "pr", repo, "--dir", "repo-package-pr", "--json"],
    repo
  };
}
