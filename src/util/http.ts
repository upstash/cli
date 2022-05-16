export type UpstashRequest = {
  authorization: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path?: string[];
  /**
   * Request body will be serialized to json
   */
  body?: unknown;
};

type HttpClientConfig = {
  baseUrl: string;
};

class HttpClient {
  private readonly baseUrl: string;

  public constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  public async request<TResponse>(req: UpstashRequest): Promise<TResponse> {
    if (!req.path) {
      req.path = [];
    }

    const url = [this.baseUrl, ...req.path].join("/");
    const init: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: req.authorization,
      },
    };
    if (req.method !== "GET") {
      init.body = JSON.stringify(req.body);
    }

    // fetch is defined by isomorphic fetch
    // eslint-disable-next-line no-undef
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return (await res.json()) as TResponse;
  }
}

export const http = new HttpClient({ baseUrl: "https://api.upstash.com" });
