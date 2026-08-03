import assert from "node:assert/strict";
import { describe, it } from "node:test";

import StrapiClient from "../src/client";
import { text } from "../src/index";
import { defaults, withServer } from "./helpers";

/*
 * Tutto ciò che deve arrivare a Strapi **oltre** al populate: locale, stato di
 * pubblicazione, parametri di default del client. E come si comporta il client
 * quando la risposta non combacia con lo schema.
 */

const schema = { title: text({ required: true }) };
const entry = (title = "Ciao") => ({ ...defaults(), title });
const collection = (...titles: string[]) => ({
  data: titles.map((title) => entry(title)),
  meta: { pagination: { page: 1, pageCount: 1 } },
});

describe("locale e status", () => {
  it("getSingle passa la locale", async () => {
    await withServer(
      () => ({ data: entry(), meta: {} }),
      async ({ client, requests }) => {
        await client.getSingle("home", { schema, locale: "it" });
        assert.equal(requests[0].search, "locale=it&fields[]=title");
      },
    );
  });

  it("getCollection passa locale e status", async () => {
    await withServer(
      () => collection("Ciao"),
      async ({ client, requests }) => {
        await client.getCollection("projects", { schema, locale: "en", status: "draft" });

        assert.match(requests[0].search, /(^|&)locale=en(&|$)/);
        assert.match(requests[0].search, /(^|&)status=draft(&|$)/);
      },
    );
  });
});

describe("parametri di default del client", () => {
  it("i params di `create` valgono per ogni richiesta", async () => {
    await withServer(
      () => ({ data: entry(), meta: {} }),
      async ({ endpoint, requests }) => {
        const client = await StrapiClient.create(endpoint, { params: { locale: "it" } });
        await client.getSingle("home", { schema });

        assert.match(requests[0].search, /(^|&)locale=it(&|$)/);
      },
    );
  });

  it("la singola chiamata batte il default del client", async () => {
    await withServer(
      () => ({ data: entry(), meta: {} }),
      async ({ endpoint, requests }) => {
        const client = await StrapiClient.create(endpoint, { params: { locale: "it" } });
        await client.getSingle("home", { schema, locale: "en" });

        assert.match(requests[0].search, /(^|&)locale=en(&|$)/);
        assert.doesNotMatch(requests[0].search, /locale=it/);
      },
    );
  });

  it("una chiamata non modifica l'oggetto `params` che le viene passato", async () => {
    await withServer(
      () => ({ data: entry(), meta: {} }),
      async ({ client }) => {
        const params = { locale: "it" };
        await client.getSingle("home", { schema, params });

        assert.deepEqual(params, { locale: "it" });
      },
    );
  });
});

describe("risposta che non combacia con lo schema", () => {
  it("getSingle solleva, invece di restituire null tipizzato non-null", async () => {
    await withServer(
      () => ({ data: { ...defaults() }, meta: {} }),
      async ({ client }) => {
        await assert.rejects(() => client.getSingle("home", { schema }));
      },
    );
  });

  it("getCollection non scarta in silenzio le entry non valide", async () => {
    await withServer(
      () => ({
        data: [entry(), { ...defaults() }],
        meta: { pagination: { page: 1, pageCount: 1 } },
      }),
      async ({ client }) => {
        await assert.rejects(() => client.getCollection("projects", { schema }));
      },
    );
  });

  it('con `onParseError: "skip"` la collection tiene solo le entry valide', async () => {
    await withServer(
      () => ({
        data: [entry("Buona"), { ...defaults() }],
        meta: { pagination: { page: 1, pageCount: 1 } },
      }),
      async ({ client }) => {
        const { data } = await client.getCollection("projects", { schema, onParseError: "skip" });

        assert.deepEqual(
          data.map((item) => item.title),
          ["Buona"],
        );
      },
    );
  });

  it("l'errore dice quale entità e quale campo", async () => {
    await withServer(
      () => ({ data: { ...defaults() }, meta: {} }),
      async ({ client }) => {
        await assert.rejects(
          () => client.getSingle("home", { schema }),
          (error: Error) => {
            assert.match(error.message, /home/);
            assert.match(error.message, /title/);
            return true;
          },
        );
      },
    );
  });
});

describe("errori di Strapi", () => {
  it("il messaggio del corpo arriva a chi chiama, non solo lo statusText", async () => {
    await withServer(
      () => {
        throw new Error("500 con corpo JSON");
      },
      async ({ client }) => {
        await assert.rejects(
          () => client.getSingle("home", { schema }),
          (error: Error) => {
            assert.match(error.message, /handler failed/);
            return true;
          },
        );
      },
    );
  });
});
