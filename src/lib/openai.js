import OpenAI, { toFile } from 'openai';

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

export async function editImage(config, {
  model,
  imageBuffer,
  prompt,
  size,
  mimeType = 'image/png',
}) {
  const client = buildOpenAIClient(config);
  const image = await toFile(imageBuffer, 'image.png', { type: mimeType });
  const res = await client.images.edit({
    model: model || 'gpt-image-1.5',
    image,
    prompt,
    size,
    input_fidelity: 'high',
    quality: 'high',
  });

  const b64 = res.data[0]?.b64_json;
  if (b64) return Buffer.from(b64, 'base64');

  const url = res.data[0]?.url;
  if (url) {
    const download = await fetch(url);
    if (!download.ok) throw new Error('Failed to download edited image from OpenAI.');
    return Buffer.from(await download.arrayBuffer());
  }

  throw new Error('OpenAI did not return an edited image.');
}
