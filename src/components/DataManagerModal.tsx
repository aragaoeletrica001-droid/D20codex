import React, { useRef, useState } from 'react';
import { Download, FileText, RotateCcw, Upload, X } from 'lucide-react';
import type { CharacterSheet, CreatureStatBlock, FeatDefinition, SpellDefinition } from '../types/dnd';
import { validateCharacterImportJson } from '../rules/engine';
import { parseCreaturesTxt, parseFeatsTxt, parseSpellsTxt } from '../rules/txtParser';

interface DataManagerModalProps {
  open: boolean;
  sheet: CharacterSheet;
  spellCount: number;
  creatureCount: number;
  onClose: () => void;
  onImportSheet: (sheet: CharacterSheet) => void;
  onImportCompendiumTxt: (payload: {
    spells: SpellDefinition[];
    creatures: CreatureStatBlock[];
    feats: FeatDefinition[];
    fileNames: string[];
  }) => void;
  onResetDefault: () => void;
}

export const DataManagerModal: React.FC<DataManagerModalProps> = ({
  open,
  sheet,
  spellCount,
  creatureCount,
  onClose,
  onImportSheet,
  onImportCompendiumTxt,
  onResetDefault,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = sheet.nome.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'personagem';
    a.href = url;
    a.download = `ficha-dd2024-${safeName}-nv${sheet.nivel}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: 'ok', text: 'Ficha exportada em formato .json com sucesso.' });
  };

  const handleJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const check = validateCharacterImportJson(parsed);
      if (check.ok === false) {
        setFeedback({ type: 'error', text: check.error });
        return;
      }
      onImportSheet(check.sheet);
      setFeedback({ type: 'ok', text: `Ficha "${check.sheet.nome}" importada com sucesso!` });
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível ler o arquivo JSON selecionado.' });
    } finally {
      e.target.value = '';
    }
  };

  const handleTxtFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const spells: SpellDefinition[] = [];
    const creatures: CreatureStatBlock[] = [];
    const feats: FeatDefinition[] = [];
    const fileNames: string[] = [];

    for (const f of files) {
      const text = await f.text();
      fileNames.push(f.name);
      const lower = f.name.toLowerCase();
      if (lower.includes('magia') || /Círculo\/Escola:/i.test(text)) {
        spells.push(...parseSpellsTxt(text));
      }
      if (lower.includes('criatura') || /Tipo\/Tamanho:/i.test(text)) {
        creatures.push(...parseCreaturesTxt(text));
      }
      if (lower.includes('talento')) {
        feats.push(...parseFeatsTxt(text));
      }
    }

    onImportCompendiumTxt({ spells, creatures, feats, fileNames });
    setFeedback({
      type: 'ok',
      text: `Importado(s) ${files.length} arquivo(s) .txt: +${spells.length} magias, +${creatures.length} criaturas, +${feats.length} talentos.`,
    });
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1A1816]/60 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[#FDFCFA] border border-[#C8BFB0] rounded-t-xl sm:rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3DDD2] bg-[#F7F4EC]">
          <h2 id="data-modal-title" className="font-display text-lg font-bold text-[#1A1816]">
            Backup, Importação & Compêndio (.txt)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de dados"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded text-[#6B6258] hover:bg-[#EAE4D7] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-[#4D453E]">
          {feedback && (
            <div
              className={`p-3 rounded border font-semibold ${
                feedback.type === 'ok'
                  ? 'border-[#9EC7B0] bg-[#F2FAF5] text-[#1B5737]'
                  : 'border-[#DFB2B2] bg-[#FDF3F3] text-[#8B1717]'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Section 1: JSON Backup */}
          <div className="p-3.5 rounded border border-[#E3DDD2] bg-[#FAF8F3] space-y-2.5">
            <h3 className="text-sm font-bold text-[#1A1816]">Salvar & Restaurar Ficha (.json)</h3>
            <p>
              Suas alterações são salvas automaticamente no navegador. Exporte um arquivo{' '}
              <code>.json</code> para backup ou para transferir a ficha entre celular e tablet.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded bg-[#1A1816] text-white font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Exportar Ficha (.json)
              </button>
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded border border-[#C8BFB0] bg-white text-[#1A1816] font-semibold hover:bg-[#EFECE4] cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Importar Ficha (.json)
              </button>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleJsonFileChange}
              />
            </div>
          </div>

          {/* Section 2: .txt Compendium Importer */}
          <div className="p-3.5 rounded border border-[#E3DDD2] bg-[#FAF8F3] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1A1816]">
                Importador de Regras e Compêndio (.txt)
              </h3>
              <span className="font-mono text-[11px] text-[#7A6F64]">
                {spellCount} magias · {creatureCount} criaturas carregadas
              </span>
            </div>
            <p>
              As regras oficiais de D&amp;D 2024 (Classes, Subclasses, Origens, Talentos,
              Equipamentos, Magias e Criaturas) já estão integradas e carregadas automaticamente. Se
              desejar adicionar novos arquivos <code>.txt</code> com magias ou conteúdo extra em
              Markdown, selecione um ou mais arquivos abaixo.
            </p>
            <button
              type="button"
              onClick={() => txtInputRef.current?.click()}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded border border-[#B08D3B] bg-[#FBF6E6] text-[#7A5610] font-semibold hover:bg-[#8A6518] hover:text-white cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Carregar Arquivos de Compêndio (.txt)
            </button>
            <input
              ref={txtInputRef}
              type="file"
              accept=".txt,.md,text/plain"
              multiple
              className="hidden"
              onChange={handleTxtFilesChange}
            />
          </div>

          {/* Section 3: Reset to Blank */}
          <div className="pt-2 border-t border-[#E3DDD2] flex items-center justify-between gap-2">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 text-[#9E1B1B] font-semibold hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar ficha atual (Ficha em Branco)
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[#8B1717] font-semibold">Zerar esta ficha?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetDefault();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="min-h-[34px] px-3 rounded bg-[#9E1B1B] text-white font-semibold cursor-pointer"
                >
                  Sim, limpar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[34px] px-2.5 rounded border border-[#C8BFB0] text-[#4D453E] cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-4 rounded border border-[#C8BFB0] bg-white font-semibold text-[#1A1816] cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
