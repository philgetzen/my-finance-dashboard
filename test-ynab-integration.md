# YNAB Integration Test Plan

## Test Environment
- Frontend: http://localhost:5175
- Backend: http://localhost:5001

## Test Cases

### 1. Backend Health Check
- [x] Backend server running and responsive
- [x] YNAB environment variables configured
- [x] CORS allowing frontend port 5175
- [x] YNAB auth URL generation working

### 2. Demo Mode Test
- [ ] Demo mode can be activated from login page
- [ ] Demo mode shows mock data
- [ ] YNAB connection disabled in demo mode
- [ ] Exit demo mode returns to login page
- [ ] No interference with real auth state

### 3. Google Authentication Test
- [ ] Google login works correctly
- [ ] User state persists after login
- [ ] Navigation works after authentication
- [ ] Logout functionality works

### 4. YNAB OAuth Flow Test
- [ ] YNAB auth URL generates correctly
- [ ] OAuth popup opens with correct redirect URI
- [ ] Callback page handles authorization code
- [ ] Token exchange with backend succeeds
- [ ] YNAB data fetching works after connection
- [ ] YNAB disconnect functionality works

### 5. State Isolation Test
- [ ] Demo mode doesn't affect real user data
- [ ] Real authentication doesn't trigger demo mode
- [ ] Context switches correctly between modes
- [ ] Manual accounts work in both modes

## Backend API Endpoints Status
✅ GET / - Health check
✅ GET /api/debug/env - Environment verification
✅ GET /api/debug/auth-url - YNAB URL generation
✅ GET /api/ynab/auth - OAuth URL endpoint
✅ POST /api/ynab/token - Token exchange
✅ GET /api/ynab/token - Token retrieval
✅ POST /api/ynab/save_token - Token storage
✅ DELETE /api/ynab/disconnect - YNAB disconnect
✅ GET /api/manual_accounts - Manual accounts

## Configuration Verified
✅ YNAB_CLIENT_ID: Set
✅ YNAB_CLIENT_SECRET: Set  
✅ YNAB_REDIRECT_URI: http://localhost:5175/auth/ynab/callback
✅ CORS: Allows localhost:5175
✅ Frontend API URL: http://localhost:5001

## Issues Fixed
✅ Demo mode functions no longer block real YNAB operations
✅ exitDemoMode() doesn't clear real user state
✅ Sidebar context updated to ConsolidatedDataContext
✅ Port mismatch between frontend (5175) and redirect URI (5173) fixed
✅ CORS configuration updated for correct port

## Next Steps for Manual Testing
1. Open browser to http://localhost:5175
2. Test demo mode flow
3. Test Google authentication
4. Test YNAB OAuth connection
5. Verify data isolation between modes