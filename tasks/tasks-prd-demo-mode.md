# Demo Mode Implementation Tasks

## Relevant Files

- `frontend/src/components/auth/LoginCard.jsx` - Redesigned as reusable component that fits within auth box containers
- `frontend/src/components/auth/AuthenticationPage.jsx` - New landing page with dual auth boxes and demo mode button
- `frontend/src/components/auth/YNABAuthCard.jsx` - New YNAB auth component for authentication page (initially disabled state) with accessibility features
- `frontend/src/components/auth/LoginCard.jsx` - Enhanced with accessibility features (ARIA labels, keyboard navigation)
- `frontend/src/components/auth/AuthenticationPage.jsx` - Enhanced with semantic HTML, accessibility features, and fixed authentication flow
- `frontend/src/App.jsx` - Updated authentication routing to prevent auto-redirect after Google auth
- `frontend/src/contexts/ConsolidatedDataContext.jsx` - Main context that needs demo mode state management
- `frontend/src/lib/mockData.js` - Realistic mock financial data representing average American household finances
- `frontend/src/lib/demoUtils.js` - New file for demo mode utility functions
- `frontend/src/components/ui/DemoModeBanner.jsx` - New component for conversion banner
- `frontend/src/components/ui/DemoModeIndicator.jsx` - New component to show demo mode status
- `frontend/src/hooks/useDemoMode.js` - Custom hook for demo mode functionality
- `frontend/src/App.jsx` - Main app routing, updated to use AuthenticationPage, needs demo routes and state integration
- `frontend/src/components/pages/Dashboard.jsx` - Needs demo mode feature flagging
- `frontend/src/components/pages/Accounts.jsx` - Needs demo mode feature flagging
- `frontend/src/components/pages/InvestmentAllocation.jsx` - Needs demo mode feature flagging

### Notes

- Unit tests should be created alongside new components and utilities
- Use existing styling patterns and Tailwind classes for consistency
- Demo mode should integrate with existing ConsolidatedDataContext patterns
- No backend changes required - demo mode is frontend-only

## Tasks

- [x] 1.0 Redesign Landing Page with Authentication Options
  - [x] 1.1 Create new AuthenticationPage component with dual auth box layout
  - [x] 1.2 Redesign LoginCard component to fit within auth box container
  - [x] 1.3 Create YNAB Auth box component (initially disabled state)
  - [x] 1.4 Add Demo Mode button below auth boxes with proper styling
  - [x] 1.5 Implement responsive design for desktop screen sizes
  - [x] 1.6 Add accessibility features (keyboard navigation, ARIA labels)

- [ ] 2.0 Create Mock Data System and Demo State Management
  - [x] 2.1 Create mockData.js with realistic American household financial profile
  - [x] 2.2 Generate 3 months of realistic transaction history with varied merchants and categories
  - [ ] 2.3 Create account data (checking, savings, credit, loans, mortgage, investments)
  - [ ] 2.4 Implement demo state management in ConsolidatedDataContext
  - [ ] 2.5 Create useDemoMode custom hook for demo functionality
  - [ ] 2.6 Add demo mode initialization and cleanup functions

- [ ] 3.0 Implement Demo Mode Context and Navigation
  - [ ] 3.1 Extend ConsolidatedDataContext to handle demo mode state
  - [ ] 3.2 Create demo mode routes that bypass authentication
  - [ ] 3.3 Implement demo data providers for all dashboard pages
  - [ ] 3.4 Add demo mode detection and routing logic in App.jsx
  - [ ] 3.5 Ensure all chart components work with mock data
  - [ ] 3.6 Add demo mode visual indicators throughout the application

- [ ] 4.0 Add Demo Mode Limitations and Feature Flagging
  - [ ] 4.1 Create DemoModeIndicator component for subtle UI indicators
  - [ ] 4.2 Add feature flagging for editing capabilities (disable in demo)
  - [ ] 4.3 Implement "Feature disabled in demo mode" messages
  - [ ] 4.4 Disable manual account creation forms in demo mode
  - [ ] 4.5 Disable YNAB connection functionality in demo mode
  - [ ] 4.6 Add demo session cleanup on browser close/navigation away

- [ ] 5.0 Build Conversion Banner and Exit Demo Functionality
  - [ ] 5.1 Create DemoModeBanner component with "Sign Up Now" CTA
  - [ ] 5.2 Implement banner positioning (anchored to bottom, non-intrusive)
  - [ ] 5.3 Add banner dismiss functionality for temporary hiding
  - [ ] 5.4 Create exit demo functionality to return to authentication page
  - [ ] 5.5 Add conversion tracking hooks for analytics integration
  - [ ] 5.6 Implement clear value proposition messaging in banner