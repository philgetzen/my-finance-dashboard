# My Finance Dashboard

A personal finance tracking application built through pair programming with Claude. It runs as HealthyWealth.

## Overview

This dashboard helps track personal finances by syncing with YNAB (You Need A Budget) or manually adding accounts, providing visual insights into spending, investments, and financial trends.

The goal is to provide a level of insight that is often missing from YNAB, as their app is primarily focused on budgeting. Often YNAB is the one place we keep all of our accounts connected, so it's an obvious choice of connection with their existing API.

Many features are still in progress.

## Features

- **Dashboard**: net worth, income and spending for a chosen period compared with the same days of the prior period, and net worth over time
- **Accounts**: YNAB accounts alongside manually added ones
- **Cash Flow**: monthly income, spending and investing by category
- **Investments**: allocation across holdings, including an Altruist CSV import
- **Runway**: how many months your cash covers your spending, with income scenarios
- **Conscious Spending Plan**: spending sorted into Ramit Sethi's four buckets (fixed costs, investments, savings, guilt-free) with targets
- **Weekly newsletter**: a Saturday email with the week's numbers, trends and short insights written by Claude
- Demo mode with sample data, plus privacy and dark modes

The dashboard and the newsletter use the same rules for what counts as income, spending and investing (`shared/cashflow.mjs`), so their numbers agree.

## How It's Built

- **Frontend** (`frontend/`): React, Vite, Tailwind CSS and Recharts
- **API** (`api/`): Vercel serverless functions for YNAB OAuth and data, manual accounts and holdings, and the newsletter
- **Local backend** (`backend/`): an Express server that serves the same routes during development, plus the newsletter code
- **Data**: the YNAB API, with Firebase for Google sign-in and Firestore for tokens, manual accounts and settings
- **Hosting**: Vercel, which also runs the newsletter on a weekly cron

## Quick Start

### Prerequisites

- Node.js 22 or later
- A Firebase project with Google sign-in and Firestore enabled
- A YNAB account and a YNAB OAuth app (optional; demo mode works without one)

### Setup

1. **Backend** (from `backend/`):
   ```bash
   npm install
   npm start
   ```
   It runs on port 5001.

2. **Frontend** (from `frontend/`):
   ```bash
   npm install
   npm run dev
   ```

### Environment Variables

Copy `frontend/.env.example` to `frontend/.env` and fill in the `VITE_FIREBASE_*` keys from your Firebase project. Keep `VITE_API_BASE_URL=http://localhost:5001`; the frontend needs it set to reach the local backend.

Copy `backend/.env.example` to `backend/.env`. The backend needs Firebase Admin credentials, either as `FIREBASE_*` variables or a `backend/firebaseServiceAccount.json` file, plus `YNAB_CLIENT_ID`, `YNAB_CLIENT_SECRET` and `YNAB_REDIRECT_URI`. The newsletter also needs `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `NEWSLETTER_FROM_EMAIL` and `NEWSLETTER_RECIPIENTS`.

## Testing

Run `npm run lint` and `npm run test:run` in `frontend/`, and `npm test` in `backend/`. GitHub Actions runs all of them, plus a production build, on every pull request.

## Development

Built collaboratively through pair programming sessions, focusing on iterative improvements and clean, maintainable code.
