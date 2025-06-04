# Performance Testing Guide

## Quick Performance Tests

### 1. Initial Load Performance
```bash
# Run Lighthouse audit
npm run build
npm run preview
# Open Chrome DevTools > Lighthouse > Generate report
```

### 2. Large Dataset Testing
```javascript
// Add to console in development mode
// This will generate 10k test transactions
const generateTestTransactions = (count) => {
  const transactions = [];
  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment'];
  const accounts = ['checking', 'savings', 'credit'];
  
  for (let i = 0; i < count; i++) {
    transactions.push({
      id: `test-${i}`,
      date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      amount: (Math.random() * 1000 - 500) * 100, // in cents
      category_name: categories[Math.floor(Math.random() * categories.length)],
      account_id: accounts[Math.floor(Math.random() * accounts.length)],
      payee_name: `Test Payee ${i}`,
      source: 'test'
    });
  }
  return transactions;
};

// Test with large dataset
window.testLargeDataset = () => {
  const testData = generateTestTransactions(10000);
  console.time('Processing 10k transactions');
  // Your transaction processing logic here
  console.timeEnd('Processing 10k transactions');
};
```

### 3. Memory Leak Detection
```javascript
// Add to App.jsx in development
if (process.env.NODE_ENV === 'development') {
  // Monitor memory usage
  setInterval(() => {
    if (performance.memory) {
      console.log('Memory usage:', {
        usedJSHeapSize: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        totalJSHeapSize: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        jsHeapSizeLimit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
      });
    }
  }, 10000);
}
```

### 4. Component Render Performance
```javascript
// Use React DevTools Profiler
// 1. Open React DevTools
// 2. Go to Profiler tab
// 3. Click record
// 4. Interact with the app
// 5. Stop recording
// 6. Analyze flame graph for slow components
```

### 5. Network Performance
```bash
# Test with slow 3G
# Chrome DevTools > Network > Throttling > Slow 3G
# Measure:
# - Time to first byte (TTFB)
# - First contentful paint (FCP)
# - Time to interactive (TTI)
```

## Performance Benchmarks

### Target Metrics
- **First Contentful Paint**: < 1.8s
- **Time to Interactive**: < 3.9s
- **Total Bundle Size**: < 500KB (gzipped)
- **Initial JS Load**: < 200KB
- **Memory Usage**: < 50MB for normal usage
- **Frame Rate**: Consistent 60fps during animations

### Testing Checklist
- [ ] Test on real mobile devices
- [ ] Test with 10k+ transactions
- [ ] Test with slow network (3G)
- [ ] Test with CPU throttling (4x slowdown)
- [ ] Monitor memory over 30 minutes of usage
- [ ] Check for memory leaks after navigation
- [ ] Verify lazy loading works correctly
- [ ] Test virtual scrolling with large tables

## Automated Performance Testing

### Setup Performance Budget
Create `frontend/performance-budget.json`:
```json
{
  "bundles": {
    "main": {
      "maxSize": "200KB"
    },
    "vendor": {
      "maxSize": "300KB"
    }
  },
  "metrics": {
    "firstContentfulPaint": 1800,
    "timeToInteractive": 3900,
    "totalBlockingTime": 300
  }
}
```

### Add to CI/CD Pipeline
```yaml
# Example GitHub Actions workflow
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v8
  with:
    configPath: './lighthouserc.json'
    uploadArtifacts: true
    temporaryPublicStorage: true
```

## Monitoring Production Performance

### 1. Use Web Vitals
```javascript
// Add to main.jsx
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const sendToAnalytics = (metric) => {
  // Send to your analytics service
  console.log(metric);
};

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### 2. Error Tracking
```javascript
// Add Sentry or similar
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

## Optimization Opportunities

1. **Images**: Use WebP format with fallbacks
2. **Fonts**: Use font-display: swap
3. **Code Splitting**: Split by route and heavy components
4. **Caching**: Implement service worker for offline support
5. **Compression**: Enable Brotli compression on server
