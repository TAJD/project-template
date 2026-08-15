function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function badRequest(msg: string): Response {
  return jsonError(msg, 400);
}

export function unauthorized(): Response {
  return jsonError('Unauthorized', 401);
}

export function notFound(): Response {
  return jsonError('Not found', 404);
}

export function serverError(err: unknown): Response {
  const message = err instanceof Error ? err.message : 'Internal server error';
  return jsonError(message, 500);
}
