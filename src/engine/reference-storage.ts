import type {FindReplaceHistoryEntry,FindReplaceStyleKind,FindReplaceTextStyle} from './shared/messages';
export const DEFAULT_SETTINGS={aiProvider:'custom',aiProviderCustomName:'',apiBaseUrl:'',apiKey:'',modelName:'',iconModelName:'',customImageServiceUrl:'',removeBgApiKey:'',cutoutProvider:'',allowImageUpload:false,savePromptHistory:false,saveGeneratedImages:false,saveReplaceHistory:true,defaultImageRatio:'',defaultImageStyle:'',defaultInsertPosition:'',themeMode:'system',compactToolLabelsVisible:true,maxImageCompressBytes:8388608,allowWebpExport:true,allowLossyReplaceOriginal:false};
const pages=['cutout','transparentCrop','imageSplit','textFill','textRecognition','textSplitMerge','cleanup','replace','statistics','scale'];
export function normalizeHomeLayout(input:any){const valid=(value:any)=>Array.isArray(value)?[...new Set<string>(value.filter((id:any)=>pages.includes(id)))]:[];const ordered=valid(input?.orderedPageIds);return{orderedPageIds:[...ordered,...pages.filter(id=>!ordered.includes(id))],hiddenPageIds:valid(input?.hiddenPageIds)};}
export function normalizeTextFillCustomFields(input:any){if(!Array.isArray(input))return[];const names=new Set();return input.slice(0,20).flatMap((field:any)=>{if(typeof field?.id!=='string'||typeof field.name!=='string'||!Array.isArray(field.values))return[];const name=field.name.trim().slice(0,20);const values=[...new Set<string>(field.values.filter((v:any)=>typeof v==='string').map((v:string)=>v.trim().slice(0,100)).filter(Boolean))].slice(0,100);if(!name||names.has(name.toLowerCase())||!values.length)return[];names.add(name.toLowerCase());return[{id:field.id.slice(0,64),name,values,fillMode:['sequence','random','cycle','fixed'].includes(field.fillMode)?field.fillMode:'sequence'}];});}

export function normalizeFindReplaceHistory(input: unknown): FindReplaceHistoryEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const entries: FindReplaceHistoryEntry[] = [];
  const seen = new Set<string>();
  for (const rawEntry of input) {
    const entry = normalizeFindReplaceHistoryEntry(rawEntry);
    if (!entry) {
      continue;
    }
    const key = findReplaceHistoryKey(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push(entry);
  }

  return entries
    .sort((left, right) => right.usedAt - left.usedAt)
    .filter((entry, index, all) => all.slice(0, index).filter((item) => item.kind === entry.kind).length < 8);
}

function normalizeFindReplaceHistoryEntry(input: unknown): FindReplaceHistoryEntry | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  const candidate = input as Partial<FindReplaceHistoryEntry>;
  if (!isFindReplaceStyleKind(candidate.kind) || !Array.isArray(candidate.sourceStyles)) {
    return undefined;
  }
  const sourceStyles = candidate.sourceStyles
    .map((style) => normalizeHistoryStyle(candidate.kind as FindReplaceStyleKind, style))
    .filter((style): style is FindReplaceTextStyle => Boolean(style));
  const targetStyle = normalizeHistoryStyle(candidate.kind, candidate.targetStyle);
  const usedAt = typeof candidate.usedAt === 'number' && Number.isFinite(candidate.usedAt) && candidate.usedAt > 0
    ? candidate.usedAt
    : undefined;
  if (!sourceStyles.length || !targetStyle || !usedAt) {
    return undefined;
  }
  const uniqueSources = [...new Map(sourceStyles.map((style) => [historyStyleKey(candidate.kind as FindReplaceStyleKind, style), style])).values()]
    .sort((left, right) => historyStyleKey(candidate.kind as FindReplaceStyleKind, left).localeCompare(historyStyleKey(candidate.kind as FindReplaceStyleKind, right)));
  return { kind: candidate.kind, sourceStyles: uniqueSources, targetStyle, usedAt };
}

function normalizeHistoryStyle(kind: FindReplaceStyleKind, input: unknown): FindReplaceTextStyle | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  const style = input as FindReplaceTextStyle;
  if (kind === 'font') {
    const fontFamily = style.fontFamily?.trim();
    if (!fontFamily) return undefined;
    return { fontFamily, fontStyle: style.fontStyle?.trim() || 'Regular' };
  }
  if (kind === 'fontSize') {
    return typeof style.fontSize === 'number' && Number.isFinite(style.fontSize) && style.fontSize > 0 && style.fontSize <= 1000
      ? { fontSize: style.fontSize }
      : undefined;
  }
  const color = normalizeHistoryColor(style.color);
  return color ? { color } : undefined;
}

function normalizeHistoryColor(value: string | undefined): string | undefined {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value?.trim() ?? '');
  return match ? `#${match[1].toUpperCase()}` : undefined;
}

function isFindReplaceStyleKind(value: unknown): value is FindReplaceStyleKind {
  return value === 'font' || value === 'fontSize' || value === 'color';
}

function historyStyleKey(kind: FindReplaceStyleKind, style: FindReplaceTextStyle): string {
  if (kind === 'font') return `${style.fontFamily}\u0000${style.fontStyle || 'Regular'}`;
  if (kind === 'fontSize') return String(style.fontSize);
  return style.color ?? '';
}

function findReplaceHistoryKey(entry: Pick<FindReplaceHistoryEntry, 'kind' | 'sourceStyles' | 'targetStyle'>): string {
  return `${entry.kind}:${entry.sourceStyles.map((style) => historyStyleKey(entry.kind, style)).sort().join('|')}->${historyStyleKey(entry.kind, entry.targetStyle)}`;
}


export function updateReplaceHistory(previous:unknown,payload:any){const entry=normalizeFindReplaceHistoryEntry({...payload,usedAt:Date.now()});if(!entry)throw new Error('INVALID');const key=findReplaceHistoryKey(entry);return normalizeFindReplaceHistory([entry,...normalizeFindReplaceHistory(previous).filter(item=>findReplaceHistoryKey(item)!==key)]);}
