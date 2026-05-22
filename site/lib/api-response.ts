import type { ApiAccess } from "./api-auth";
import { apiJson, type ApiHttpContext } from "./api-http";
import { recordApiUsage } from "./api-usage";

export async function apiJsonWithUsage(
  request: Request,
  value: unknown,
  options: {
    access: ApiAccess;
    cacheControl?: string | undefined;
    context: ApiHttpContext;
    headers?: Record<string, string>;
    route?: string;
    status?: number;
  }
): Promise<Response> {
  const status = options.status ?? 200;
  await recordApiUsage({
    access: options.access,
    context: options.context,
    request,
    responseBody: value,
    route: options.route ?? new URL(request.url).pathname,
    status
  });
  const responseOptions: {
    cacheControl?: string | undefined;
    context: ApiHttpContext;
    headers?: Record<string, string>;
    status?: number;
  } = {
    context: options.context,
    status
  };
  if (options.cacheControl !== undefined) {
    responseOptions.cacheControl = options.cacheControl;
  }
  if (options.headers !== undefined) {
    responseOptions.headers = options.headers;
  }
  return apiJson(value, {
    ...responseOptions
  });
}
