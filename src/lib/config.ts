// Environment configuration management
export interface AppConfig {
  // Database
  database: {
    url: string;
    mongodbUrl: string;
  };

  // Authentication
  auth: {
    nextAuthUrl: string;
    nextAuthSecret: string;
  };

  // Application
  app: {
    nodeEnv: string;
    logLevel: string;
    port: number;
  };

  // API Keys (optional)
  apiKeys?: {
    openai?: string;
    anthropic?: string;
  };

  // Email (optional)
  email?: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  };

  // Monitoring (optional)
  monitoring?: {
    sentryDsn?: string;
    analyticsId?: string;
  };

  // Security
  security: {
    encryptionKey?: string;
  };
}

// Configuration validation
function validateConfig(): void {
  const required = [
    'DATABASE_URL',
    'MONGODB_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Load configuration from environment
export function loadConfig(): AppConfig {
  validateConfig();

  return {
    database: {
      url: process.env.DATABASE_URL!,
      mongodbUrl: process.env.MONGODB_URL!,
    },
    auth: {
      nextAuthUrl: process.env.NEXTAUTH_URL!,
      nextAuthSecret: process.env.NEXTAUTH_SECRET!,
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      port: parseInt(process.env.PORT || '3000', 10),
    },
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    },
    email: process.env.SMTP_HOST ? {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
      smtpUser: process.env.SMTP_USER!,
      smtpPass: process.env.SMTP_PASS!,
    } : undefined,
    monitoring: {
      sentryDsn: process.env.SENTRY_DSN,
      analyticsId: process.env.ANALYTICS_ID,
    },
    security: {
      encryptionKey: process.env.ENCRYPTION_KEY,
    },
  };
}

// Global config instance
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// Environment-specific helpers
export const isDevelopment = () => getConfig().app.nodeEnv === 'development';
export const isProduction = () => getConfig().app.nodeEnv === 'production';
export const isTest = () => getConfig().app.nodeEnv === 'test';