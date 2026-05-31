export interface Env {}

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response(
      JSON.stringify({ service: "alphagrid-api", status: "not_implemented" }),
      {
        status: 501,
        headers: { "content-type": "application/json" },
      },
    );
  },
} satisfies ExportedHandler<Env>;
