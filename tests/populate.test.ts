import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { component, dynamic, media, relation, text } from "../src/index";
import { defaults, mediaPayload, withServer } from "./helpers";

/*
 * Cosa finisce nella query string a partire da uno schema.
 *
 * È il cuore della libreria: lo schema è insieme spec di populate e tipo, e se il
 * populate è sbagliato il tipo mente — la relazione risulta popolata ma non c'è.
 * Questi test guardano la richiesta, non la risposta.
 */

/*
 * Interessa solo cosa è stato chiesto: il finto backend risponde con un'entità che
 * non combacia con lo schema, e l'errore che ne segue si ignora di proposito.
 */
const single = async (schema: any) => {
  let search = "";
  await withServer(
    () => ({ data: { ...defaults() }, meta: {} }),
    async ({ client, requests }) => {
      await client.getSingle("thing", { schema }).catch(() => undefined);
      search = requests[0].search;
    },
  );
  return search;
};

describe("populate dedotto dallo schema", () => {
  it("uno schema di soli scalari chiede quei campi e nessun populate", async () => {
    assert.equal(await single({ title: text({ required: true }) }), "fields[]=title");
  });

  it("`fields: false` lascia il populate e non restringe nulla", async () => {
    let search = "";
    await withServer(
      () => ({ data: { ...defaults() }, meta: {} }),
      async ({ client, requests }) => {
        await client
          .getSingle("thing", {
            schema: { title: text({ required: true }), cover: media.single() },
            fields: false,
          })
          .catch(() => undefined);
        search = requests[0].search;
      },
    );

    assert.equal(search, "populate[cover]=true");
  });

  it("un media si popola", async () => {
    assert.equal(await single({ cover: media.single() }), "populate[cover]=true");
  });

  it("un componente annidato scende di un livello", async () => {
    const schema = {
      intro: component.single({
        eyebrow: text({ required: true }),
        cta: component.single({ label: text({ required: true }) }),
      }),
    };

    assert.equal(
      await single(schema),
      "populate[intro][fields][]=eyebrow&populate[intro][populate][cta][fields][]=label",
    );
  });

  it("una relazione porta con sé i propri media", async () => {
    const schema = {
      related: relation.hasMany({
        title: text({ required: true }),
        thumbnail: media.single({ required: true }),
      }),
    };

    assert.equal(
      await single(schema),
      "populate[related][fields][]=title&populate[related][populate][thumbnail]=true",
    );
  });

  it("una dynamic zone usa `on`, e ogni blocco porta i propri campi", async () => {
    const schema = {
      content: dynamic({
        "blocks.image-full": { image: media.single({ required: true }) },
        "blocks.text": { text: text({ required: true }) },
      }),
    };

    assert.equal(
      await single(schema),
      "populate[content][on][blocks.image-full][populate][image]=true&" +
        "populate[content][on][blocks.text][fields][]=text",
    );
  });
});

describe("lettura", () => {
  it("getSingle restituisce i dati validati e i campi di default", async () => {
    await withServer(
      () => ({
        data: { ...defaults("doc-1"), title: "Ciao", cover: mediaPayload("/uploads/x.webp") },
        meta: {},
      }),
      async ({ client }) => {
        const { data } = await client.getSingle("thing", {
          schema: { title: text({ required: true }), cover: media.single({ required: true }) },
        });

        assert.equal(data.title, "Ciao");
        assert.equal(data.cover.url, "/uploads/x.webp");
        assert.equal(data.documentId, "doc-1");
      },
    );
  });

  it("i campi non dichiarati sopravvivono a runtime", async () => {
    await withServer(
      () => ({ data: { ...defaults(), title: "Ciao", extra: "resto" }, meta: {} }),
      async ({ client }) => {
        const { data } = await client.getSingle("thing", {
          schema: { title: text({ required: true }) },
        });

        assert.equal((data as Record<string, unknown>).extra, "resto");
      },
    );
  });

  it("getCollection con `pagination: false` scarica tutte le pagine", async () => {
    await withServer(
      (_request, index) => ({
        data: [{ ...defaults(`doc-${index}`), title: `Pagina ${index + 1}` }],
        meta: { pagination: { page: index + 1, pageCount: 3 } },
      }),
      async ({ client, requests }) => {
        const { data } = await client.getCollection("things", {
          schema: { title: text({ required: true }) },
          pagination: false,
        });

        assert.equal(requests.length, 3);
        assert.deepEqual(
          data.map((entry) => entry.title),
          ["Pagina 1", "Pagina 2", "Pagina 3"],
        );
      },
    );
  });
});
