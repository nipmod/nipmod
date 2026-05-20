export function removedScoutResponse() {
  return Response.json(
    {
      error: "Package candidate discovery has been retired. Use https://nipmod.com/package for repos you own.",
      ok: false
    },
    {
      headers: {
        "cache-control": "no-store"
      },
      status: 410
    }
  );
}
