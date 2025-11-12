// Environment variable validation utilities
export class EnvValidationError extends Error {
  constructor(message: string, public missingVars: string[]) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

export function validateRequiredEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new EnvValidationError(
      `Missing required environment variables: ${missing.join(', ')}`,
      missing
    );
  }
}

export function validateOptionalEnvVars(vars: Record<string, [string, ((value: string) => boolean) | undefined]>): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};

  for (const [key, [defaultValue, validator]] of Object.entries(vars)) {
    const value = process.env[key] || defaultValue;

    if (validator && typeof validator === 'function') {
      if (!validator(value)) {
        throw new Error(`Invalid value for ${key}: ${value}`);
      }
    }

    result[key] = value;
  }

  return result;
}

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new EnvValidationError(`Missing required environment variable: ${key}`, [key]);
  }
  return value || defaultValue!;
}

export function getEnvVarAsNumber(key: string, defaultValue?: number): number {
  const value = getEnvVar(key, defaultValue?.toString());
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${key}: ${value}`);
  }
  return parsed;
}

export function getEnvVarAsBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = getEnvVar(key, defaultValue.toString()).toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

// Common validators
export const validators = {
  url: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  port: (value: string) => {
    const port = parseInt(value, 10);
    return port > 0 && port <= 65535;
  },
};