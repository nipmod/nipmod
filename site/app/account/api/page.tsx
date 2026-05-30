import { getCurrentAccountUser } from "../../../lib/account-auth";
import { createPageMetadata } from "../../metadata";
import { AccountWorkspace } from "../account-workspace";
import { AccountLoginSurface, readAccountLoginState } from "../login-surface";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  description: "Create and manage Nipmod API keys for agents and integrations.",
  path: "/account/api",
  title: "Nipmod account API keys"
});

type AccountApiPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountApiPage({ searchParams }: AccountApiPageProps) {
  const user = await getCurrentAccountUser();
  const loginState = readAccountLoginState(await searchParams);

  if (user) {
    return <AccountWorkspace section="api" user={user} />;
  }

  return <AccountLoginSurface loginPath="/account" nextPath="/account/api" state={loginState} />;
}
