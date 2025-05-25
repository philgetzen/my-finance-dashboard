# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal finance dashboard application with a React frontend and Express.js backend that integrates with Plaid for banking data and Firebase for authentication and data storage.

**Architecture:**
- **Frontend**: React 19.1.0 with Vite, using Tailwind CSS for styling
- **Backend**: Express.js server with Plaid API integration
- **Authentication**: Firebase Auth with Google OAuth
- **Database**: Firestore for storing user tokens and manual accounts
- **External APIs**: Plaid for banking data, Recharts for data visualization

## Development Commands

### Frontend (from `frontend/` directory):
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Backend (from `backend/` directory):
- `node index.js` - Start backend server (runs on port 5001)

## Key Architecture Patterns

### Context and State Management
- **PlaidDataContext**: Central context that provides user authentication state and Plaid data (accounts, transactions)
- **usePlaidData hook**: Custom hook that handles all Plaid API calls and data fetching
- User state managed through Firebase Auth's `onAuthStateChanged`

### Data Flow
1. User authenticates via Google OAuth through Firebase Auth
2. Frontend obtains Plaid link token from backend
3. User connects bank accounts through Plaid Link
4. Backend exchanges public token for access token and stores in Firestore
5. Frontend fetches account/transaction data using stored access tokens

### Component Structure
- **App.jsx**: Main application with routing and all page components
- **PlaidDataContext**: Authentication and data provider
- **usePlaidData**: Custom hook for Plaid API integration
- Pages are defined as functions within App.jsx (DashboardPage, AccountsPage, etc.)

### API Endpoints (Backend)
- `POST /api/create_link_token` - Generate Plaid link token
- `POST /api/exchange_public_token` - Exchange public token for access token
- `POST /api/save_access_token` - Store access token in Firestore
- `GET /api/access_tokens` - Retrieve user's access tokens
- `POST /api/accounts` - Fetch account data from Plaid
- `POST /api/transactions` - Fetch transaction data from Plaid

### Data Storage
- **Firestore Collections**:
  - `user_tokens`: Stores Plaid access tokens per user
  - `manual_accounts`: User-created accounts not from Plaid

## Configuration Notes

- Backend expects environment variables: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`
- Firebase service account key should be in `backend/firebaseServiceAccount.json`
- Frontend connects to backend at `http://localhost:5001`
- Plaid environment defaults to 'sandbox'

## Common Development Patterns

When adding new features:
1. Check if user authentication is required (most features do)
2. Use the `usePlaid()` hook to access user state and data
3. Follow existing component patterns in App.jsx
4. Manual accounts are stored in Firestore, Plaid accounts come from API
5. Use the established card/layout styling patterns with Tailwind classes