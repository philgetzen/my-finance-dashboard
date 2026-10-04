# Product Requirements Document: Demo Mode Feature

## 1. Introduction/Overview

The Demo Mode feature will allow prospective users to experience the full functionality of the finance dashboard without requiring Google authentication or YNAB account connection. This addresses the barrier to entry for users who want to explore the application before committing to account creation and bank data integration.

**Problem Statement**: Current users must authenticate with Google and potentially connect YNAB accounts before they can evaluate whether the finance dashboard meets their needs, creating friction in user acquisition.

**Goal**: Provide a frictionless way for users to experience all dashboard features using realistic mock financial data, ultimately increasing user conversion rates.

## 2. Goals

1. **Reduce User Acquisition Friction**: Enable immediate access to dashboard functionality without authentication barriers
2. **Increase User Conversion**: Demonstrate value proposition through hands-on experience with realistic financial scenarios
3. **Showcase Full Feature Set**: Allow users to explore all dashboard capabilities (Dashboard, Accounts, Investment Allocation pages)
4. **Maintain User Intent**: Provide clear pathways for users to transition from demo to authenticated accounts

## 3. User Stories

**As a prospective user**, I want to try the finance dashboard without creating accounts, so that I can evaluate if it meets my financial tracking needs.

**As a prospective user**, I want to see realistic financial data in the demo, so that I can understand how the dashboard would work with my actual finances.

**As a prospective user**, I want to explore all features available in the app, so that I can make an informed decision about signing up.

**As a prospective user**, I want clear prompts to sign up when I'm ready, so that I can easily transition from demo to a real account.

**As a product owner**, I want demo users to experience the full value proposition, so that they are more likely to convert to paying customers.

## 4. Functional Requirements

### 4.1 Landing Page Enhancement
1. **Redesign authentication page** to display two distinct boxes:
   - Google Authentication box (primary login method)
   - YNAB Authentication box (initially disabled until Google auth completes)
2. **Add Demo Mode button** positioned below both authentication boxes
3. **Demo Mode button text**: "Don't have a YNAB account yet? Try out demo mode"

### 4.2 Mock Data Generation
4. **Create realistic financial profile** representing average American household:
   - Checking account: $2,800 balance
   - Savings account: $8,000 balance
   - Credit card: $7,321 balance (negative)
   - Car loan: $25,000 balance (negative)
   - Mortgage: $252,505 balance (negative)
   - Investment account: $45,000 balance
5. **Generate 3 months of transaction history** with realistic spending patterns:
   - Recurring bills (utilities, insurance, subscriptions)
   - Grocery and dining transactions
   - Gas and transportation expenses
   - Entertainment and miscellaneous purchases
   - Salary deposits and income

### 4.3 Demo Mode Functionality
6. **Enable full dashboard navigation**: Users can access all pages (Dashboard, Accounts, Investment Allocation)
7. **Display all analytics and charts** using mock data
8. **Allow filter and date range interactions** on mock transaction data
9. **Show detailed transaction views** with realistic merchant names and categories
10. **Display manual account creation interface** but disable the actual creation functionality
11. **Show placeholder text** indicating "Feature disabled in demo mode" for editing capabilities

### 4.4 Demo Mode Limitations
12. **Disable account creation**: Manual account creation forms are visible but non-functional
13. **Disable data editing**: No transactions, accounts, or settings can be modified
14. **Disable YNAB connection**: YNAB authentication is not available in demo mode
15. **Session-based only**: Demo data resets when browser session ends

### 4.5 Conversion Features
16. **Add bottom banner** with "Sign Up Now" call-to-action anchored to bottom of all demo pages
17. **Banner design**: Non-intrusive but visible, with clear messaging about getting started with real data
18. **Exit demo functionality**: Allow users to return to authentication page from any demo page

## 5. Non-Goals (Out of Scope)

- **Data persistence**: Demo data will not be saved or transferred to real accounts
- **Limited demo**: Demo will include full feature set, not a reduced subset
- **Demo user accounts**: No separate demo user management system
- **Mobile optimization**: Focus on desktop experience initially
- **Demo data customization**: Users cannot modify the demo financial profile

## 6. Design Considerations

### 6.1 Landing Page Design
- **Visual hierarchy**: Authentication boxes should be prominent with demo option clearly secondary
- **Accessibility**: Ensure color contrast and keyboard navigation support
- **Responsive layout**: Maintain usability across desktop screen sizes

### 6.2 Demo Mode Indicators
- **Clear visual indicators**: Subtle but noticeable elements indicating demo mode is active
- **Consistent messaging**: All disabled features show consistent "Demo mode" explanations
- **Brand consistency**: Maintain existing UI/UX patterns and styling

### 6.3 Conversion Banner
- **Non-intrusive design**: Banner should not interfere with demo experience
- **Clear value proposition**: Emphasize benefits of creating real account
- **Easy dismissal**: Allow users to hide banner temporarily if desired

## 7. Technical Considerations

### 7.1 Architecture
- **Bypass authentication**: Create demo mode that skips Google/YNAB auth flows
- **Mock data service**: Generate consistent realistic data on demo mode initialization
- **Context management**: Extend existing ConsolidatedDataContext to handle demo state
- **Route protection**: Ensure demo routes are properly isolated from authenticated routes

### 7.2 Data Management
- **Static mock data**: Use predefined dataset for consistency and performance
- **Memory-based storage**: Demo data exists only in browser session
- **No backend integration**: Demo mode should not make API calls to YNAB or Firebase

### 7.3 State Management
- **Demo state flag**: Global state to track when user is in demo mode
- **Feature flagging**: Conditional rendering based on demo state for disabled features
- **Session cleanup**: Ensure demo state is cleared when user exits or signs up

## 8. Success Metrics

### 8.1 Engagement Metrics
- **Demo adoption rate**: Percentage of landing page visitors who enter demo mode
- **Demo session duration**: Average time spent exploring demo features
- **Page coverage**: Percentage of demo users who visit multiple dashboard pages
- **Feature interaction**: Number of filters, date ranges, and navigation actions in demo

### 8.2 Conversion Metrics
- **Demo-to-signup conversion**: Percentage of demo users who create accounts
- **Conversion timing**: Time from demo start to account creation
- **Banner effectiveness**: Click-through rate on "Sign Up Now" banner
- **Drop-off points**: Identify where demo users exit without converting

### 8.3 Success Targets
- **Target demo adoption**: 25% of landing page visitors try demo mode
- **Target conversion rate**: 15% of demo users create authenticated accounts
- **Target session duration**: Average 5+ minutes exploring demo features

## 9. Open Questions

1. **Demo data refresh**: Should demo data change periodically to show different financial scenarios?
2. **Analytics integration**: How should demo mode interactions be tracked without user identification?
3. **Marketing integration**: Should demo mode integrate with email capture for follow-up marketing?
4. **Error handling**: How should the app handle errors in demo mode (e.g., API timeouts)?
5. **Accessibility compliance**: Are there specific accessibility requirements for the demo experience?
6. **Browser compatibility**: Are there minimum browser requirements for demo mode functionality?
7. **Performance optimization**: Should demo mode be optimized differently than authenticated mode?

## 10. Implementation Priority

### Phase 1 (MVP)
- Landing page redesign with demo option
- Basic demo mode with static mock data
- Core navigation and data display
- Simple conversion banner

### Phase 2 (Enhanced)
- Detailed transaction interactions
- Advanced filtering and date range functionality
- Improved mock data realism
- Enhanced conversion tracking

### Phase 3 (Optimization)
- A/B testing for demo experience
- Advanced analytics and user behavior tracking
- Mobile responsiveness improvements
- Performance optimizations