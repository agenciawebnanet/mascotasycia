import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, ChevronDown } from 'lucide-react';
import type { AppLanguage, AuditLog } from '../shared/types';
import { formatDateTime } from '../shared/currency';
import { getTranslations } from '../shared/i18n';

export function AuditView({ logs, lang }: { logs: AuditLog[]; lang: AppLanguage }) {
  const t = getTranslations(lang);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const tr = (es: string, pt: string) => (lang === 'pt-BR' ? pt : es);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? logs.filter((log) =>
          [log.action, log.user_name, log.entity_type, log.entity_id, log.details_json]
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : logs;
    return list;
  }, [logs, query]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tr('Clínica y Auditoría', 'Clínica e Auditoria')}</h1>
        <p className="text-sm text-slate-500">
          {tr('Registro inmutable de quién hizo qué, cuándo y sobre qué registro.', 'Registro imutável de quem fez o quê, quando e sobre qual registro.')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('Buscar acción, usuario o entidad…', 'Buscar ação, usuário ou entidade…')}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
            aria-label={tr('Buscar en auditoría', 'Buscar na auditoria')}
          />
        </div>
        <p className="text-xs text-slate-500 font-mono-tabular">
          {filtered.length} {tr('registro(s)', 'registro(s)')}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-700">{tr('Sin registros de auditoría.', 'Nenhum registro de auditoria.')}</p>
          <p className="mt-1 text-xs text-slate-500">{tr('Las acciones aparecen aquí en cuanto se ejecutan.', 'As ações aparecem aqui assim que são executadas.')}</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-[62vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="text-left font-semibold px-4 py-2.5 w-[140px]">{tr('Fecha y hora', 'Data e hora')}</th>
                    <th className="text-left font-semibold px-4 py-2.5">{tr('Usuario', 'Usuário')}</th>
                    <th className="text-left font-semibold px-4 py-2.5">{tr('Acción', 'Ação')}</th>
                    <th className="text-left font-semibold px-4 py-2.5">{tr('Entidad', 'Entidade')}</th>
                    <th className="text-left font-semibold px-4 py-2.5">{tr('Detalle', 'Detalhe')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((log, index) => (
                    <tr key={log.id} className={`border-b border-slate-100 last:border-0 ${index % 2 ? 'bg-slate-50/40' : 'bg-white'}`}>
                      <td className="px-4 py-2.5 font-mono-tabular text-slate-500 whitespace-nowrap">{formatDateTime(log.created_at, lang)}</td>
                      <td className="px-4 py-2.5">
                        <span className="block font-medium text-slate-900">{log.user_name}</span>
                        <span className="block text-[11px] text-slate-500">{t.roles[log.user_role as keyof typeof t.roles] || log.user_role}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-[11px] text-slate-700">{log.action}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {log.entity_type} <span className="text-slate-400">#{log.entity_id}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 max-w-[320px]">
                        <span className="line-clamp-2" title={log.details_json}>{log.details_json}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="md:hidden space-y-2">
            {visible.map((log) => (
              <li key={log.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-[11px] text-slate-700">{log.action}</span>
                  <span className="font-mono-tabular text-[10px] text-slate-400">{formatDateTime(log.created_at, lang)}</span>
                </div>
                <p className="mt-1.5 text-xs font-medium text-slate-900">{log.user_name} · {log.entity_type} #{log.entity_id}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{log.details_json}</p>
              </li>
            ))}
          </ul>

          {filtered.length > visible.length ? (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
            >
              <ChevronDown className="w-3.5 h-3.5" /> {tr('Mostrar más', 'Mostrar mais')}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
