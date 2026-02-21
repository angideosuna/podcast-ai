// Logger centralizado para PodCast.ai
// - Desarrollo: consola con colores para lectura rápida
// - Producción: JSON estructurado compatible con Vercel Logs, Datadog, etc.

type LogLevel = "debug" | "info" | "warn" | "error";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ── Desarrollo: formato legible con colores ─────────────────────────────────

const LOG_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",  // cyan
  info: "\x1b[32m",   // green
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
};
const RESET = "\x1b[0m";

function formatDev(level: LogLevel, context: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level];
  const prefix = `${color}[${level.toUpperCase()}]${RESET} ${timestamp} [${context}]`;
  const formatted = `${prefix} ${message}`;

  // Route to the correct console method (error → stderr, warn → stderr, rest → stdout)
  if (level === "error") {
    data !== undefined ? console.error(formatted, data) : console.error(formatted);
  } else if (level === "warn") {
    data !== undefined ? console.warn(formatted, data) : console.warn(formatted);
  } else {
    data !== undefined ? console.log(formatted, data) : console.log(formatted);
  }
}

// ── Producción: JSON estructurado ───────────────────────────────────────────

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      ...(err.stack ? { stack: err.stack } : {}),
    };
  }
  if (typeof err === "string") return { message: err };
  return { value: err };
}

function formatJson(level: LogLevel, context: string, message: string, data?: unknown): void {
  const entry: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    context,
    message,
  };

  if (data !== undefined) {
    entry.data = data instanceof Error ? serializeError(data) : data;
  }

  // Vercel y la mayoría de servicios de logging parsean JSON de stdout/stderr
  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

const emit = IS_PRODUCTION ? formatJson : formatDev;

// ── API pública ─────────────────────────────────────────────────────────────

export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

/** Crea un logger con contexto (nombre del módulo/servicio) */
export function createLogger(context: string): Logger {
  return {
    debug: (message: string, data?: unknown) => {
      if (!IS_PRODUCTION) {
        emit("debug", context, message, data);
      }
    },
    info: (message: string, data?: unknown) => emit("info", context, message, data),
    warn: (message: string, data?: unknown) => emit("warn", context, message, data),
    error: (message: string, data?: unknown) => emit("error", context, message, data),
  };
}
