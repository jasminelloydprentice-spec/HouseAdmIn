/** Shared HTTP helpers for Edge Functions: CORS + safe error responses. */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Client-facing errors are deliberately generic; detail goes to server logs
 * only (and never includes document content).
 */
export function errorResponse(publicMessage: string, status: number, logDetail?: string): Response {
  if (logDetail) console.error(`[${status}] ${publicMessage}: ${logDetail}`);
  return jsonResponse({ error: publicMessage }, status);
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return null;
}
