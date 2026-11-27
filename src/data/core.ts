import type { AbilityDefinition, AbilityKey, SkillDefinition, SkillKey } from '../types/dnd';

export const ABILITIES: AbilityDefinition[] = [
  { key: 'for', label: 'Força', shortLabel: 'FOR', skills: ['atletismo'] },
  {
    key: 'des',
    label: 'Destreza',
    shortLabel: 'DES',
    skills: ['acrobacia', 'furtividade', 'prestidigitacao'],
  },
  { key: 'con', label: 'Constituição', shortLabel: 'CON', skills: [] },
  {
    key: 'int',
    label: 'Inteligência',
    shortLabel: 'INT',
    skills: ['arcanismo', 'historia', 'investigacao', 'natureza', 'religiao'],
  },
  {
    key: 'sab',
    label: 'Sabedoria',
    shortLabel: 'SAB',
    skills: ['intuicao', 'lidar_com_animais', 'medicina', 'percepcao', 'sobrevivencia'],
  },
  {
    key: 'car',
    label: 'Carisma',
    shortLabel: 'CAR',
    skills: ['atuacao', 'enganacao', 'intimidacao', 'persuasao'],
  },
];

export const ABILITY_MAP: Record<AbilityKey, AbilityDefinition> = ABILITIES.reduce(
  (acc, item) => {
    acc[item.key] = item;
    return acc;
  },
  {} as Record<AbilityKey, AbilityDefinition>
);

export const SKILLS: SkillDefinition[] = [
  { key: 'acrobacia', label: 'Acrobacia', ability: 'des' },
  { key: 'arcanismo', label: 'Arcanismo', ability: 'int' },
  { key: 'atletismo', label: 'Atletismo', ability: 'for' },
  { key: 'atuacao', label: 'Atuação', ability: 'car' },
  { key: 'enganacao', label: 'Enganação', ability: 'car' },
  { key: 'furtividade', label: 'Furtividade', ability: 'des' },
  { key: 'historia', label: 'História', ability: 'int' },
  { key: 'intimidacao', label: 'Intimidação', ability: 'car' },
  { key: 'intuicao', label: 'Intuição', ability: 'sab' },
  { key: 'investigacao', label: 'Investigação', ability: 'int' },
  { key: 'lidar_com_animais', label: 'Lidar com Animais', ability: 'sab' },
  { key: 'medicina', label: 'Medicina', ability: 'sab' },
  { key: 'natureza', label: 'Natureza', ability: 'int' },
  { key: 'percepcao', label: 'Percepção', ability: 'sab' },
  { key: 'persuasao', label: 'Persuasão', ability: 'car' },
  { key: 'prestidigitacao', label: 'Prestidigitação', ability: 'des' },
  { key: 'religiao', label: 'Religião', ability: 'int' },
  { key: 'sobrevivencia', label: 'Sobrevivência', ability: 'sab' },
];

export const SKILL_MAP: Record<SkillKey, SkillDefinition> = SKILLS.reduce(
  (acc, item) => {
    acc[item.key] = item;
    return acc;
  },
  {} as Record<SkillKey, SkillDefinition>
);

// Bloco 2: Tabela de XP (Níveis 1-20)
export const LEVEL_XP_TABLE: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

// Bloco 2: Tabela Conjurador Completo (1º ao 9º Círculo)
export const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

// Bloco 3: Guardião e Paladino (D&D 2024 começam no Nível 1 com 2 espaços de 1º círculo)
export const HALF_CASTER_SLOTS: Record<number, number[]> = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  4: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  6: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  8: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  9: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  10: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  11: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  12: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  13: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  14: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  15: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  16: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  17: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  18: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  19: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  20: [4, 3, 3, 3, 2, 0, 0, 0, 0],
};

// Bloco 3: Cavaleiro Místico e Trapaceiro Arcano
export const THIRD_CASTER_SLOTS: Record<number, number[]> = {
  1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  4: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  5: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  6: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  7: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  8: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  9: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  10: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  11: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  12: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  13: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  14: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  15: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  16: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  17: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  18: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  19: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  20: [4, 3, 3, 1, 0, 0, 0, 0, 0],
};

// Bloco 3: Bruxo (Magia de Pacto)
export const PACT_MAGIC_TABLE: Record<number, { slots: number; slotLevel: number }> = {
  1: { slots: 1, slotLevel: 1 },
  2: { slots: 2, slotLevel: 1 },
  3: { slots: 2, slotLevel: 2 },
  4: { slots: 2, slotLevel: 2 },
  5: { slots: 2, slotLevel: 3 },
  6: { slots: 2, slotLevel: 3 },
  7: { slots: 2, slotLevel: 4 },
  8: { slots: 2, slotLevel: 4 },
  9: { slots: 2, slotLevel: 5 },
  10: { slots: 2, slotLevel: 5 },
  11: { slots: 3, slotLevel: 5 },
  12: { slots: 3, slotLevel: 5 },
  13: { slots: 3, slotLevel: 5 },
  14: { slots: 3, slotLevel: 5 },
  15: { slots: 3, slotLevel: 5 },
  16: { slots: 3, slotLevel: 5 },
  17: { slots: 4, slotLevel: 5 },
  18: { slots: 4, slotLevel: 5 },
  19: { slots: 4, slotLevel: 5 },
  20: { slots: 4, slotLevel: 5 },
};

export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const COMMON_LANGUAGES = [
  'Comum',
  'Língua de Sinais Comum',
  'Anão',
  'Dracônico',
  'Élfico',
  'Gigante',
  'Gnômico',
  'Goblin',
  'Orc',
  'Pequenino',
];

export const RARE_LANGUAGES = [
  'Abissal',
  'Celestial',
  'Dialeto Obscuro',
  'Druídico',
  'Gíria dos Ladrões',
  'Infernal',
  'Primordial',
  'Silvestre',
  'Subcomum',
];

export const ALIGNMENTS = [
  'Ordeiro e Bom (OB)',
  'Neutro e Bom (NB)',
  'Caótico e Bom (CB)',
  'Ordeiro e Neutro (ON)',
  'Neutro (N)',
  'Caótico e Neutro (CN)',
  'Ordeiro e Mau (OM)',
  'Neutro e Mau (NM)',
  'Caótico e Mau (CM)',
];
