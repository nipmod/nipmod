import { getCurrentAccountUser } from "../lib/account-auth";
import { AccountWorkspace } from "./account/account-workspace";
import { AccountLoginSurface, readAccountLoginState } from "./account/login-surface";
import { createPageMetadata } from "./metadata";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  description: "Sign in to Nipmod, use package intelligence in chat and create API keys for agents.",
  path: "/",
  title: "Nipmod"
});

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getCurrentAccountUser();

  if (user) {
    return <AccountWorkspace user={user} />;
  }

  return <AccountLoginSurface docsHref="/docs" loginPath="/" nextPath="/account" state={readAccountLoginState(await searchParams)} />;
}
