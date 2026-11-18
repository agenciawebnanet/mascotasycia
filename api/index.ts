import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/server/app.ts';

/**
 * Função serverless da Vercel: todas as rotas /api/* caem aqui e são
 * encaminhadas para o mesmo Express usado no dev.
 */
let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
