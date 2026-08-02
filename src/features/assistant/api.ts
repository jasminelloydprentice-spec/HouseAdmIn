import { supabase } from '../../lib/supabase';
import { AssistantAnswer } from './citations';

export class AssistantError extends Error {}

/** Ask a question; the Edge Function grounds the answer in household documents only. */
export async function askQuestion(question: string, conversationId: string | null): Promise<AssistantAnswer> {
  const { data, error } = await supabase.functions.invoke('ask-assistant', {
    body: { question, conversationId },
  });
  if (error) {
    // supabase-js surfaces non-2xx as FunctionsHttpError with a Response.
    let message = 'The assistant is unavailable right now. Please try again.';
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // keep generic message
      }
    }
    throw new AssistantError(message);
  }
  return data as AssistantAnswer;
}
