# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HealthyWealth is a personal finance dashboard built on YNAB. It reads accounts, transactions and categories from the YNAB API, adds manual accounts and holdings, and shows net worth, cash flow, runway, investments and a Conscious Spending Plan (CSP). A weekly email newsletter summarizes the same numbers.

- **Frontend** (`frontend/`): React 19, Vite 6, Tailwind CSS 3, Recharts, TanStack Query, React Router 7
- **API in production** (`api/`): Vercel serverless functions
- **API for local development** (`backend/`): an Express server on port 5001 serving the same routes, plus the newsletter code
- **Shared rules** (`shared/`): the cash-flow classifier both the dashboard and the newsletter use
- **Auth and storage**: Firebase Auth (Google sign-in) and Firestore
- **Deploy**: Vercel (`vercel.json`), at healthywealth.philgetzen.com

## Commands

Frontend (from `frontend/`):
- `npm run dev`: start the Vite dev server
- `npm run build`: production build
- `npm run lint`: ESLint (CI fails on errors; warnings are allowed)
- `npm run test:run`: Vitest, single run (`npm test` watches)

Backend (from `backend/`):
- `npm start`: start the Express server on port 5001 (`npm run dev` uses nodemon)
- `npm test`: Node's built-in test runner over `newsletter/` and `services/`

CI (`.github/workflows/tests.yml`) runs backend tests, then frontend lint, tests and build, on every PR and on pushes to main.

## Architecture

### Cash-flow rules
- `shared/cashflow.mjs` decides what counts as income, spending, investing and saving. The dashboard (`frontend/src/utils/calculations/cashflow.js`) and the newsletter (`backend/newsletter/cashflow.js`) both re-export it, so change the rules there, not in either app.
- It is a plain ES module with no imports. Vite bundles it for the dashboard. The backend loads it with `import()`, because Vercel's function runtime can't `require()` an ES module, so newsletter code must `await loadSharedRules()` (from `backend/newsletter/cashflow.js`) before building a ledger. The backend CI job runs with `--no-experimental-require-module` to catch a stray `require()`.
- YNAB dates are calendar dates. Parse them with `parseLocalDate()` (frontend) or keep them as `'YYYY-MM-DD'` strings (backend). `new Date('2026-08-01')` is July 31 in US time zones.

### Frontend
- `src/App.jsx` holds the routes. Pages are in `src/components/pages/`: Dashboard (`/`), Accounts, CashFlow (`/spending`), InvestmentAllocation (`/investments`), Runway, ConsciousSpendingPlan (`/conscious-spending`).
- `src/contexts/ConsolidatedDataContext.jsx` is the single data provider. Components read it through `useFinanceData()` and `usePrivacy()`. It also handles demo mode, which uses `src/lib/mockData.js`.
- API calls use `VITE_API_BASE_URL`: empty in production (same origin), `http://localhost:5001` locally. It must be set: `src/lib/ynabApi.js` falls back to localhost, but the direct `fetch` calls in `ConsolidatedDataContext.jsx`, `AuthenticationPage.jsx` and `YNABConnectionCard.jsx` don't. `ynabApi.js` also refreshes the YNAB token on a 401.
- Page math lives in hooks (`src/hooks/`: `useTransactionProcessor`, `useCategoryProcessor`, `useConsciousSpendingPlan`, `useRunwayCalculator`, `useIncomeScenario`) and in `src/utils/calculations/`.
- Use the existing card and layout patterns and Tailwind classes. Use `import.meta.env.DEV` / `PROD`, not `process.env`.

### API routes
Most routes exist twice: as a Vercel function in `api/` (production) and as an Express handler in `backend/index.js` (local development). When you change one, change the other. Where they differ:
- Only `api/` has `manual_holdings`.
- Only Express has the per-resource paths (`/api/ynab/budgets/:budgetId/accounts` and so on), `/api/debug/env` and `/api/debug/auth-url`.
- Express exposes the newsletter as `/api/newsletter/send`, `/preview`, `/preview-prompt`, `/logs`, `/status` and `/config`, with no auth check. The debug routes return the YNAB client ID and redirect URI. Treat the Express server as local-only.

The production routes in `api/`:
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
- **API and backend** (Vercel env vars, or `backend/.env` from `backend/.env.example` locally):
  - Firebase Admin credentials: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` and the related fields. The local backend can use `backend/firebaseServiceAccount.json` instead.
  - YNAB OAuth: `YNAB_CLIENT_ID`, `YNAB_CLIENT_SECRET`, `YNAB_REDIRECT_URI`
  - Newsletter: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `NEWSLETTER_FROM_EMAIL`, `NEWSLETTER_RECIPIENTS`, `NEWSLETTER_TIMEZONE`, `FRONTEND_URL`, `CRON_SECRET`
- Never commit credentials. `.env` files and the service-account JSON are gitignored.
