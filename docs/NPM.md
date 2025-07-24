# simple-strapi

> 📦 A lightweight and intuitive Strapi client library for fetching collections and single entries with schema-based validation and flexible field types.

## Installation

Run the following to install the package:

```bash
npm install simple-strapi
# or
yarn add simple-strapi
```

## API

| Funzione                                 | Descrizione                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `StrapiClient.create(baseUrl, options?)` | Crea un'istanza del client Strapi con URL base e opzionale token di autenticazione. |
| `strapiClient.getCollection(name, opts)` | Recupera una collezione di entries, con paginazione e schema per validazione.       |
| `strapiClient.getSingle(name, opts)`     | Recupera una singola entry, con filtri e schema per validazione.                    |

Per la documentazione completa, consulta il repository GitHub del progetto.

For the full documentation, please refer to the project's GitHub repository.

## License

[ISC](./LICENSE)

## Maintainer

[@hund-ernesto](https://github.com/hund-ernesto)
