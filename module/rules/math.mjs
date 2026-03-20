import { ATTRIBUTE_CATALOG, DEFECT_CATALOG, SIZE_RANKS, SKILL_GROUPS } from "./catalogs.mjs";
import { getBesmContent } from "./content.mjs";

const MOVEMENT_SPEEDS = {
  flight: [0, 10, 30, 100, 300, 1000, 3000],
  ground: [0, 10, 30, 100, 300, 1000, 3000],
  superspeed: [0, 100, 300, 1000, 3000, 10000, 30000],
  water: [0, 10, 30, 100, 300, 1000, 3000]
};

const SHORTCOMING_ASPECTS = {
  body: ["agility", "endurance", "strength", "immune", "manual dexterity", "running speed"],
  mind: ["creativity", "perception", "reason", "common sense", "intuition", "memory"],
  soul: ["charisma", "luck", "willpower", "composure", "empathy", "self-discipline"]
};

const PASSIVE_CONFIGURATION_WARNINGS = {
  "alternate-form": "Alternate Form is stored on the sheet but requires a manual active-form toggle.",
  "dynamic-powers": "Dynamic Powers are stored on the sheet but point reallocation is still manual.",
  metamorphosis: "Metamorphosis is stored on the sheet but transformation state is still manual.",
  "power-flux": "Power Flux is stored on the sheet but reallocation is still manual.",
  "power-variation": "Power Variation is stored on the sheet but per-scene swapping is still manual."
};

export function getCatalogEntry(itemType, catalogId) {
  if (!catalogId) return null;
  const content = getBesmContent();
  if (itemType === "attribute") return content?.attributes?.[catalogId] ?? ATTRIBUTE_CATALOG[catalogId] ?? null;
  if (itemType === "defect") return content?.defects?.[catalogId] ?? DEFECT_CATALOG[catalogId] ?? null;
  return null;
}

export function getSkillGroupDefinition(id) {
  return getBesmContent()?.skillGroups?.[id] ?? SKILL_GROUPS[id] ?? null;
}

export function getSizeProfile(rank = 0) {
  const sizeRanks = getBesmContent()?.sizeRanks ?? SIZE_RANKS;
  return sizeRanks[String(rank)] ?? sizeRanks["0"];
}

export function getModifierDefinition(id) {
  return getBesmContent()?.modifiers?.byId?.[id] ?? null;
}

export function getSelectedModifiers(item) {
  return Array.isArray(item?.system?.mods) ? item.system.mods : [];
}

export function getModifierSlotTotals(item) {
  let enhancementSlots = Number(item?.system?.enhancementSlots) || 0;
  let limiterSlots = Number(item?.system?.limiterSlots) || 0;

  for (const selected of getSelectedModifiers(item)) {
    const definition = getModifierDefinition(selected.id);
    if (!definition) continue;
    const assignments = Math.max(Number(selected.assignments) || 1, 1);
    const slots = (Number(definition.slotCost) || 0) * assignments;
    if (definition.kind === "enhancement") enhancementSlots += slots;
    if (definition.kind === "limiter") limiterSlots += slots;
  }

  return { enhancementSlots, limiterSlots };
}

export function statPointCost(value = 0) {
  const safe = Math.max(Number(value) || 0, 0);
  if (safe <= 12) return safe * 2;
  return 24 + ((safe - 12) * 4);
}

export function buildRollFormula(mode = "normal", bonus = 0) {
  const base = {
    normal: "2d6",
    minorEdge: "3d6kh2",
    majorEdge: "4d6kh2",
    minorObstacle: "3d6kl2",
    majorObstacle: "4d6kl2"
  }[mode] ?? "2d6";

  const numericBonus = Number(bonus) || 0;
  if (!numericBonus) return base;
  return `${base} + ${numericBonus}`;
}

export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function statFromText(value) {
  const text = normalizeText(value);
  if (/\bbody\b/.test(text)) return "body";
  if (/\bmind\b/.test(text)) return "mind";
  if (/\bsoul\b/.test(text)) return "soul";
  return "";
}

function getMovementSpeed(profile, level) {
  const safe = Math.max(Math.min(Number(level) || 0, 6), 0);
  return MOVEMENT_SPEEDS[profile]?.[safe] ?? 0;
}

function getSpaceflightLabel(level) {
  const safe = Math.max(Number(level) || 0, 0);
  if (safe <= 0) return "";
  if (safe === 1) return "Primitive near-planetary";
  if (safe === 2) return "Slow interplanetary";
  if (safe === 3) return "Average interplanetary";
  if (safe === 4) return "Fast interplanetary";
  if (safe === 5) return "Extrasolar";
  return "Faster-than-light";
}

function getItemText(item) {
  return normalizeText([
    item?.name,
    item?.system?.specialization,
    item?.system?.selectedStat,
    item?.system?.notes
  ].filter(Boolean).join(" "));
}

function getSizeChangeDirection(item) {
  const text = getItemText(item);
  if (/(decrease|smaller|shrink|shrinks|reduce|reduced|miniature)/.test(text)) return -1;
  if (/(increase|larger|grow|grows|enlarge|expanded|expands|giant)/.test(text)) return 1;
  return 0;
}

function getShortcomingStat(item) {
  const explicit = statFromText(item?.system?.selectedStat);
  if (explicit) return explicit;

  const text = getItemText(item);
  for (const [stat, aspects] of Object.entries(SHORTCOMING_ASPECTS)) {
    if (!new RegExp(`\\b${stat}\\b`).test(text)) continue;
    if (aspects.some((aspect) => text.includes(aspect))) return "";
    return stat;
  }

  return "";
}

export function specializationMatches(source, target) {
  const sourceText = normalizeText(source);
  const targetText = normalizeText(target);
  if (!sourceText) return true;
  if (!targetText) return sourceText.includes("all") || sourceText === "any";
  if (sourceText.includes("all") || sourceText === "any") return true;
  return sourceText === targetText;
}

export function getItemEffectiveLevel(item) {
  const level = Number(item?.system?.level) || 0;
  const { enhancementSlots: enhancements, limiterSlots: limiters } = getModifierSlotTotals(item);
  return Math.max(level - enhancements + limiters, 0);
}

function applySharedOwnership(cost, item) {
  const owners = Math.max(Number(item?.system?.sharedOwners) || 1, 1);
  if (owners <= 1) return cost;
  return Math.ceil(cost / owners);
}

export function resolveItemPointCost(item) {
  const system = item.system ?? {};
  const manual = Number(system.manualPointCost) || 0;
  const catalog = getCatalogEntry(item.type, system.catalogId);
  if (system.useManualPointCost) return applySharedOwnership(manual, item);

  if (item.type === "attribute") {
    const level = Math.max(Number(system.level) || 0, 0);
    if (!catalog) return applySharedOwnership(manual, item);
    if (catalog.costType === "perLevel") {
      let cost = level * (catalog.costPerLevel ?? 0);
      if (getSelectedModifiers(item).some((modifier) => modifier.id === "alt-munition")) cost = Math.ceil(cost / 2);
      return applySharedOwnership(cost, item);
    }
    if (catalog.costType === "skillGroup") {
      const group = getSkillGroupDefinition(system.skillGroup);
      return applySharedOwnership(level * (group?.costPerLevel ?? 0), item);
    }
    return applySharedOwnership(manual, item);
  }

  if (item.type === "defect") {
    if (!catalog) return manual;
    if (catalog.costType === "special") return manual;
    const rank = Math.max(Math.min(Number(system.rank) || 1, 3), 1);
    return catalog.pointsByRank?.[rank - 1] ?? manual;
  }

  if (item.type === "template") {
    const content = getBesmContent();
    const template = content?.templateIndex?.all?.find((entry) => entry.id === system.templateId);
    return template?.points ?? manual;
  }

  return applySharedOwnership(manual, item);
}

export function summarizeActorItems(items) {
  const summary = {
    attackMastery: 0,
    defenceMastery: 0,
    massiveDamage: 0,
    superstrength: 0,
    tough: 0,
    energised: 0,
    armourRating: 0,
    forceFieldRating: 0,
    extraActions: 0,
    ineptAttack: 0,
    ineptDefence: 0,
    fragile: 0,
    reducedDamage: 0,
    sizeRankMod: 0,
    statMods: { body: 0, mind: 0, soul: 0 },
    movement: {
      groundMax: 0,
      flightMax: 0,
      waterMax: 0,
      spaceflightLevel: 0,
      spaceflightLabel: ""
    }
  };

  for (const item of items) {
    const catalog = getCatalogEntry(item.type, item.system.catalogId);

    if (item.type === "attribute") {
      if (!catalog?.automation) continue;
      const effective = getItemEffectiveLevel(item);
      const automation = catalog.automation;
      if (automation.attackCombatValuePerLevel) summary.attackMastery += effective * automation.attackCombatValuePerLevel;
      if (automation.defenceCombatValuePerLevel) summary.defenceMastery += effective * automation.defenceCombatValuePerLevel;
      if (automation.damageMultiplierPerLevel) summary.massiveDamage += effective * automation.damageMultiplierPerLevel;
      if (automation.muscleDamageMultiplierPerLevel) summary.superstrength += effective * automation.muscleDamageMultiplierPerLevel;
      if (automation.healthPointsPerLevel) summary.tough += effective * (automation.healthPointsPerLevel / 10);
      if (automation.energyPointsPerLevel) summary.energised += effective * (automation.energyPointsPerLevel / 10);
      if (automation.armourRatingPerLevel && item.system.catalogId === "force-field") summary.forceFieldRating += effective * (automation.armourRatingPerLevel / 10);
      if (automation.armourRatingPerLevel && item.system.catalogId === "armour") summary.armourRating += effective * automation.armourRatingPerLevel;
      if (automation.actionsPerLevel) summary.extraActions += effective * automation.actionsPerLevel;
      if (automation.augmentsSelectedStatPerLevel && item.system.selectedStat) {
        const stat = normalizeText(item.system.selectedStat);
        if (summary.statMods[stat] !== undefined) summary.statMods[stat] += effective * automation.augmentsSelectedStatPerLevel;
      }
      if (automation.sizeRankPerLevel) {
        const direction = getSizeChangeDirection(item);
        summary.sizeRankMod += effective * automation.sizeRankPerLevel * direction;
      }
      if (automation.movementProfile === "ground") summary.movement.groundMax = Math.max(summary.movement.groundMax, getMovementSpeed("ground", effective));
      if (automation.movementProfile === "superspeed") summary.movement.groundMax = Math.max(summary.movement.groundMax, getMovementSpeed("superspeed", effective));
      if (automation.movementProfile === "flight") summary.movement.flightMax = Math.max(summary.movement.flightMax, getMovementSpeed("flight", effective));
      if (automation.movementProfile === "water") summary.movement.waterMax = Math.max(summary.movement.waterMax, getMovementSpeed("water", effective));
      if (automation.movementProfile === "spaceflight") {
        const level = Math.max(Number(effective) || 0, 0);
        if (level > summary.movement.spaceflightLevel) {
          summary.movement.spaceflightLevel = level;
          summary.movement.spaceflightLabel = getSpaceflightLabel(level);
        }
      }
    }

    if (item.type === "defect") {
      const rank = Math.max(Math.min(Number(item.system.rank) || 1, 3), 1);
      const automation = catalog?.automation ?? {};
      if (automation?.attackCombatValuePerRank) summary.ineptAttack += rank * automation.attackCombatValuePerRank;
      if (automation?.defenceCombatValuePerRank) summary.ineptDefence += rank * automation.defenceCombatValuePerRank;
      if (automation?.healthPointsPerRank) summary.fragile += rank * (automation.healthPointsPerRank / 10);
      if (automation?.damageMultiplierPerRank) summary.reducedDamage += rank * automation.damageMultiplierPerRank;
      if (item.system.catalogId === "shortcoming") {
        const stat = getShortcomingStat(item);
        const penalty = Math.floor(Math.abs(resolveItemPointCost(item)) / 2);
        if (stat && penalty && summary.statMods[stat] !== undefined) summary.statMods[stat] -= penalty;
      }
    }
  }

  return summary;
}

export function summarizeTemplateItems(items) {
  return items.reduce((summary, item) => {
    if (item.type !== "template") return summary;
    summary.body += Number(item.system.templateBody) || 0;
    summary.mind += Number(item.system.templateMind) || 0;
    summary.soul += Number(item.system.templateSoul) || 0;
    summary.sizeRank += Number(item.system.templateSizeRank) || 0;
    return summary;
  }, { body: 0, mind: 0, soul: 0, sizeRank: 0 });
}

export function getMatchingCombatBonus(actor, mode, group) {
  const catalogId = mode === "melee" ? "melee-attack" : "ranged-attack";
  return actor.items.contents.reduce((total, item) => {
    if (item.type !== "attribute" || item.system.catalogId !== catalogId) return total;
    if (!specializationMatches(item.system.specialization, group)) return total;
    return total + getItemEffectiveLevel(item);
  }, 0);
}

export function getLightningReflexesMode(actor) {
  let count = 0;
  for (const item of actor.items) {
    if (item.type !== "attribute" || item.system.catalogId !== "combat-technique") continue;
    if (normalizeText(item.system.specialization) === "lightning reflexes") count += Number(item.system.level) || 0;
  }

  if (count >= 2) return "majorEdge";
  if (count >= 1) return "minorEdge";
  return "normal";
}

export function calculateWeaponRollBonus(actor, item) {
  const mode = normalizeText(item.system.attackMode) === "ranged" ? "ranged" : "melee";
  const group = item.system.weaponGroup;
  const system = actor.system;

  let bonus = Number(system.combat.attack) || 0;
  bonus += Number(item.system.attackBonus) || 0;
  bonus += getMatchingCombatBonus(actor, mode, group);

  if (mode === "ranged") bonus += Number(system.size.attackRangedMod) || 0;

  return bonus;
}

export function calculateWeaponDamage(actor, item) {
  const level = Number(item.system.effectiveLevel) || getItemEffectiveLevel(item);
  const system = actor.system;
  const muscle = !!item.system.musclePowered;
  const multiplier = muscle ? Number(system.combat.muscleDamageMultiplier) || 0 : Number(system.combat.damageMultiplier) || 0;
  const attackBonus = calculateWeaponRollBonus(actor, item);
  const sizeDamage = Number(system.size.strengthDamage) || 0;
  return (level * multiplier) + attackBonus + sizeDamage + (Number(item.system.damageBonus) || 0);
}

export function computeBenchmarkWarnings(actor) {
  const content = getBesmContent();
  const benchmark = content?.benchmarks?.[actor.system.powerLevel];
  if (!benchmark) return [];

  const warnings = [];
  const effectiveBody = Number(actor.system.effectiveStats?.body) || 0;
  const effectiveMind = Number(actor.system.effectiveStats?.mind) || 0;
  const effectiveSoul = Number(actor.system.effectiveStats?.soul) || 0;
  const maxStat = Math.max(effectiveBody, effectiveMind, effectiveSoul);
  if (maxStat > benchmark.maximumStat) warnings.push(`Stat value ${maxStat} exceeds the suggested ${benchmark.maximumStat} for this power level.`);

  const effectiveLevels = actor.items.contents
    .filter((item) => item.type === "attribute")
    .map((item) => Number(item.system.effectiveLevel) || 0);
  const maxAttributeLevel = effectiveLevels.length ? Math.max(...effectiveLevels) : 0;
  if (maxAttributeLevel > benchmark.maximumAttributeLevel) warnings.push(`Attribute effective level ${maxAttributeLevel} exceeds the suggested ${benchmark.maximumAttributeLevel} for this power level.`);

  const combat = Number(actor.system.combat.attack) || 0;
  if (combat < benchmark.combat.minimum || combat > benchmark.combat.maximum) warnings.push(`Attack Combat Value ${combat} sits outside the suggested ${benchmark.combat.minimum}-${benchmark.combat.maximum} range.`);

  const defence = Number(actor.system.combat.defence) || 0;
  if (defence < benchmark.combat.minimum || defence > benchmark.combat.maximum) warnings.push(`Defence Combat Value ${defence} sits outside the suggested ${benchmark.combat.minimum}-${benchmark.combat.maximum} range.`);

  const health = Number(actor.system.resources.health.max) || 0;
  if (health < benchmark.resources.minimum || health > benchmark.resources.maximum) warnings.push(`Health Points ${health} sit outside the suggested ${benchmark.resources.minimum}-${benchmark.resources.maximum} range.`);

  const energy = Number(actor.system.resources.energy.max) || 0;
  if (energy < benchmark.resources.minimum || energy > benchmark.resources.maximum) warnings.push(`Energy Points ${energy} sit outside the suggested ${benchmark.resources.minimum}-${benchmark.resources.maximum} range.`);

  const damageMultiplier = Number(actor.system.combat.damageMultiplier) || 0;
  if (damageMultiplier < benchmark.damageMultiplier.minimum || damageMultiplier > benchmark.damageMultiplier.maximum) warnings.push(`Damage Multiplier ${damageMultiplier} sits outside the suggested ${benchmark.damageMultiplier.minimum}-${benchmark.damageMultiplier.maximum} range.`);

  return warnings;
}

export function computeBuildWarnings(actor) {
  const warnings = [];

  for (const item of actor.items.contents) {
    if (item.type === "attribute") {
      const catalogId = item.system.catalogId;
      if (catalogId === "augmented" && !statFromText(item.system.selectedStat)) {
        warnings.push(`${item.name} needs a selected Stat before it can change Body, Mind, or Soul.`);
      }
      if (catalogId === "skill-group" && !normalizeText(item.system.skillGroup)) {
        warnings.push(`${item.name} needs a Skill Group before its point cost and rolls are complete.`);
      }
      if (catalogId === "size-change" && !getSizeChangeDirection(item)) {
        warnings.push(`${item.name} needs an explicit increase/decrease specialization before passive Size Rank math can apply.`);
      }
      if (catalogId === "special-movement" && getItemText(item).includes("fast")) {
        warnings.push(`${item.name} includes Special Movement (Fast), which is stored but still needs manual movement interpretation.`);
      }
      if (PASSIVE_CONFIGURATION_WARNINGS[catalogId]) {
        warnings.push(`${item.name}: ${PASSIVE_CONFIGURATION_WARNINGS[catalogId]}`);
      }
    }

    if (item.type === "defect" && item.system.catalogId === "shortcoming") {
      const stat = getShortcomingStat(item);
      const points = Math.abs(resolveItemPointCost(item));
      if (stat && points < 2) {
        warnings.push(`${item.name} is targeting the full ${stat} Stat, but fewer than 2 defect points will not reduce the effective Stat yet.`);
      }
      if (!stat && /\bbody\b|\bmind\b|\bsoul\b/.test(getItemText(item))) {
        warnings.push(`${item.name} references a Stat, but it looks aspect-specific rather than a full-stat Shortcoming, so only roll penalties are stored.`);
      }
    }
  }

  return [...new Set(warnings)];
}

export function getActorEffectiveStat(actor, stat) {
  return Number(actor?.system?.effectiveStats?.[stat]) || Number(actor?.system?.stats?.[stat]) || 0;
}
