export interface IntelligenceHttpRequest {
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly pathWithQuery: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal;
}

export interface IntelligenceHttpResponse {
  readonly status: number;
  readonly body: string;
}

export interface IntelligenceTransport {
  send(request: IntelligenceHttpRequest): Promise<IntelligenceHttpResponse>;
}

export class FetchIntelligenceTransport implements IntelligenceTransport {
  public async send(request: IntelligenceHttpRequest): Promise<IntelligenceHttpResponse> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.method === "GET" ? {} : { body: request.body }),
      signal: request.signal,
    });
    return { status: response.status, body: await response.text() };
  }
}
