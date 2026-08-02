import { validateAnalysis } from './analysisSchema.ts';
import {
  AnalyseDocumentInput,
  AnalysisProviderError,
  DocumentAnalysisProvider,
  DocumentAnalysisResult,
} from './provider.ts';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL, extractionUserInstruction, repairInstruction } from './prompts.ts';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 16000;

interface ClaudeContentBlock {
  type: string;
  [key: string]: unknown;
}

interface ClaudeResponse {
  content: { type: string; name?: string; input?: unknown }[];
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

/**
 * Claude implementation of the analysis provider. Sends page images / the
 * PDF as content blocks (Claude's vision handles OCR + structuring in one
 * pass) and forces a record_extraction tool call for strict JSON output.
 * Output is validated against the Zod schema; one repair round-trip is
 * attempted before giving up.
 */
export class ClaudeProvider implements DocumentAnalysisProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async analyseDocument(input: AnalyseDocumentInput): Promise<DocumentAnalysisResult> {
    const documentBlocks: ClaudeContentBlock[] = input.files.map((file) =>
      file.mimeType === 'application/pdf'
        ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
          }
        : {
            type: 'image',
            source: { type: 'base64', media_type: file.mimeType, data: file.base64 },
          },
    );

    const baseMessages = [
      {
        role: 'user',
        content: [...documentBlocks, { type: 'text', text: extractionUserInstruction(input.todayIso) }],
      },
    ];

    const first = await this.call(baseMessages);
    const firstValidation = validateAnalysis(first.toolInput);
    if (firstValidation.ok) {
      return { analysis: firstValidation.analysis, usage: first.usage };
    }

    // One repair attempt: feed back the validation errors. The repair turn
    // resends the document so the model can re-check rather than invent.
    const repairMessages = [
      ...baseMessages,
      { role: 'assistant', content: first.rawAssistantContent },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: first.toolUseId,
            content: repairInstruction(firstValidation.errors),
            is_error: true,
          },
        ],
      },
    ];
    const second = await this.call(repairMessages);
    const secondValidation = validateAnalysis(second.toolInput);
    if (secondValidation.ok) {
      return {
        analysis: secondValidation.analysis,
        usage: {
          model: second.usage.model,
          inputTokens: first.usage.inputTokens + second.usage.inputTokens,
          outputTokens: first.usage.outputTokens + second.usage.outputTokens,
        },
      };
    }
    throw new AnalysisProviderError(
      `Analysis output failed validation after repair: ${secondValidation.errors.slice(0, 5).join('; ')}`,
      false,
    );
  }

  private async call(messages: unknown[]): Promise<{
    toolInput: unknown;
    toolUseId: string;
    rawAssistantContent: unknown;
    usage: { inputTokens: number; outputTokens: number; model: string };
  }> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: EXTRACTION_TOOL.name },
      }),
    });

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500 || res.status === 529;
      // Do not include response body in the thrown message (may echo content).
      throw new AnalysisProviderError(`Claude API error (HTTP ${res.status})`, retryable);
    }

    const body = (await res.json()) as ClaudeResponse & { model?: string; content: { type: string; id?: string; name?: string; input?: unknown }[] };
    const toolBlock = body.content.find((b) => b.type === 'tool_use' && b.name === EXTRACTION_TOOL.name);
    if (!toolBlock || toolBlock.input === undefined) {
      throw new AnalysisProviderError('Claude returned no extraction tool call', false);
    }
    return {
      toolInput: toolBlock.input,
      toolUseId: (toolBlock as { id?: string }).id ?? '',
      rawAssistantContent: body.content,
      usage: {
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
        model: body.model ?? this.model,
      },
    };
  }
}
