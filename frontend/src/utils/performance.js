import { useRef, useEffect, useState } from 'react';

/**
 * Debounce hook for expensive operations
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Memoize expensive calculations with custom comparison
 */
export function useDeepMemo(factory, deps, compare) {
  const ref = useRef();
  
  if (!ref.current || !compare(ref.current.deps, deps)) {
    ref.current = {
      value: factory(),
      deps
    };
  }
  
  return ref.current.value;
}

/**
 * Deep comparison function for complex objects
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] === 'object' && typeof b[i] === 'object') {
      if (!deepEqual(Object.keys(a[i]), Object.keys(b[i]))) return false;
      for (let key in a[i]) {
        if (!deepEqual(a[i][key], b[i][key])) return false;
      }
    } else if (a[i] !== b[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Request idle callback polyfill
 */
export function requestIdleCallback(callback) {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback);
  }
  
  // Fallback to setTimeout
  return setTimeout(() => callback({ timeRemaining: () => 50 }), 1);
}

/**
 * Chunk array processing to avoid blocking UI
 */
export async function processInChunks(array, processFn, chunkSize = 100) {
  const results = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    const chunkResults = await new Promise(resolve => {
      requestIdleCallback(() => {
        resolve(chunk.map(processFn));
      });
    });
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * Create a worker pool for parallel processing
 */
export class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.workers = [];
    this.queue = [];
    this.poolSize = poolSize;
    
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript);
      worker.idle = true;
      worker.id = i;
      this.workers.push(worker);
    }
  }
  
  async process(data) {
    return new Promise((resolve, reject) => {
      const worker = this.workers.find(w => w.idle);
      
      if (worker) {
        this.runWorker(worker, data, resolve, reject);
      } else {
        this.queue.push({ data, resolve, reject });
      }
    });
  }
  
  runWorker(worker, data, resolve, reject) {
    worker.idle = false;
    
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.idle = true;
      
      if (this.queue.length > 0) {
        const { data, resolve, reject } = this.queue.shift();
        this.runWorker(worker, data, resolve, reject);
      }
    };
    
    worker.onerror = (error) => {
      reject(error);
      worker.idle = true;
    };
    
    worker.postMessage(data);
  }
  
  terminate() {
    this.workers.forEach(worker => worker.terminate());
  }
}
