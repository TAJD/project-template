export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Declares which rate-limiter bindings exist in wrangler.toml. Referencing a
 * binding name not declared here is a TypeScript compile error.
 */
export interface RateLimitBindings {
  AUTH_RATE_LIMITER: RateLimiterBinding;
}
