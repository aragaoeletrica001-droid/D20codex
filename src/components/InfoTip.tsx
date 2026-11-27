import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Search, X } from 'lucide-react';
import { sanitizeUiText } from '../rules/txtParser';
import { searchGlossaryEntries, type SearchableGlossaryEntry } from '../data/rulesHelp';

export interface InfoTipPayload {
  title: string;
  subtitle?: string;
  body: string;
  formula?: string;
  tips?: string[];
}

interface InfoTipContextValue {
  openInfo: (payload: InfoTipPayload) => void;
  openGlossarySearch: (initialQuery?: string) => void;
  closeInfo: () => void;
}

const InfoTipContext = createContext<InfoTipContextValue>({
  openInfo: () => {},
  openGlossarySearch: () => {},
  closeInfo: () => {},
});

const GENERIC_PLACEHOLDERS = new Set([
  'item registrado no inventário do personagem.',
  'ataque de arma ou truque registrado na ficha.',
]);

function hasMeaningfulInfo(body: string | undefined, tips?: string[]): boolean {
  const cleanBody = (body ?? '').trim();
  const hasRealTips = Boolean(tips && tips.some((t) => t.trim().length > 0));
  if (!cleanBody && !hasRealTips) return false;
  if (!hasRealTips && GENERIC_PLACEHOLDERS.has(cleanBody.toLowerCase())) return false;
  return true;
}

export const InfoTipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActive] = useState<InfoTipPayload | null>(null);
  const [previous, setPrevious] = useState<InfoTipPayload | null>(null);
  const [glossaryQuery, setGlossaryQuery] = useState('');
  const [glossaryOnlyMode, setGlossaryOnlyMode] = useState(false);

  const openInfo = useCallback((payload: InfoTipPayload) => {
    if (!hasMeaningfulInfo(payload.body, payload.tips)) return;
    setPrevious(null);
    setGlossaryQuery('');
    setGlossaryOnlyMode(false);
    setActive({
      title: sanitizeUiText(payload.title),
      subtitle: payload.subtitle ? sanitizeUiText(payload.subtitle) : undefined,
      body: sanitizeUiText(payload.body),
      formula: payload.formula ? sanitizeUiText(payload.formula) : undefined,
      tips: payload.tips?.map(sanitizeUiText).filter(Boolean),
    });
  }, []);

  const openGlossarySearch = useCallback((initialQuery = '') => {
    setPrevious(null);
    setGlossaryQuery(initialQuery);
    setGlossaryOnlyMode(true);
    setActive({
      title: 'Busca Rápida no Glossário',
      subtitle: 'Regras, Propriedades de Armas, Condições e Combate (D&D 2024)',
      body: 'Pesquise qualquer termo abaixo (ex.: Recarga, Adaptável, Leve, Acuidade, Ação Bônus, Cobertura, Crítico, Envenenado, Dano Radiante) para ver a explicação completa sem sair da ficha.',
    });
  }, []);

  const closeInfo = useCallback(() => {
    setActive(null);
    setPrevious(null);
    setGlossaryQuery('');
    setGlossaryOnlyMode(false);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInfo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, closeInfo]);

  const trimmedQuery = glossaryQuery.trim();
  const glossaryMatches = useMemo<SearchableGlossaryEntry[]>(() => {
    if (!trimmedQuery && !glossaryOnlyMode) return [];
    return searchGlossaryEntries(trimmedQuery, 20);
  }, [trimmedQuery, glossaryOnlyMode]);

  const handleSelectGlossaryEntry = (entry: SearchableGlossaryEntry) => {
    if (active && !previous && !glossaryOnlyMode) {
      setPrevious(active);
    }
    setGlossaryOnlyMode(false);
    setGlossaryQuery('');
    setActive({
      title: sanitizeUiText(entry.title),
      subtitle: sanitizeUiText(entry.subtitle ? `${entry.category} · ${entry.subtitle}` : entry.category),
      body: sanitizeUiText(entry.body),
      tips: entry.tips?.map(sanitizeUiText).filter(Boolean),
    });
  };

  return (
    <InfoTipContext.Provider value={{ openInfo, openGlossarySearch, closeInfo }}>
      {children}
      {active && (
        <div
          data-testid="info-tip-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-tip-title"
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-[1.5px] p-0 sm:p-4"
          onClick={closeInfo}
        >
          <div
            className="info-tip-dialog w-full sm:max-w-lg bg-[#FDFCFA] border-2 border-[#8F8578] rounded-t-xl sm:rounded-lg shadow-2xl overflow-hidden max-h-[86vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="info-tip-header flex items-start justify-between gap-2 px-3.5 py-2.5 border-b border-[#D8D0C2] bg-[#F5F1E8]">
              <div className="min-w-0 flex-1">
                {previous && (
                  <button
                    type="button"
                    onClick={() => {
                      setActive(previous);
                      setPrevious(null);
                      setGlossaryQuery('');
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#9E1B1B] hover:underline mb-0.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Voltar para {previous.title}
                  </button>
                )}
                {active.subtitle && (
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#8A6518]">
                    {active.subtitle}
                  </p>
                )}
                <h3
                  id="info-tip-title"
                  className="font-display text-sm sm:text-[15px] font-bold text-[#1A1816] flex items-center gap-1.5 leading-snug"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
                  <span>{active.title}</span>
                </h3>
              </div>
              <button
                type="button"
                data-testid="info-tip-close"
                aria-label="Fechar explicação da regra"
                onClick={closeInfo}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded text-[#5C534A] hover:bg-[#E7E0D3] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Built-in Live Glossary Search Bar */}
            <div className="px-3.5 py-2 border-b border-[#E5DFD3] bg-[#FAF8F3]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8C8175] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  data-testid="info-tip-glossary-search"
                  placeholder="Buscar no glossário (ex.: Recarga, Adaptável, Leve, Acuidade, Ação Bônus...)"
                  value={glossaryQuery}
                  onChange={(e) => setGlossaryQuery(e.target.value)}
                  className="w-full min-h-[30px] pl-8 pr-7 rounded border border-[#CFC6B8] bg-white text-[11px] text-[#1A1816] placeholder:text-[#8C8175] focus:outline-none focus:border-[#9E1B1B]"
                />
                {glossaryQuery && (
                  <button
                    type="button"
                    aria-label="Limpar busca do glossário"
                    onClick={() => setGlossaryQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[#8C8175] hover:text-[#1A1816] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Body OR Live Glossary Search Results */}
            <div className="p-3.5 space-y-2.5 overflow-y-auto text-[11.5px] text-[#2B2622] leading-relaxed">
              {trimmedQuery || glossaryOnlyMode ? (
                <div className="space-y-1.5" data-testid="info-tip-glossary-results">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6258]">
                    {trimmedQuery
                      ? `${glossaryMatches.length} termo(s) encontrado(s) para "${trimmedQuery}"`
                      : `Glossário Rápido (${glossaryMatches.length} termos principais)`}
                  </p>
                  {glossaryMatches.length === 0 ? (
                    <p className="text-[11px] text-[#6B6258] py-3 text-center">
                      Nenhum termo encontrado. Tente palavras como Recarga, Adaptável, Leve, Crítico, Cobertura ou Envenenado.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EAE4D7] border border-[#DDD5C7] rounded bg-white">
                      {glossaryMatches.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          data-testid={`glossary-result-${entry.id}`}
                          onClick={() => handleSelectGlossaryEntry(entry)}
                          className="w-full text-left px-2.5 py-2 hover:bg-[#FAF8F3] transition-colors cursor-pointer space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11.5px] font-bold text-[#1A1816]">
                              {entry.title}
                            </span>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border border-[#DFD1AE] bg-[#FBF7EC] text-[#7A5610] shrink-0">
                              {entry.category}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-[#5C534A] line-clamp-2 leading-snug">
                            {entry.body}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {active.formula && (
                    <div className="info-tip-formula p-2 rounded border border-[#DFD1AE] bg-[#FBF7EC] text-[10.5px] font-mono text-[#1A1816]">
                      <span className="block text-[9px] font-sans font-extrabold uppercase tracking-wider text-[#7A5610] mb-0.5">
                        Cálculo Atual na Ficha
                      </span>
                      {active.formula}
                    </div>
                  )}

                  {active.body && (
                    <p className="whitespace-pre-line text-[11.5px] leading-relaxed">
                      {active.body}
                    </p>
                  )}

                  {active.tips && active.tips.length > 0 && (
                    <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-[#4D453E] pt-2 border-t border-[#EAE4D7] leading-snug">
                      {active.tips.map((tip, idx) => (
                        <li key={idx} className="whitespace-pre-line">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </InfoTipContext.Provider>
  );
};

export function useInfoTip() {
  return useContext(InfoTipContext);
}

interface InfoTipProps extends InfoTipPayload {
  className?: string;
  testId?: string;
}

/**
 * Ícone informativo (i) compacto em expoente que nunca estica, quebra ou deforma
 * linhas, caixas ou títulos da ficha. Nunca renderiza quando não houver explicação real.
 */
export const InfoTip: React.FC<InfoTipProps> = ({
  title,
  subtitle,
  body,
  formula,
  tips,
  className = '',
  testId,
}) => {
  const { openInfo } = useInfoTip();

  if (!hasMeaningfulInfo(body, tips)) {
    return null;
  }

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openInfo({ title, subtitle, body, formula, tips });
  };

  return (
    <span
      role="button"
      tabIndex={0}
      data-testid={testId ?? 'info-tip-trigger'}
      aria-label={`Explicação completa: ${title}`}
      title={`Ver explicação completa: ${title}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick(e);
      }}
      className={`info-tip-badge inline-flex items-center justify-center align-baseline relative -top-[0.24em] ml-[2px] select-none cursor-pointer shrink-0 group after:content-[''] after:absolute after:-inset-[6px] ${className}`}
    >
      <span className="info-tip-circle inline-flex items-center justify-center w-[10.5px] h-[10.5px] rounded-full border border-[#8A6518]/85 bg-[#FBF4DC] text-[#6E4A08] group-hover:bg-[#8A6518] group-hover:text-white text-[7px] font-serif italic font-bold leading-none transition-colors">
        i
      </span>
    </span>
  );
};
