import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/server/app.ts';

// Single Express app instance reused across warm serverless invocations.
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
