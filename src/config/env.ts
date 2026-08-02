import { z } from 'zod';

/**
 * Validated client environment. Only EXPO_PUBLIC_* variables are available
 * in the bundle; secrets (AI keys, service role) live exclusively in Edge
 * Function configuration and must never appear here.
 */
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'EXPO_PUBLIC_SUPABASE_URL must be a valid URL (see .env.example)',
  }),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'EXPO_PUBLIC_SUPABASE_ANON_KEY looks too short — copy it from your Supabase project'),
  EXPO_PUBLIC_DEV_TOOLS: z.enum(['true', 'false']).default('false'),
  EXPO_PUBLIC_DEV_MOCK_AI: z.enum(['true', 'false']).default('false'),
});

function loadEnv() {
  const parsed = envSchema.safeParse({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_DEV_TOOLS: process.env.EXPO_PUBLIC_DEV_TOOLS,
    EXPO_PUBLIC_DEV_MOCK_AI: process.env.EXPO_PUBLIC_DEV_MOCK_AI,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `Environment configuration is invalid or missing:\n${issues}\n\nCopy .env.example to .env and fill in your Supabase project values.`,
    );
  }
  return {
    supabaseUrl: parsed.data.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    devToolsEnabled: parsed.data.EXPO_PUBLIC_DEV_TOOLS === 'true',
    devMockAi: parsed.data.EXPO_PUBLIC_DEV_MOCK_AI === 'true',
  };
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
