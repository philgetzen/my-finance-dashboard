# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HealthyWealth is a personal finance dashboard built on YNAB. It reads accounts, transactions and categories from the YNAB API, adds manual accounts and holdings, and shows net worth, cash flow, runway, investments and a Conscious Spending Plan (CSP). A weekly email newsletter summarizes the same numbers.

- **Frontend** (`frontend/`): React 19, Vite 6, Tailwind CSS 3, Recharts, TanStack Query, React Router 7
- **API** (`api/`): Vercel serverless functions, in production and locally through `vercel dev`
- **Newsletter code** (`backend/`): the metrics, template, AI and email modules `api/newsletter.js` loads. There is no server here.
- **Shared rules** (`shared/`): the cash-flow classifier both the dashboard and the newsletter use
- **Auth and storage**: Firebase Auth (Google sign-in) and Firestore
- **Deploy**: Vercel (`vercel.json`), at healthywealth.philgetzen.com

## Commands

Frontend (from `frontend/`):
- `npm run dev`: start the Vite dev server
- `npm run build`: production build
- `npm run lint`: ESLint (CI fails on errors; warnings are allowed)
- `npm run test:run`: Vitest, single run (`npm test` watches)

API (from the repo root):
- `vercel dev`: serve the `api/` functions on port 3000, with the linked Vercel project's development env vars. Run the frontend's `npm run dev` alongside it. Don't add a root `dev` script that calls `vercel dev`: `vercel dev` runs that script itself and refuses to recurse.
- `npm run test:api`: Node's test runner over `api/__tests__/` (auth and ownership for every user route)

Backend (from `backend/`):
- `npm test`: Node's built-in test runner over `newsletter/` and `services/`

Firestore rules (from `tests/firestore-rules/`, needs Java):
- `npm install && npm test`: runs `firestore.rules` against the emulator

CI (`.github/workflows/tests.yml`) runs backend tests, API tests, then frontend lint, tests and build, on every PR and on pushes to main. The rules tests are local-only.

## Architecture

### Cash-flow rules
- `shared/cashflow.mjs` decides what counts as income, spending, investing and saving. The dashboard (`frontend/src/utils/calculations/cashflow.js`) and the newsletter (`backend/newsletter/cashflow.js`) both re-export it, so change the rules there, not in either app.
- It is a plain ES module with no imports. Vite bundles it for the dashboard. The backend loads it with `import()`, because Vercel's function runtime can't `require()` an ES module, so newsletter code must `await loadSharedRules()` (from `backend/newsletter/cashflow.js`) before building a ledger. The backend CI job runs with `--no-experimental-require-module` to catch a stray `require()`.
- YNAB dates are calendar dates. Parse them with `parseLocalDate()` (frontend) or keep them as `'YYYY-MM-DD'` strings (backend). `new Date('2026-08-01')` is July 31 in US time zones.

### Frontend
- `src/App.jsx` holds the routes. Pages are in `src/components/pages/`: Dashboard (`/`), Accounts, CashFlow (`/spending`), InvestmentAllocation (`/investments`), Runway, ConsciousSpendingPlan (`/conscious-spending`).
- `src/contexts/ConsolidatedDataContext.jsx` is the single data provider. Components read it through `useFinanceData()` and `usePrivacy()`. It also handles demo mode, which uses `src/lib/mockData.js`.
- API calls use `VITE_API_BASE_URL`: empty in production (same origin), `http://localhost:3000` (`vercel dev`) locally. It must be set: `src/lib/ynabApi.js` falls back to localhost, but the calls in `ConsolidatedDataContext.jsx`, `AuthenticationPage.jsx` and `YNABConnectionCard.jsx` don't. `ynabApi.js` also refreshes the YNAB token on a 401.
- Calls to the user routes (`ynab/token`, `save_token`, `refresh_token`, `disconnect`, `manual_accounts`, `manual_holdings`, `import-altruist-holdings`) go through `src/lib/authFetch.js`, which sends the Firebase ID token. Never send `user_id`; the server takes the user from the token.
- Page math lives in hooks (`src/hooks/`: `useTransactionProcessor`, `useCategoryProcessor`, `useConsciousSpendingPlan`, `useRunwayCalculator`, `useIncomeScenario`) and in `src/utils/calculations/`.
- Use the existing card and layout patterns and Tailwind classes. Use `import.meta.env.DEV` / `PROD`, not `process.env`.

### API routes
Every route is a Vercel function in `api/`; `vercel dev` runs the same files locally. (An Express copy in `backend/index.js` was removed in October 2026.)
- The user routes require `Authorization: Bearer <Firebase ID token>` (`api/_lib/auth.js`: `withUser`, inside `handleCors`) and use the token's uid. A `user_id` that disagrees gets 403; per-document routes check the owner (`ownerOf`).
- `api/ynab/`: OAuth (`auth`, `token`, `save_token`, `refresh_token`, `disconnect`) and YNAB data. `budgets/index.js` lists budgets, or proxies `?budgetId=&resource=accounts|transactions|categories|months|scheduled_transactions` (plus `since_date` for transactions).
- `api/manual_accounts/`, `api/manual_holdings/`, `api/import-altruist-holdings.js`: manual data
- `api/newsletter.js`: the weekly email. `?action=cron` (Vercel cron, Saturdays 17:00 UTC), `?action=preview&user_id=`, or POST to send. Every action needs `Authorization: Bearer $CRON_SECRET`.

### Newsletter
`backend/services/newsletterService.js` fetches YNAB data, then:
- `backend/newsletter/metrics.js` and `trends.js` compute the numbers.
- `aiAnalysisService.js` writes insights with Claude (Sonnet, falling back to Haiku, then to template text).
- `template.js` renders the email, and `emailService.js` sends it through Resend.

### Firestore collections
`ynab_tokens`, `manual_accounts`, `user_holdings`, `csp_settings`, `income_scenarios`, `newsletter_settings`, `newsletter_snapshots`, `newsletter_logs`

## Configuration

- **Frontend** (`frontend/.env`, from `frontend/.env.example`): `VITE_API_BASE_URL` and the `VITE_FIREBASE_*` keys
- **API and newsletter** (Vercel project env vars; `vercel dev` loads the development set, and `vercel env pull .env.local` copies them to disk):
  - Firebase Admin credentials: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` and the related fields
  - YNAB OAuth: `YNAB_CLIENT_ID`, `YNAB_CLIENT_SECRET`, `YNAB_REDIRECT_URI` (locally `http://localhost:5173/auth/ynab/callback`)
  - Newsletter: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `NEWSLETTER_FROM_EMAIL`, `NEWSLETTER_RECIPIENTS`, `NEWSLETTER_TIMEZONE`, `FRONTEND_URL`, `CRON_SECRET`
- Never commit credentials. `.env` files and the service-account JSON are gitignored.
