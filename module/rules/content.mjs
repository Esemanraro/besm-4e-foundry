import { ATTRIBUTE_CATALOG, DEFECT_CATALOG, POWER_LEVELS, SIZE_RANKS, SKILL_GROUPS, TARGET_NUMBERS } from "./catalogs.mjs";

const CONTENT_PATHS = {
  attributes: "systems/besm4e/data/attributes.json",
  coverage: "systems/besm4e/data/coverage.json",
  defects: "systems/besm4e/data/defects.json",
  companions: "systems/besm4e/data/companions.json",
  itemLibrary: "systems/besm4e/data/item-library.json",
  itemBlueprints: "systems/besm4e/data/item-blueprints.json",
  modifiers: "systems/besm4e/data/modifiers.json",
  reference: "systems/besm4e/data/reference-data.json",
  templates: "systems/besm4e/data/templates.json"
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load BESM content from ${path}`);
  return response.json();
}

function toMap(entries, key = "id") {
  return Object.fromEntries((entries ?? []).map((entry) => [entry[key], entry]));
}

function mergeCatalogEntries(entries, fallbackCatalog) {
  return (entries ?? []).map((entry) => ({
    ...(fallbackCatalog?.[entry.id] ?? {}),
    ...entry,
    automation: {
      ...(fallbackCatalog?.[entry.id]?.automation ?? {}),
      ...(entry.automation ?? {})
    }
  }));
}

function fallbackAttributeEntries() {
  return Object.values(ATTRIBUTE_CATALOG);
}

function fallbackDefectEntries() {
  return Object.values(DEFECT_CATALOG);
}

function fallbackSkillGroups() {
  return Object.values(SKILL_GROUPS);
}

function validateContent(content) {
  if (!Array.isArray(content.attributeList) || !content.attributeList.length) {
    throw new Error("BESM attributes were not loaded.");
  }

  if (!Array.isArray(content.defectList) || !content.defectList.length) {
    throw new Error("BESM defects were not loaded.");
  }

  if (!Array.isArray(content.templateIndex?.race) || !Array.isArray(content.templateIndex?.class)) {
    throw new Error("BESM templates are incomplete.");
  }

  if (!Array.isArray(content.modifiers?.standardEnhancements) || !Array.isArray(content.modifiers?.weaponLimiters)) {
    throw new Error("BESM modifiers are incomplete.");
  }

  if (!Array.isArray(content.referenceTables)) {
    throw new Error("BESM reference tables are incomplete.");
  }

  if (!Array.isArray(content.itemBlueprints?.list)) {
    throw new Error("BESM item blueprints are incomplete.");
  }

  if (!Array.isArray(content.companions?.list)) {
    throw new Error("BESM companions are incomplete.");
  }
}

export async function loadBesmContent() {
  const [attributeData, coverage, defectData, companionData, itemLibrary, itemBlueprintData, modifiers, reference, templates] = await Promise.all([
    fetchJson(CONTENT_PATHS.attributes),
    fetchJson(CONTENT_PATHS.coverage),
    fetchJson(CONTENT_PATHS.defects),
    fetchJson(CONTENT_PATHS.companions),
    fetchJson(CONTENT_PATHS.itemLibrary),
    fetchJson(CONTENT_PATHS.itemBlueprints),
    fetchJson(CONTENT_PATHS.modifiers),
    fetchJson(CONTENT_PATHS.reference),
    fetchJson(CONTENT_PATHS.templates)
  ]);

  const attributeList = attributeData.entries?.length
    ? mergeCatalogEntries(attributeData.entries, ATTRIBUTE_CATALOG)
    : fallbackAttributeEntries();
  const defectList = defectData.entries?.length
    ? mergeCatalogEntries(defectData.entries, DEFECT_CATALOG)
    : fallbackDefectEntries();
  const skillGroupList = reference.skillGroups?.length ? reference.skillGroups : fallbackSkillGroups();

  const content = {
    attributes: toMap(attributeList),
    attributeList,
    defects: toMap(defectList),
    defectList,
    modifiers: {
      ...modifiers,
      all: [
        ...(modifiers.standardEnhancements ?? []),
        ...(modifiers.standardLimiters ?? []),
        ...(modifiers.weaponEnhancements ?? []),
        ...(modifiers.weaponLimiters ?? [])
      ],
      byId: {}
    },
    referenceData: reference,
    referenceTables: reference.referenceTables ?? [],
    powerLevels: reference.powerLevels ?? POWER_LEVELS,
    targetNumbers: reference.targetNumbers ?? TARGET_NUMBERS,
    sizeRanks: reference.sizeRanks ?? SIZE_RANKS,
    stats: reference.stats ?? null,
    skillGroups: toMap(skillGroupList),
    skillGroupList,
    benchmarks: reference.benchmarks ?? {},
    templates,
    templateIndex: {
      race: templates.race ?? [],
      class: templates.class ?? [],
      all: templates.all ?? [...(templates.race ?? []), ...(templates.class ?? [])],
      raceById: toMap(templates.race ?? []),
      classById: toMap(templates.class ?? [])
    },
    itemBlueprints: {
      list: itemBlueprintData.entries ?? [],
      byId: toMap(itemBlueprintData.entries ?? [])
    },
    companions: {
      list: companionData.entries ?? [],
      byId: toMap(companionData.entries ?? [])
    },
    itemLibrary,
    coverage
  };

  content.modifiers.byId = toMap(content.modifiers.all);
  validateContent(content);
  return content;
}

export function getBesmContent() {
  return globalThis.CONFIG?.BESM4E?.content ?? null;
}
