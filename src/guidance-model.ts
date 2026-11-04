export type Provider = 'paid' | 'gemini';
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  provider?: string;
  at: string;
}
export interface ProviderResponse {
  ok: boolean;
  status: number;
  text?: string;
}
export async function askProviders(
  messages: ChatMessage[],
  configured: { paid: boolean; gemini: boolean },
  fallback: boolean,
  call: (provider: Provider, messages: ChatMessage[]) => Promise<ProviderResponse>,
) {
  const order: Provider[] = configured.paid
    ? ['paid', ...(fallback && configured.gemini ? ['gemini' as const] : [])]
    : configured.gemini
      ? ['gemini']
      : [];
  const failures: { provider: string; status: number }[] = [];
  for (const provider of order) {
    try {
      const result = await call(provider, messages);
      if (result.ok && result.text) return { text: result.text, provider, failures };
      failures.push({ provider, status: result.status });
    } catch {
      failures.push({ provider, status: 0 });
    }
  }
  return { text: '', provider: 'offline', failures };
}

let lessonDraft = '';
export function setLessonDraft(value: string) {
  lessonDraft = value;
}
export function takeLessonDraft() {
  const value = lessonDraft;
  lessonDraft = '';
  return value;
}
