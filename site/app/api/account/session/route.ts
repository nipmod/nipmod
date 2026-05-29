import { apiJson, createApiHttpContext } from "../../../../lib/api-http";
import { accountAuthConfig, getCurrentAccountUser } from "../../../../lib/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const config = accountAuthConfig();
  const user = await getCurrentAccountUser();
  return apiJson(
    {
      authConfigured: config.configured,
      authenticated: Boolean(user),
      user,
      type: "dev.nipmod.account-session.v1"
    },
    { context: createApiHttpContext(request) }
  );
}
