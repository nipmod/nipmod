import { getCurrentAccountUser } from "../../lib/account-auth";
import { createPageMetadata } from "../metadata";
import { AccountWorkspace } from "./account-workspace";
import { AccountLoginSurface, readAccountLoginState } from "./login-surface";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  description: "Nipmod account surface for human package search, agent API keys and integration setup.",
  path: "/account",
  title: "Nipmod account"
});

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getCurrentAccountUser();
  const loginState = readAccountLoginState(await searchParams);

  if (user) {
    return <AccountWorkspace section="chat" user={user} />;
  }

  return <AccountLoginSurface loginPath="/account" nextPath="/account" state={loginState} />;
}
