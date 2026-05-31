/**
 * AlphaGrid API entrypoint (Cloudflare Worker).
 * Route handlers and business logic will be added in a follow-up PR.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", service: "alphagrid-api" });
    }

    return Response.json({ error: "Not implemented" }, { status: 501 });
  },
} satisfies ExportedHandler;
