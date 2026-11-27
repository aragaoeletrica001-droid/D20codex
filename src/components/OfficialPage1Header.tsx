import React, { useState } from 'react';
import {
  AlertTriangle,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import type { CharacterSheet, ClassDefinition, CreatureSize } from '../types/dnd';
import { ALIGNMENTS } from '../data/core';
import { CLASSES_LIST, CLASS_MAP } from '../data/classes';
import { BACKGROUNDS_LIST, SPECIES_LIST } from '../data/origins';
import { CONDITION_MAP } from '../data/glossary';
import {
  applyDamage,
  applyHealing,
  applyTempHp,
  calculateAC,
  calculateInitiative,
  calculateMaxHP,
  calculatePassivePerception,
  calculateSpeed,
  formatSigned,
  getProficiencyBonus,
  getSpeciesDarkvision,
  rollDie,
} from '../rules/engine';
import {
  applyInlineBackgroundChange,
  applyInlineClassChange,
  applyInlineLevelChange,
  applyInlineSpeciesChange,
  applyInlineSubclassChange,
} from '../rules/defaultCharacter';
import { InfoTip } from './InfoTip';
import { CORE_RULE_HELP } from '../data/rulesHelp';

interface OfficialPage1HeaderProps {
  sheet: CharacterSheet;
  allClasses?: ClassDefinition[];
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
  onOpenConditionsModal: () => void;
}

const SIZES: CreatureSize[] = ['Miúdo', 'Pequeno', 'Médio', 'Grande', 'Enorme'];
const LEVELS_1_TO_20 = Array.from({ length: 20 }, (_, i) => i + 1);

export const OfficialPage1Header: React.FC<OfficialPage1HeaderProps> = ({
  sheet,
  allClasses,
  onUpdateSheet,
  onOpenConditionsModal,
}) => {
  const [hpInput, setHpInput] = useState('');
  const [showHpTools, setShowHpTools] = useState(false);

  const classesList = allClasses && allClasses.length > 0 ? allClasses : CLASSES_LIST;
  const cls = classesList.find((c) => c.id === sheet.classeId) ?? CLASS_MAP[sheet.classeId];
  const species = SPECIES_LIST.find((s) => s.id === sheet.especieId);
  const hitDieSize = cls?.hitDie ?? null;
  const ac = calculateAC(sheet);
  const maxHp = calculateMaxHP(sheet);
  const remainingHitDice = Math.max(0, sheet.nivel - sheet.dvGasto);
  const bp = getProficiencyBonus(sheet.nivel);
  const initiative = calculateInitiative(sheet);
  const speed = calculateSpeed(sheet);
  const passivePerception = calculatePassivePerception(sheet);
  const darkvision = getSpeciesDarkvision(sheet.especieId, sheet.especieOpcaoId);

  const handleHpDelta = (mode: 'damage' | 'heal' | 'temp') => {
    const val = parseInt(hpInput, 10);
    if (!Number.isFinite(val) || val <= 0) return;
    onUpdateSheet((prev) => {
      if (mode === 'damage') return applyDamage(prev, val);
      if (mode === 'heal') {
        const currentMax = calculateMaxHP(prev);
        if (currentMax === 0) {
          return { ...prev, pvAtual: prev.pvAtual + val, pvMax: prev.pvAtual + val };
        }
        return applyHealing(prev, val);
      }
      return applyTempHp(prev, val);
    });
    setHpInput('');
  };

  return (
    <section aria-label="Cabeçalho da Ficha e Combate" className="space-y-2">
      {/* ================================================================
          1. NOME DO PERSONAGEM
          2. CLASSE / NÍVEL / SUBCLASSE
          3. ESPÉCIE / ANTECEDENTE / ORIENTAÇÃO
          ================================================================ */}
      <div className="official-box-tinted p-2 sm:p-2.5 space-y-2">
        {/* 1. NOME DO PERSONAGEM (com miniatura de retrato se anexado) */}
        <div data-testid="ficha-row-nome" className="flex items-center gap-2">
          {sheet.retratoDataUrl && (
            <img
              src={sheet.retratoDataUrl}
              alt={`Retrato de ${sheet.nome || 'personagem'}`}
              data-testid="header-portrait-thumb"
              className="w-10 h-10 rounded border border-[#8F8578] object-cover shrink-0 bg-white"
            />
          )}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              id="official-char-name"
              data-testid="char-name-input"
              placeholder="Nome do Personagem..."
              value={sheet.nome}
              onChange={(e) =>
                onUpdateSheet((prev) => ({
                  ...prev,
                  nome: e.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
              className="official-underline-input font-display text-base sm:text-lg font-bold tracking-tight placeholder:text-[#9C9285] placeholder:font-normal py-0.5"
            />
            <label htmlFor="official-char-name" className="official-label block mt-0.5">
              Nome do Personagem
            </label>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <input
              id="inline-xp-input"
              type="number"
              min={0}
              aria-label="Pontos de Experiência (XP)"
              value={sheet.xp}
              onChange={(e) =>
                onUpdateSheet((prev) => ({
                  ...prev,
                  xp: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
              className="w-14 h-7 text-center font-mono text-xs font-bold text-[#1A1816] bg-white border border-[#B8AEA0] rounded tabular-nums focus:outline-none focus:border-[#9E1B1B]"
            />
            <label htmlFor="inline-xp-input" className="official-label mt-0.5">
              XP
            </label>
          </div>
        </div>

        {/* 2. CLASSE / NÍVEL (Pick List 1–20) / SUBCLASSE */}
        <div
          data-testid="ficha-row-classe"
          className="grid grid-cols-12 gap-x-2 gap-y-1.5 items-end"
        >
          {/* CLASSE */}
          <div className="col-span-5 min-w-0">
            <select
              id="inline-class-select"
              data-testid="inline-class-select"
              value={sheet.classeId}
              onChange={(e) =>
                onUpdateSheet((prev) => applyInlineClassChange(prev, e.target.value))
              }
              className="official-underline-input text-xs font-bold cursor-pointer truncate py-0.5"
            >
              <option value="">— Classe —</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label htmlFor="inline-class-select" className="official-label block mt-0.5">
              Classe
            </label>
          </div>

          {/* NÍVEL (1–20 Pick List) */}
          <div className="col-span-2 min-w-0 flex flex-col items-center">
            <select
              id="inline-level-select"
              data-testid="inline-level-select"
              aria-label="Nível do personagem (1 a 20)"
              value={sheet.nivel}
              onChange={(e) =>
                onUpdateSheet((prev) =>
                  applyInlineLevelChange(prev, parseInt(e.target.value, 10) || 1)
                )
              }
              className="w-full h-7 px-1 text-center font-mono text-xs font-extrabold text-[#1A1816] bg-white border border-[#8F8578] rounded tabular-nums cursor-pointer focus:outline-none focus:border-[#9E1B1B]"
            >
              {LEVELS_1_TO_20.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
            <label htmlFor="inline-level-select" className="official-label mt-0.5">
              Nível
            </label>
          </div>

          {/* SUBCLASSE */}
          <div className="col-span-5 min-w-0">
            <select
              id="inline-subclass-select"
              data-testid="inline-subclass-select"
              disabled={!cls || sheet.nivel < 3}
              value={sheet.subclasseId}
              onChange={(e) =>
                onUpdateSheet((prev) => applyInlineSubclassChange(prev, e.target.value))
              }
              className="official-underline-input text-xs font-semibold cursor-pointer truncate py-0.5 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {!cls ? (
                <option value="">—</option>
              ) : sheet.nivel < 3 ? (
                <option value="">Nível 3+</option>
              ) : (
                <>
                  <option value="">— Subclasse —</option>
                  {cls.subclasses.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            <label htmlFor="inline-subclass-select" className="official-label block mt-0.5">
              Subclasse
            </label>
          </div>
        </div>

        {/* 3. ESPÉCIE / ANTECEDENTE / ORIENTAÇÃO */}
        <div
          data-testid="ficha-row-origem"
          className="grid grid-cols-3 gap-x-2 gap-y-1.5 items-end"
        >
          {/* ESPÉCIE */}
          <div className="min-w-0">
            <select
              id="inline-species-select"
              data-testid="inline-species-select"
              value={sheet.especieId}
              onChange={(e) =>
                onUpdateSheet((prev) => applyInlineSpeciesChange(prev, e.target.value))
              }
              className="official-underline-input text-xs font-semibold cursor-pointer truncate py-0.5"
            >
              <option value="">— Espécie —</option>
              {SPECIES_LIST.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <label htmlFor="inline-species-select" className="official-label">
                Espécie
              </label>
              {species?.subOptions && species.subOptions.length > 0 && (
                <select
                  aria-label="Linhagem da espécie"
                  value={sheet.especieOpcaoId ?? species.subOptions[0].id}
                  onChange={(e) =>
                    onUpdateSheet((prev) =>
                      applyInlineSpeciesChange(prev, prev.especieId, e.target.value)
                    )
                  }
                  className="text-[10px] font-semibold text-[#7A5610] bg-transparent border-b border-[#C8BFB0] focus:outline-none max-w-[78px] truncate cursor-pointer"
                >
                  {species.subOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* ANTECEDENTE */}
          <div className="min-w-0">
            <select
              id="inline-bg-select"
              data-testid="inline-bg-select"
              value={sheet.antecedenteId}
              onChange={(e) =>
                onUpdateSheet((prev) => applyInlineBackgroundChange(prev, e.target.value))
              }
              className="official-underline-input text-xs font-semibold cursor-pointer truncate py-0.5"
            >
              <option value="">— Antecedente —</option>
              {BACKGROUNDS_LIST.map((bg) => (
                <option key={bg.id} value={bg.id}>
                  {bg.name}
                </option>
              ))}
            </select>
            <label htmlFor="inline-bg-select" className="official-label block mt-0.5">
              Antecedente
            </label>
          </div>

          {/* ORIENTAÇÃO (ALINHAMENTO) */}
          <div className="min-w-0">
            <select
              id="inline-alignment-select"
              data-testid="inline-alignment-select"
              value={sheet.alinhamento}
              onChange={(e) =>
                onUpdateSheet((prev) => ({
                  ...prev,
                  alinhamento: e.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
              className="official-underline-input text-xs font-semibold cursor-pointer truncate py-0.5"
            >
              <option value="">— Orientação —</option>
              {ALIGNMENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <label htmlFor="inline-alignment-select" className="official-label block mt-0.5">
              Orientação
            </label>
          </div>
        </div>
      </div>

      {/* ================================================================
          4. PONTOS DE VIDA / DADOS DE VIDA (+ CA & ESCUDO ABAIXO DA CA)
          ================================================================ */}
      <div
        data-testid="ficha-row-pv-dv"
        className="grid grid-cols-12 gap-2 items-stretch"
      >
        {/* PONTOS DE VIDA (ATUAL | MÁX / TEMP) */}
        <div className="col-span-8 sm:col-span-6 official-box flex flex-col justify-between overflow-hidden">
          <div className="official-box-header py-0.5 px-2">
            <span className="official-box-title text-[10px]">
              Pontos de Vida
            </span>
            <button
              type="button"
              onClick={() => setShowHpTools((v) => !v)}
              className="text-[10px] font-bold text-[#9E1B1B] hover:underline cursor-pointer"
            >
              {showHpTools ? 'Fechar' : '± Dano/Cura'}
            </button>
          </div>

          <div className="grid grid-cols-12 flex-1 divide-x divide-[#CFC6B8]">
            <div className="col-span-7 px-1.5 py-1 flex flex-col items-center justify-center gap-0.5">
              <div className="flex items-center gap-1 w-full justify-center">
                <button
                  type="button"
                  aria-label="Reduzir 1 PV"
                  onClick={() => onUpdateSheet((prev) => applyDamage(prev, 1))}
                  className="w-6 h-6 flex items-center justify-center rounded border border-[#CFC6B8] bg-[#FAF8F3] hover:border-[#9E1B1B] hover:text-[#9E1B1B] cursor-pointer shrink-0"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min={0}
                  aria-label="Pontos de Vida Atuais"
                  data-testid="current-hp-value"
                  value={sheet.pvAtual}
                  onChange={(e) => {
                    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                    onUpdateSheet((prev) => ({
                      ...prev,
                      pvAtual: v,
                      morteSucessos: v > 0 ? 0 : prev.morteSucessos,
                      morteFalhas: v > 0 ? 0 : prev.morteFalhas,
                    }));
                  }}
                  className={`w-12 text-center font-mono text-2xl font-extrabold bg-transparent focus:outline-none tabular-nums ${
                    maxHp > 0 && sheet.pvAtual === 0 ? 'text-[#9E1B1B]' : 'text-[#1A1816]'
                  }`}
                />
                <button
                  type="button"
                  aria-label="Aumentar 1 PV"
                  onClick={() =>
                    onUpdateSheet((prev) =>
                      calculateMaxHP(prev) > 0
                        ? applyHealing(prev, 1)
                        : { ...prev, pvAtual: prev.pvAtual + 1, pvMax: prev.pvAtual + 1 }
                    )
                  }
                  className="w-6 h-6 flex items-center justify-center rounded border border-[#CFC6B8] bg-[#FAF8F3] hover:border-[#1F6B43] hover:text-[#1F6B43] cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="official-label">Atual</span>
            </div>

            <div className="col-span-5 grid grid-rows-2 divide-y divide-[#CFC6B8]">
              <div className="px-1 py-0.5 flex items-center justify-between gap-1">
                <label htmlFor="hp-max-input" className="official-label">
                  Máx
                </label>
                <input
                  id="hp-max-input"
                  data-testid="max-hp-value"
                  type="number"
                  min={0}
                  value={maxHp}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') {
                      onUpdateSheet((prev) => ({ ...prev, pvMaxManualOverride: null }));
                    } else {
                      const v = Math.max(0, parseInt(raw, 10) || 0);
                      onUpdateSheet((prev) => ({
                        ...prev,
                        pvMaxManualOverride: v,
                        pvMax: v,
                      }));
                    }
                  }}
                  className="w-10 text-right font-mono text-xs font-extrabold text-[#1A1816] bg-transparent focus:outline-none tabular-nums"
                />
              </div>
              <div className="px-1 py-0.5 flex items-center justify-between gap-1 bg-[#FAF8F3]">
                <label htmlFor="hp-temp-input" className="official-label">
                  Tmp
                </label>
                <input
                  id="hp-temp-input"
                  data-testid="temp-hp-value"
                  type="number"
                  min={0}
                  value={sheet.pvTemp}
                  onChange={(e) =>
                    onUpdateSheet((prev) => ({
                      ...prev,
                      pvTemp: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className={`w-10 text-right font-mono text-xs font-bold bg-transparent focus:outline-none tabular-nums ${
                    sheet.pvTemp > 0 ? 'text-[#1F6B43]' : 'text-[#5C534A]'
                  }`}
                />
              </div>
            </div>
          </div>

          {showHpTools && (
            <div className="p-1.5 border-t border-[#CFC6B8] bg-[#FAF8F3] space-y-1.5">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Val."
                  aria-label="Valor de dano ou cura"
                  data-testid="hp-delta-input"
                  value={hpInput}
                  onChange={(e) => setHpInput(e.target.value)}
                  className="w-12 min-h-[28px] px-1 rounded border border-[#B8AEA0] bg-white font-mono text-xs tabular-nums"
                />
                <button
                  type="button"
                  data-testid="apply-damage-btn"
                  onClick={() => handleHpDelta('damage')}
                  className="flex-1 min-h-[28px] px-1.5 rounded bg-[#9E1B1B] text-white text-[10px] font-bold cursor-pointer"
                >
                  Dano
                </button>
                <button
                  type="button"
                  data-testid="apply-heal-btn"
                  onClick={() => handleHpDelta('heal')}
                  className="flex-1 min-h-[28px] px-1.5 rounded bg-[#1F6B43] text-white text-[10px] font-bold cursor-pointer"
                >
                  Curar
                </button>
                <button
                  type="button"
                  onClick={() => handleHpDelta('temp')}
                  className="px-1.5 min-h-[28px] rounded border border-[#8A6518] bg-[#FBF4DC] text-[#7A5610] text-[10px] font-bold cursor-pointer"
                >
                  Temp
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-[#E5DFD3] text-[10px]">
                <div className="inline-flex items-center gap-1">
                  <span className="font-bold text-[#5C534A]">PV/Nível:</span>
                  <button
                    type="button"
                    data-testid="hp-mode-media"
                    onClick={() =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        hpMode: 'media',
                        pvMaxManualOverride: null,
                      }))
                    }
                    className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                      (sheet.hpMode ?? 'media') === 'media'
                        ? 'border-[#1A1816] bg-[#1A1816] text-white'
                        : 'border-[#CFC6B8] bg-white text-[#5C534A]'
                    }`}
                  >
                    Média fixa
                  </button>
                  <button
                    type="button"
                    data-testid="hp-mode-rolagem"
                    onClick={() =>
                      onUpdateSheet((prev) => {
                        const die = cls?.hitDie ?? 8;
                        const nextRolled = { ...(prev.hpRolledPerLevel ?? {}) };
                        for (let l = 2; l <= prev.nivel; l++) {
                          if (!nextRolled[l]) nextRolled[l] = rollDie(die);
                        }
                        return {
                          ...prev,
                          hpMode: 'rolagem',
                          hpRolledPerLevel: nextRolled,
                          pvMaxManualOverride: null,
                        };
                      })
                    }
                    className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                      sheet.hpMode === 'rolagem'
                        ? 'border-[#9E1B1B] bg-[#9E1B1B] text-white'
                        : 'border-[#CFC6B8] bg-white text-[#5C534A]'
                    }`}
                  >
                    Rolagem
                  </button>
                </div>

                {sheet.hpMode === 'rolagem' && sheet.nivel >= 2 && hitDieSize && (
                  <button
                    type="button"
                    data-testid="reroll-hp-btn"
                    onClick={() =>
                      onUpdateSheet((prev) => {
                        const nextRolled = { ...(prev.hpRolledPerLevel ?? {}) };
                        for (let l = 2; l <= prev.nivel; l++) {
                          nextRolled[l] = rollDie(hitDieSize);
                        }
                        return {
                          ...prev,
                          hpRolledPerLevel: nextRolled,
                          pvMaxManualOverride: null,
                        };
                      })
                    }
                    className="px-1.5 py-0.5 rounded border border-[#8A6518] bg-[#FBF4DC] text-[#7A5610] font-bold cursor-pointer"
                  >
                    Rerrolar d{hitDieSize}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CA SHIELD + ESCUDO CHECKBOX ESTRITAMENTE ABAIXO DA CA */}
        <div
          data-testid="ac-shield-card"
          className="col-span-4 sm:col-span-3 official-box p-1.5 flex flex-col items-center justify-center gap-1"
        >
          <div
            data-testid="ac-shield-frame"
            className="official-shield-frame w-[58px] h-[52px] flex flex-col items-center justify-center shrink-0"
            title={ac.formulaText}
          >
            <span
              data-testid="ac-value"
              className="font-mono text-2xl font-extrabold text-[#1A1816] tabular-nums leading-none"
            >
              {ac.total}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#6B6258] mt-0.5 inline-flex items-center">
              CA
              <InfoTip
                {...CORE_RULE_HELP.ca}
                formula={ac.formulaText}
                testId="info-tip-ca"
              />
            </span>
          </div>

          <label
            data-testid="toggle-shield-btn"
            className={`min-h-[24px] px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer select-none transition-colors whitespace-nowrap ${
              sheet.escudoEquipado
                ? 'border-[#1A1816] bg-[#1A1816] text-white'
                : 'border-[#CFC6B8] bg-[#FAF8F3] text-[#4D453E] hover:border-[#1A1816]'
            }`}
          >
            <input
              type="checkbox"
              checked={sheet.escudoEquipado}
              onChange={() =>
                onUpdateSheet((prev) => ({
                  ...prev,
                  escudoEquipado: !prev.escudoEquipado,
                  updatedAt: new Date().toISOString(),
                }))
              }
              className="w-3 h-3 accent-[#9E1B1B] shrink-0"
            />
            <span>Escudo</span>
          </label>

          {(ac.untrainedWarning || ac.minStrengthWarning) && (
            <span
              className="text-[9px] font-semibold text-[#9E1B1B] inline-flex items-center gap-0.5 leading-tight"
              title={
                ac.untrainedWarning
                  ? 'Sem treinamento na armadura/escudo'
                  : 'Força abaixo do mínimo (-3m)'
              }
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {ac.untrainedWarning ? 'S/ treino' : 'FOR'}
            </span>
          )}
        </div>

        {/* DADOS DE VIDA (Status e gastos — rolagem centralizada em Testes) */}
        <div className="col-span-12 sm:col-span-3 official-box p-2 flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="official-label text-[#1A1816]">
              Dados de Vida
            </span>
            <span className="font-mono text-xs font-extrabold text-[#1A1816] tabular-nums">
              {hitDieSize ? `${remainingHitDice}/${sheet.nivel}d${hitDieSize}` : `${sheet.nivel}d—`}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="hd-spent-input" className="text-[10px] text-[#6B6258]">
              Gastos
            </label>
            <input
              id="hd-spent-input"
              type="number"
              min={0}
              max={sheet.nivel}
              value={sheet.dvGasto}
              onChange={(e) =>
                onUpdateSheet((prev) => ({
                  ...prev,
                  dvGasto: Math.max(0, Math.min(prev.nivel, parseInt(e.target.value, 10) || 0)),
                }))
              }
              className="w-10 h-6 text-center font-mono text-xs font-bold text-[#1A1816] bg-[#FAF8F3] border border-[#CFC6B8] rounded tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* ================================================================
          5. INICIATIVA / PERCEPÇÃO PASSIVA / INSPIRAÇÃO (+ BP / DESL / TAMANHO)
          ================================================================ */}
      <div data-testid="ficha-row-iniciativa" className="space-y-1.5">
        <div
          className="grid grid-cols-3 gap-1.5"
          data-testid="quick-metrics-strip"
        >
          {/* INICIATIVA (Somente leitura — rolagem centralizada em Testes) */}
          <div className="official-box px-1.5 py-1.5 flex flex-col items-center justify-center text-center">
            <span className="official-label">
              Iniciativa
              <InfoTip
                {...CORE_RULE_HELP.iniciativa}
                formula={initiative.breakdown.map((b) => `${formatSigned(b.value)} (${b.label})`).join(' ')}
              />
            </span>
            <span
              data-testid="initiative-value"
              className="font-mono text-lg font-extrabold text-[#9E1B1B] tabular-nums leading-tight mt-0.5"
            >
              {formatSigned(initiative.total)}
            </span>
          </div>

          {/* PERCEPÇÃO PASSIVA + VISÃO NO ESCURO */}
          <div className="official-box px-1.5 py-1.5 flex flex-col items-center justify-center text-center">
            <span className="official-label">
              Perc. Passiva
              <InfoTip
                {...CORE_RULE_HELP.percepcao_passiva}
                formula={`10 + Percepção${sheet.nivelExaustao > 0 ? ` - ${sheet.nivelExaustao * 2} (Exaustão)` : ''} = ${passivePerception}`}
              />
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                data-testid="passive-perception-value"
                className="font-mono text-lg font-extrabold text-[#1A1816] tabular-nums leading-tight"
              >
                {passivePerception}
              </span>
              {darkvision > 0 && (
                <span
                  data-testid="darkvision-value"
                  className="text-[9px] font-bold text-[#7A5610]"
                  title={`Visão no Escuro ${darkvision} m`}
                >
                  VE {darkvision}m
                </span>
              )}
            </div>
          </div>

          {/* INSPIRAÇÃO HEROICA */}
          <button
            type="button"
            data-testid="heroic-inspiration-btn"
            onClick={() =>
              onUpdateSheet((prev) => ({
                ...prev,
                inspiracaoHeroica: !prev.inspiracaoHeroica,
              }))
            }
            aria-pressed={sheet.inspiracaoHeroica}
            className={`official-box px-1.5 py-1.5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              sheet.inspiracaoHeroica
                ? 'bg-[#FBF4DC] border-[#8A6518]'
                : 'bg-white hover:bg-[#FAF8F3]'
            }`}
          >
            <span className="official-label">
              Inspiração
              <InfoTip {...CORE_RULE_HELP.inspiracao} />
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-extrabold mt-1 ${
                sheet.inspiracaoHeroica ? 'text-[#7A5610]' : 'text-[#8C8175]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {sheet.inspiracaoHeroica ? 'Ativa' : 'Não'}
            </span>
          </button>
        </div>

        {/* Compact Secondary Metrics Strip: BP | Deslocamento | Tamanho */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* BP */}
          <div className="official-box px-2 py-1 flex items-center justify-between gap-1">
            <span className="official-label">
              Prof. (BP)
            </span>
            <span
              data-testid="proficiency-bonus-value"
              className="font-mono text-sm font-extrabold text-[#1A1816] tabular-nums"
            >
              {formatSigned(bp)}
            </span>
          </div>

          {/* DESLOCAMENTO */}
          <div className="official-box px-2 py-1 flex items-center justify-between gap-1">
            <span className="official-label">
              Desloc.
            </span>
            <span
              data-testid="speed-value"
              className={`font-mono text-sm font-extrabold tabular-nums ${
                sheet.especieId && speed.totalMeters === 0 ? 'text-[#9E1B1B]' : 'text-[#1A1816]'
              }`}
              title={speed.notes.join(' | ')}
            >
              {speed.totalMeters > 0 ? `${speed.totalMeters} m` : '—'}
            </span>
          </div>

          {/* TAMANHO */}
          <div className="official-box px-1.5 py-1 flex items-center justify-between gap-1">
            <label htmlFor="inline-size-select" className="official-label shrink-0">
              Tam.
            </label>
            <select
              id="inline-size-select"
              value={sheet.tamanho}
              onChange={(e) =>
                onUpdateSheet((prev) => ({
                  ...prev,
                  tamanho: e.target.value as CreatureSize,
                }))
              }
              className="w-full text-right font-display text-xs font-bold text-[#1A1816] bg-transparent focus:outline-none cursor-pointer"
            >
              {SIZES.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================
          ACTIVE CONDITIONS / EXHAUSTION / CONCENTRATION STRIP (Only when active)
          ================================================================ */}
      {(sheet.condicoesAtivas.length > 0 || sheet.nivelExaustao > 0 || sheet.concentrandoEm) && (
        <div
          data-testid="active-conditions-bar"
          className="official-box border-[#C98E8E] bg-[#FDF5F5] px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8B1717]">
              Estados:
            </span>
            {sheet.concentrandoEm && (
              <button
                type="button"
                onClick={() => onUpdateSheet((prev) => ({ ...prev, concentrandoEm: '' }))}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#B08D3B] bg-[#FBF4DC] text-[#7A5610] text-[11px] font-semibold cursor-pointer"
              >
                Conc.: {sheet.concentrandoEm}
                <InfoTip {...CORE_RULE_HELP.concentracao} />
                <X className="w-3 h-3" />
              </button>
            )}
            {sheet.nivelExaustao > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#C98E8E] bg-white text-[#7D1414] text-[11px] font-bold">
                Exaustão {sheet.nivelExaustao} (-{sheet.nivelExaustao * 2} D20)
                <InfoTip {...CORE_RULE_HELP.condicoes} />
              </span>
            )}
            {sheet.condicoesAtivas.map((cid) => {
              const cond = CONDITION_MAP[cid];
              if (!cond) return null;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() =>
                    onUpdateSheet((prev) => ({
                      ...prev,
                      condicoesAtivas: prev.condicoesAtivas.filter((c) => c !== cid),
                    }))
                  }
                  title={`${cond.shortEffect} (Clique para remover)`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#C98E8E] bg-white text-[#7D1414] text-[11px] font-semibold hover:bg-[#FCEAEA] cursor-pointer"
                >
                  {cond.name}
                  <InfoTip
                    title={cond.name}
                    subtitle="Condição Ativa (D&D 2024)"
                    body={cond.shortEffect}
                    tips={cond.rules}
                  />
                  <X className="w-3 h-3" />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onOpenConditionsModal}
            className="text-[11px] font-bold text-[#9E1B1B] underline underline-offset-2 cursor-pointer"
          >
            Gerenciar
          </button>
        </div>
      )}
    </section>
  );
};
