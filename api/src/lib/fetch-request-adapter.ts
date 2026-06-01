import type { HTTPAdapter } from "@x402/core/server";

/** Minimal HTTPAdapter for x402 verification on a raw `Request` (e.g. MCP Streamable HTTP). */
export class FetchRequestAdapter implements HTTPAdapter {
  constructor(
    private readonly request: Request,
    private readonly path: string,
    private readonly body?: unknown,
  ) {}

  getHeader(name: string): string | undefined {
    return this.request.headers.get(name) ?? undefined;
  }

  getMethod(): string {
    return this.request.method;
  }

  getPath(): string {
    return this.path;
  }

  getUrl(): string {
    return this.request.url;
  }

  getAcceptHeader(): string {
    return this.request.headers.get("Accept") ?? "";
  }

  getUserAgent(): string {
    return this.request.headers.get("User-Agent") ?? "";
  }

  getQueryParams(): Record<string, string | string[]> {
    const url = new URL(this.request.url);
    const result: Record<string, string | string[]> = {};
    url.searchParams.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  getQueryParam(name: string): string | string[] | undefined {
    const url = new URL(this.request.url);
    return url.searchParams.get(name) ?? undefined;
  }

  async getBody(): Promise<unknown> {
    return this.body;
  }
}
