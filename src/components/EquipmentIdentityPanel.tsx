import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Coins, ImagePlus, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CharacterSheet, InventoryItem } from '../types/dnd';
import { ADVENTURE_GEAR_CATALOG, ARMORS_LIST, WEAPONS_LIST } from '../data/equipment';
import { ALIGNMENTS, COMMON_LANGUAGES, RARE_LANGUAGES } from '../data/core';
import {
  buildWeaponRuleHelp,
  resolveWeaponPropertyHelp,
} from '../data/rulesHelp';
import {
  calculateCarryCapacityKg,
  calculateTotalGoldValue,
  calculateTotalWeightKg,
  deductCopperFromCoins,
  formatCopperToCoinsLabel,
  parseCostToCopper,
} from '../rules/engine';
import { useSectionOpen } from '../hooks/useCollapsibleSections';
import { InfoTip } from './InfoTip';

interface EquipmentIdentityPanelProps {
  sheet: CharacterSheet;
  onUpdateSheet: (updater: (prev: CharacterSheet) => CharacterSheet) => void;
}

const COIN_META: { key: keyof CharacterSheet['moedas']; label: string; color: string }[] = [
  { key: 'pc', label: 'PC', color: 'text-[#8B5A2B]' },
  { key: 'pp', label: 'PP', color: 'text-[#64748B]' },
  { key: 'pe', label: 'PE', color: 'text-[#4B6B7A]' },
  { key: 'po', label: 'PO', color: 'text-[#9A721A]' },
  { key: 'pl', label: 'PL', color: 'text-[#475569]' },
];

const PRICE_MULTIPLIER_PRESETS = [0.5, 0.8, 1, 1.2, 1.5, 2] as const;

interface UnifiedCatalogOption {
  key: string;
  group: 'Equipamentos' | 'Armas' | 'Armaduras';
  name: string;
  weightKg: number;
  cost: string;
  properties?: string;
  description?: string;
}

export const EquipmentIdentityPanel: React.FC<EquipmentIdentityPanelProps> = ({
  sheet,
  onUpdateSheet,
}) => {
  const [addMode, setAddMode] = useState<'catalog' | 'manual'>('catalog');
  const [selectedCatalogKey, setSelectedCatalogKey] = useState('');
  const [catalogQty, setCatalogQty] = useState('1');

  // Manual item fields
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualWeight, setManualWeight] = useState('0.5');
  const [manualCost, setManualCost] = useState('');
  const [manualProperties, setManualProperties] = useState('');
  const [manualDescription, setManualDescription] = useState('');

  // Purchase & price multiplier state
  const [isPurchased, setIsPurchased] = useState(false);
  const [priceMultiplier, setPriceMultiplier] = useState('1');
  const [purchaseNotice, setPurchaseNotice] = useState<{
    tone: 'ok' | 'warn';
    text: string;
  } | null>(null);

  const [newLanguage, setNewLanguage] = useState('');
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const [coinsOpen, toggleCoinsOpen] = useSectionOpen('coins', true);
  const [inventoryOpen, toggleInventoryOpen] = useSectionOpen('inventory', true);
  const [attunementOpen, toggleAttunementOpen] = useSectionOpen('attunement', true);
  const [identityOpen, toggleIdentityOpen] = useSectionOpen('identity_lore', true);

  const unifiedCatalog = useMemo<UnifiedCatalogOption[]>(() => {
    const gear: UnifiedCatalogOption[] = ADVENTURE_GEAR_CATALOG.map((g, idx) => ({
      key: `gear:${idx}`,
      group: 'Equipamentos',
      name: g.name,
      weightKg: g.weightKg,
      cost: g.cost,
      description: g.notes,
    }));
    const weapons: UnifiedCatalogOption[] = WEAPONS_LIST.map((w) => ({
      key: `weapon:${w.id}`,
      group: 'Armas',
      name: w.name,
      weightKg: w.weightKg,
      cost: w.cost,
      properties: [
        `${w.damageDice} ${w.damageType}`,
        `Maestria: ${w.mastery}`,
        ...w.properties,
      ].join(' · '),
      description: `${w.category} · Alcance ${w.range}`,
    }));
    const armors: UnifiedCatalogOption[] = ARMORS_LIST.filter((a) => a.id !== 'nenhuma').map(
      (a) => ({
        key: `armor:${a.id}`,
        group: 'Armaduras',
        name: a.name,
        weightKg: a.weightKg,
        cost: a.cost,
        properties: `CA ${a.baseAc}${a.dexCap === null ? ' + DES' : a.dexCap > 0 ? ` + DES (máx +${a.dexCap})` : ''}${a.stealthDisadvantage ? ' · Desvant. Furtividade' : ''}`,
        description: `Armadura ${a.category}${a.minStrength ? ` · Força mín. ${a.minStrength}` : ''}`,
      })
    );
    return [...gear, ...weapons, ...armors];
  }, []);

  const selectedCatalogOption = useMemo(
    () => unifiedCatalog.find((o) => o.key === selectedCatalogKey) ?? null,
    [unifiedCatalog, selectedCatalogKey]
  );

  const activeAttunedCount = sheet.sintonizacao.filter((s) => s.active && s.name.trim()).length;
  const carryCapacity = calculateCarryCapacityKg(sheet);
  const totalWeight = calculateTotalWeightKg(sheet);
  const weightPct = Math.min(100, Math.round((totalWeight / Math.max(1, carryCapacity)) * 100));
  const overloaded = totalWeight > carryCapacity;
  const totalGold = calculateTotalGoldValue(sheet.moedas);

  // Live cost preview for current form
  const effectiveQty = Math.max(
    1,
    parseInt(addMode === 'catalog' ? catalogQty : manualQty, 10) || 1
  );
  const effectiveCostStr =
    addMode === 'catalog' ? selectedCatalogOption?.cost ?? '' : manualCost.trim();
  const parsedMult = Math.max(0, parseFloat(priceMultiplier.replace(',', '.')) || 0);
  const baseUnitCopper = parseCostToCopper(effectiveCostStr);
  const finalCopperCost = isPurchased ? Math.round(baseUnitCopper * effectiveQty * parsedMult) : 0;
  const currentTotalCopper = Math.round(totalGold * 100);
  const insufficientFunds = isPurchased && finalCopperCost > currentTotalCopper;

  const handleConfirmAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    let newItem: InventoryItem | null = null;

    if (addMode === 'catalog') {
      if (!selectedCatalogOption) return;
      const bundleMatch = selectedCatalogOption.name.match(/^(.+?)\s*\((\d+)\)$/);
      const bundleSize = bundleMatch ? Math.max(1, parseInt(bundleMatch[2], 10)) : 1;
      const cleanName = bundleMatch ? bundleMatch[1].trim() : selectedCatalogOption.name;
      const unitWeightKg =
        bundleSize > 1
          ? Number((selectedCatalogOption.weightKg / bundleSize).toFixed(3))
          : selectedCatalogOption.weightKg;
      newItem = {
        id: `inv_${Date.now()}`,
        name: cleanName,
        quantity: effectiveQty * bundleSize,
        weightKg: unitWeightKg,
        cost: selectedCatalogOption.cost,
        properties: selectedCatalogOption.properties,
        description: selectedCatalogOption.description,
        notes: selectedCatalogOption.properties || selectedCatalogOption.description,
        countable: bundleSize > 1 ? true : undefined,
        purchased: isPurchased,
        priceMultiplier: isPurchased ? parsedMult : undefined,
        paidCopper: isPurchased ? finalCopperCost : 0,
      };
    } else {
      const name = manualName.trim();
      if (!name) return;
      const weightKg = Math.max(0, parseFloat(manualWeight.replace(',', '.')) || 0);
      newItem = {
        id: `inv_${Date.now()}`,
        name,
        quantity: effectiveQty,
        weightKg,
        cost: manualCost.trim() || undefined,
        properties: manualProperties.trim() || undefined,
        description: manualDescription.trim() || undefined,
        notes: manualProperties.trim() || manualDescription.trim() || undefined,
        purchased: isPurchased,
        priceMultiplier: isPurchased ? parsedMult : undefined,
        paidCopper: isPurchased ? finalCopperCost : 0,
      };
    }

    if (!newItem) return;
    const itemToAdd = newItem;

    if (isPurchased && finalCopperCost > 0) {
      const check = deductCopperFromCoins(sheet.moedas, finalCopperCost);
      onUpdateSheet((prev) => {
        const res = deductCopperFromCoins(prev.moedas, finalCopperCost);
        return {
          ...prev,
          moedas: res.moedas,
          equipamentos: [...prev.equipamentos, itemToAdd],
        };
      });
      setPurchaseNotice({
        tone: !check.insufficient ? 'ok' : 'warn',
        text: !check.insufficient
          ? `Comprado: ${itemToAdd.name} (${effectiveQty}x) — deduzido ${formatCopperToCoinsLabel(finalCopperCost)} (fator ${parsedMult}x).`
          : `Item adicionado, mas o saldo era insuficiente para ${formatCopperToCoinsLabel(finalCopperCost)} — moedas zeradas (faltou ${formatCopperToCoinsLabel(check.missingCp)}).`,
      });
    } else {
      onUpdateSheet((prev) => ({
        ...prev,
        equipamentos: [...prev.equipamentos, itemToAdd],
      }));
      setPurchaseNotice({
        tone: 'ok',
        text: `Adicionado sem custo: ${itemToAdd.name} (${effectiveQty}x).`,
      });
    }

    // Reset item inputs while keeping purchase preferences predictable
    if (addMode === 'catalog') {
      setSelectedCatalogKey('');
      setCatalogQty('1');
    } else {
      setManualName('');
      setManualQty('1');
      setManualWeight('0.5');
      setManualCost('');
      setManualProperties('');
      setManualDescription('');
    }
  };

  const adjustCoin = (key: keyof CharacterSheet['moedas'], delta: number) => {
    onUpdateSheet((prev) => ({
      ...prev,
      moedas: {
        ...prev.moedas,
        [key]: Math.max(0, (prev.moedas[key] || 0) + delta),
      },
    }));
  };

  const setCoinExact = (key: keyof CharacterSheet['moedas'], val: number) => {
    onUpdateSheet((prev) => ({
      ...prev,
      moedas: {
        ...prev.moedas,
        [key]: Math.max(0, Math.floor(val) || 0),
      },
    }));
  };

  const handleAddLanguage = () => {
    const lang = newLanguage.trim();
    if (!lang || sheet.idiomas.includes(lang)) return;
    onUpdateSheet((prev) => ({
      ...prev,
      idiomas: [...prev.idiomas, lang],
    }));
    setNewLanguage('');
  };

  const handlePortraitUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPortraitError(null);
    if (!file.type.startsWith('image/')) {
      setPortraitError('Selecione um arquivo de imagem válido (PNG, JPG ou WebP).');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 480;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            onUpdateSheet((prev) => ({ ...prev, retratoDataUrl: rawDataUrl }));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          onUpdateSheet((prev) => ({
            ...prev,
            retratoDataUrl: compressed,
            updatedAt: new Date().toISOString(),
          }));
        } catch {
          onUpdateSheet((prev) => ({
            ...prev,
            retratoDataUrl: rawDataUrl,
            updatedAt: new Date().toISOString(),
          }));
        }
      };
      img.onerror = () => {
        onUpdateSheet((prev) => ({
          ...prev,
          retratoDataUrl: rawDataUrl,
          updatedAt: new Date().toISOString(),
        }));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2.5">
      {/* 1. MOEDAS (PC · PP · PE · PO · PL — Ultra-compact 5-col bar) */}
      <section className="official-box overflow-hidden" data-testid="section-coins">
        <button
          type="button"
          data-testid="section-toggle-coins"
          aria-expanded={coinsOpen}
          onClick={toggleCoinsOpen}
          className="w-full official-box-header py-1.5 px-2.5 min-h-[38px] text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {coinsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <Coins className="w-3.5 h-3.5 text-[#8A6518] shrink-0" />
            <h2 className="official-box-title truncate">
              Moedas
            </h2>
          </div>
          <span
            data-testid="coins-total-gold"
            className="font-mono text-[10px] font-bold text-[#7A5610] tabular-nums shrink-0"
          >
            Total: {totalGold} PO
          </span>
        </button>

        {coinsOpen && (
          <div className="p-2 grid grid-cols-5 gap-1">
            {COIN_META.map((c) => (
              <div
                key={c.key}
                className="p-1 rounded border border-[#CFC6B8] bg-[#FAF8F3] flex flex-col items-center gap-0.5"
              >
                <span className={`text-[10px] font-extrabold uppercase ${c.color}`}>{c.label}</span>
                <input
                  type="number"
                  min={0}
                  data-testid={`coin-input-${c.key}`}
                  aria-label={`Quantidade de ${c.label}`}
                  value={sheet.moedas[c.key]}
                  onChange={(e) => setCoinExact(c.key, parseInt(e.target.value, 10))}
                  className="w-full text-center font-mono text-xs font-bold text-[#1A1816] bg-white border border-[#B8AEA0] rounded py-0.5 tabular-nums"
                />
                <div className="flex items-center gap-0.5 w-full">
                  <button
                    type="button"
                    aria-label={`Remover 1 ${c.label}`}
                    onClick={() => adjustCoin(c.key, -1)}
                    className="flex-1 min-h-[22px] flex items-center justify-center rounded border border-[#CFC6B8] bg-white hover:border-[#9E1B1B] cursor-pointer"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Adicionar 1 ${c.label}`}
                    onClick={() => adjustCoin(c.key, 1)}
                    className="flex-1 min-h-[22px] flex items-center justify-center rounded border border-[#CFC6B8] bg-white hover:border-[#1F6B43] cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. EQUIPAMENTO (Armadura Equipada + Inventário + Compras com Multiplicador) */}
      <section className="official-box overflow-hidden" data-testid="section-inventory">
        <button
          type="button"
          data-testid="section-toggle-inventory"
          aria-expanded={inventoryOpen}
          onClick={toggleInventoryOpen}
          className="w-full official-box-header py-1.5 px-2.5 min-h-[38px] text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {inventoryOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h2 className="official-box-title truncate">
              Equipamento & Armadura
            </h2>
          </div>
          <span className="font-mono text-[10px] font-bold text-[#5C534A] tabular-nums shrink-0">
            {sheet.equipamentos.length} it. · {totalWeight}/{carryCapacity} kg
          </span>
        </button>

        {inventoryOpen && (
          <div className="p-2 space-y-2">
            {/* Armadura & Defesa Equipada */}
            <div
              className="p-2 rounded border border-[#DDD5C7] bg-[#FAF8F3] grid grid-cols-1 sm:grid-cols-2 gap-1.5"
              data-testid="section-armor-defense"
            >
              <div>
                <label htmlFor="armor-select" className="official-label block mb-0.5">
                  Armadura Equipada
                </label>
                <select
                  id="armor-select"
                  value={sheet.armorId}
                  onChange={(e) =>
                    onUpdateSheet((prev) => ({ ...prev, armorId: e.target.value }))
                  }
                  className="w-full min-h-[30px] px-1.5 rounded border border-[#CFC6B8] bg-white text-xs text-[#1A1816]"
                >
                  {ARMORS_LIST.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (CA {a.baseAc}
                      {a.dexCap === null ? '+DES' : a.dexCap > 0 ? `+DES máx +${a.dexCap}` : ''})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="unarmored-select" className="official-label block mb-0.5">
                  Sem Armadura / Bônus CA
                </label>
                <div className="flex items-center gap-1">
                  <select
                    id="unarmored-select"
                    value={sheet.unarmoredFormula}
                    onChange={(e) =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        unarmoredFormula: e.target.value as CharacterSheet['unarmoredFormula'],
                      }))
                    }
                    className="flex-1 min-w-0 min-h-[30px] px-1.5 rounded border border-[#CFC6B8] bg-white text-xs text-[#1A1816]"
                  >
                    <option value="padrao">Padrão (10+DES)</option>
                    <option value="barbaro">Bárbaro (+CON)</option>
                    <option value="monge">Monge (+SAB)</option>
                    <option value="draconico">Dracônico (+CAR)</option>
                    <option value="danca">Colégio da Dança (+CAR)</option>
                    <option value="armadura_arcana">Arm. Arcana (13+DES)</option>
                    <option value="pele_arvore">Pele de Árvore (17)</option>
                  </select>
                  <input
                    type="number"
                    aria-label="Bônus manual de CA"
                    title="Bônus manual de CA"
                    value={sheet.caBonusManual}
                    onChange={(e) =>
                      onUpdateSheet((prev) => ({
                        ...prev,
                        caBonusManual: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-11 min-h-[30px] px-1 rounded border border-[#CFC6B8] bg-white font-mono text-xs text-center tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Carry Bar */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px] text-[#5C534A]">
                <span className="font-semibold">
                  Capacidade de Carga
                </span>
                <span className={`font-mono font-bold ${overloaded ? 'text-[#9E1B1B]' : ''}`}>
                  {totalWeight} / {carryCapacity} kg ({weightPct}%)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-sm bg-[#EAE4D7] overflow-hidden">
                <div
                  className={`h-full transition-all ${overloaded ? 'bg-[#9E1B1B]' : 'bg-[#8A6518]'}`}
                  style={{ width: `${weightPct}%` }}
                />
              </div>
            </div>

            {/* Inventory List */}
            {sheet.equipamentos.length > 0 ? (
              <div className="divide-y divide-[#E5DFD3] border-y border-[#E5DFD3] max-h-[220px] overflow-y-auto">
                {sheet.equipamentos.map((item) => {
                  const matchedWeapon = WEAPONS_LIST.find(
                    (w) => w.name.toLowerCase() === item.name.trim().toLowerCase()
                  );
                  const weaponHelp = matchedWeapon
                    ? buildWeaponRuleHelp({
                        name: matchedWeapon.name,
                        range: matchedWeapon.range ?? 'Corpo a corpo',
                        damageLabel: matchedWeapon.damageDice,
                        damageType: matchedWeapon.damageType,
                        properties: matchedWeapon.properties,
                        mastery: matchedWeapon.mastery,
                        notes: item.description,
                      })
                    : null;
                  const parsedPropertyTips =
                    !weaponHelp && item.properties
                      ? item.properties
                          .split(/[·,;]+/)
                          .map((p) => resolveWeaponPropertyHelp(p.trim()))
                          .filter((e): e is NonNullable<typeof e> => Boolean(e))
                          .map((e) => `${e.title}: ${e.body}`)
                      : [];
                  const itemTips = [
                    ...(weaponHelp ? weaponHelp.tips : []),
                    ...(!weaponHelp && item.properties
                      ? [`Propriedades/Efeitos: ${item.properties}`]
                      : []),
                    ...parsedPropertyTips,
                    ...(item.purchased && item.paidCopper
                      ? [
                          `Comprado por ${formatCopperToCoinsLabel(item.paidCopper)} (multiplicador ${item.priceMultiplier ?? 1}x).`,
                        ]
                      : []),
                  ];

                  return (
                  <div
                    key={item.id}
                    data-testid={`inventory-item-${item.id}`}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-[#1A1816]">{item.name}</span>
                        <InfoTip
                          title={item.name}
                          subtitle={`Qtd: ${item.quantity} · Peso un.: ${item.weightKg} kg${item.cost ? ` · Custo: ${item.cost}` : ''}`}
                          body={weaponHelp ? weaponHelp.body : item.description || item.notes || ''}
                          tips={itemTips}
                        />
                        {item.cost && (
                          <span className="text-[10px] font-mono text-[#7A5610]">{item.cost}</span>
                        )}
                        {item.purchased && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#FBF4DC] text-[#7A5610]">
                            Comprado{item.priceMultiplier && item.priceMultiplier !== 1 ? ` ${item.priceMultiplier}x` : ''}
                          </span>
                        )}
                      </div>
                      {(item.properties || item.description || item.notes) && (
                        <p className="text-[9.5px] text-[#6B6258] truncate">
                          {item.properties || item.description || item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-mono tabular-nums">
                      <span className="text-[10px] text-[#7A6F64]">
                        {(item.weightKg * item.quantity).toFixed(1)}kg
                      </span>
                      <button
                        type="button"
                        aria-label={`Diminuir quantidade de ${item.name}`}
                        onClick={() =>
                          onUpdateSheet((prev) => ({
                            ...prev,
                            equipamentos: prev.equipamentos
                              .map((eq) =>
                                eq.id === item.id ? { ...eq, quantity: eq.quantity - 1 } : eq
                              )
                              .filter((eq) => eq.quantity > 0),
                          }))
                        }
                        className="w-6 h-6 flex items-center justify-center rounded border border-[#CFC6B8] bg-white cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="min-w-[16px] text-center font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Aumentar quantidade de ${item.name}`}
                        onClick={() =>
                          onUpdateSheet((prev) => ({
                            ...prev,
                            equipamentos: prev.equipamentos.map((eq) =>
                              eq.id === item.id ? { ...eq, quantity: eq.quantity + 1 } : eq
                            ),
                          }))
                        }
                        className="w-6 h-6 flex items-center justify-center rounded border border-[#CFC6B8] bg-white cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() =>
                          onUpdateSheet((prev) => ({
                            ...prev,
                            equipamentos: prev.equipamentos.filter((eq) => eq.id !== item.id),
                          }))
                        }
                        className="p-0.5 text-[#8C8175] hover:text-[#9E1B1B] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10.5px] text-[#7A6F64] text-center py-1.5 border-y border-dashed border-[#CFC6B8]">
                Inventário vazio. Adicione pelo catálogo ou manualmente abaixo.
              </p>
            )}

            {/* Add Item Panel (Catalog OR Manual + Purchase & Price Multiplier) */}
            <form
              onSubmit={handleConfirmAddItem}
              data-testid="add-inventory-form"
              className="p-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] space-y-2"
            >
              {/* Mode Switch: Catálogo vs Item Manual */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded border border-[#8F8578] bg-white p-0.5">
                  <button
                    type="button"
                    data-testid="inv-mode-catalog"
                    onClick={() => setAddMode('catalog')}
                    className={`min-h-[26px] px-2.5 rounded-sm text-[11px] font-bold cursor-pointer ${
                      addMode === 'catalog'
                        ? 'bg-[#1A1816] text-white'
                        : 'text-[#4D453E] hover:bg-[#F3EFE6]'
                    }`}
                  >
                    Catálogo
                  </button>
                  <button
                    type="button"
                    data-testid="inv-mode-manual"
                    onClick={() => setAddMode('manual')}
                    className={`min-h-[26px] px-2.5 rounded-sm text-[11px] font-bold cursor-pointer ${
                      addMode === 'manual'
                        ? 'bg-[#1A1816] text-white'
                        : 'text-[#4D453E] hover:bg-[#F3EFE6]'
                    }`}
                  >
                    Item Manual
                  </button>
                </div>
                <span className="text-[10px] font-mono text-[#7A5610] font-bold">
                  Saldo: {totalGold} PO
                </span>
              </div>

              {addMode === 'catalog' ? (
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Selecionar item do catálogo de Equipamentos"
                    data-testid="catalog-item-select"
                    value={selectedCatalogKey}
                    onChange={(e) => setSelectedCatalogKey(e.target.value)}
                    className="flex-1 min-w-0 min-h-[32px] px-2 rounded border border-[#CFC6B8] bg-white text-xs text-[#1A1816]"
                  >
                    <option value="">Selecionar do catálogo...</option>
                    <optgroup label="Equipamentos de Aventura">
                      {unifiedCatalog
                        .filter((o) => o.group === 'Equipamentos')
                        .map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.name} ({o.cost} · {o.weightKg} kg)
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Armas">
                      {unifiedCatalog
                        .filter((o) => o.group === 'Armas')
                        .map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.name} ({o.cost} · {o.weightKg} kg)
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Armaduras">
                      {unifiedCatalog
                        .filter((o) => o.group === 'Armaduras')
                        .map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.name} ({o.cost} · {o.weightKg} kg)
                          </option>
                        ))}
                    </optgroup>
                  </select>
                  <input
                    type="number"
                    min={1}
                    aria-label="Quantidade do item"
                    data-testid="catalog-item-qty"
                    value={catalogQty}
                    onChange={(e) => setCatalogQty(e.target.value)}
                    className="w-14 min-h-[32px] px-1 rounded border border-[#CFC6B8] bg-white font-mono text-xs text-center"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-1.5">
                    <input
                      type="text"
                      required
                      data-testid="manual-item-name"
                      placeholder="Nome do item (ex.: Poção de Cura)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="col-span-12 sm:col-span-6 min-h-[30px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      data-testid="manual-item-qty"
                      aria-label="Quantidade"
                      placeholder="Qtd"
                      value={manualQty}
                      onChange={(e) => setManualQty(e.target.value)}
                      className="col-span-4 sm:col-span-2 min-h-[30px] px-1.5 rounded border border-[#CFC6B8] bg-white font-mono text-xs text-center"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      data-testid="manual-item-weight"
                      aria-label="Peso em kg"
                      placeholder="kg"
                      value={manualWeight}
                      onChange={(e) => setManualWeight(e.target.value)}
                      className="col-span-4 sm:col-span-2 min-h-[30px] px-1.5 rounded border border-[#CFC6B8] bg-white font-mono text-xs text-center"
                    />
                    <input
                      type="text"
                      data-testid="manual-item-cost"
                      aria-label="Custo (ex: 50 PO)"
                      placeholder="Custo (50 PO)"
                      value={manualCost}
                      onChange={(e) => setManualCost(e.target.value)}
                      className="col-span-4 sm:col-span-2 min-h-[30px] px-1.5 rounded border border-[#CFC6B8] bg-white font-mono text-xs text-center"
                    />
                  </div>
                  <input
                    type="text"
                    data-testid="manual-item-properties"
                    placeholder="Propriedades / Efeitos (ex.: Cura 2d4+2 PV, Ação Bônus)"
                    value={manualProperties}
                    onChange={(e) => setManualProperties(e.target.value)}
                    className="w-full min-h-[30px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
                  />
                  <input
                    type="text"
                    data-testid="manual-item-description"
                    placeholder="Descrição / observações adicionais..."
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="w-full min-h-[30px] px-2 rounded border border-[#CFC6B8] bg-white text-xs"
                  />
                </div>
              )}

              {/* Purchase Question & Price Multiplier */}
              <div className="p-2 rounded border border-[#DFD1AE] bg-[#FBF7EC] space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[11px] font-bold text-[#1A1816] inline-flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3 text-[#7A5610]" />
                    Este item foi comprado?
                  </span>
                  <div className="inline-flex rounded border border-[#B08D3B] bg-white p-0.5">
                    <button
                      type="button"
                      data-testid="purchase-mode-free"
                      onClick={() => setIsPurchased(false)}
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-bold cursor-pointer ${
                        !isPurchased
                          ? 'bg-[#1A1816] text-white'
                          : 'text-[#5C534A] hover:bg-[#FAF8F3]'
                      }`}
                    >
                      Não (Grátis)
                    </button>
                    <button
                      type="button"
                      data-testid="purchase-mode-bought"
                      onClick={() => setIsPurchased(true)}
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-bold cursor-pointer ${
                        isPurchased
                          ? 'bg-[#8A6518] text-white'
                          : 'text-[#5C534A] hover:bg-[#FAF8F3]'
                      }`}
                    >
                      Sim (Deduzir)
                    </button>
                  </div>
                </div>

                {isPurchased && (
                  <div className="space-y-1.5 pt-1 border-t border-[#E6DAB9]">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-bold text-[#7A5610] mr-0.5">
                        Multiplicador:
                      </span>
                      {PRICE_MULTIPLIER_PRESETS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          data-testid={`price-mult-${m}`}
                          onClick={() => setPriceMultiplier(String(m))}
                          className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold cursor-pointer ${
                            parsedMult === m
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
                        data-testid="price-mult-input"
                        aria-label="Multiplicador de preço customizado"
                        value={priceMultiplier}
                        onChange={(e) => setPriceMultiplier(e.target.value)}
                        className="w-14 h-6 px-1 rounded border border-[#B08D3B] bg-white font-mono text-[11px] font-bold text-center"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="text-[#5C534A]">
                        Valor final:{' '}
                        <strong
                          data-testid="purchase-final-cost-preview"
                          className="font-mono text-[#1A1816]"
                        >
                          {finalCopperCost > 0
                            ? formatCopperToCoinsLabel(finalCopperCost)
                            : '0 PC (informe custo)'}
                        </strong>
                      </span>
                      {insufficientFunds && (
                        <span className="text-[10px] font-bold text-[#9E1B1B]">
                          Saldo insuficiente (zerará moedas)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                data-testid="confirm-add-inventory-item-btn"
                disabled={addMode === 'catalog' ? !selectedCatalogOption : !manualName.trim()}
                className="w-full min-h-[34px] px-3 rounded bg-[#1A1816] text-white text-xs font-bold hover:bg-[#332E2A] disabled:opacity-40 cursor-pointer"
              >
                {isPurchased && finalCopperCost > 0
                  ? `Comprar e Adicionar (−${formatCopperToCoinsLabel(finalCopperCost)})`
                  : '+ Adicionar ao Inventário'}
              </button>

              {purchaseNotice && (
                <p
                  data-testid="purchase-feedback-notice"
                  className={`text-[11px] font-semibold px-2 py-1 rounded border ${
                    purchaseNotice.tone === 'ok'
                      ? 'bg-[#EEF6F0] border-[#B6D4BE] text-[#1B5737]'
                      : 'bg-[#FCEAEA] border-[#E0A7A7] text-[#8B1717]'
                  }`}
                >
                  {purchaseNotice.text}
                </p>
              )}
            </form>
          </div>
        )}
      </section>

      {/* 3. ITENS MÁGICOS SINTONIZADOS (Seção retrátil dedicada) */}
      <section className="official-box overflow-hidden" data-testid="section-attunement">
        <button
          type="button"
          data-testid="section-toggle-attunement"
          aria-expanded={attunementOpen}
          onClick={toggleAttunementOpen}
          className="w-full official-box-header py-1.5 px-2.5 min-h-[38px] text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {attunementOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h2 className="official-box-title truncate">
              Itens Mágicos Sintonizados
            </h2>
          </div>
          <span className="font-mono text-[10px] font-bold text-[#5C534A] shrink-0">
            {activeAttunedCount}/3
          </span>
        </button>

        {attunementOpen && (
          <div className="p-2.5 space-y-1.5">
            {sheet.sintonizacao.map((slot, idx) => (
              <div key={slot.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  aria-label={`Ativar sintonização ${idx + 1}`}
                  checked={slot.active}
                  onChange={(e) =>
                    onUpdateSheet((prev) => ({
                      ...prev,
                      sintonizacao: prev.sintonizacao.map((s) =>
                        s.id === slot.id ? { ...s, active: e.target.checked } : s
                      ),
                    }))
                  }
                  className="w-3.5 h-3.5 accent-[#5D4970] shrink-0"
                />
                <input
                  type="text"
                  placeholder={`Item sintonizado ${idx + 1}...`}
                  value={slot.name}
                  onChange={(e) =>
                    onUpdateSheet((prev) => ({
                      ...prev,
                      sintonizacao: prev.sintonizacao.map((s) =>
                        s.id === slot.id
                          ? { ...s, name: e.target.value, active: Boolean(e.target.value.trim()) }
                          : s
                      ),
                    }))
                  }
                  className="official-underline-input text-xs font-medium text-[#1A1816] placeholder:text-[#9C9285]"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. COLLAPSIBLE IDENTIDADE, IDIOMAS, APARÊNCIA & HISTÓRIA */}
      <section className="official-box overflow-hidden" data-testid="section-identity-lore">
        <button
          type="button"
          data-testid="section-toggle-identity"
          onClick={toggleIdentityOpen}
          aria-expanded={identityOpen}
          className="w-full official-box-header py-1.5 px-2.5 min-h-[38px] text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {identityOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9E1B1B] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#5C534A] shrink-0" />
            )}
            <h2 className="official-box-title truncate">
              Idiomas, Aparência & História
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-[#5C534A] shrink-0">
            {sheet.idiomas.length} idioma(s){sheet.alinhamento ? ` · ${sheet.alinhamento}` : ''}
          </span>
        </button>

        {identityOpen && (
          <div className="p-2.5 space-y-2.5 text-xs">
            {/* Idiomas */}
            <div className="space-y-1.5">
              <span className="official-label text-[#1A1816] block">
                Idiomas
              </span>
              {sheet.idiomas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {sheet.idiomas.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() =>
                        onUpdateSheet((prev) => ({
                          ...prev,
                          idiomas: prev.idiomas.filter((l) => l !== lang),
                        }))
                      }
                      title="Clique para remover idioma"
                      className="px-2 py-0.5 rounded border border-[#B8AEA0] bg-[#FAF8F3] text-[#1A1816] font-medium hover:border-[#9E1B1B] cursor-pointer"
                    >
                      {lang} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                <input
                  type="text"
                  list="languages-datalist"
                  placeholder="Adicionar idioma..."
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="flex-1 min-h-[30px] px-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs"
                />
                <datalist id="languages-datalist">
                  {[...COMMON_LANGUAGES, ...RARE_LANGUAGES].map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={handleAddLanguage}
                  aria-label="Adicionar idioma"
                  className="min-h-[30px] px-2.5 rounded bg-[#1A1816] text-white text-xs font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Retrato / Imagem do Personagem */}
            <div
              data-testid="character-portrait-section"
              className="p-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="official-label text-[#1A1816]">Imagem do Personagem</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="upload-portrait-btn"
                    onClick={() => portraitInputRef.current?.click()}
                    className="min-h-[28px] px-2.5 rounded border border-[#8A6518] bg-[#FBF4DC] text-[#7A5610] text-[11px] font-bold hover:bg-[#8A6518] hover:text-white inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    {sheet.retratoDataUrl ? 'Trocar Imagem' : 'Anexar Imagem'}
                  </button>
                  {sheet.retratoDataUrl && (
                    <button
                      type="button"
                      data-testid="remove-portrait-btn"
                      aria-label="Remover imagem do personagem"
                      onClick={() =>
                        onUpdateSheet((prev) => ({
                          ...prev,
                          retratoDataUrl: '',
                          updatedAt: new Date().toISOString(),
                        }))
                      }
                      className="min-h-[28px] px-2 rounded border border-[#D4B2B2] bg-white text-[#9E1B1B] text-[11px] font-bold hover:bg-[#FCEAEA] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      Remover
                    </button>
                  )}
                </div>
                <input
                  ref={portraitInputRef}
                  type="file"
                  accept="image/*"
                  data-testid="portrait-file-input"
                  className="hidden"
                  onChange={handlePortraitUpload}
                />
              </div>

              {portraitError && (
                <p className="text-[11px] font-semibold text-[#9E1B1B]">{portraitError}</p>
              )}

              {sheet.retratoDataUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={sheet.retratoDataUrl}
                    alt={`Retrato de ${sheet.nome || 'personagem'}`}
                    data-testid="character-portrait-preview"
                    className="w-24 h-24 rounded border-2 border-[#8F8578] object-cover bg-white shrink-0"
                  />
                  <p className="text-[11px] text-[#5C534A] leading-snug">
                    Imagem salva localmente junto com a ficha e incluída nas exportações em JSON.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-[#6B6258]">
                  Anexe uma ilustração ou foto local do seu personagem para exibir na aparência e no topo da ficha.
                </p>
              )}
            </div>

            {/* Orientação (Alinhamento) */}
            <div className="flex items-center gap-2 pt-1 border-t border-[#E5DFD3]">
              <label htmlFor="alignment-select" className="official-label text-[#1A1816] shrink-0">
                Orientação:
              </label>
              <select
                id="alignment-select"
                value={sheet.alinhamento}
                onChange={(e) =>
                  onUpdateSheet((prev) => ({ ...prev, alinhamento: e.target.value }))
                }
                className="official-underline-input text-xs font-semibold cursor-pointer"
              >
                <option value="">— Selecionar —</option>
                {ALIGNMENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Aparência */}
            <div>
              <label htmlFor="appearance-text" className="official-label block mb-1">
                Aparência
              </label>
              <textarea
                id="appearance-text"
                rows={2}
                placeholder="Traços físicos, vestes, marcas..."
                value={sheet.aparencia}
                onChange={(e) =>
                  onUpdateSheet((prev) => ({ ...prev, aparencia: e.target.value }))
                }
                className="w-full p-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816]"
              />
            </div>

            {/* História */}
            <div>
              <label htmlFor="backstory-text" className="official-label block mb-1">
                História e Personalidade
              </label>
              <textarea
                id="backstory-text"
                rows={3}
                placeholder="Origem, ideais, vínculos e defeitos..."
                value={sheet.historia}
                onChange={(e) =>
                  onUpdateSheet((prev) => ({ ...prev, historia: e.target.value }))
                }
                className="w-full p-2 rounded border border-[#CFC6B8] bg-[#FAF8F3] text-xs text-[#1A1816]"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
