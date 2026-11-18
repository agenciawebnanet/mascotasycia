# Mascotas y Cia · Sistema Veterinario

Sistema de gestão veterinária exclusivo para a **Mascotas y Cia** (Ciudad del Este, Paraguai): história clínica SOAP, agenda, vacinas, internação 24h, banho e tosa, portal do tutor, loja pública, estoque, PDV e financeiro em **guaranis (G$)**.

- **Produção:** https://mascotasycia.vercel.app
- **Stack:** React 19 + Vite + Tailwind CSS 4 no front-end; Express + SQLite (`node:sqlite`) na API; deploy em Vercel (função serverless).
- **Idioma:** espanhol (Paraguai), com valores em G$, RUC e IVA 10% incluído nos comprovantes.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes dos fluxos críticos
npm run lint       # checagem de tipos
npm run build      # build de produção em dist/
```

O banco de demonstração é criado e populado automaticamente em `data/` na primeira execução.
Use o botão **Restaurar dados** no topo para voltar ao estado inicial.

## Deploy

O projeto já está configurado para a Vercel (`vercel.json` + `api/[...path].ts`):

```bash
npx vercel --prod
```

Variáveis de ambiente opcionais:

| Variável | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Habilita o rascunho SOAP assistido por IA (opcional) |
| `MASCOTAS_DATA_DIR` | Diretório alternativo para o SQLite (padrão: `data/` local, `/tmp` na Vercel) |

> **Persistência:** na Vercel o SQLite fica em `/tmp`, ou seja, é efêmero e recriado a cada instância fria.
> Para uso real da clínica, troque a camada `src/server/db.ts` por Postgres/Neon ou Turso/libSQL.

## Estrutura

```
api/[...path].ts          entrada serverless da API Express
src/server/app.ts         rotas da API
src/server/db.ts          conexão SQLite + seed
src/server/services/      regras de negócio (SOAP, agenda, PDV, internação...)
src/components/           telas do sistema
src/shared/               tipos, i18n e formatação (G$, datas, peso)
public/                   ícones e manifest PWA
```

## Licença

Uso exclusivo de Mascotas y Cia.
