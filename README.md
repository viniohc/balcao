[English](README.md) · [Português brasileiro](README.pt-BR.md)

# Balcão

Point of sale and order pickup for local fairs.

Balcão is a web application for stall operators at fairs and events. It brings product selection, sales records and order pickup into one interface, so the cashier can handle immediate purchases and orders that need preparation.

The public demo lets you try these workflows with fictional data stored in your browser. Its interface is in Brazilian Portuguese; **Balcão** is the project name in both languages.

## Try the demo

**[Open Balcão](https://balcao-ohc.vercel.app/)**

On the login screen, click **Preencher campos** to fill in the displayed demo credentials, then **Entrar no Balcão**. This is a simulated login: no account is created, and you should not enter real credentials.

## Sales with and without a pickup order

Both flows start by selecting a fair, searching or filtering its products, adding items to the order, adjusting quantities and choosing a payment method.

| Flow | How it works in the demo |
| --- | --- |
| Direct sale | Leave **Registrar como comanda** unchecked and click **Concluir venda**. The sale is saved in the history without entering the pickup queue. |
| Numbered pickup order | Enable **Registrar como comanda**, optionally add a note, then click **Registrar comanda**. The order receives a number and appears in **Comandas**, where you can view its items and status, call it for pickup and mark it as collected. |

Here, *comanda* means a numbered order used to track pickup. Pix, cash and card are recorded as payment methods; the demo does not process payments.

## Features

- **Sales:** product search, category filters, quantity controls and calculated order totals.
- **Pickup queue:** order numbers, notes and status, with filters for outstanding, completed or all orders; actions to call an order and confirm collection.
- **History:** items, date and time, payment method, amount and sale status; cancellation with confirmation and totals by payment method.
- **Products:** create, edit and delete products with a name, price and category.
- **Fairs:** switch between separate catalogues and sales records; create, rename or delete a fair and set its stall name.
- **Activity summary:** confirmed sales value, confirmed orders, items sold and orders awaiting pickup, calculated from the active fair's records.
- **Interface:** responsive layouts, labelled form fields and custom dropdowns with mouse, touch and keyboard support.

## Run the demo locally

Use Node.js 24.x and npm, plus Git to clone the repository. This Node version meets the dependency requirements recorded in the lockfile.

```bash
git clone https://github.com/viniohc/balcao.git
cd balcao
npm ci
npm run dev:demo
```

Open the local URL printed by Vite. No Firebase setup or environment file is required for the demo; its Vite configuration disables environment-file loading.

Other demo-related commands from [package.json](package.json):

| Command | Purpose |
| --- | --- |
| `npm run test` | Run the local Vitest suite. Firestore emulator tests are excluded from this suite. |
| `npm run build:demo` | Type-check the project and build the demo into `dist-demo`. |

The scripts named `dev`, `build` and `preview` use the separate application configuration described below.

## Demo data and storage

A fresh demo database contains **4 fairs, 60 products and 96 sales/order records**. These are fictional examples, including different payment methods, cancellations and pickup statuses. They are not usage statistics.

- **IndexedDB**, accessed through Dexie, stores fairs, products, sales and settings in the database named `festa-camarao-portfolio-demo`.
- **localStorage** stores the simulated session and selected fair. Signing out does not delete saved records.
- Saved changes survive a reload. The unfinished cart is held in memory and is not saved across reloads.
- The additional example pack is inserted once. Existing edits are preserved, and subsequent reloads do not recreate deleted examples or duplicate the pack.
- **Restaurar dados** asks for confirmation, then replaces all demo records for that browser origin with the examples.

Storage belongs to a browser profile and origin. Localhost, another domain or another device has separate data. Clearing site data removes the saved demo records; there is no server backup or synchronization in the demo.

The examples and initialization logic are in [sampleData.ts](src/demo/sampleData.ts) and [database.ts](src/demo/database.ts).

## Technologies and repository scope

The demo uses **Vue 3**, **TypeScript**, **Vite 8**, CSS and **Dexie/IndexedDB**. The build configuration also loads the Tailwind CSS 4 Vite plugin. Tests use **Vitest**, **jsdom** and **fake-indexeddb**.

This repository contains two application entry points:

| Area | Published demo | Separate application code |
| --- | --- | --- |
| Entry | `demo.html` → `src/demo/main.ts` | `index.html` → `src/main.ts` |
| Main code | `src/demo/` | `src/views/`, `src/stores/`, `src/services/` and `src/router/` |
| Data and access | Local demo repository and simulated login | Firebase Authentication, Firestore integration and separate local storage |
| Additional infrastructure | No Firebase runtime, backend API or service worker | Vue Router, Pinia and PWA configuration |
| Build | `npm run build:demo` → `dist-demo` | `npm run build` → `dist` |

The public demo does not expose every feature in the separate application. Its flows and data stay within `src/demo`; types are shared from `src/types/models.ts`. The separate application has its own Firebase configuration requirements and is not covered by the demo setup instructions above.

[vercel.json](vercel.json) runs `npm run build:demo` and publishes only `dist-demo`. Its root and login routes serve the demo entry. [vite.demo.config.ts](vite.demo.config.ts) does not copy the separate application's public directory or load its environment files. The other build remains configured in [vite.config.ts](vite.config.ts).

For visual conventions and implementation notes, see [DESIGN.md](DESIGN.md).

## Font

Albert Sans is bundled locally. Its [SIL Open Font License 1.1](src/demo/assets/albert-sans-OFL.txt) is included in the repository and emitted with the demo build.
