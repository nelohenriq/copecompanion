// Basic performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(label: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordMetric(label, duration);
      return duration;
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(value);

    // Keep only last 100 measurements
    const measurements = this.metrics.get(label)!;
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  getMetrics(label: string): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.metrics.get(label);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sum = measurements.reduce((a, b) => a + b, 0);
    return {
      avg: sum / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      count: measurements.length,
    };
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const [label, measurements] of this.metrics.entries()) {
      if (measurements.length > 0) {
        const sum = measurements.reduce((a, b) => a + b, 0);
        result[label] = {
          avg: sum / measurements.length,
          min: Math.min(...measurements),
          max: Math.max(...measurements),
          count: measurements.length,
        };
      }
    }

    return result;
  }
}

// Error tracking utility
export class ErrorTracker {
  private static instance: ErrorTracker;
  private errors: Array<{ error: Error; context: any; timestamp: Date }> = [];

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  trackError(error: Error, context?: any): void {
    this.errors.push({
      error,
      context,
      timestamp: new Date(),
    });

    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors.shift();
    }
  }

  getRecentErrors(count: number = 10): Array<{ error: Error; context: any; timestamp: Date }> {
    return this.errors.slice(-count);
  }

  getErrorCount(): number {
    return this.errors.length;
  }
}

// Global error handler
export function setupGlobalErrorHandling(): void {
  if (typeof window !== 'undefined') {
    // Client-side error handling
    window.addEventListener('error', (event) => {
      ErrorTracker.getInstance().trackError(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      ErrorTracker.getInstance().trackError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { type: 'unhandledrejection' }
      );
    });
  }
}