import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// Development pretty printing
if (process.env.NODE_ENV === 'development') {
  logger.info('Logger initialized in development mode');
}

// Helper functions for structured logging
export const logInfo = (message: string, data?: any) => {
  if (data) {
    logger.info(data, message);
  } else {
    logger.info(message);
  }
};

export const logError = (message: string, error?: any, data?: any) => {
  const logData = { ...data };
  if (error) {
    logData.error = error instanceof Error ? error.message : error;
  }
  logger.error(logData, message);
};

export const logWarn = (message: string, data?: any) => {
  if (data) {
    logger.warn(data, message);
  } else {
    logger.warn(message);
  }
};

export { logger };
export default logger;