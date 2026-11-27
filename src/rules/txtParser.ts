import type {
  AbilityKey,
  ClassDefinition,
  ClassExtraSection,
  ClassFeature,
  ClassFeatureCategory,
  CreatureStatBlock,
  FeatDefinition,
  SpellDefinition,
} from '../types/dnd';
import { CLASSES_LIST } from '../data/classes';
import { FEATS_LIST } from '../data/feats';
import { BASE_SPELLS_LIST } from '../data/spells';
import { CREATURES_LIST } from '../data/glossary';
import {
  EMBEDDED_CLASS_TXTS,
  EMBEDDED_CREATURES_TXT,
  EMBEDDED_FEATS_TXT,
  EMBEDDED_SPELL_TXTS,
} from '../data/embeddedSources';

export function sanitizeUiText(text: string): string {
  return text
    .replace(/\bblocos\s+de\s+estat[íi]sticas\b/gi, 'Estatísticas')
    .replace(/\bbloco\s+de\s+estat[íi]sticas\b/gi, 'Estatísticas')
    .replace(/\bbloco\s*\d+\b[:\s-]*/gi, '')
    .replace(/\bblocos\b/gi, 'seções')
    .replace(/\bbloco\b/gi, 'seção')
    .trim();
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const CLASS_NAME_TO_ID: Record<string, string> = {
  barbaro: 'barbaro',
  bardo: 'bardo',
  bruxo: 'bruxo',
  clerigo: 'clerigo',
  druida: 'druida',
  feiticeiro: 'feiticeiro',
  guardiao: 'guardiao',
  guerreiro: 'guerreiro',
  ladino: 'ladino',
  mago: 'mago',
  monge: 'monge',
  paladino: 'paladino',
};

export function classifyFeatureCategory(name: string, text: string): ClassFeatureCategory {
  const combined = `${name} ${text}`.toLowerCase();
  if (/aumento no valor de atributo|dádiva épica|subclasse|campeão primitivo|corpo e mente/.test(combined)) {
    return 'Evolução';
  }
  if (/conjuração|magia|truque|espaço|ritual|metamagia|arcana mística|pacto|livro de magias|círculo/.test(combined)) {
    return 'Conjuração';
  }
  if (/defesa|armadura|aura|evasão|resistência|imunidade|salvaguarda|esquiva|indomável|sobrevivente|queda lenta|defletir|proteção/.test(combined)) {
    return 'Defesa';
  }
  if (/fúria|inspiração|canalizar|forma selvagem|foco|recuperar fôlego|surto de ação|mãos consagradas|feitiçaria inata|astúcia mágica|superioridade|psiônic|reserva|descanso/.test(combined)) {
    return 'Recurso';
  }
  if (/ataque|golpe|dano|maestria|estilo de luta|crítico|frenesi|furtivo|destruição|manobra|retaliação|lâmina/.test(combined)) {
    return 'Combate';
  }
  return 'Exploração';
}

function parseFeatureBullets(lines: string[], source: 'classe' | 'subclasse'): ClassFeature[] {
  const features: ClassFeature[] = [];
  let current: ClassFeature | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Top-level feature bullet: "* Nível 1 - Nome: descrição" or "* Nível 4, 8, 12, 16 - Nome: descrição"
    const featMatch = rawLine.match(/^\*\s+N[íi]vel\s+([\d,\s]+)\s*[-–—]\s*([^:]+):?\s*(.*)$/i);
    if (featMatch) {
      const levelsRaw = featMatch[1]
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 20);
      const name = featMatch[2].trim();
      const desc = featMatch[3].trim();
      const primaryLevel = levelsRaw[0] ?? 1;
      const levelSuffix = levelsRaw.length > 1 ? ` (Níveis ${levelsRaw.join(', ')})` : '';
      const fullName = `${name}${levelSuffix}`;
      const feat: ClassFeature = {
        level: primaryLevel,
        name: fullName,
        description: desc,
        details: [],
        category: classifyFeatureCategory(name, desc),
        source,
      };
      features.push(feat);
      current = feat;
      continue;
    }

    // Sub-bullet: "  - ..." or "  * ..."
    if (/^\s+[-*]\s+/.test(rawLine) && current) {
      const detail = trimmed.replace(/^[-*]\s+/, '').trim();
      if (detail) {
        current.details = [...(current.details ?? []), detail];
      }
      continue;
    }

    // Continuation paragraph or bullet inside a feature block
    if (current && !trimmed.startsWith('#') && !trimmed.startsWith('|')) {
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        current.details = [...(current.details ?? []), trimmed.replace(/^[*-]\s+/, '').trim()];
      } else if (!current.description) {
        current.description = trimmed;
      } else {
        current.details = [...(current.details ?? []), trimmed];
      }
    }
  }

  return features.map((f) => ({
    ...f,
    description: f.description || (f.details?.[0] ?? ''),
    details: f.description ? f.details : f.details?.slice(1),
    category: classifyFeatureCategory(f.name, `${f.description} ${(f.details ?? []).join(' ')}`),
  }));
}

function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | undefined {
  const tableLines = lines.map((l) => l.trim()).filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (tableLines.length < 3) return undefined;
  const splitRow = (line: string) =>
    line
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
  const headers = splitRow(tableLines[0]);
  const rows = tableLines
    .slice(2)
    .map(splitRow)
    .filter((r) => r.length > 0 && r.some(Boolean));
  if (headers.length === 0 || rows.length === 0) return undefined;
  return { headers, rows };
}

function extractSpellIdsFromListSection(lines: string[]): string[] {
  const ids = new Set<string>();
  for (const raw of lines) {
    const m = raw.match(/^\*\s*(?:Truques|(?:\d+)[º°]\s*C[íi]rculo)[^:]*:\s*(.+)$/i);
    if (!m) continue;
    const entries = m[1].split(',');
    for (const entry of entries) {
      const cleanName = entry.replace(/\([^)]*\)/g, '').replace(/\.$/, '').trim();
      const id = slugify(cleanName);
      if (id.length >= 2) ids.add(id);
    }
  }
  return Array.from(ids);
}

/**
 * Faz o parse completo de um arquivo Bloco 3 (Classe + Subclasses + Tabela + Opções Extras + Lista de Magias)
 * e mescla sobre o ClassDefinition base sem cortar descrições nem perder mecânicas.
 */
export function parseClassBlockTxt(
  markdownText: string,
  baseClass: ClassDefinition
): { enrichedClass: ClassDefinition; classSpellIds: string[] } {
  const sections = markdownText.split(/\n(?=##\s+)/);
  let startingEquipmentText = baseClass.startingEquipmentText;
  let multiclassGains = baseClass.multiclassGains;
  let progressionTable = baseClass.progressionTable;
  let parsedClassFeatures: ClassFeature[] = [];
  const classExtraSections: ClassExtraSection[] = [];
  let classSpellIds: string[] = [];
  let updatedSubclasses = baseClass.subclasses.map((s) => ({ ...s }));

  for (const sec of sections) {
    const lines = sec.trim().split('\n');
    const heading = lines[0]?.trim() ?? '';
    const bodyLines = lines.slice(1);

    if (/^##\s+TRAÇOS BÁSICOS/i.test(heading)) {
      for (const line of bodyLines) {
        const equipM = line.match(/^\*\s*Equipamento Inicial:\s*(.+)/i);
        if (equipM) startingEquipmentText = equipM[1].trim();
        const multiM = line.match(/^\*\s*Multiclasse(?:\s*\([^)]*\))?:\s*(.+)/i);
        if (multiM) multiclassGains = multiM[1].trim();
      }
    } else if (/^##\s+TABELA DE PROGRESSÃO/i.test(heading)) {
      const tbl = parseMarkdownTable(bodyLines);
      if (tbl) progressionTable = tbl;
    } else if (/^##\s+CARACTERÍSTICAS DE CLASSE/i.test(heading)) {
      // Separate embedded ### tables (e.g. Druida's TABELA DE FORMAS DE FERAS) without dropping trailing features/sub-bullets
      const classFeatureLines: string[] = [];
      let currentTableTitle: string | null = null;
      let currentTableItems: string[] = [];

      const flushEmbeddedTable = () => {
        if (currentTableTitle && currentTableItems.length > 0) {
          classExtraSections.push({ title: currentTableTitle, items: currentTableItems });
        }
        currentTableTitle = null;
        currentTableItems = [];
      };

      for (const line of bodyLines) {
        const trimmed = line.trim();
        if (/^###\s+/.test(trimmed)) {
          flushEmbeddedTable();
          currentTableTitle = trimmed.replace(/^###\s+/, '').trim();
          continue;
        }
        if (currentTableTitle) {
          if (trimmed.startsWith('|')) {
            if (!/^\|[-|\s]+\|$/.test(trimmed)) {
              currentTableItems.push(trimmed);
            }
            continue;
          }
          if (!trimmed) {
            continue;
          }
          // Non-table content resumes class features / sub-bullets
          flushEmbeddedTable();
        }
        classFeatureLines.push(line);
      }
      flushEmbeddedTable();

      parsedClassFeatures = parseFeatureBullets(classFeatureLines, 'classe');
    } else if (/^##\s+OPÇÕES DE\s+/i.test(heading)) {
      const title = heading.replace(/^##\s+/, '').trim();
      const items = bodyLines
        .map((l) => l.trim().replace(/^[*-]\s+/, ''))
        .filter(Boolean);
      if (items.length > 0) {
        classExtraSections.push({ title, items });
      }
    } else if (/^##\s+LISTA DE MAGIAS/i.test(heading)) {
      classSpellIds = extractSpellIdsFromListSection(bodyLines);
    } else if (/^##\s+SUBCLASSES/i.test(heading)) {
      const subBlocks = bodyLines.join('\n').split(/\n(?=###\s+)/);
      for (const subRaw of subBlocks) {
        const subLines = subRaw.trim().split('\n');
        const subHeading = subLines[0]?.trim() ?? '';
        if (!subHeading.startsWith('### ')) continue;
        const rawSubTitle = subHeading.replace(/^###\s+/, '').trim();
        const rawSlug = slugify(rawSubTitle);

        // Match against existing subclass by slug or significant keyword overlap
        const matchIdx = updatedSubclasses.findIndex((s) => {
          const sSlug = slugify(s.name);
          return (
            sSlug === rawSlug ||
            rawSlug.includes(s.id) ||
            sSlug.includes(rawSlug) ||
            rawSlug.includes(sSlug)
          );
        });

        // Handle extra ### tables that belong to the previous subclass (e.g. TABELA: SURTO DE MAGIA SELVAGEM)
        if (matchIdx === -1) {
          if (/^TABELA:/i.test(rawSubTitle) && updatedSubclasses.length > 0) {
            const lastIdx = updatedSubclasses.length - 1;
            const prevSub = updatedSubclasses[lastIdx];
            const items = subLines
              .slice(1)
              .map((l) => l.trim())
              .filter((l) => l && !/^\|[-|\s]+\|$/.test(l));
            updatedSubclasses[lastIdx] = {
              ...prevSub,
              extraSections: [...(prevSub.extraSections ?? []), { title: rawSubTitle, items }],
            };
          }
          continue;
        }

        // Separate feature bullets from #### extra sections (Manobras, Tabelas, Blocos de Estatísticas)
        const h4Parts = subLines.slice(1).join('\n').split(/\n(?=####\s+)/);
        const subFeatureLines: string[] = [];
        const subExtras: ClassExtraSection[] = [];

        for (let i = 0; i < h4Parts.length; i++) {
          const part = h4Parts[i].trim();
          if (!part) continue;
          if (part.startsWith('#### ')) {
            const pLines = part.split('\n');
            const title = pLines[0].replace(/^####\s+/, '').trim();
            // Separate any trailing "* Nível X -" feature bullets that follow a #### table
            const extraItems: string[] = [];
            let switchedBackToFeatures = false;
            for (const l of pLines.slice(1)) {
              if (/^\*\s+N[íi]vel\s+\d+/i.test(l) || switchedBackToFeatures) {
                switchedBackToFeatures = true;
                subFeatureLines.push(l);
              } else {
                const t = l.trim();
                if (t && !/^\|[-|\s]+\|$/.test(t)) {
                  extraItems.push(t.replace(/^[*-]\s+/, ''));
                }
              }
            }
            if (extraItems.length > 0) {
              subExtras.push({ title: sanitizeUiText(title), items: extraItems.map(sanitizeUiText) });
            }
          } else {
            subFeatureLines.push(...part.split('\n'));
          }
        }

        const parsedSubFeatures = parseFeatureBullets(subFeatureLines, 'subclasse');
        if (parsedSubFeatures.length > 0) {
          updatedSubclasses[matchIdx] = {
            ...updatedSubclasses[matchIdx],
            features: parsedSubFeatures,
            extraSections: subExtras.length > 0 ? subExtras : updatedSubclasses[matchIdx].extraSections,
          };
        }
      }
    }
  }

  return {
    enrichedClass: {
      ...baseClass,
      startingEquipmentText,
      multiclassGains,
      progressionTable,
      features:
        parsedClassFeatures.length > 0
          ? parsedClassFeatures
          : baseClass.features.map((f) => ({
              ...f,
              source: 'classe',
              category: f.category ?? classifyFeatureCategory(f.name, f.description),
            })),
      extraSections: classExtraSections.length > 0 ? classExtraSections : baseClass.extraSections,
      subclasses: updatedSubclasses,
    },
    classSpellIds,
  };
}

function detectSpellMeta(effectText: string): {
  attackType: SpellDefinition['attackType'];
  saveAbility?: AbilityKey;
  damageFormula?: string;
  damageType?: string;
  healingFormula?: string;
} {
  const lower = effectText.toLowerCase();
  let attackType: SpellDefinition['attackType'] = 'none';
  let saveAbility: AbilityKey | undefined;

  if (lower.includes('ataque mágico à distância') || lower.includes('ataque magico a distancia')) {
    attackType = 'ranged';
  } else if (lower.includes('ataque mágico corpo a corpo') || lower.includes('ataque magico corpo a corpo')) {
    attackType = 'melee';
  } else if (
    lower.includes('salvaguarda') ||
    lower.includes('sg ') ||
    lower.includes('teste de resistência')
  ) {
    attackType = 'save';
    if (lower.includes('força') || lower.includes('sg for')) saveAbility = 'for';
    else if (lower.includes('destreza') || lower.includes('sg des')) saveAbility = 'des';
    else if (lower.includes('constituição') || lower.includes('sg con')) saveAbility = 'con';
    else if (lower.includes('inteligência') || lower.includes('sg int')) saveAbility = 'int';
    else if (lower.includes('sabedoria') || lower.includes('sg sab')) saveAbility = 'sab';
    else if (lower.includes('carisma') || lower.includes('sg car')) saveAbility = 'car';
  }

  const dmgMatch = effectText.match(
    /(\d+d\d+(?:\s*\+\s*\d+)?)\s*(?:de\s*dano\s*)?(Ígneo|Gélido|Elétrico|Trovejante|Ácido|Venenoso|Radiante|Necrótico|Psíquico|Energético|Perfurante|Cortante|Contundente)/i
  );

  let damageFormula: string | undefined;
  let damageType: string | undefined;
  if (dmgMatch) {
    damageFormula = dmgMatch[1].replace(/\s+/g, '');
    damageType = dmgMatch[2].charAt(0).toUpperCase() + dmgMatch[2].slice(1).toLowerCase();
  }

  let healingFormula: string | undefined;
  if (lower.includes('recupera') || lower.includes('cura')) {
    const healMatch = effectText.match(/(?:recupera|cura)[^.\n]*?(\d+d\d+(?:\s*\+\s*(?:\d+|Mod\.\s*Conjuração))?)/i);
    if (healMatch) {
      healingFormula = healMatch[1].replace(/\s+/g, ' ').trim();
    }
  }

  return { attackType, saveAbility, damageFormula, damageType, healingFormula };
}

export function parseSpellsTxt(markdownText: string): SpellDefinition[] {
  const spells: SpellDefinition[] = [];
  const blocks = markdownText.split(/\n(?=###\s+)/);

  for (const rawBlock of blocks) {
    const lines = rawBlock.trim().split('\n');
    const header = lines[0]?.trim() ?? '';
    if (!header.startsWith('### ')) continue;

    const rawName = header.replace(/^###\s+/, '').trim();
    if (!rawName || rawName.length > 80) continue;

    const name =
      rawName === rawName.toUpperCase()
        ? rawName
            .toLowerCase()
            .replace(/(^|\s|-|\()([a-zà-ú])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`)
            .replace(/\b(De|Da|Do|Das|Dos|E|Em|Na|No|Para|Com|Sem|Contra|Ao|À|Os|As|Um|Uma)\b/g, (w) => w.toLowerCase())
            .replace(/^[a-zà-ú]/, (c) => c.toUpperCase())
        : rawName;

    const bodyLines = lines.slice(1);
    let circleLine = '';
    let castLine = '';
    const effectLines: string[] = [];
    const higherLines: string[] = [];
    let currentField: 'none' | 'effect' | 'higher' = 'none';

    for (const rawLine of bodyLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('## ')) break;

      const circleMatch = trimmed.match(/^\*\s*\*?\*?Círculo\/Escola:?\*?\*?\s*(.+)$/i);
      if (circleMatch) {
        circleLine = circleMatch[1].trim();
        currentField = 'none';
        continue;
      }

      const castMatch = trimmed.match(/^\*\s*\*?\*?Conjuração:?\*?\*?\s*(.+)$/i);
      if (castMatch) {
        castLine = castMatch[1].trim();
        currentField = 'none';
        continue;
      }

      const effectMatch = trimmed.match(/^\*\s*\*?\*?Efeito:?\*?\*?\s*(.*)$/i);
      if (effectMatch) {
        if (effectMatch[1].trim()) effectLines.push(effectMatch[1].trim());
        currentField = 'effect';
        continue;
      }

      const higherMatch = trimmed.match(
        /^\*\s*\*?\*?(?:Círculo Superior|Aprimoramento de Truque|Em Círculos Superiores):?\*?\*?\s*(.*)$/i
      );
      if (higherMatch) {
        if (higherMatch[1].trim()) higherLines.push(higherMatch[1].trim());
        currentField = 'higher';
        continue;
      }

      // Preserve ALL sub-bullets, options, continuation lines, and tables verbatim
      if (currentField === 'effect') {
        if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          const cells = trimmed
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean);
          if (cells.length > 0) effectLines.push(`• ${cells.join(' — ')}`);
        } else if (/^[-*]\s+/.test(trimmed)) {
          effectLines.push(`• ${trimmed.replace(/^[-*]\s+/, '').trim()}`);
        } else {
          effectLines.push(trimmed);
        }
      } else if (currentField === 'higher') {
        if (/^[-*]\s+/.test(trimmed)) {
          higherLines.push(`• ${trimmed.replace(/^[-*]\s+/, '').trim()}`);
        } else {
          higherLines.push(trimmed);
        }
      }
    }

    const effectFull = effectLines.join('\n').trim();
    const higherFull = higherLines.join('\n').trim() || undefined;

    if (!circleLine && !effectFull) continue;

    let level = 0;
    const lvlMatch = circleLine.match(/(\d+)[º°]\s*Círculo/i);
    if (lvlMatch) {
      level = parseInt(lvlMatch[1], 10);
    } else if (/truque/i.test(circleLine)) {
      level = 0;
    }

    const schoolMatch = circleLine.match(
      /(Abjuração|Adivinhação|Conjuração|Encantamento|Evocação|Ilusão|Necromancia|Transmutação)/i
    );
    const school = schoolMatch ? schoolMatch[1] : 'Evocação';

    const classes: string[] = [];
    const parenMatch = circleLine.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const tokens = parenMatch[1].split(/[,;]/);
      for (const t of tokens) {
        const key = slugify(t);
        if (CLASS_NAME_TO_ID[key]) {
          classes.push(CLASS_NAME_TO_ID[key]);
        }
      }
    }

    const castParts = castLine.split('|').map((p) => p.trim());
    const castingTime = castParts[0] || '1 Ação';
    const range =
      castParts.find((p) => /^Alcance:/i.test(p))?.replace(/^Alcance:\s*/i, '') || 'Pessoal';
    const components =
      castParts
        .find((p) => /^Comp(?:onentes)?\.?:/i.test(p))
        ?.replace(/^Comp(?:onentes)?\.?:\s*/i, '') || 'V, S';
    const duration =
      castParts.find((p) => /^Duração:/i.test(p))?.replace(/^Duração:\s*/i, '') || 'Instantânea';

    const concentration = /concentração/i.test(duration);
    const ritual = /ritual/i.test(castingTime) || /ritual/i.test(circleLine);
    const materialSpecific = /po|consum|vale|custa|m\s*\(/i.test(components);

    const meta = detectSpellMeta(effectFull);

    spells.push({
      id: slugify(name),
      name,
      level,
      school,
      castingTime,
      range,
      components,
      duration,
      concentration,
      ritual,
      materialSpecific,
      classes: classes.length > 0 ? classes : ['mago'],
      description: effectFull,
      higherLevels: higherFull,
      ...meta,
    });
  }

  return spells;
}

export function parseCreaturesTxt(markdownText: string): CreatureStatBlock[] {
  const creatures: CreatureStatBlock[] = [];
  const blocks = markdownText.split(/\n(?=###\s+)/);

  for (const rawBlock of blocks) {
    const lines = rawBlock.trim().split('\n');
    const header = lines[0]?.trim() ?? '';
    if (!header.startsWith('### ')) continue;

    const rawName = header.replace(/^###\s+/, '').trim();
    if (!rawName || rawName.length > 70) continue;

    const body = lines.slice(1).join('\n');
    const typeLine = body.match(/\*\s*\*?\*?Tipo\/Tamanho:?\*?\*?\s*(.+)/i)?.[1];
    const statsLine = body.match(/\*\s*\*?\*?CA:?\*?\*?\s*(.+)/i)?.[1];
    const attrLine = body.match(/\*\s*\*?\*?Atributos:?\*?\*?\s*(.+)/i)?.[1];
    if (!typeLine || !statsLine) continue;

    const crMatch = typeLine.match(/ND\s*([\d/]+)/i);
    const acMatch = statsLine.match(/^(\d+)/);
    const hpMatch = statsLine.match(/PV:\s*([^|]+)/i);
    const speedMatch = statsLine.match(/Desl\.:\s*([^|\n]+)/i);

    const abilities: Record<AbilityKey, number> = { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };
    if (attrLine) {
      const pairs: [AbilityKey, RegExp][] = [
        ['for', /FOR\s*(\d+)/i],
        ['des', /DES\s*(\d+)/i],
        ['con', /CON\s*(\d+)/i],
        ['int', /INT\s*(\d+)/i],
        ['sab', /SAB\s*(\d+)/i],
        ['car', /CAR\s*(\d+)/i],
      ];
      for (const [k, rx] of pairs) {
        const m = attrLine.match(rx);
        if (m) abilities[k] = parseInt(m[1], 10);
      }
    }

    const sensesLine = body.match(/\*\s*\*?\*?Sentidos:?\*?\*?\s*(.+)/i)?.[1] ?? 'Percepção Passiva 10';
    const traitsLine = body.match(/\*\s*\*?\*?Traços:?\*?\*?\s*(.+)/i)?.[1] ?? '';
    const actionsLine = body.match(/\*\s*\*?\*?Ações:?\*?\*?\s*(.+)/i)?.[1] ?? '';

    const name =
      rawName === rawName.toUpperCase()
        ? rawName
            .toLowerCase()
            .replace(/(^|\s|-)([a-zà-ú])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`)
        : rawName;

    creatures.push({
      id: slugify(name),
      name,
      typeSize: typeLine.split('|')[0]?.trim() ?? typeLine.trim(),
      cr: crMatch ? crMatch[1] : '0',
      ac: acMatch ? parseInt(acMatch[1], 10) : 11,
      hp: hpMatch ? hpMatch[1].trim() : '10 (2d8)',
      speed: speedMatch ? speedMatch[1].trim() : '9 m',
      abilities,
      senses: sensesLine.split('|')[0]?.trim() ?? sensesLine,
      languages: sensesLine.match(/Idiomas?:\s*(.+)/i)?.[1]?.trim() ?? '—',
      traits: traitsLine ? traitsLine.split(';').map((t) => t.trim()).filter(Boolean) : [],
      actions: actionsLine ? actionsLine.split(';').map((a) => a.trim()).filter(Boolean) : [],
    });
  }

  return creatures;
}

function toTitleCasePt(rawName: string): string {
  if (rawName !== rawName.toUpperCase()) return rawName;
  return rawName
    .toLowerCase()
    .replace(/(^|\s|-|\()([a-zà-ú])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`)
    .replace(
      /\b(De|Da|Do|Das|Dos|E|Em|Na|No|Para|Com|Sem|Contra|Ao|À|Às|Os|As|Um|Uma)\b/g,
      (w) => w.toLowerCase()
    )
    .replace(/^[a-zà-ú]/, (c) => c.toUpperCase());
}

export function parseFeatsTxt(markdownText: string): FeatDefinition[] {
  const feats: FeatDefinition[] = [];
  let currentCategory: FeatDefinition['category'] = 'Geral';
  let defaultPrereq: string | undefined;

  const lines = markdownText.split('\n');
  let currentRawTitle = '';
  let currentBodyLines: string[] = [];

  const flushFeat = () => {
    if (!currentRawTitle) return;
    const rawHeader = currentRawTitle.trim();
    currentRawTitle = '';
    const bodyLines = currentBodyLines;
    currentBodyLines = [];
    if (bodyLines.length === 0) return;

    let repeatable = /repet[íi]vel/i.test(rawHeader);
    let prereq: string | undefined = defaultPrereq;

    const parenMatches = Array.from(rawHeader.matchAll(/\(([^)]+)\)/g));
    for (const pm of parenMatches) {
      const content = pm[1].trim();
      if (/repet[íi]vel/i.test(content)) {
        repeatable = true;
      } else if (/pr[ée]r|n[íi]vel|nv\b|for[çc]a|destreza|conjura|estilo/i.test(content)) {
        prereq = content.replace(/^pr[ée]r(?:equisito)?s?:?\s*/i, '').trim();
      }
    }

    const baseNameRaw = rawHeader.replace(/\s*\([^)]*\)/g, '').trim();
    const name = toTitleCasePt(baseNameRaw);
    const benefits: string[] = [];

    for (const rawLine of bodyLines) {
      const trimmed = rawLine.trim();
      if (!trimmed || /^\|[\s-:|]+\|$/.test(trimmed)) continue;

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        if (cells.length > 0 && !/^(ferramenta|dado|nível|item)$/i.test(cells[0])) {
          benefits.push(`Tabela: ${cells.join(' → ')}`);
        }
        continue;
      }

      if (/^\*\s+/.test(rawLine)) {
        benefits.push(trimmed.replace(/^\*\s+/, '').trim());
      } else if (/^\s+[-*]\s+/.test(rawLine)) {
        const sub = trimmed.replace(/^[-*]\s+/, '').trim();
        if (benefits.length > 0) {
          benefits[benefits.length - 1] = `${benefits[benefits.length - 1]}\n  • ${sub}`;
        } else {
          benefits.push(sub);
        }
      } else if (/^[-]\s+/.test(trimmed)) {
        benefits.push(trimmed.replace(/^[-]\s+/, '').trim());
      } else {
        if (benefits.length > 0) {
          benefits[benefits.length - 1] = `${benefits[benefits.length - 1]} ${trimmed}`;
        } else {
          benefits.push(trimmed);
        }
      }
    }

    if (benefits.length === 0) return;

    feats.push({
      id: slugify(name),
      name,
      category: currentCategory,
      prerequisite: prereq,
      repeatable: repeatable || undefined,
      grantsSpellcasting: /conjura|truque|magia de 1[º°]/i.test(benefits.join(' ')) || undefined,
      summary: benefits[0],
      benefits,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      flushFeat();
      const upper = trimmed.toUpperCase();
      if (upper.includes('ORIGEM')) {
        currentCategory = 'Origem';
        defaultPrereq = undefined;
      } else if (upper.includes('ESTILO DE LUTA')) {
        currentCategory = 'Estilo de Luta';
        defaultPrereq = 'Característica Estilo de Luta';
      } else if (upper.includes('DÁDIVA ÉPICA') || upper.includes('DADIVA EPICA')) {
        currentCategory = 'Dádiva Épica';
        defaultPrereq = 'Nível 19+';
      } else if (upper.includes('GERAIS')) {
        currentCategory = 'Geral';
        defaultPrereq = 'Nível 4+';
      }
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushFeat();
      currentRawTitle = trimmed.replace(/^###\s+/, '').trim();
      continue;
    }

    if (currentRawTitle) {
      currentBodyLines.push(line);
    }
  }
  flushFeat();

  return feats;
}

export function mergeFeatsById(base: FeatDefinition[], incoming: FeatDefinition[]): FeatDefinition[] {
  const bySlug = new Map<string, FeatDefinition>();
  for (const f of incoming) {
    bySlug.set(slugify(f.name), f);
    bySlug.set(f.id, f);
  }

  const usedIncomingIds = new Set<string>();
  const result: FeatDefinition[] = [];

  for (const baseFeat of base) {
    const match =
      bySlug.get(baseFeat.id) ??
      bySlug.get(slugify(baseFeat.name)) ??
      incoming.find((f) => {
        const a = slugify(baseFeat.name);
        const b = slugify(f.name);
        return a === b || (a.length >= 6 && (b.startsWith(a) || a.startsWith(b)));
      });

    if (match) {
      usedIncomingIds.add(match.id);
      result.push({
        ...baseFeat,
        prerequisite: match.prerequisite ?? baseFeat.prerequisite,
        repeatable: match.repeatable ?? baseFeat.repeatable,
        summary: baseFeat.summary,
        benefits: match.benefits.length > 0 ? match.benefits : baseFeat.benefits,
      });
    } else {
      result.push(baseFeat);
    }
  }

  for (const inc of incoming) {
    if (!usedIncomingIds.has(inc.id)) {
      result.push(inc);
    }
  }

  return result;
}

export function mergeSpellsById(base: SpellDefinition[], incoming: SpellDefinition[]): SpellDefinition[] {
  const map = new Map<string, SpellDefinition>();
  for (const s of base) map.set(s.id, s);
  for (const s of incoming) {
    const existing = map.get(s.id);
    if (!existing) {
      map.set(s.id, s);
    } else {
      map.set(s.id, {
        ...s,
        description: s.description.length >= existing.description.length ? s.description : existing.description,
        higherLevels: s.higherLevels ?? existing.higherLevels,
        attackType: existing.attackType !== 'none' ? existing.attackType : s.attackType,
        saveAbility: existing.saveAbility ?? s.saveAbility,
        damageFormula: existing.damageFormula ?? s.damageFormula,
        damageType: existing.damageType ?? s.damageType,
        healingFormula: existing.healingFormula ?? s.healingFormula,
        classes: Array.from(new Set([...existing.classes, ...s.classes])),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'));
}

export function mergeCreaturesById(base: CreatureStatBlock[], incoming: CreatureStatBlock[]): CreatureStatBlock[] {
  const map = new Map<string, CreatureStatBlock>();
  for (const c of base) map.set(c.id, c);
  for (const c of incoming) {
    if (!map.has(c.id)) map.set(c.id, c);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

let cachedHydratedCompendiums: {
  classes: ClassDefinition[];
  spells: SpellDefinition[];
  creatures: CreatureStatBlock[];
  feats: FeatDefinition[];
  loadedFilesCount: number;
} | null = null;

/**
 * Hidrata instantaneamente todas as 12 Classes, todos os Talentos oficiais, todas as Magias (A–Z)
 * e todas as Criaturas diretamente dos dados embutidos (100% offline / compatível com GitHub Pages).
 */
export function getHydratedCompendiums(): {
  classes: ClassDefinition[];
  spells: SpellDefinition[];
  creatures: CreatureStatBlock[];
  feats: FeatDefinition[];
  loadedFilesCount: number;
} {
  if (cachedHydratedCompendiums) return cachedHydratedCompendiums;

  let loadedFilesCount = 0;
  const parsedSpells: SpellDefinition[] = [];
  const parsedCreatures: CreatureStatBlock[] = [];
  const parsedFeats: FeatDefinition[] = [];
  const enrichedClassMap = new Map<string, ClassDefinition>(CLASSES_LIST.map((c) => [c.id, c]));
  const spellClassMembership: Record<string, Set<string>> = {};

  for (const baseCls of CLASSES_LIST) {
    const txt = EMBEDDED_CLASS_TXTS[baseCls.id];
    if (!txt) continue;
    const { enrichedClass, classSpellIds } = parseClassBlockTxt(txt, baseCls);
    enrichedClassMap.set(baseCls.id, enrichedClass);
    for (const spId of classSpellIds) {
      if (!spellClassMembership[spId]) spellClassMembership[spId] = new Set();
      spellClassMembership[spId].add(baseCls.id);
    }
    loadedFilesCount++;
  }

  for (const txt of EMBEDDED_SPELL_TXTS) {
    const items = parseSpellsTxt(txt);
    if (items.length > 0) {
      parsedSpells.push(...items);
      loadedFilesCount++;
    }
  }

  if (EMBEDDED_CREATURES_TXT) {
    const items = parseCreaturesTxt(EMBEDDED_CREATURES_TXT);
    if (items.length > 0) {
      parsedCreatures.push(...items);
      loadedFilesCount++;
    }
  }

  if (EMBEDDED_FEATS_TXT) {
    const items = parseFeatsTxt(EMBEDDED_FEATS_TXT);
    if (items.length > 0) {
      parsedFeats.push(...items);
      loadedFilesCount++;
    }
  }

  const mergedSpells = mergeSpellsById(BASE_SPELLS_LIST, parsedSpells).map((sp) => {
    const extraClasses = spellClassMembership[sp.id];
    if (!extraClasses || extraClasses.size === 0) return sp;
    return {
      ...sp,
      classes: Array.from(new Set([...sp.classes, ...Array.from(extraClasses)])),
    };
  });

  cachedHydratedCompendiums = {
    classes: CLASSES_LIST.map((c) => enrichedClassMap.get(c.id) ?? c),
    spells: mergedSpells,
    creatures: mergeCreaturesById(CREATURES_LIST, parsedCreatures),
    feats: mergeFeatsById(FEATS_LIST, parsedFeats),
    loadedFilesCount,
  };

  return cachedHydratedCompendiums;
}

export async function hydrateAttachedBlocks(): Promise<{
  classes: ClassDefinition[];
  spells: SpellDefinition[];
  creatures: CreatureStatBlock[];
  feats: FeatDefinition[];
  loadedFilesCount: number;
}> {
  return getHydratedCompendiums();
}
