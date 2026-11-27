import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Dices,
  ShoppingBag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  AbilityKey,
  CharacterSheet,
  CreatureSize,
  FeatDefinition,
  InventoryItem,
  SkillKey,
  SpellDefinition,
} from '../types/dnd';
import { CLASSES_LIST, CLASS_MAP } from '../data/classes';
import { ABILITIES, POINT_BUY_COST, SKILLS, SKILL_MAP } from '../data/core';
import { BACKGROUNDS_LIST, SPECIES_LIST } from '../data/origins';
import { ADVENTURE_GEAR_CATALOG, ARMORS_LIST, WEAPONS_LIST } from '../data/equipment';
import {
  calculateAC,
  calculateInitiative,
  calculateMaxHP,
  calculateMaxStartingGold,
  calculatePassivePerception,
  calculateSpeed,
  calculateSpellStats,
  calculateTotalGoldValue,
  deductCopperFromCoins,
  formatCopperToCoinsLabel,
  formatSigned,
  getAbilityMod,
  getSpeciesDarkvision,
  getSpeciesInnateSpells,
  hasSpellcastingAccess,
  parseCostToCopper,
  rollDie,
} from '../rules/engine';
import {
  buildCharacterFromWizardConfig,
  type WizardBuildConfig,
} from '../rules/defaultCharacter';

interface CharacterWizardModalProps {
  open: boolean;
  currentSheet: CharacterSheet;
  allFeats: FeatDefinition[];
  allSpells: SpellDefinition[];
  onClose: () => void;
  onApplySheet: (sheet: CharacterSheet) => void;
}

const STEPS = [
  '1. Classe & Nível',
  '2. Origem',
  '3. Atributos',
  '4. Perícias & Talentos',
  '5. Equipamento',
  '6. Magias & Revisão',
];

function extractConfigFromSheet(sheet: CharacterSheet): WizardBuildConfig {
  const selectedSkills = (Object.entries(sheet.periciasProf) as [SkillKey, number][])
    .filter(([, v]) => v >= 1)
    .map(([k]) => k);
  const expertiseSkills = (Object.entries(sheet.periciasProf) as [SkillKey, number][])
    .filter(([, v]) => v === 2)
    .map(([k]) => k);

  const resolvedClass = CLASS_MAP[sheet.classeId] ?? CLASSES_LIST[0];
  const resolvedSpecies = SPECIES_LIST.find((s) => s.id === sheet.especieId) ?? SPECIES_LIST[0];
  const resolvedBg = BACKGROUNDS_LIST.find((b) => b.id === sheet.antecedenteId) ?? BACKGROUNDS_LIST[0];
  const isFromBlank = !sheet.classeId;

  return {
    nome: sheet.nome,
    classeId: resolvedClass.id,
    subclasseId: sheet.subclasseId || resolvedClass.subclasses[0]?.id || '',
    nivel: sheet.nivel,
    especieId: resolvedSpecies.id,
    especieOpcaoId: sheet.especieOpcaoId ?? resolvedSpecies.subOptions?.[0]?.id,
    tamanho: sheet.tamanho || resolvedSpecies.sizes[0] || 'Médio',
    antecedenteId: resolvedBg.id,
    antecedenteEquipOpcao: sheet.antecedenteEquipOpcao ?? 'A',
    alinhamento: sheet.alinhamento || 'Neutro',
    atributos: isFromBlank
      ? { ...resolvedClass.suggestedStandardArray }
      : { ...sheet.atributos },
    selectedSkills: isFromBlank ? [...resolvedBg.skills] : selectedSkills,
    expertiseSkills,
    talentosIds: isFromBlank ? [resolvedBg.originFeatId] : [...sheet.talentosIds],
    armorId: sheet.armorId,
    escudoEquipado: sheet.escudoEquipado,
    weaponIds: sheet.ataques.map((a) => a.weaponId).filter((w): w is string => Boolean(w)),
    preparedSpellIds: [...sheet.magiasPreparadasIds],
    idiomas: sheet.idiomas.length > 0 ? [...sheet.idiomas] : ['Comum'],
    aparencia: sheet.aparencia,
    historia: sheet.historia,
  };
}

export const CharacterWizardModal: React.FC<CharacterWizardModalProps> = ({
  open,
  currentSheet,
  allFeats,
  allSpells,
  onClose,
  onApplySheet,
}) => {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<WizardBuildConfig>(() => extractConfigFromSheet(currentSheet));
  const [spellSearch, setSpellSearch] = useState('');

  // Wizard gold & Step 5 purchase controls (defaults to maximum starting gold)
  const initialMaxGold = calculateMaxStartingGold(cfg.classeId, cfg.antecedenteId);
  const hasExistingCoins = calculateTotalGoldValue(currentSheet.moedas) > 0 && Boolean(currentSheet.classeId);
  const [wizardMoedas, setWizardMoedas] = useState<CharacterSheet['moedas']>(() =>
    hasExistingCoins
      ? { ...currentSheet.moedas }
      : { pc: 0, pp: 0, pe: 0, po: initialMaxGold, pl: 0 }
  );
  const [goldCustomized, setGoldCustomized] = useState(hasExistingCoins);
  const [wizPurchaseMode, setWizPurchaseMode] = useState(true);
  const [wizPriceMult, setWizPriceMult] = useState('1');
  const [wizGearChoice, setWizGearChoice] = useState('');
  const [wizManualName, setWizManualName] = useState('');
  const [wizManualCost, setWizManualCost] = useState('');
  const [wizManualWeight, setWizManualWeight] = useState('0.5');
  const [wizManualProps, setWizManualProps] = useState('');
  const [wizPurchaseNotice, setWizPurchaseNotice] = useState<string | null>(null);

  // Background Attribute Bonus overlay (prevents double-applying when switching backgrounds)
  const initialBg =
    BACKGROUNDS_LIST.find((b) => b.id === currentSheet.antecedenteId) ?? BACKGROUNDS_LIST[0];
  const [bgBonusMode, setBgBonusMode] = useState<'none' | '2_1' | '1_1_1'>('none');
  const [bgPlus2, setBgPlus2] = useState<AbilityKey>(initialBg.abilityOptions[0]);
  const [bgPlus1, setBgPlus1] = useState<AbilityKey>(initialBg.abilityOptions[1]);

  const cls = CLASS_MAP[cfg.classeId] ?? CLASSES_LIST[0];
  const species = SPECIES_LIST.find((s) => s.id === cfg.especieId) ?? SPECIES_LIST[0];
  const bg = BACKGROUNDS_LIST.find((b) => b.id === cfg.antecedenteId) ?? BACKGROUNDS_LIST[0];
  const currentMaxGold = calculateMaxStartingGold(cfg.classeId, cfg.antecedenteId);
  const wizMultNum = Math.max(0, parseFloat(wizPriceMult.replace(',', '.')) || 0);

  const effectiveAtributos = useMemo(() => {
    const out = { ...cfg.atributos };
    if (bgBonusMode === '2_1') {
      const p2 = bg.abilityOptions.includes(bgPlus2) ? bgPlus2 : bg.abilityOptions[0];
      const p1 =
        bg.abilityOptions.includes(bgPlus1) && bgPlus1 !== p2
          ? bgPlus1
          : bg.abilityOptions.find((a) => a !== p2) ?? bg.abilityOptions[1];
      out[p2] = Math.min(20, out[p2] + 2);
      out[p1] = Math.min(20, out[p1] + 1);
    } else if (bgBonusMode === '1_1_1') {
      bg.abilityOptions.forEach((k) => {
        out[k] = Math.min(20, out[k] + 1);
      });
    }
    return out;
  }, [cfg.atributos, bgBonusMode, bgPlus2, bgPlus1, bg.abilityOptions]);

  const effectiveCfg = useMemo<WizardBuildConfig>(
    () => ({ ...cfg, atributos: effectiveAtributos, customMoedas: wizardMoedas }),
    [cfg, effectiveAtributos, wizardMoedas]
  );

  const previewSheet = useMemo(
    () => buildCharacterFromWizardConfig(effectiveCfg, currentSheet),
    [effectiveCfg, currentSheet]
  );
  const previewAc = useMemo(() => calculateAC(previewSheet), [previewSheet]);
  const previewHp = useMemo(() => calculateMaxHP(previewSheet), [previewSheet]);
  const previewInit = useMemo(() => calculateInitiative(previewSheet), [previewSheet]);
  const previewSpeed = useMemo(() => calculateSpeed(previewSheet), [previewSheet]);
  const previewPassPerc = useMemo(() => calculatePassivePerception(previewSheet), [previewSheet]);
  const previewSpellStats = useMemo(() => calculateSpellStats(previewSheet), [previewSheet]);
  const previewCanCast = useMemo(() => hasSpellcastingAccess(previewSheet), [previewSheet]);
  const previewDarkvision = useMemo(
    () => getSpeciesDarkvision(cfg.especieId, cfg.especieOpcaoId),
    [cfg.especieId, cfg.especieOpcaoId]
  );
  const previewInnateSpells = useMemo(
    () => getSpeciesInnateSpells(cfg.especieId, cfg.especieOpcaoId, cfg.nivel),
    [cfg.especieId, cfg.especieOpcaoId, cfg.nivel]
  );

  const pointBuyUsed = useMemo(() => {
    return ABILITIES.reduce((sum, a) => {
      const val = cfg.atributos[a.key];
      return sum + (POINT_BUY_COST[val] ?? 0);
    }, 0);
  }, [cfg.atributos]);

  const classSpells = useMemo(() => {
    const q = spellSearch.trim().toLowerCase();
    const maxCircle =
      cls.spellcasting.progression === 'full'
        ? Math.min(9, Math.ceil(cfg.nivel / 2))
        : cls.spellcasting.progression === 'half'
          ? Math.min(5, Math.ceil(cfg.nivel / 4))
          : cls.spellcasting.progression === 'pact'
            ? Math.min(5, Math.ceil(cfg.nivel / 2))
            : 4;

    return allSpells
      .filter((sp) => {
        if (sp.level > maxCircle) return false;
        const matchesClass = sp.classes.includes(cfg.classeId) || sp.classes.includes('mago');
        if (!matchesClass && !cfg.preparedSpellIds.includes(sp.id)) return false;
        if (q && !sp.name.toLowerCase().includes(q) && !sp.school.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .slice(0, 60);
  }, [allSpells, cfg.classeId, cfg.nivel, cfg.preparedSpellIds, cls.spellcasting.progression, spellSearch]);

  if (!open) return null;

  const handleClassChange = (newClassId: string) => {
    const nextCls = CLASS_MAP[newClassId] ?? CLASSES_LIST[0];
    const defaultArmor = nextCls.armorTraining.pesada
      ? 'cota_malha'
      : nextCls.armorTraining.media
        ? 'brunea'
        : nextCls.armorTraining.leve
          ? 'couro_batido'
          : 'nenhuma';
    const defaultShield = nextCls.armorTraining.escudos && nextCls.id !== 'barbaro';
    const defaultWeapon =
      nextCls.id === 'barbaro'
        ? ['machado_grande', 'azagaia']
        : nextCls.id === 'ladino'
          ? ['espada_curta', 'adaga', 'arco_curto']
          : nextCls.id === 'mago' || nextCls.id === 'feiticeiro'
            ? ['bordao', 'adaga']
            : nextCls.id === 'monge'
              ? ['espada_curta', 'dardo']
              : nextCls.id === 'guardiao'
                ? ['arco_longo', 'espada_curta']
                : ['espada_longa', 'azagaia'];

    if (!goldCustomized) {
      setWizardMoedas({
        pc: 0,
        pp: 0,
        pe: 0,
        po: calculateMaxStartingGold(newClassId, cfg.antecedenteId),
        pl: 0,
      });
    }

    setCfg((prev) => ({
      ...prev,
      classeId: newClassId,
      subclasseId: nextCls.subclasses[0]?.id ?? '',
      armorId: defaultArmor,
      escudoEquipado: defaultShield,
      weaponIds: defaultWeapon,
      atributos: { ...nextCls.suggestedStandardArray },
    }));
  };

  const handleSpeciesChange = (newSpeciesId: string) => {
    const nextSp = SPECIES_LIST.find((s) => s.id === newSpeciesId);
    if (!nextSp) return;
    setCfg((prev) => ({
      ...prev,
      especieId: nextSp.id,
      especieOpcaoId: nextSp.subOptions?.[0]?.id,
      tamanho: nextSp.sizes[0] ?? 'Médio',
    }));
  };

  const handleBackgroundChange = (newBgId: string) => {
    const prevBg = BACKGROUNDS_LIST.find((b) => b.id === cfg.antecedenteId);
    const nextBg = BACKGROUNDS_LIST.find((b) => b.id === newBgId);
    if (!nextBg) return;

    setBgPlus2(nextBg.abilityOptions[0]);
    setBgPlus1(nextBg.abilityOptions[1]);
    setBgBonusMode('2_1');

    if (!goldCustomized) {
      setWizardMoedas({
        pc: 0,
        pp: 0,
        pe: 0,
        po: calculateMaxStartingGold(cfg.classeId, newBgId),
        pl: 0,
      });
    }

    setCfg((prev) => {
      const filteredFeats = prevBg
        ? prev.talentosIds.filter((fid) => fid !== prevBg.originFeatId)
        : prev.talentosIds;
      const filteredSkills = prevBg
        ? prev.selectedSkills.filter((sk) => !prevBg.skills.includes(sk))
        : prev.selectedSkills;

      return {
        ...prev,
        antecedenteId: newBgId,
        talentosIds: Array.from(new Set([nextBg.originFeatId, ...filteredFeats])),
        selectedSkills: Array.from(new Set([...nextBg.skills, ...filteredSkills])),
      };
    });
  };

  const handleRoll4d6 = () => {
    const nextAttrs = { ...cfg.atributos };
    for (const a of ABILITIES) {
      const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((x, y) => y - x);
      nextAttrs[a.key] = rolls[0] + rolls[1] + rolls[2];
    }
    setCfg((prev) => ({ ...prev, atributos: nextAttrs }));
  };

  const toggleSkill = (sk: SkillKey) => {
    setCfg((prev) => {
      const exists = prev.selectedSkills.includes(sk);
      return {
        ...prev,
        selectedSkills: exists
          ? prev.selectedSkills.filter((s) => s !== sk)
          : [...prev.selectedSkills, sk],
      };
    });
  };

  const toggleFeat = (fid: string) => {
    setCfg((prev) => {
      const exists = prev.talentosIds.includes(fid);
      return {
        ...prev,
        talentosIds: exists ? prev.talentosIds.filter((f) => f !== fid) : [...prev.talentosIds, fid],
      };
    });
  };

  const toggleWeapon = (wid: string) => {
    const exists = cfg.weaponIds.includes(wid);
    const weapon = WEAPONS_LIST.find((w) => w.id === wid);
    if (!exists && wizPurchaseMode && weapon) {
      const costCopper = Math.round(parseCostToCopper(weapon.cost) * wizMultNum);
      if (costCopper > 0) {
        const res = deductCopperFromCoins(wizardMoedas, costCopper);
        setWizardMoedas(res.moedas);
        setGoldCustomized(true);
        setWizPurchaseNotice(
          `Comprado: ${weapon.name} (−${formatCopperToCoinsLabel(costCopper)} · ${wizMultNum}x)`
        );
      }
    }
    setCfg((prev) => ({
      ...prev,
      weaponIds: exists ? prev.weaponIds.filter((w) => w !== wid) : [...prev.weaponIds, wid],
    }));
  };

  const handleWizardAddGear = () => {
    const gear = ADVENTURE_GEAR_CATALOG.find((g) => g.name === wizGearChoice);
    if (!gear) return;
    const costCopper = wizPurchaseMode ? Math.round(parseCostToCopper(gear.cost) * wizMultNum) : 0;
    if (wizPurchaseMode && costCopper > 0) {
      const res = deductCopperFromCoins(wizardMoedas, costCopper);
      setWizardMoedas(res.moedas);
      setGoldCustomized(true);
      setWizPurchaseNotice(
        `Comprado: ${gear.name} (−${formatCopperToCoinsLabel(costCopper)} · ${wizMultNum}x)`
      );
    } else {
      setWizPurchaseNotice(`Adicionado grátis: ${gear.name}`);
    }
    const item: InventoryItem = {
      id: `wiz_gear_${Date.now()}`,
      name: gear.name,
      quantity: 1,
      weightKg: gear.weightKg,
      cost: gear.cost,
      description: gear.notes,
      notes: gear.notes,
      purchased: wizPurchaseMode,
      priceMultiplier: wizPurchaseMode ? wizMultNum : undefined,
      paidCopper: costCopper,
    };
    setCfg((prev) => ({
      ...prev,
      extraEquipment: [...(prev.extraEquipment ?? []), item],
    }));
    setWizGearChoice('');
  };

  const handleWizardAddManualItem = () => {
    const name = wizManualName.trim();
    if (!name) return;
    const weightKg = Math.max(0, parseFloat(wizManualWeight.replace(',', '.')) || 0);
    const costCopper = wizPurchaseMode
      ? Math.round(parseCostToCopper(wizManualCost) * wizMultNum)
      : 0;
    if (wizPurchaseMode && costCopper > 0) {
      const res = deductCopperFromCoins(wizardMoedas, costCopper);
      setWizardMoedas(res.moedas);
      setGoldCustomized(true);
      setWizPurchaseNotice(
        `Comprado: ${name} (−${formatCopperToCoinsLabel(costCopper)} · ${wizMultNum}x)`
      );
    } else {
      setWizPurchaseNotice(`Adicionado: ${name}`);
    }
    const item: InventoryItem = {
      id: `wiz_man_${Date.now()}`,
      name,
      quantity: 1,
      weightKg,
      cost: wizManualCost.trim() || undefined,
      properties: wizManualProps.trim() || undefined,
      notes: wizManualProps.trim() || undefined,
      purchased: wizPurchaseMode,
      priceMultiplier: wizPurchaseMode ? wizMultNum : undefined,
      paidCopper: costCopper,
    };
    setCfg((prev) => ({
      ...prev,
      extraEquipment: [...(prev.extraEquipment ?? []), item],
    }));
    setWizManualName('');
    setWizManualCost('');
    setWizManualWeight('0.5');
    setWizManualProps('');
  };

  const toggleSpell = (sid: string) => {
    setCfg((prev) => {
      const exists = prev.preparedSpellIds.includes(sid);
      return {
        ...prev,
        preparedSpellIds: exists
          ? prev.preparedSpellIds.filter((s) => s !== sid)
          : [...prev.preparedSpellIds, sid],
      };
    });
  };

  const handleFinish = () => {
    onApplySheet(previewSheet);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1A1816]/65 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl bg-[#FDFCFA] border border-[#C8BFB0] rounded-t-xl sm:rounded-lg shadow-2xl overflow-hidden max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E3DDD2] bg-[#F7F4EC]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A6518]">
              Assistente Guiado · Regras Oficiais D&D 2024
            </p>
            <h2 id="wizard-modal-title" className="font-display text-lg font-bold text-[#1A1816]">
              Criar / Editar Personagem
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar assistente de personagem"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded text-[#6B6258] hover:bg-[#EAE4D7] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Derived Stats Preview Bar */}
        <div className="px-5 py-2.5 bg-[#1A1816] text-[#FDFCFA] flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <strong className="text-[#E5C068]">CA:</strong> {previewAc.total}
            </span>
            <span>
              <strong className="text-[#E5C068]">PV:</strong> {previewHp}
            </span>
            <span>
              <strong className="text-[#E5C068]">Inic:</strong> {formatSigned(previewInit.total)}
            </span>
            <span>
              <strong className="text-[#E5C068]">PP:</strong> {previewPassPerc}
            </span>
            {previewCanCast && (
              <span>
                <strong className="text-[#E5C068]">CD Magia:</strong> {previewSpellStats.spellSaveDc}
              </span>
            )}
          </div>
          <span className="font-sans text-[11px] text-[#C8BFB0]">
            {cls.name} Nv {cfg.nivel} · {species.name}
          </span>
        </div>

        {/* Step Navigation Pills */}
        <div className="px-5 py-2.5 border-b border-[#E3DDD2] bg-[#FAF8F3] flex items-center gap-1.5 overflow-x-auto">
          {STEPS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(idx)}
              className={`min-h-[34px] px-2.5 rounded border text-xs font-semibold whitespace-nowrap cursor-pointer ${
                step === idx
                  ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                  : 'border-[#D4CCC0] bg-white text-[#574E46] hover:border-[#1A1816]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* STEP 1: Nome, Nível, Classe e Subclasse */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="wiz-name" className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-1">
                    Nome do Personagem
                  </label>
                  <input
                    id="wiz-name"
                    type="text"
                    placeholder="Digite o nome do personagem..."
                    value={cfg.nome}
                    onChange={(e) => setCfg((p) => ({ ...p, nome: e.target.value }))}
                    className="w-full min-h-[40px] px-3 rounded border border-[#D4CCC0] bg-[#FAF8F3] text-sm font-semibold text-[#1A1816]"
                  />
                </div>
                <div>
                  <label htmlFor="wiz-level" className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-1">
                    Nível (1–20)
                  </label>
                  <select
                    id="wiz-level"
                    data-testid="wizard-level-select"
                    value={cfg.nivel}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        nivel: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)),
                      }))
                    }
                    className="w-full min-h-[40px] px-3 rounded border border-[#D4CCC0] bg-[#FAF8F3] font-mono text-sm font-bold text-[#1A1816] tabular-nums cursor-pointer"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Nível {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class Selection Grid */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-2">
                  Classe (12 Classes Oficiais)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CLASSES_LIST.map((c) => {
                    const active = cfg.classeId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        data-testid={`wizard-class-${c.id}`}
                        onClick={() => handleClassChange(c.id)}
                        className={`text-left p-2.5 rounded border transition-colors cursor-pointer ${
                          active
                            ? 'border-[#9E1B1B] bg-[#FCEAEA]'
                            : 'border-[#D4CCC0] bg-[#FAF8F3] hover:border-[#1A1816]'
                        }`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-bold text-sm text-[#1A1816]">{c.name}</span>
                          <span className="font-mono text-[11px] text-[#7A6F64]">d{c.hitDie}</span>
                        </div>
                        <p className="text-[11px] text-[#6B6258] mt-0.5">
                          {c.spellcasting.progression === 'none'
                            ? 'Marcial'
                            : c.spellcasting.progression === 'pact'
                              ? 'Magia de Pacto'
                              : c.spellcasting.progression === 'half'
                                ? 'Meio-Conjurador'
                                : 'Conjurador Pleno'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subclass Selector (Nv 3+) */}
              <div>
                <label htmlFor="wiz-subclass" className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-1">
                  Subclasse {cfg.nivel < 3 ? '(desbloqueada no Nível 3)' : '(4 opções oficiais)'}
                </label>
                <select
                  id="wiz-subclass"
                  disabled={cfg.nivel < 3}
                  value={cfg.subclasseId}
                  onChange={(e) => setCfg((p) => ({ ...p, subclasseId: e.target.value }))}
                  className="w-full min-h-[40px] px-3 rounded border border-[#D4CCC0] bg-[#FAF8F3] text-xs font-semibold text-[#1A1816] disabled:opacity-50"
                >
                  {cls.subclasses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.summary}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Espécie & Antecedente */}
          {step === 1 && (
            <div className="space-y-4">
              {/* 10 Espécies */}
              <div className="space-y-2.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6258]">
                  Espécie (10 Espécies Oficiais)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SPECIES_LIST.map((sp) => {
                    const active = cfg.especieId === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        data-testid={`wizard-species-${sp.id}`}
                        onClick={() => handleSpeciesChange(sp.id)}
                        className={`text-left p-2.5 rounded border cursor-pointer ${
                          active
                            ? 'border-[#9E1B1B] bg-[#FCEAEA]'
                            : 'border-[#D4CCC0] bg-[#FAF8F3] hover:border-[#1A1816]'
                        }`}
                      >
                        <p className="font-bold text-sm text-[#1A1816]">{sp.name}</p>
                        <p className="text-[11px] text-[#6B6258]">
                          {sp.speed}m · {sp.sizes.join('/')}
                          {sp.darkvision ? ` · VE ${sp.darkvision}m` : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Tamanho (when species allows Médio or Pequeno) */}
                {species.sizes.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6258]">
                      Tamanho:
                    </span>
                    {species.sizes.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setCfg((p) => ({ ...p, tamanho: sz as CreatureSize }))}
                        className={`min-h-[34px] px-3 py-1 rounded border font-semibold cursor-pointer ${
                          cfg.tamanho === sz
                            ? 'border-[#1A1816] bg-[#1A1816] text-white'
                            : 'border-[#D4CCC0] bg-white text-[#4D453E]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                )}

                {/* Linhagem / Ancestralidade / Legado (Sub-opção de Espécie) */}
                {species.subOptions && species.subOptions.length > 0 && (
                  <div>
                    <label
                      htmlFor="wiz-species-suboption"
                      className="block text-[11px] font-bold uppercase tracking-wider text-[#7A5610] mb-1"
                    >
                      {species.subOptionLabel ?? 'Linhagem / Ancestralidade'}
                    </label>
                    <select
                      id="wiz-species-suboption"
                      data-testid="wizard-species-suboption"
                      value={cfg.especieOpcaoId ?? species.subOptions[0].id}
                      onChange={(e) =>
                        setCfg((p) => ({ ...p, especieOpcaoId: e.target.value }))
                      }
                      className="w-full min-h-[40px] px-3 rounded border border-[#DFD1AE] bg-[#FBF7EC] text-xs font-semibold text-[#1A1816]"
                    >
                      {species.subOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} — {opt.summary}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Live Species Traits & Senses Preview */}
                <div className="p-3 rounded border border-[#E3DDD2] bg-[#FAF8F3] space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-[#1A1816]">
                      {species.name} · {species.creatureType} · Desl. {previewSpeed.totalMeters} m
                      {previewDarkvision > 0 ? ` · Visão no Escuro ${previewDarkvision} m` : ''}
                    </span>
                    {previewInnateSpells.length > 0 && (
                      <span className="font-semibold text-[#7A5610]">
                        +{previewInnateSpells.length} magia(s) inata(s) no Nv {cfg.nivel}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#574E46] leading-relaxed">
                    <strong>Traços:</strong> {species.traits.map((t) => t.name).join(' · ')}
                  </p>
                </div>
              </div>

              {/* 16 Antecedentes */}
              <div className="space-y-3 pt-2 border-t border-[#E5DFD3]">
                <div>
                  <label
                    htmlFor="wiz-bg"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-1.5"
                  >
                    Antecedente (16 Antecedentes Oficiais)
                  </label>
                  <select
                    id="wiz-bg"
                    data-testid="wizard-bg-select"
                    value={cfg.antecedenteId}
                    onChange={(e) => handleBackgroundChange(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded border border-[#D4CCC0] bg-[#FAF8F3] text-xs font-semibold text-[#1A1816]"
                  >
                    {BACKGROUNDS_LIST.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.abilityOptions.map((a) => a.toUpperCase()).join('/')} · Talento: {b.originFeatLabel}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#574E46] mt-1.5">{bg.description}</p>
                </div>

                {/* Auto-Applied Background Summary */}
                <div className="p-3 rounded border border-[#DFD1AE] bg-[#FBF7EC] space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="block font-bold uppercase tracking-wider text-[#7A5610]">
                        Talento de Origem
                      </span>
                      <span className="font-semibold text-[#1A1816]">{bg.originFeatLabel}</span>
                    </div>
                    <div>
                      <span className="block font-bold uppercase tracking-wider text-[#7A5610]">
                        Perícias (+2)
                      </span>
                      <span className="font-semibold text-[#1A1816]">
                        {bg.skills.map((s) => SKILL_MAP[s].label).join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="block font-bold uppercase tracking-wider text-[#7A5610]">
                        Ferramenta
                      </span>
                      <span className="font-semibold text-[#1A1816]">{bg.tool}</span>
                    </div>
                  </div>

                  {/* Interactive Background Ability Score Bonus (+2/+1 or +1/+1/+1) */}
                  <div className="pt-2 border-t border-[#E6DAB9] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A5610]">
                        Bônus de Atributos do Antecedente ({bg.abilityOptions.map((a) => a.toUpperCase()).join(', ')})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="bg-bonus-2-1"
                          onClick={() => setBgBonusMode('2_1')}
                          className={`min-h-[32px] px-2.5 rounded border text-[11px] font-semibold cursor-pointer ${
                            bgBonusMode === '2_1'
                              ? 'border-[#1A1816] bg-[#1A1816] text-white'
                              : 'border-[#D4C39A] bg-white text-[#4D453E]'
                          }`}
                        >
                          +2 / +1
                        </button>
                        <button
                          type="button"
                          data-testid="bg-bonus-1-1-1"
                          onClick={() => setBgBonusMode('1_1_1')}
                          className={`min-h-[32px] px-2.5 rounded border text-[11px] font-semibold cursor-pointer ${
                            bgBonusMode === '1_1_1'
                              ? 'border-[#1A1816] bg-[#1A1816] text-white'
                              : 'border-[#D4C39A] bg-white text-[#4D453E]'
                          }`}
                        >
                          +1 / +1 / +1
                        </button>
                        <button
                          type="button"
                          onClick={() => setBgBonusMode('none')}
                          className={`min-h-[32px] px-2 rounded border text-[11px] font-semibold cursor-pointer ${
                            bgBonusMode === 'none'
                              ? 'border-[#9E1B1B] bg-[#FCEAEA] text-[#8B1717]'
                              : 'border-[#D4C39A] bg-white text-[#6B6258]'
                          }`}
                        >
                          Manual
                        </button>
                      </div>
                    </div>

                    {bgBonusMode === '2_1' && (
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className="inline-flex items-center gap-1.5">
                          <span className="font-bold text-[#9E1B1B]">+2 em:</span>
                          <select
                            aria-label="Atributo que recebe +2 do antecedente"
                            data-testid="bg-plus2-select"
                            value={bg.abilityOptions.includes(bgPlus2) ? bgPlus2 : bg.abilityOptions[0]}
                            onChange={(e) => {
                              const next2 = e.target.value as AbilityKey;
                              setBgPlus2(next2);
                              if (bgPlus1 === next2) {
                                const alt = bg.abilityOptions.find((a) => a !== next2);
                                if (alt) setBgPlus1(alt);
                              }
                            }}
                            className="min-h-[32px] px-2 rounded border border-[#D4C39A] bg-white font-semibold"
                          >
                            {bg.abilityOptions.map((a) => (
                              <option key={a} value={a}>
                                {a.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="inline-flex items-center gap-1.5">
                          <span className="font-bold text-[#7A5610]">+1 em:</span>
                          <select
                            aria-label="Atributo que recebe +1 do antecedente"
                            data-testid="bg-plus1-select"
                            value={
                              bg.abilityOptions.includes(bgPlus1) && bgPlus1 !== bgPlus2
                                ? bgPlus1
                                : bg.abilityOptions.find((a) => a !== bgPlus2) ?? bg.abilityOptions[1]
                            }
                            onChange={(e) => setBgPlus1(e.target.value as AbilityKey)}
                            className="min-h-[32px] px-2 rounded border border-[#D4C39A] bg-white font-semibold"
                          >
                            {bg.abilityOptions
                              .filter((a) => a !== (bg.abilityOptions.includes(bgPlus2) ? bgPlus2 : bg.abilityOptions[0]))
                              .map((a) => (
                                <option key={a} value={a}>
                                  {a.toUpperCase()}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Equipamento Inicial do Antecedente: Opção A vs Opção B (50 PO) */}
                  <div className="pt-2 border-t border-[#E6DAB9] space-y-1.5">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-[#7A5610]">
                      Equipamento Inicial do Antecedente
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-testid="bg-equip-option-a"
                        onClick={() => setCfg((p) => ({ ...p, antecedenteEquipOpcao: 'A' }))}
                        className={`text-left p-2.5 rounded border cursor-pointer ${
                          (cfg.antecedenteEquipOpcao ?? 'A') === 'A'
                            ? 'border-[#1A1816] bg-white ring-1 ring-[#1A1816]'
                            : 'border-[#D4C39A] bg-[#FAF8F3] text-[#574E46]'
                        }`}
                      >
                        <p className="font-bold text-[#1A1816]">
                          Opção A — Pacote + {bg.startingGold} PO
                        </p>
                        <p className="text-[11px] text-[#6B6258] mt-0.5 line-clamp-2">
                          {bg.startingEquipment.join(', ')}
                        </p>
                      </button>

                      <button
                        type="button"
                        data-testid="bg-equip-option-b"
                        onClick={() => setCfg((p) => ({ ...p, antecedenteEquipOpcao: 'B' }))}
                        className={`text-left p-2.5 rounded border cursor-pointer ${
                          cfg.antecedenteEquipOpcao === 'B'
                            ? 'border-[#1A1816] bg-white ring-1 ring-[#1A1816]'
                            : 'border-[#D4C39A] bg-[#FAF8F3] text-[#574E46]'
                        }`}
                      >
                        <p className="font-bold text-[#1A1816]">
                          Opção B — {bg.optionBGold ?? 50} PO
                        </p>
                        <p className="text-[11px] text-[#6B6258] mt-0.5">
                          Ouro livre para comprar seu próprio equipamento inicial (regra 2024).
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Atributos */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCfg((p) => ({ ...p, atributos: { ...cls.suggestedStandardArray } }))
                  }
                  className="min-h-[38px] px-3 rounded border border-[#1A1816] bg-[#1A1816] text-white font-semibold cursor-pointer"
                >
                  Conjunto Padrão ({cls.name})
                </button>
                <button
                  type="button"
                  onClick={handleRoll4d6}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded border border-[#9E1B1B] bg-[#FCEAEA] text-[#8B1717] font-semibold cursor-pointer"
                >
                  <Dices className="w-4 h-4" />
                  Rolar 4d6 (descarta menor)
                </button>
                <button
                  type="button"
                  onClick={() => setBgBonusMode(bgBonusMode === '2_1' ? 'none' : '2_1')}
                  className={`min-h-[38px] px-3 rounded border font-semibold cursor-pointer ${
                    bgBonusMode === '2_1'
                      ? 'border-[#8A6518] bg-[#8A6518] text-white'
                      : 'border-[#B08D3B] bg-[#FBF6E6] text-[#7A5610]'
                  }`}
                >
                  Antecedente +2 / +1 ({bgPlus2.toUpperCase()}/{bgPlus1.toUpperCase()})
                </button>
                <button
                  type="button"
                  onClick={() => setBgBonusMode(bgBonusMode === '1_1_1' ? 'none' : '1_1_1')}
                  className={`min-h-[38px] px-3 rounded border font-semibold cursor-pointer ${
                    bgBonusMode === '1_1_1'
                      ? 'border-[#8A6518] bg-[#8A6518] text-white'
                      : 'border-[#D4CCC0] bg-white text-[#4D453E]'
                  }`}
                >
                  +1 / +1 / +1 ({bg.abilityOptions.map((a) => a.toUpperCase()).join(', ')})
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-[#574E46]">
                <span>Compra por Pontos (base 8–15):</span>
                <span className="font-mono font-bold">
                  {pointBuyUsed} / 27 pts
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ABILITIES.map((a) => {
                  const baseVal = cfg.atributos[a.key];
                  const finalVal = effectiveAtributos[a.key];
                  const bonusFromBg = finalVal - baseVal;
                  const mod = getAbilityMod(finalVal);
                  return (
                    <div
                      key={a.key}
                      className="p-3 rounded border border-[#D4CCC0] bg-[#FAF8F3] flex flex-col items-center gap-1.5"
                    >
                      <span className="font-display font-bold text-sm text-[#1A1816]">{a.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCfg((p) => ({
                              ...p,
                              atributos: { ...p.atributos, [a.key]: Math.max(3, baseVal - 1) },
                            }))
                          }
                          className="w-8 h-8 rounded border border-[#C8BFB0] bg-white font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono text-2xl font-extrabold text-[#1A1816] min-w-[36px] text-center tabular-nums">
                          {finalVal}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCfg((p) => ({
                              ...p,
                              atributos: { ...p.atributos, [a.key]: Math.min(20, baseVal + 1) },
                            }))
                          }
                          className="w-8 h-8 rounded border border-[#C8BFB0] bg-white font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#9E1B1B]">
                        Mod {formatSigned(mod)}
                        {bonusFromBg > 0 && (
                          <span className="text-[#7A5610] ml-1">(+{bonusFromBg} Orig.)</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Perícias & Talentos */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Destaque igualitário: Perícias do Antecedente vs Perícias da Classe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  data-testid="wizard-bg-skills-box"
                  className="p-2.5 rounded border border-[#DFD1AE] bg-[#FBF7EC] space-y-1"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A5610]">
                    Perícias do Antecedente ({bg.name})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {bg.skills.map((sk) => (
                      <span
                        key={sk}
                        className="px-2 py-0.5 rounded bg-[#8A6518] text-white text-[11px] font-bold"
                      >
                        {SKILL_MAP[sk].label}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  data-testid="wizard-class-skills-box"
                  className="p-2.5 rounded border border-[#D4CCC0] bg-[#FAF8F3] space-y-1"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#1A1816]">
                    Perícias da Classe ({cls.name})
                  </p>
                  <p className="text-[11px] text-[#574E46]">
                    Escolha <strong>{cls.skillCount}</strong>{' '}
                    {cls.skillChoices === 'any'
                      ? 'perícias quaisquer'
                      : `entre: ${cls.skillChoices.map((k) => SKILL_MAP[k].label).join(', ')}`}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-2">
                  Todas as Perícias ({cfg.selectedSkills.length} selecionadas · {cls.skillCount}{' '}
                  Classe + 2 Antecedente)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {SKILLS.map((sk) => {
                    const active = cfg.selectedSkills.includes(sk.key);
                    const fromBg = bg.skills.includes(sk.key);
                    const isClassOption =
                      cls.skillChoices === 'any' || cls.skillChoices.includes(sk.key);
                    return (
                      <button
                        key={sk.key}
                        type="button"
                        onClick={() => toggleSkill(sk.key)}
                        className={`min-h-[38px] px-2.5 py-1.5 rounded border text-left flex items-center justify-between gap-1 cursor-pointer ${
                          active
                            ? fromBg
                              ? 'border-[#8A6518] bg-[#8A6518] text-white'
                              : 'border-[#1A1816] bg-[#1A1816] text-white'
                            : 'border-[#D4CCC0] bg-[#FAF8F3] text-[#3F3934]'
                        }`}
                      >
                        <span className="truncate font-medium inline-flex items-center gap-1 min-w-0">
                          <span className="truncate">{sk.label}</span>
                          {fromBg ? (
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1 rounded shrink-0 ${
                                active ? 'bg-white/20 text-white' : 'bg-[#FBF4DC] text-[#7A5610]'
                              }`}
                            >
                              Antec.
                            </span>
                          ) : isClassOption ? (
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1 rounded shrink-0 ${
                                active ? 'bg-white/20 text-white' : 'bg-[#EFEAE0] text-[#5C534A]'
                              }`}
                            >
                              Classe
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-[10px] opacity-75 uppercase shrink-0">
                          {sk.ability}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-2">
                  Talentos Ativos ({cfg.talentosIds.length} selecionado(s))
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {allFeats.map((f) => {
                    const active = cfg.talentosIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFeat(f.id)}
                        className={`text-left p-2 rounded border cursor-pointer ${
                          active
                            ? 'border-[#8A6518] bg-[#FBF6E6]'
                            : 'border-[#E3DDD2] bg-[#FAF8F3] hover:border-[#8A6518]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#1A1816]">{f.name}</span>
                          <span className="text-[10px] text-[#7A6F64]">{f.category}</span>
                        </div>
                        <p className="text-[11px] text-[#574E46] line-clamp-1 mt-0.5">{f.summary}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Equipamento, Ouro Inicial Máximo & Compras */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Ouro Inicial Máximo & Modo de Compra */}
              <div className="p-3 rounded border border-[#DFD1AE] bg-[#FBF7EC] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-[#8A6518]" />
                    <span className="font-bold text-xs text-[#1A1816]">
                      Ouro Inicial Máximo ({cls.name} + {bg.name}: {currentMaxGold} PO)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="wiz-gold-po" className="text-[11px] font-bold text-[#7A5610]">
                      PO:
                    </label>
                    <input
                      id="wiz-gold-po"
                      data-testid="wizard-gold-po-input"
                      type="number"
                      min={0}
                      value={wizardMoedas.po}
                      onChange={(e) => {
                        setGoldCustomized(true);
                        setWizardMoedas((m) => ({
                          ...m,
                          po: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }));
                      }}
                      className="w-16 h-7 px-1.5 rounded border border-[#B08D3B] bg-white font-mono text-xs font-extrabold text-center"
                    />
                    <span className="font-mono text-[10px] text-[#5C534A]">
                      Total: {calculateTotalGoldValue(wizardMoedas)} PO
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setGoldCustomized(false);
                        setWizardMoedas({ pc: 0, pp: 0, pe: 0, po: currentMaxGold, pl: 0 });
                        setWizPurchaseNotice(null);
                      }}
                      className="px-2 py-1 rounded border border-[#B08D3B] bg-white text-[10px] font-bold text-[#7A5610] hover:bg-[#F3E7C4] cursor-pointer"
                    >
                      Restaurar Máx.
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#E6DAB9]">
                  <span className="text-[11px] font-bold text-[#1A1816] inline-flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#7A5610]" />
                    Itens adicionados foram comprados?
                  </span>
                  <div className="inline-flex rounded border border-[#B08D3B] bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setWizPurchaseMode(false)}
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-bold cursor-pointer ${
                        !wizPurchaseMode ? 'bg-[#1A1816] text-white' : 'text-[#5C534A]'
                      }`}
                    >
                      Não (Grátis)
                    </button>
                    <button
                      type="button"
                      data-testid="wizard-purchase-toggle"
                      onClick={() => setWizPurchaseMode(true)}
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-bold cursor-pointer ${
                        wizPurchaseMode ? 'bg-[#8A6518] text-white' : 'text-[#5C534A]'
                      }`}
                    >
                      Sim (Deduzir)
                    </button>
                  </div>
                </div>

                {wizPurchaseMode && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[10px] font-bold text-[#7A5610]">Multiplicador:</span>
                    {[0.5, 0.8, 1, 1.2, 1.5, 2].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWizPriceMult(String(m))}
                        className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold cursor-pointer ${
                          wizMultNum === m
                            ? 'border-[#8A6518] bg-[#8A6518] text-white'
                            : 'border-[#D4C39A] bg-white text-[#4D453E]'
                        }`}
                      >
                        {m}x
                      </button>
                    ))}
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      data-testid="wizard-price-mult-input"
                      aria-label="Multiplicador de preço no assistente"
                      value={wizPriceMult}
                      onChange={(e) => setWizPriceMult(e.target.value)}
                      className="w-14 h-6 px-1 rounded border border-[#B08D3B] bg-white font-mono text-[11px] font-bold text-center"
                    />
                  </div>
                )}

                {wizPurchaseNotice && (
                  <p className="text-[11px] font-semibold text-[#1B5737] bg-[#EEF6F0] border border-[#B6D4BE] rounded px-2 py-1">
                    {wizPurchaseNotice}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wiz-armor" className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-1">
                    Armadura Equipada
                  </label>
                  <select
                    id="wiz-armor"
                    value={cfg.armorId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const armor = ARMORS_LIST.find((a) => a.id === nextId);
                      if (wizPurchaseMode && armor && armor.id !== 'nenhuma') {
                        const costCopper = Math.round(parseCostToCopper(armor.cost) * wizMultNum);
                        if (costCopper > 0) {
                          const res = deductCopperFromCoins(wizardMoedas, costCopper);
                          setWizardMoedas(res.moedas);
                          setGoldCustomized(true);
                          setWizPurchaseNotice(
                            `Comprado: ${armor.name} (−${formatCopperToCoinsLabel(costCopper)} · ${wizMultNum}x)`
                          );
                        }
                      }
                      setCfg((p) => ({ ...p, armorId: nextId }));
                    }}
                    className="w-full min-h-[40px] px-2.5 rounded border border-[#D4CCC0] bg-[#FAF8F3] text-xs font-semibold"
                  >
                    {ARMORS_LIST.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.category} · CA {a.baseAc} · {a.cost})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      const nextEquipped = !cfg.escudoEquipado;
                      if (nextEquipped && wizPurchaseMode) {
                        const costCopper = Math.round(parseCostToCopper('10 PO') * wizMultNum);
                        const res = deductCopperFromCoins(wizardMoedas, costCopper);
                        setWizardMoedas(res.moedas);
                        setGoldCustomized(true);
                        setWizPurchaseNotice(
                          `Comprado: Escudo (−${formatCopperToCoinsLabel(costCopper)} · ${wizMultNum}x)`
                        );
                      }
                      setCfg((p) => ({ ...p, escudoEquipado: nextEquipped }));
                    }}
                    className={`w-full min-h-[40px] px-3 rounded border font-semibold cursor-pointer ${
                      cfg.escudoEquipado
                        ? 'border-[#1A1816] bg-[#1A1816] text-white'
                        : 'border-[#D4CCC0] bg-[#FAF8F3] text-[#4D453E]'
                    }`}
                  >
                    {cfg.escudoEquipado ? 'Escudo Equipado (+2 CA)' : 'Sem Escudo (10 PO)'}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B6258] mb-2">
                  Armas Equipadas ({cfg.weaponIds.length} selecionada(s))
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {WEAPONS_LIST.map((w) => {
                    const active = cfg.weaponIds.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWeapon(w.id)}
                        className={`text-left p-2 rounded border cursor-pointer ${
                          active
                            ? 'border-[#9E1B1B] bg-[#FCEAEA]'
                            : 'border-[#E3DDD2] bg-[#FAF8F3] hover:border-[#9E1B1B]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#1A1816]">{w.name}</span>
                          <span className="font-mono text-[11px] text-[#7A6F64]">
                            {w.damageDice} · {w.cost}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B6258] mt-0.5">
                          Maestria: {w.mastery} · {w.properties.join(', ') || w.category}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extra Catalog Gear & Manual Items inside Wizard */}
              <div className="p-2.5 rounded border border-[#D4CCC0] bg-[#FAF8F3] space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#5C534A]">
                  Equipamentos Adicionais (Catálogo ou Manual)
                </p>
                <div className="flex gap-1.5">
                  <select
                    aria-label="Equipamento de aventura"
                    value={wizGearChoice}
                    onChange={(e) => setWizGearChoice(e.target.value)}
                    className="flex-1 min-w-0 min-h-[34px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
                  >
                    <option value="">Selecionar equipamento do catálogo...</option>
                    {ADVENTURE_GEAR_CATALOG.map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name} ({g.cost} · {g.weightKg} kg)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleWizardAddGear}
                    className="min-h-[34px] px-3 rounded bg-[#1A1816] text-white text-xs font-bold cursor-pointer shrink-0"
                  >
                    + Catálogo
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-1.5">
                  <input
                    type="text"
                    placeholder="Item manual..."
                    value={wizManualName}
                    onChange={(e) => setWizManualName(e.target.value)}
                    className="col-span-12 sm:col-span-5 min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Custo (5 PO)"
                    value={wizManualCost}
                    onChange={(e) => setWizManualCost(e.target.value)}
                    className="col-span-4 sm:col-span-2 min-h-[32px] px-1.5 rounded border border-[#CFC6B8] bg-white font-mono text-xs text-center"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    placeholder="kg"
                    value={wizManualWeight}
                    onChange={(e) => setWizManualWeight(e.target.value)}
                    className="col-span-4 sm:col-span-2 min-h-[32px] px-1.5 rounded border border-[#CFC6B8] bg-white font-mono text-xs text-center"
                  />
                  <button
                    type="button"
                    onClick={handleWizardAddManualItem}
                    className="col-span-4 sm:col-span-3 min-h-[32px] px-2 rounded border border-[#1A1816] bg-white text-[#1A1816] text-xs font-bold hover:bg-[#EFEAE0] cursor-pointer"
                  >
                    + Manual
                  </button>
                  <input
                    type="text"
                    placeholder="Propriedades / efeitos (opcional)..."
                    value={wizManualProps}
                    onChange={(e) => setWizManualProps(e.target.value)}
                    className="col-span-12 min-h-[30px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
                  />
                </div>

                {(cfg.extraEquipment ?? []).length > 0 && (
                  <div className="divide-y divide-[#E5DFD3] border-t border-[#E5DFD3] pt-1">
                    {(cfg.extraEquipment ?? []).map((eq) => (
                      <div key={eq.id} className="py-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">
                          <strong>{eq.name}</strong>
                          {eq.cost ? ` (${eq.cost})` : ''}
                          {eq.purchased ? ' · Comprado' : ' · Grátis'}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remover ${eq.name}`}
                          onClick={() =>
                            setCfg((prev) => ({
                              ...prev,
                              extraEquipment: (prev.extraEquipment ?? []).filter(
                                (item) => item.id !== eq.id
                              ),
                            }))
                          }
                          className="p-0.5 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Magias & Revisão */}
          {step === 5 && (
            <div className="space-y-4">
              {previewCanCast ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A5610]">
                      Truques & Magias Preparadas ({cfg.preparedSpellIds.length} selecionadas)
                    </p>
                    <input
                      type="text"
                      placeholder="Filtrar magias..."
                      value={spellSearch}
                      onChange={(e) => setSpellSearch(e.target.value)}
                      className="min-h-[34px] px-2.5 rounded border border-[#D4CCC0] bg-[#FAF8F3] text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {classSpells.map((sp) => {
                      const active = cfg.preparedSpellIds.includes(sp.id);
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => toggleSpell(sp.id)}
                          className={`text-left p-2 rounded border flex items-center justify-between gap-2 cursor-pointer ${
                            active
                              ? 'border-[#8A6518] bg-[#FBF6E6]'
                              : 'border-[#E3DDD2] bg-[#FAF8F3]'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold text-[#8A6518] mr-1.5">
                              {sp.level === 0 ? 'TRQ' : `${sp.level}º`}
                            </span>
                            <span className="font-bold text-[#1A1816]">{sp.name}</span>
                          </div>
                          {active && <Check className="w-3.5 h-3.5 text-[#7A5610] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded border border-[#E3DDD2] bg-[#FAF8F3] text-center space-y-1">
                  <p className="font-bold text-sm text-[#1A1816]">Personagem Não-Conjurador</p>
                  <p className="text-[#574E46]">
                    A seção de Magias ficará oculta automaticamente para manter a ficha limpa. Você
                    poderá ativá-la a qualquer momento no botão <strong>+ Habilitar Conjuração</strong>.
                  </p>
                </div>
              )}

              {/* Final Summary */}
              <div className="p-3.5 rounded border border-[#D4CCC0] bg-[#FAF8F3] space-y-1.5">
                <p className="font-display font-bold text-sm text-[#1A1816]">
                  Resumo: {previewSheet.nome} — {cls.name} Nv {previewSheet.nivel}
                </p>
                <p className="text-[#574E46]">
                  CA <strong>{previewAc.total}</strong> · PV Máx <strong>{previewHp}</strong> ·
                  Iniciativa <strong>{formatSigned(previewInit.total)}</strong> · Percepção Passiva{' '}
                  <strong>{previewPassPerc}</strong> · Recursos de Classe:{' '}
                  <strong>{previewSheet.recursosClasse.length}</strong>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#E3DDD2] bg-[#F7F4EC] flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="min-h-[42px] inline-flex items-center gap-1 px-3.5 rounded border border-[#C8BFB0] bg-white text-xs font-semibold text-[#1A1816] disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="min-h-[42px] inline-flex items-center gap-1 px-4 rounded border border-[#1A1816] bg-[#1A1816] text-white text-xs font-semibold cursor-pointer"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              data-testid="wizard-save-btn"
              onClick={handleFinish}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded bg-[#9E1B1B] text-white text-xs font-semibold hover:bg-[#7D1414] cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              Aplicar à Ficha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
