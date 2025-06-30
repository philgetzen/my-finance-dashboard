# My Finance Dashboard

A personal finance tracking application built through pair programming with Claude.

## Overview

This dashboard helps track personal finances by syncing with YNAB (You Need A Budget) or manually adding accounts, providing visual insights into spending, investments, and financial trends.

The goal is to provide a level of insight that is often missing from YNAB, as their app is primarily focused on budgeting. Often YNAB is the one place we keep all of our accounts connected, so it's an obvious choice of connection with their existing API.

Many features are still in progress.

## Quick Start

### Prerequisites
- Node.js
- Firebase account
- YNAB account (optional)

### Setup

1. **Backend** (from `backend/` directory):
   ```bash
   npm install
   node index.js
   ```

2. **Frontend** (from `frontend/` directory):
   ```bash
   npm install
   npm run dev
   ```

### Environment Variables

Backend requires Firebase configuration. YNAB integration is handled through the frontend.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express.js
- **Data**: YNAB API + Firebase (Auth & Firestore)
- **Charts**: Recharts

## Features

- 🔐 Google OAuth authentication
- 💰 YNAB account synchronization
- 📊 Visual spending analytics
- 💼 Investment tracking
- 📈 Budget management
- ✏️ Manual account creation and management

## Development

Built collaboratively through pair programming sessions, focusing on iterative improvements and clean, maintainable code.