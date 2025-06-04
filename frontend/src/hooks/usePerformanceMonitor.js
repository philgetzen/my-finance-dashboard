import { useEffect, useRef, useCallback } from 'react';

/**
 * Performance monitoring hook
 * Tracks render times, re-renders, and performance metrics
 */
export function usePerformanceMonitor(componentName) {
  const renderCount = useRef(0);
  const renderStartTime = useRef(null);
  const lastRenderDuration = useRef(null);

  // Track render start
  renderStartTime.current = performance.now();

  useEffect(() => {
    // Track render end and calculate duration
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;
    lastRenderDuration.current = renderDuration;
    renderCount.current += 1;

    // Log slow renders (> 16ms which is one frame at 60fps)
    if (renderDuration > 16) {
      console.warn(
        `[Performance] ${componentName} slow render:`,
        {
          duration: `${renderDuration.toFixed(2)}ms`,
          renderCount: renderCount.current,
          timestamp: new Date().toISOString()
        }
      );
    }

    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[Performance] ${componentName} rendered:`,
        {
          duration: `${renderDuration.toFixed(2)}ms`,
          renderCount: renderCount.current,
          timestamp: new Date().toISOString()
        }
      );
    }
  });

  // Measure function execution time
  const measureFunction = useCallback((fn, fnName) => {
    return (...args) => {
      const startTime = performance.now();
      const result = fn(...args);
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (duration > 10) {
        console.warn(
          `[Performance] ${componentName}.${fnName} slow execution:`,
          {
            duration: `${duration.toFixed(2)}ms`,
            timestamp: new Date().toISOString()
          }
        );
      }

      return result;
    };
  }, [componentName]);

  // Get performance report
  const getPerformanceReport = useCallback(() => {
    return {
      componentName,
      renderCount: renderCount.current,
      lastRenderDuration: lastRenderDuration.current,
      timestamp: new Date().toISOString()
    };
  }, [componentName]);

  return {
    measureFunction,
    getPerformanceReport,
    renderCount: renderCount.current,
    lastRenderDuration: lastRenderDuration.current
  };
}

/**
 * Memory usage monitor
 * Tracks memory usage and warns about potential leaks
 */
export function useMemoryMonitor(componentName, checkInterval = 5000) {
  const memoryCheckInterval = useRef(null);
  const initialMemory = useRef(null);

  useEffect(() => {
    if (!performance.memory) {
      console.debug('[Memory] Performance.memory API not available');
      return;
    }

    // Record initial memory
    initialMemory.current = performance.memory.usedJSHeapSize;

    // Start monitoring
    memoryCheckInterval.current = setInterval(() => {
      const currentMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = currentMemory - initialMemory.current;
      const increasePercentage = (memoryIncrease / initialMemory.current) * 100;

      // Warn if memory increased by more than 50%
      if (increasePercentage > 50) {
        console.warn(
          `[Memory] ${componentName} potential memory leak:`,
          {
            initial: `${(initialMemory.current / 1024 / 1024).toFixed(2)}MB`,
            current: `${(currentMemory / 1024 / 1024).toFixed(2)}MB`,
            increase: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${increasePercentage.toFixed(1)}%)`,
            timestamp: new Date().toISOString()
          }
        );
      }
    }, checkInterval);

    return () => {
      if (memoryCheckInterval.current) {
        clearInterval(memoryCheckInterval.current);
      }
    };
  }, [componentName, checkInterval]);
}

/**
 * FPS monitor
 * Tracks frames per second to detect janky animations
 */
export function useFPSMonitor(targetFPS = 60) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const fps = useRef(0);
  const animationId = useRef(null);

  useEffect(() => {
    const measureFPS = (currentTime) => {
      frameCount.current++;
      
      if (currentTime >= lastTime.current + 1000) {
        fps.current = Math.round(
          (frameCount.current * 1000) / (currentTime - lastTime.current)
        );
        
        // Warn if FPS drops below target
        if (fps.current < targetFPS * 0.8) {
          console.warn(
            '[FPS] Low frame rate detected:',
            {
              fps: fps.current,
              target: targetFPS,
              timestamp: new Date().toISOString()
            }
          );
        }
        
        frameCount.current = 0;
        lastTime.current = currentTime;
      }
      
      animationId.current = requestAnimationFrame(measureFPS);
    };
    
    animationId.current = requestAnimationFrame(measureFPS);
    
    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
    };
  }, [targetFPS]);
  
  return fps.current;
}

/**
 * Bundle size analyzer
 * Helps identify large dependencies
 */
export function analyzeBundleSize() {
  if (process.env.NODE_ENV === 'production') return;
  
  // This would typically integrate with webpack-bundle-analyzer
  // For now, we'll log module sizes if available
  if (window.__webpack_require__ && window.__webpack_require__.m) {
    const modules = window.__webpack_require__.m;
    const moduleSizes = [];
    
    Object.keys(modules).forEach(moduleId => {
      const moduleString = modules[moduleId].toString();
      const sizeInKB = (moduleString.length / 1024).toFixed(2);
      
      if (sizeInKB > 50) {
        moduleSizes.push({ moduleId, sizeInKB });
      }
    });
    
    if (moduleSizes.length > 0) {
      console.warn('[Bundle] Large modules detected:', moduleSizes);
    }
  }
}
