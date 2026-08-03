import http from "http";
import { AddressInfo } from "net";

import StrapiClient from "../src/client";

/**
 * Una richiesta ricevuta dal finto backend.
 *
 * `search` è la query string **grezza**: è quella che si vuole asserire, perché è
 * l'unico punto in cui si vede davvero cosa la libreria ha chiesto a Strapi.
 */
export interface RecordedRequest {
  method: string;
  pathname: string;
  search: string;
  body: string;
}

/**
 * Alza un finto backend Strapi, gli punta contro un client e passa entrambi al test.
 *
 * È un server HTTP vero e non uno stub di `fetch`: il client importa `node-fetch`,
 * quindi sostituire la globale non intercetterebbe nulla. In cambio i test coprono
 * anche la serializzazione dei parametri, che è metà del contratto verso Strapi.
 *
 * `respond` riceve la richiesta n-esima e restituisce il corpo JSON: così un test
 * può rispondere in modo diverso alla prima e alla seconda pagina.
 */
export const withServer = async (
  respond: (request: RecordedRequest, index: number) => unknown | Promise<unknown>,
  run: (context: {
    client: Awaited<ReturnType<typeof StrapiClient.create>>;
    /** L'endpoint del finto backend, per i test che costruiscono un client proprio. */
    endpoint: string;
    requests: RecordedRequest[];
  }) => Promise<void>,
) => {
  const requests: RecordedRequest[] = [];

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);

    const url = new URL(req.url ?? "/", "http://localhost");
    const request: RecordedRequest = {
      method: req.method ?? "GET",
      pathname: url.pathname,
      search: decodeURIComponent(url.search.replace(/^\?/, "")),
      body: Buffer.concat(chunks).toString(),
    };
    requests.push(request);

    let payload: unknown;
    try {
      payload = await respond(request, requests.length - 1);
    } catch {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "handler failed" } }));
      return;
    }

    if (payload === undefined) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: null, error: { status: 404, message: "Not Found" } }));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const endpoint = `http://127.0.0.1:${port}/api`;

  try {
    const client = await StrapiClient.create(endpoint);
    await run({ client, endpoint, requests });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

/** Un media come lo restituisce Strapi, ridotto ai campi che lo zod pretende. */
export const mediaPayload = (url = "/uploads/a.webp") => ({
  id: 1,
  name: "a.webp",
  alternativeText: null,
  caption: null,
  width: 100,
  height: 100,
  hash: "a",
  ext: ".webp",
  mime: "image/webp",
  size: 1,
  url,
  previewUrl: null,
  provider: "local",
  provider_metadata: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

/** I campi che Strapi mette in ogni entità e che lo zod di uscita si aspetta. */
export const defaults = (documentId = "abc") => ({
  id: 1,
  documentId,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  publishedAt: "2026-01-01T00:00:00.000Z",
});
