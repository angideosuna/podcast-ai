// Retry con backoff exponencial para llamadas a APIs externas

import { createLogger } from "@/lib/logger";

const log = createLogger("retry");

export interface RetryOptions {
  /** Número máximo de reintentos (sin contar el intento inicial) */
  maxRetries: number;
  /** Delay base en ms (se multiplica exponencialmente: base * 2^intento) */
  baseDelayMs: number;
  /** Delay máximo en ms (cap del backoff) */
  maxDelayMs: number;
  /** Función para decidir si un error es retryable. Por defecto: true para errores transitorios */
  isRetryable?: (error: unknown) => boolean;
  /** Etiqueta para logs */
  label?: string;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Determina si un error es transitorio y merece reintento.
 * Retorna true para: timeouts, errores de red, 429 (rate limit), 5xx (server errors).
 * Retorna false para: 4xx (excepto 429), errores de validación, API key inválida.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;

  const message = error.message.toLowerCase();

  // Timeout / abort
  if (error.name === "AbortError" || message.includes("timeout") || message.includes("timed out")) {
    return true;
  }

  // Network errors
  if (message.includes("fetch failed") || message.includes("network") || message.includes("econnreset") || message.includes("econnrefused")) {
    return true;
  }

  // Anthropic SDK / API errors con status code
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    // 429 = rate limit, 5xx = server error → retryable
    if (status === 429 || status >= 500) return true;
    // 400, 401, 403, 404 → not retryable
    if (status >= 400 && status < 500) return false;
  }

  // Anthropic SDK specific: check for overloaded error
  if (message.includes("overloaded") || message.includes("rate_limit")) {
    return true;
  }

  // API key errors → not retryable
  if (message.includes("api key") || message.includes("authentication") || message.includes("unauthorized")) {
    return false;
  }

  // Default: retry on unknown errors
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ejecuta una función con reintentos y backoff exponencial.
 *
 * @example
 * const result = await withRetry(
 *   () => client.messages.create({ ... }),
 *   { maxRetries: 3, baseDelayMs: 1000, label: "claude" }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const isRetryable = opts.isRetryable ?? isTransientError;
  const label = opts.label ?? "operation";

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Si es el último intento, lanzar directamente
      if (attempt === opts.maxRetries) {
        break;
      }

      // Si el error no es retryable, lanzar directamente
      if (!isRetryable(error)) {
        log.warn(`[${label}] Error no retryable en intento ${attempt + 1}, abortando`, error);
        break;
      }

      // Calcular delay con jitter para evitar thundering herd
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * opts.baseDelayMs * 0.5;
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelayMs);

      log.warn(
        `[${label}] Intento ${attempt + 1}/${opts.maxRetries + 1} falló, reintentando en ${Math.round(delay)}ms`,
        error instanceof Error ? error.message : error
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
