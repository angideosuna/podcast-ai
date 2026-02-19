// Logger centralizado para PodCast.ai
// En desarrollo muestra todo en consola, en producción se puede conectar a un servicio externo.

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",  // cyan
  info: "\x1b[32m",   // green
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
};
const RESET = "\x1b[0m";

function formatMessage(level: LogLevel, context: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level];
  const prefix = `${color}[${level.toUpperCase()}]${RESET} ${timestamp} [${context}]`;

  if (data !== undefined) {
    console[level === "debug" ? "log" : level](`${prefix} ${message}`, data);
  } else {
    console[level === "debug" ? "log" : level](`${prefix} ${message}`);
  }
}

/** Crea un logger con contexto (nombre del módulo/servicio) */
export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => {
      if (process.env.NODE_ENV === "development") {
        formatMessage("debug", context, message, data);
      }
    },
    info: (message: string, data?: unknown) => formatMessage("info", context, message, data),
    warn: (message: string, data?: unknown) => formatMessage("warn", context, message, data),
    error: (message: string, data?: unknown) => formatMessage("error", context, message, data),
  };
}
