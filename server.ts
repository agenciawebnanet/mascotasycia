import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './src/server/app.ts';

const PORT = Number(process.env.PORT || 3000);

/**
 * Entrada local (dev e `npm start`). Em produção na Vercel o Express roda em
 * `api/[...path].ts`, sem Vite e sem `listen`.
 */
async function startServer() {
  const app = await createApp();

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mascotas & Cia server running at http://localhost:${PORT}`);
  });
}

startServer();
