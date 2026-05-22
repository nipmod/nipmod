type ReleaseRouteContext = {
  params: Promise<{
    artifact: string;
  }>;
};

const RELEASE_ARTIFACT = /^nipmod-(?<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\.tgz$/;

export async function GET(_request: Request, context: ReleaseRouteContext): Promise<Response> {
  const { artifact } = await context.params;
  const match = RELEASE_ARTIFACT.exec(artifact);

  if (!match?.groups?.version) {
    return new Response("not found", { status: 404 });
  }

  return Response.redirect(
    `https://github.com/nipmod/nipmod/releases/download/v${match.groups.version}/${artifact}`,
    302
  );
}
