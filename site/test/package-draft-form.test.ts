import { describe, expect, test } from "vitest";
import { draftFromRepo, inferRepoName, isValidGitlawbRepo, shellQuote } from "../app/package/package-draft-form";

describe("package draft form", () => {
  test("accepts canonical Gitlawb repo inputs", () => {
    expect(isValidGitlawbRepo("gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader")).toBe(true);
    expect(isValidGitlawbRepo("https://gitlawb.com/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader")).toBe(true);
    expect(isValidGitlawbRepo("https://gitlawb.com/node/repos/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader")).toBe(true);
    expect(isValidGitlawbRepo("https://gitlawb.com/node/repos/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo.name")).toBe(true);
    expect(isValidGitlawbRepo("https://node.nipmod.com/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader.git")).toBe(true);
  });

  test("rejects arbitrary strings before generating commands", () => {
    const draft = draftFromRepo("not a repo");

    expect(draft.status).toBe("invalid");
    expect(draft.commands).toBe("No draft yet.");
    expect(isValidGitlawbRepo("https://example.com/z6Mkabc/repo")).toBe(false);
  });

  test("keeps shell quoting safe for displayed commands", () => {
    expect(inferRepoName("gitlawb://did:key:z6Mkabc/Repo Name.git")).toBe("repo-name");
    expect(inferRepoName("https://gitlawb.com/node/repos/z6Mkabc/repo-name")).toBe("repo-name");
    expect(shellQuote("repo'name")).toBe("'repo'\\''name'");
  });
});
