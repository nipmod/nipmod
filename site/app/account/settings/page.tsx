import { getCurrentAccountUser } from "../../../lib/account-auth";
import { createPageMetadata } from "../../metadata";
import { AccountWorkspace } from "../account-workspace";
import { AccountLoginSurface, readAccountLoginState } from "../login-surface";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  description: "Nipmod account settings and hosted API boundaries.",
  path: "/account/settings",
  title: "Nipmod account settings"
});

type AccountSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountSettingsPage({ searchParams }: AccountSettingsPageProps) {
  const user = await getCurrentAccountUser();
  const loginState = readAccountLoginState(await searchParams);

  if (user) {
    return <AccountWorkspace section="settings" user={user} />;
  }

  return <AccountLoginSurface loginPath="/account" nextPath="/account/settings" state={loginState} />;
}
