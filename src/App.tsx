import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Backpack,
  BookOpen,
  Database,
  Download,
  FilePlus2,
  FileText,
  Moon,
  PawPrint,
  Shield,
  Sliders,
  Sun,
  Trash2,
  UserPen,
} from 'lucide-react';
import type {
  CharacterSheet,
  ClassDefinition,
  CreatureStatBlock,
  FeatDefinition,
  RollRequest,
  RollResult,
  SpellDefinition,
  SubBlockVisibility,
} from './types/dnd';
import { CLASS_MAP } from './data/classes';
import {
  createBlankCharacter,
  isSheetPristineBlank,
} from './rules/defaultCharacter';
import {
  getHydratedCompendiums,
  mergeCreaturesById,
  mergeSpellsById,
} from './rules/txtParser';
import {
  reconcileCharacterSheet,
  spellRequiresTest,
  validateCharacterImportJson,
} from './rules/engine';
import { CollapsibleSectionsProvider } from './hooks/useCollapsibleSections';
import { InfoTipProvider } from './components/InfoTip';

import { OfficialPage1Header } from './components/OfficialPage1Header';
import { ResourcesCountersPanel } from './components/ResourcesCountersPanel';
import { QuickTestsPanel } from './components/QuickTestsPanel';
import { AbilitiesSkillsPanel } from './components/AbilitiesSkillsPanel';
import { AttacksActionsPanel } from './components/AttacksActionsPanel';
import { FeaturesPanel } from './components/FeaturesPanel';
import { SpellsPanel } from './components/SpellsPanel';
import { EquipmentIdentityPanel } from './components/EquipmentIdentityPanel';
import { DiceRollModal } from './components/DiceRollModal';
import { CharacterWizardModal } from './components/CharacterWizardModal';
import { RestModal } from './components/RestModal';
import { ConditionsGlossaryModal } from './components/ConditionsGlossaryModal';
import { DataManagerModal } from './components/DataManagerModal';

// Clean v2 user-only storage keys (never loads legacy demo/preset characters)
const STORAGE_KEY_SAVED_CHARS = 'dnd2024_user_characters_v2';
const STORAGE_KEY_ACTIVE_ID = 'dnd2024_active_char_id_v2';
const STORAGE_KEY_ROLLS = 'dnd2024_recent_rolls_v2';
const STORAGE_KEY_THEME = 'd20codex_theme_v1';

type SheetTabId = 'ficha' | 'variaveis' | 'equipamentos';

function loadInitialTheme(): 'light' | 'dark' {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  return 'light';
}

function loadSavedCharacters(): CharacterSheet[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SAVED_CHARS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: CharacterSheet[] = [];
    for (const item of parsed) {
      const check = validateCharacterImportJson(item);
      if (check.ok) valid.push(check.sheet);
    }
    return valid;
  } catch {
    return [];
  }
}

function loadInitialState(): { saved: CharacterSheet[]; active: CharacterSheet } {
  const saved = loadSavedCharacters();
  if (saved.length === 0) {
    return { saved: [], active: createBlankCharacter() };
  }
  try {
    const activeId = window.localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    const match = saved.find((c) => c.id === activeId);
    if (match) return { saved, active: match };
  } catch {
    // ignore
  }
  return { saved, active: saved[0] };
}

function loadInitialRolls(): RollResult[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY_ROLLS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.slice(0, 20);
    }
  } catch {
    // ignore
  }
  return [];
}

function formatSavedOptionLabel(char: CharacterSheet): string {
  const name = char.nome.trim() || 'Personagem Sem Nome';
  const clsName = CLASS_MAP[char.classeId]?.name;
  return clsName ? `${name} — ${clsName} Nv ${char.nivel}` : `${name} — Nv ${char.nivel}`;
}

export default function App() {
  const [initialBundle] = useState(loadInitialState);
  const [initialCompendiums] = useState(getHydratedCompendiums);
  const [theme, setTheme] = useState<'light' | 'dark'>(loadInitialTheme);

  const [savedCharacters, setSavedCharacters] = useState<CharacterSheet[]>(initialBundle.saved);
  const [sheet, setSheet] = useState<CharacterSheet>(initialBundle.active);
  const [recentRolls, setRecentRolls] = useState<RollResult[]>(loadInitialRolls);
  const [activeRollRequest, setActiveRollRequest] = useState<RollRequest | null>(null);
  const [activeTab, setActiveTab] = useState<SheetTabId>('ficha');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInstanceKey, setWizardInstanceKey] = useState(0);
  const [restMode, setRestMode] = useState<'curto' | 'longo' | null>(null);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Immediately hydrated from embedded JS data (100% offline / single-file index.html ready)
  const [allClasses] = useState<ClassDefinition[]>(initialCompendiums.classes);
  const [allSpells, setAllSpells] = useState<SpellDefinition[]>(initialCompendiums.spells);
  const [allCreatures, setAllCreatures] = useState<CreatureStatBlock[]>(initialCompendiums.creatures);
  const [allFeats, setAllFeats] = useState<FeatDefinition[]>(initialCompendiums.feats);

  // Sync Dark Mode (Power-Saving) attribute & localStorage
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Sync saved characters list + active ID to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_SAVED_CHARS, JSON.stringify(savedCharacters));
      if (savedCharacters.some((c) => c.id === sheet.id)) {
        window.localStorage.setItem(STORAGE_KEY_ACTIVE_ID, sheet.id);
      } else {
        window.localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
      }
    } catch {
      // Storage full or restricted
    }
  }, [savedCharacters, sheet.id]);

  // Auto-persist recent rolls
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_ROLLS, JSON.stringify(recentRolls.slice(0, 20)));
    } catch {
      // ignore
    }
  }, [recentRolls]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const commitSheet = (nextRaw: CharacterSheet) => {
    setSheet((prev) => {
      const next = reconcileCharacterSheet(prev, nextRaw);
      if (!isSheetPristineBlank(next)) {
        setSavedCharacters((list) => {
          const exists = list.some((c) => c.id === next.id);
          return exists ? list.map((c) => (c.id === next.id ? next : c)) : [...list, next];
        });
      }
      return next;
    });
  };

  const handleUpdateSheet = (updater: (prev: CharacterSheet) => CharacterSheet) => {
    setSheet((prev) => {
      const nextRaw = updater(prev);
      const next = reconcileCharacterSheet(prev, nextRaw);
      if (!isSheetPristineBlank(next)) {
        setSavedCharacters((list) => {
          const exists = list.some((c) => c.id === next.id);
          return exists ? list.map((c) => (c.id === next.id ? next : c)) : [...list, next];
        });
      }
      return next;
    });
  };

  const handleNewBlankCharacter = () => {
    const fresh = createBlankCharacter();
    setSheet(fresh);
    setConfirmDeleteId(null);
    setActiveTab('ficha');
    showToast('Nova ficha em branco criada.');
  };

  const handleSelectSavedCharacter = (charId: string) => {
    setConfirmDeleteId(null);
    if (charId === '__blank__') {
      handleNewBlankCharacter();
      return;
    }
    const found = savedCharacters.find((c) => c.id === charId);
    if (found) {
      setSheet(found);
    }
  };

  const handleDeleteCurrentSaved = () => {
    const remaining = savedCharacters.filter((c) => c.id !== sheet.id);
    setSavedCharacters(remaining);
    setConfirmDeleteId(null);
    if (remaining.length > 0) {
      setSheet(remaining[0]);
      showToast('Personagem excluído.');
    } else {
      setSheet(createBlankCharacter());
      showToast('Personagem excluído. Ficha limpa carregada.');
    }
  };

  const handleQuickExportJson = () => {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = sheet.nome.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'personagem';
    a.href = url;
    a.download = `d20codex-${safeName}-nv${sheet.nivel}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Ficha exportada (.json).');
  };

  const handleOpenWizard = () => {
    setWizardInstanceKey((k) => k + 1);
    setWizardOpen(true);
  };

  const handleRecordRoll = (res: RollResult) => {
    setRecentRolls((prev) => [res, ...prev].slice(0, 20));
  };

  const handleConsumeHeroicInspiration = () => {
    handleUpdateSheet((prev) => ({ ...prev, inspiracaoHeroica: false }));
  };

  const toggleSubBlock = (key: keyof SubBlockVisibility) => {
    handleUpdateSheet((prev) => ({
      ...prev,
      visibilidade: {
        ...prev.visibilidade,
        [key]: !prev.visibilidade[key],
      },
    }));
  };

  const handleImportCompendiumTxt = (payload: {
    spells: SpellDefinition[];
    creatures: CreatureStatBlock[];
    feats: FeatDefinition[];
    fileNames: string[];
  }) => {
    if (payload.spells.length > 0) {
      setAllSpells((prev) => mergeSpellsById(prev, payload.spells));
    }
    if (payload.creatures.length > 0) {
      setAllCreatures((prev) => mergeCreaturesById(prev, payload.creatures));
    }
    if (payload.feats.length > 0) {
      setAllFeats((prev) => {
        const map = new Map(prev.map((f) => [f.id, f]));
        payload.feats.forEach((f) => map.set(f.id, f));
        return Array.from(map.values());
      });
    }
    showToast(`Compêndio importado: ${payload.fileNames.join(', ')}`);
  };

  const handleSelectTab = (tab: SheetTabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isCurrentSaved = savedCharacters.some((c) => c.id === sheet.id);
  const activeConditionsCount = sheet.condicoesAtivas.length + (sheet.nivelExaustao > 0 ? 1 : 0);
  const isDark = theme === 'dark';

  return (
    <InfoTipProvider>
      <CollapsibleSectionsProvider>
        <div className="min-h-screen bg-[#E5DFD5] text-[#1A1816] flex flex-col">
          {/* Slim Sticky Top Header + 3 Tabs (Hidden automatically in Tablet Landscape where all 3 columns appear side-by-side) */}
          <div className="sticky top-0 z-30 shadow-sm">
            <header className="d20-top-header h-[44px] md:h-[48px] bg-[#1A1816] text-[#FDFCFA] border-b border-[#332E2A]">
              <div className="max-w-[1600px] mx-auto h-full px-2.5 sm:px-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Shield className="w-4 h-4 text-[#E5C068] shrink-0" aria-hidden="true" />
                  <span
                    data-testid="app-brand-name"
                    className="font-display text-sm sm:text-base font-extrabold tracking-wide whitespace-nowrap text-[#FDFCFA]"
                  >
                    D20Codex
                  </span>
                </div>

                {/* Desktop/Tablet Session Operations */}
                <nav className="hidden md:flex items-center gap-1.5" aria-label="Ações de sessão">
                  <button
                    type="button"
                    data-testid="short-rest-btn"
                    onClick={() => setRestMode('curto')}
                    className="h-7 px-2.5 rounded border border-[#3E3832] bg-[#26221F] text-[#EFECE4] text-xs font-semibold hover:border-[#E5C068] hover:text-[#E5C068] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Desc. Curto
                  </button>
                  <button
                    type="button"
                    data-testid="long-rest-btn"
                    onClick={() => setRestMode('longo')}
                    className="h-7 px-2.5 rounded border border-[#3E3832] bg-[#26221F] text-[#EFECE4] text-xs font-semibold hover:border-[#E5C068] hover:text-[#E5C068] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Moon className="w-3.5 h-3.5" />
                    Desc. Longo
                  </button>
                  <button
                    type="button"
                    data-testid="open-conditions-btn"
                    onClick={() => setConditionsOpen(true)}
                    className={`h-7 px-2.5 rounded border text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      activeConditionsCount > 0
                        ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                        : 'border-[#3E3832] bg-[#26221F] text-[#EFECE4] hover:border-[#E5C068] hover:text-[#E5C068]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Glossário{activeConditionsCount > 0 ? ` (${activeConditionsCount})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataModalOpen(true)}
                    className="h-7 px-2.5 rounded border border-[#3E3832] bg-[#26221F] text-[#EFECE4] text-xs font-semibold hover:border-[#E5C068] hover:text-[#E5C068] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Compêndio
                  </button>
                </nav>

                {/* Right Utility Icons + Dark Mode Toggle + Wizard CTA */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="toggle-dark-mode-btn"
                    aria-pressed={isDark}
                    aria-label={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro (Economia de Energia)'}
                    title={isDark ? 'Modo Claro' : 'Modo Escuro (Economia de Energia)'}
                    onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                    className={`h-8 md:h-7 px-2 rounded border text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                      isDark
                        ? 'border-[#E5C068] bg-[#262010] text-[#FCE29A]'
                        : 'border-[#3E3832] bg-[#26221F] text-[#EFECE4] hover:border-[#E5C068] hover:text-[#E5C068]'
                    }`}
                  >
                    {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isDark ? 'Claro' : 'Escuro'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestMode('curto')}
                    aria-label="Descanso Curto"
                    title="Descanso Curto"
                    className="md:hidden h-8 w-8 flex items-center justify-center rounded border border-[#3E3832] bg-[#26221F] text-[#E5C068] cursor-pointer"
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestMode('longo')}
                    aria-label="Descanso Longo"
                    title="Descanso Longo"
                    className="md:hidden h-8 w-8 flex items-center justify-center rounded border border-[#3E3832] bg-[#26221F] text-[#EFECE4] cursor-pointer"
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid="open-conditions-mobile-btn"
                    onClick={() => setConditionsOpen(true)}
                    aria-label="Glossário, Condições e Regras"
                    title="Glossário, Condições e Regras"
                    className={`md:hidden h-8 px-1.5 flex items-center justify-center gap-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                      activeConditionsCount > 0
                        ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                        : 'border-[#3E3832] bg-[#26221F] text-[#EFECE4]'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {activeConditionsCount > 0 && <span>{activeConditionsCount}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataModalOpen(true)}
                    aria-label="Backup e Compêndio"
                    title="Backup / Importar / Compêndio"
                    className="md:hidden h-8 w-8 flex items-center justify-center rounded border border-[#3E3832] bg-[#26221F] text-[#EFECE4] cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid="open-wizard-btn"
                    onClick={handleOpenWizard}
                    className="h-8 md:h-7 px-2.5 rounded bg-[#9E1B1B] hover:bg-[#B82222] text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                  >
                    <UserPen className="w-3.5 h-3.5" />
                    <span>Assistente</span>
                  </button>
                </div>
              </div>
            </header>

            {/* EXACT 3 MAIN TABS: Ficha | Variáveis | Equipamentos (Visible on Phone Portrait/Landscape & Tablet Portrait; Hidden on Tablet Landscape) */}
            <nav
              role="tablist"
              data-testid="main-tabs-nav"
              aria-label="Seções principais do D20Codex"
              className="d20-tab-bar h-[38px] bg-[#FAF8F3] border-b-2 border-[#8F8578]"
            >
              <div className="max-w-[1600px] mx-auto h-full px-1 sm:px-4 grid grid-cols-3 gap-0.5 sm:gap-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'ficha'}
                  data-testid="tab-ficha"
                  onClick={() => handleSelectTab('ficha')}
                  className={`h-full px-1 flex items-center justify-center gap-1 text-xs font-extrabold border-b-2 transition-colors cursor-pointer whitespace-nowrap min-w-0 ${
                    activeTab === 'ficha'
                      ? 'border-[#9E1B1B] text-[#9E1B1B] bg-white'
                      : 'border-transparent text-[#5C534A] hover:text-[#1A1816]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Ficha</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'variaveis'}
                  data-testid="tab-variaveis"
                  onClick={() => handleSelectTab('variaveis')}
                  className={`h-full px-1 flex items-center justify-center gap-1 text-xs font-extrabold border-b-2 transition-colors cursor-pointer whitespace-nowrap min-w-0 ${
                    activeTab === 'variaveis'
                      ? 'border-[#9E1B1B] text-[#9E1B1B] bg-white'
                      : 'border-transparent text-[#5C534A] hover:text-[#1A1816]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Variáveis</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'equipamentos'}
                  data-testid="tab-equipamentos"
                  onClick={() => handleSelectTab('equipamentos')}
                  className={`h-full px-1 flex items-center justify-center gap-1 text-xs font-extrabold border-b-2 transition-colors cursor-pointer whitespace-nowrap min-w-0 ${
                    activeTab === 'equipamentos'
                      ? 'border-[#8A6518] text-[#8A6518] bg-white'
                      : 'border-transparent text-[#5C534A] hover:text-[#1A1816]'
                  }`}
                >
                  <Backpack className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Equipamentos</span>
                </button>
              </div>
            </nav>
          </div>

          {/* Subtle Toast Banner */}
          {toastMessage && (
            <div
              role="status"
              className="fixed top-24 right-3 z-40 max-w-xs px-3 py-2 rounded border border-[#1F6B43] bg-[#F2FAF5] text-[#1B5737] text-xs font-semibold shadow-lg"
            >
              {toastMessage}
            </div>
          )}

          {/* Main Workspace */}
          <main className="flex-1 w-full max-w-[1600px] mx-auto px-2 sm:px-4 py-2.5 space-y-2.5">
            {/* COMPACT USER-ONLY CHARACTER MANAGER BAR (ZERO PRESETS / ZERO DEMOS) */}
            <div
              data-testid="character-manager-bar"
              className="bg-[#F3EFE6] border border-[#B8AEA0] rounded px-2 py-1.5 flex flex-wrap items-center justify-between gap-1.5"
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <select
                  id="saved-characters-select"
                  data-testid="saved-characters-select"
                  aria-label="Personagens salvos"
                  value={isCurrentSaved ? sheet.id : '__blank__'}
                  onChange={(e) => handleSelectSavedCharacter(e.target.value)}
                  className="h-[32px] flex-1 sm:flex-none sm:w-[220px] min-w-0 px-2 rounded border border-[#8F8578] bg-white text-xs font-semibold text-[#1A1816] cursor-pointer truncate"
                >
                  {!isCurrentSaved && (
                    <option value="__blank__">
                      {savedCharacters.length === 0
                        ? 'Ficha Limpa (0 salvos)'
                        : 'Nova Ficha em Branco'}
                    </option>
                  )}
                  {savedCharacters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatSavedOptionLabel(c)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  data-testid="new-blank-char-btn"
                  onClick={handleNewBlankCharacter}
                  className="h-[32px] px-2 rounded border border-[#1A1816] bg-[#1A1816] text-white text-[11px] font-bold inline-flex items-center gap-1 hover:bg-[#332E2A] whitespace-nowrap cursor-pointer shrink-0"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-[#E5C068]" />
                  <span className="sm:hidden">+ Nova</span>
                  <span className="hidden sm:inline">+ Novo Personagem (Ficha Limpa)</span>
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleSubBlock('companheiro')}
                  aria-pressed={sheet.visibilidade.companheiro}
                  title="Mostrar/ocultar seção de Companheiro em Variáveis"
                  className={`h-[30px] px-2 rounded border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                    sheet.visibilidade.companheiro
                      ? 'border-[#2F5B39] bg-[#EEF6F0] text-[#1F4226]'
                      : 'border-[#B8AEA0] bg-white text-[#4D453E]'
                  }`}
                >
                  <PawPrint className="w-3 h-3" />
                  <span className="hidden sm:inline">Companheiro</span>
                </button>

                {isCurrentSaved && (
                  <>
                    <button
                      type="button"
                      onClick={handleQuickExportJson}
                      title="Exportar este personagem (.json)"
                      aria-label="Exportar personagem JSON"
                      className="h-[30px] px-2 rounded border border-[#8F8578] bg-white text-[#1A1816] text-[11px] font-semibold hover:bg-[#EFEAE0] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Exportar</span>
                    </button>

                    {confirmDeleteId === sheet.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          data-testid="confirm-delete-char-btn"
                          onClick={handleDeleteCurrentSaved}
                          className="h-[30px] px-2 rounded bg-[#9E1B1B] text-white text-[11px] font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-[30px] px-2 rounded border border-[#8F8578] bg-white text-[11px] cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid="delete-char-btn"
                        onClick={() => setConfirmDeleteId(sheet.id)}
                        title="Excluir personagem salvo"
                        aria-label="Excluir personagem salvo"
                        className="h-[30px] px-2 rounded border border-[#D4B2B2] bg-white text-[#9E1B1B] text-[11px] font-semibold hover:bg-[#FCEAEA] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Excluir</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ================================================================
                3-PANEL WORKSPACE:
                - Phone (Portrait/Landscape) & Tablet Portrait: 1 active tab
                - Tablet Landscape & Desktop: All 3 columns side-by-side!
                ================================================================ */}
            <div className="d20-workspace" data-testid="d20-workspace">
              {/* COLUNA / ABA 1: FICHA (Ordem exata 1..8) */}
              <div
                data-testid="panel-tab-ficha"
                data-active={activeTab === 'ficha' ? 'true' : 'false'}
                className="d20-col-panel official-sheet-page p-2 sm:p-3 space-y-2.5"
              >
                <div className="d20-col-heading items-center gap-1.5 pb-1.5 border-b border-[#CFC6B8]">
                  <FileText className="w-4 h-4 text-[#9E1B1B]" />
                  <h1 className="font-display text-xs font-extrabold uppercase tracking-wider text-[#1A1816]">
                    Ficha
                  </h1>
                </div>

                <OfficialPage1Header
                  sheet={sheet}
                  allClasses={allClasses}
                  onUpdateSheet={handleUpdateSheet}
                  onOpenConditionsModal={() => setConditionsOpen(true)}
                />

                <ResourcesCountersPanel
                  sheet={sheet}
                  allClasses={allClasses}
                  allSpells={allSpells}
                  onUpdateSheet={handleUpdateSheet}
                />

                <QuickTestsPanel
                  sheet={sheet}
                  allSpells={allSpells}
                  onUpdateSheet={handleUpdateSheet}
                  onRequestRoll={setActiveRollRequest}
                />
              </div>

              {/* COLUNA / ABA 2: VARIÁVEIS (Atributos & Perícias, Armas, Classe/Espécie/Talentos/Custom, Magias) */}
              <div
                data-testid="panel-tab-variaveis"
                data-active={activeTab === 'variaveis' ? 'true' : 'false'}
                className="d20-col-panel official-sheet-page p-2 sm:p-3 space-y-2.5"
              >
                <div className="d20-col-heading items-center gap-1.5 pb-1.5 border-b border-[#CFC6B8]">
                  <Sliders className="w-4 h-4 text-[#9E1B1B]" />
                  <h2 className="font-display text-xs font-extrabold uppercase tracking-wider text-[#1A1816]">
                    Variáveis
                  </h2>
                </div>

                <AbilitiesSkillsPanel
                  sheet={sheet}
                  onUpdateSheet={handleUpdateSheet}
                />

                <AttacksActionsPanel
                  sheet={sheet}
                  onUpdateSheet={handleUpdateSheet}
                />

                <FeaturesPanel
                  sheet={sheet}
                  allClasses={allClasses}
                  allFeats={allFeats}
                  allCreatures={allCreatures}
                  onUpdateSheet={handleUpdateSheet}
                />

                <SpellsPanel
                  sheet={sheet}
                  allClasses={allClasses}
                  allSpells={allSpells}
                  onUpdateSheet={handleUpdateSheet}
                />
              </div>

              {/* COLUNA / ABA 3: EQUIPAMENTOS (Moedas, Equipamentos & Armadura, Sintonização, Idiomas/Aparência/História + Retrato) */}
              <div
                data-testid="panel-tab-equipamentos"
                data-active={activeTab === 'equipamentos' ? 'true' : 'false'}
                className="d20-col-panel official-sheet-page p-2 sm:p-3 space-y-2.5"
              >
                <div className="d20-col-heading items-center gap-1.5 pb-1.5 border-b border-[#CFC6B8]">
                  <Backpack className="w-4 h-4 text-[#8A6518]" />
                  <h2 className="font-display text-xs font-extrabold uppercase tracking-wider text-[#1A1816]">
                    Equipamentos
                  </h2>
                </div>

                <EquipmentIdentityPanel
                  sheet={sheet}
                  onUpdateSheet={handleUpdateSheet}
                />
              </div>
            </div>
          </main>

          {/* Modals */}
          <DiceRollModal
            request={activeRollRequest}
            sheet={sheet}
            onClose={() => setActiveRollRequest(null)}
            onLogResult={handleRecordRoll}
            onConsumeHeroicInspiration={handleConsumeHeroicInspiration}
          />

          <CharacterWizardModal
            key={wizardInstanceKey}
            open={wizardOpen}
            currentSheet={sheet}
            allFeats={allFeats}
            allSpells={allSpells}
            onClose={() => setWizardOpen(false)}
            onApplySheet={(newSheet) => {
              const autoSpellTests = newSheet.magiasPreparadasIds
                .map((id) => allSpells.find((s) => s.id === id))
                .filter((sp): sp is SpellDefinition => Boolean(sp && spellRequiresTest(sp)))
                .map((sp) => `test_spell_${sp.id}`);
              const mergedSelected = Array.from(
                new Set([...(newSheet.testesSelecionadosIds ?? []), ...autoSpellTests])
              );
              commitSheet({ ...newSheet, testesSelecionadosIds: mergedSelected });
              showToast(`Ficha "${newSheet.nome}" salva.`);
            }}
          />

          <RestModal
            mode={restMode}
            sheet={sheet}
            onClose={() => setRestMode(null)}
            onApplyRest={(updated, msg) => {
              commitSheet(updated);
              showToast(msg);
            }}
          />

          <ConditionsGlossaryModal
            open={conditionsOpen}
            sheet={sheet}
            allCreatures={allCreatures}
            onClose={() => setConditionsOpen(false)}
            onUpdateSheet={handleUpdateSheet}
          />

          <DataManagerModal
            open={dataModalOpen}
            sheet={sheet}
            spellCount={allSpells.length}
            creatureCount={allCreatures.length}
            onClose={() => setDataModalOpen(false)}
            onImportSheet={(imported) => {
              commitSheet(imported);
              showToast(`Ficha "${imported.nome || 'Sem Nome'}" carregada.`);
            }}
            onImportCompendiumTxt={handleImportCompendiumTxt}
            onResetDefault={() => {
              handleNewBlankCharacter();
            }}
          />
        </div>
      </CollapsibleSectionsProvider>
    </InfoTipProvider>
  );
}
