import OpenAI from 'openai';

export function buildOpenAIClient(config) {
  if (!config || !config.apiKey) {
    throw new Error('OpenAI is not configured. Set it in Platform Settings.');
  }
  return new OpenAI({ apiKey: config.apiKey });
}

export async function listModels(config) {
  const client = buildOpenAIClient(config);
  const res = await client.models.list();
  return res.data
    .map((m) => m.id)
    .filter((id) => id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4'))
    .sort();
}

export async function chatComplete(config, { model, system, user, temperature = 0.7 }) {
  const client = buildOpenAIClient(config);
  const res = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    temperature,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() || '';
}
