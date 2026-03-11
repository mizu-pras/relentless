/**
 * 5-Layer Circuit Breaker for Relentless
 * Prevents runaway loops (OmO issue #2462 pattern)
 */

// Error type classification
export const ErrorType = {
  TOKEN_LIMIT: "token_limit",
  RATE_LIMIT: "rate_limit",
  NETWORK: "network",
  MODEL_REFUSED: "model_refused",
  ABORT: "abort",
  UNKNOWN: "unknown",
} as const;

export type ErrorTypeValue = (typeof ErrorType)[keyof typeof ErrorType];

interface ErrorLike {
  message?: string;
  name?: string;
  status?: number;
  code?: number;
}

export interface CircuitBreakerConfig {
  max_consecutive_failures?: number;
  max_injections_per_minute?: number;
  token_budget_threshold?: number;
}

export type RecordFailureResult =
  | { open: true; reason: string; errorType: ErrorTypeValue }
  | { open: false; retryable: boolean; delay: number; errorType: ErrorTypeValue };

export interface CircuitBreakerStatus {
  consecutive_failures: number;
  injections_last_minute: number;
  stalled: boolean;
}

/**
 * Layer 1: Classify an error by type.
 * Token limit errors are NEVER retried.
 */
export function classifyError(error: ErrorLike | Error | unknown): ErrorTypeValue {
  const errorObj = error as ErrorLike | Error | null | undefined;
  const msg = (errorObj?.message || "").toLowerCase();
  const code = (errorObj as ErrorLike)?.status || (errorObj as ErrorLike)?.code || 0;

  // Token limit - NEVER retry
  if (
    msg.includes("context_length_exceeded") ||
    msg.includes("prompt is too long") ||
    msg.includes("maximum context length") ||
    msg.includes("token limit") ||
    msg.includes("context window")
  ) {
    return ErrorType.TOKEN_LIMIT;
  }

  // Abort/cancel - NEVER retry
  if (
    errorObj?.name === "AbortError" ||
    msg.includes("aborted") ||
    msg.includes("cancelled")
  ) {
    return ErrorType.ABORT;
  }

  // Model refused - NEVER retry
  if (
    msg.includes("content policy") ||
    msg.includes("refused") ||
    code === 400
  ) {
    return ErrorType.MODEL_REFUSED;
  }

  // Rate limit - retry with backoff
  if (
    code === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    return ErrorType.RATE_LIMIT;
  }

  // Network/transient - retry with backoff
  if (code === 502 || code === 503 || code === 504 || msg.includes("network")) {
    return ErrorType.NETWORK;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Whether this error type should be retried.
 */
export function shouldRetry(errorType: ErrorTypeValue): boolean {
  return errorType === ErrorType.RATE_LIMIT || errorType === ErrorType.NETWORK;
}

/**
 * Get retry delay in ms for this error type and attempt number.
 */
export function retryDelay(errorType: ErrorTypeValue, attempt: number): number {
  if (errorType === ErrorType.RATE_LIMIT) {
    return [2000, 4000, 8000][attempt - 1] || 8000;
  }
  if (errorType === ErrorType.NETWORK) {
    return 2000;
  }
  return 0;
}

/**
 * Per-session circuit breaker state.
 */
export class CircuitBreaker {
  maxConsecutiveFailures: number;
  maxInjectionsPerMinute: number;
  tokenBudgetThreshold: number;
  consecutiveFailures: number;
  lastErrorType: ErrorTypeValue | null;
  injectionTimestamps: number[];
  stalled: boolean;

  constructor(config: CircuitBreakerConfig = {}) {
    this.maxConsecutiveFailures = config.max_consecutive_failures ?? 3;
    this.maxInjectionsPerMinute = config.max_injections_per_minute ?? 3;
    this.tokenBudgetThreshold = config.token_budget_threshold ?? 0.85;

    // Layer 2: consecutive failure tracking
    this.consecutiveFailures = 0;
    this.lastErrorType = null;

    // Layer 3: injection rate limiting
    this.injectionTimestamps = [];

    // Layer 5: dead session detection
    this.stalled = false;
  }

  /**
   * Layer 2: Record a failure. Returns true if circuit should open (stop).
   */
  recordFailure(error: ErrorLike | Error | unknown): RecordFailureResult {
    const errorType = classifyError(error);

    // Token limit and abort always stop immediately
    if (errorType === ErrorType.TOKEN_LIMIT || errorType === ErrorType.ABORT) {
      this.stalled = true;
      return { open: true, reason: `${errorType} error — stopping immediately`, errorType };
    }

    // Same error type twice in a row - stop immediately
    if (this.lastErrorType === errorType && errorType !== ErrorType.UNKNOWN) {
      this.stalled = true;
      return { open: true, reason: `Same error (${errorType}) twice in a row`, errorType };
    }

    this.lastErrorType = errorType;
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.stalled = true;
      return {
        open: true,
        reason: `${this.consecutiveFailures} consecutive failures`,
        errorType,
      };
    }

    return {
      open: false,
      retryable: shouldRetry(errorType),
      delay: retryDelay(errorType, this.consecutiveFailures),
      errorType,
    };
  }

  /**
   * Reset failure count on success.
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastErrorType = null;
  }

  /**
   * Layer 3: Check if injection is rate-limited.
   * Returns true if injection is allowed, false if rate limit exceeded.
   */
  canInject(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.injectionTimestamps = this.injectionTimestamps.filter((t) => t > oneMinuteAgo);

    if (this.injectionTimestamps.length >= this.maxInjectionsPerMinute) {
      this.stalled = true;
      return false;
    }

    this.injectionTimestamps.push(now);
    return true;
  }

  /**
   * Layer 4: Check token budget.
   * contextUsage is a fraction (0.0 to 1.0) of maxContext used.
   * Returns true if safe to proceed, false if budget exceeded.
   */
  checkTokenBudget(contextUsage: number | null | undefined): boolean {
    if (contextUsage === null || contextUsage === undefined) return true;
    return contextUsage < this.tokenBudgetThreshold;
  }

  /**
   * Layer 5: Mark session as stalled.
   */
  markStalled(): void {
    this.stalled = true;
  }

  /**
   * Get status for /status command.
   */
  getStatus(): CircuitBreakerStatus {
    return {
      consecutive_failures: this.consecutiveFailures,
      injections_last_minute: this.injectionTimestamps.filter(
        (t) => t > Date.now() - 60000
      ).length,
      stalled: this.stalled,
    };
  }
}
