import { getItemEffectiveLevel, getSizeProfile, resolveItemPointCost, statPointCost, summarizeActorItems, summarizeTemplateItems } from "../rules/math.mjs";

const fields = foundry.data.fields;

function resourceSchema() {
  return new fields.SchemaField({
    value: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
    max: new fields.NumberField({ integer: true, initial: 0, min: 0 })
  });
}

function modifierSchema() {
  return new fields.SchemaField({
    id: new fields.StringField({ initial: "" }),
    assignments: new fields.NumberField({ integer: true, initial: 1, min: 1 })
  });
}

export class BesmActorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      playerName: new fields.StringField({ initial: "" }),
      gmName: new fields.StringField({ initial: "" }),
      species: new fields.StringField({ initial: "" }),
      occupation: new fields.StringField({ initial: "" }),
      habitat: new fields.StringField({ initial: "" }),
      sizeText: new fields.StringField({ initial: "" }),
      powerLevel: new fields.StringField({ initial: "heroic" }),
      targetPoints: new fields.NumberField({ integer: true, initial: 75, min: 0 }),
      stats: new fields.SchemaField({
        body: new fields.NumberField({ integer: true, initial: 4, min: 0 }),
        mind: new fields.NumberField({ integer: true, initial: 4, min: 0 }),
        soul: new fields.NumberField({ integer: true, initial: 4, min: 0 })
      }),
      effectiveStats: new fields.SchemaField({
        body: new fields.NumberField({ integer: true, initial: 4, min: 0 }),
        mind: new fields.NumberField({ integer: true, initial: 4, min: 0 }),
        soul: new fields.NumberField({ integer: true, initial: 4, min: 0 })
      }),
      size: new fields.SchemaField({
        rank: new fields.NumberField({ integer: true, initial: 0, min: -10, max: 10 }),
        effectiveRank: new fields.NumberField({ integer: true, initial: 0, min: -10, max: 10 }),
        label: new fields.StringField({ initial: "Medium" }),
        pointCost: new fields.NumberField({ integer: true, initial: 0 }),
        strengthDamage: new fields.NumberField({ integer: true, initial: 0 }),
        durability: new fields.NumberField({ integer: true, initial: 0 }),
        attackRangedMod: new fields.NumberField({ integer: true, initial: 0 }),
        defenceRangedMod: new fields.NumberField({ integer: true, initial: 0 }),
        rangeSpeedMultiplier: new fields.NumberField({ initial: 1 }),
        liftingMultiplier: new fields.NumberField({ initial: 1 })
      }),
      creation: new fields.SchemaField({
        statPoints: new fields.NumberField({ integer: true, initial: 0 }),
        sizePoints: new fields.NumberField({ integer: true, initial: 0 }),
        attributePoints: new fields.NumberField({ integer: true, initial: 0 }),
        defectPoints: new fields.NumberField({ integer: true, initial: 0 }),
        templatePoints: new fields.NumberField({ integer: true, initial: 0 }),
        gearPoints: new fields.NumberField({ integer: true, initial: 0 }),
        totalSpent: new fields.NumberField({ integer: true, initial: 0 }),
        unspent: new fields.NumberField({ integer: true, initial: 0 })
      }),
      combat: new fields.SchemaField({
        base: new fields.NumberField({ integer: true, initial: 0 }),
        attack: new fields.NumberField({ integer: true, initial: 0 }),
        defence: new fields.NumberField({ integer: true, initial: 0 }),
        damageMultiplier: new fields.NumberField({ integer: true, initial: 5 }),
        muscleDamageMultiplier: new fields.NumberField({ integer: true, initial: 5 }),
        unarmedDamage: new fields.NumberField({ integer: true, initial: 0 }),
        armourRating: new fields.NumberField({ integer: true, initial: 0 }),
        forceFieldRating: new fields.NumberField({ integer: true, initial: 0 }),
        actions: new fields.NumberField({ integer: true, initial: 1, min: 1 })
      }),
      movement: new fields.SchemaField({
        walk: new fields.NumberField({ initial: 0 }),
        jog: new fields.NumberField({ initial: 0 }),
        run: new fields.NumberField({ initial: 0 }),
        sprint: new fields.NumberField({ initial: 0 }),
        crawl: new fields.NumberField({ initial: 0 }),
        swim: new fields.NumberField({ initial: 0 }),
        groundMax: new fields.NumberField({ initial: 0 }),
        flightMax: new fields.NumberField({ initial: 0 }),
        waterMax: new fields.NumberField({ initial: 0 }),
        spaceflightLevel: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
        spaceflightLabel: new fields.StringField({ initial: "" })
      }),
      resources: new fields.SchemaField({
        health: resourceSchema(),
        energy: resourceSchema()
      }),
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const items = this.parent?.items ?? [];
    const bonuses = summarizeActorItems(items);
    const templateBonuses = summarizeTemplateItems(items);

    const body = Math.max((Number(this.stats.body) || 0) + bonuses.statMods.body + templateBonuses.body, 0);
    const mind = Math.max((Number(this.stats.mind) || 0) + bonuses.statMods.mind + templateBonuses.mind, 0);
    const soul = Math.max((Number(this.stats.soul) || 0) + bonuses.statMods.soul + templateBonuses.soul, 0);
    this.effectiveStats.body = body;
    this.effectiveStats.mind = mind;
    this.effectiveStats.soul = soul;

    const baseSize = getSizeProfile(Number(this.size.rank) || 0);
    const effectiveSizeRank = Math.max(Math.min((Number(this.size.rank) || 0) + templateBonuses.sizeRank + bonuses.sizeRankMod, 10), -10);
    const size = getSizeProfile(effectiveSizeRank);
    this.size.effectiveRank = effectiveSizeRank;
    this.size.label = size.label;
    this.size.pointCost = size.pointCost;
    this.size.strengthDamage = size.strengthDamage;
    this.size.durability = size.durability;
    this.size.attackRangedMod = size.attackRangedMod;
    this.size.defenceRangedMod = size.defenceRangedMod;
    this.size.rangeSpeedMultiplier = size.rangeSpeedMultiplier;
    this.size.liftingMultiplier = size.liftingMultiplier;

    this.creation.statPoints = statPointCost(this.stats.body) + statPointCost(this.stats.mind) + statPointCost(this.stats.soul);
    this.creation.sizePoints = baseSize.pointCost;

    this.creation.attributePoints = 0;
    this.creation.defectPoints = 0;
    this.creation.templatePoints = 0;
    this.creation.gearPoints = 0;

    for (const item of items) {
      if (item.system.excludeFromTotals) continue;
      const points = Number(item.system.pointCost) || 0;
      if (item.type === "attribute") this.creation.attributePoints += points;
      if (item.type === "defect") this.creation.defectPoints += points;
      if (item.type === "template") this.creation.templatePoints += points;
      if (item.type === "gear") this.creation.gearPoints += points;
    }

    this.creation.totalSpent = this.creation.statPoints + this.creation.sizePoints + this.creation.attributePoints + this.creation.defectPoints + this.creation.templatePoints + this.creation.gearPoints;
    this.creation.unspent = (Number(this.targetPoints) || 0) - this.creation.totalSpent;

    this.combat.base = Math.floor((body + mind + soul) / 3);
    this.combat.attack = this.combat.base + bonuses.attackMastery + bonuses.ineptAttack;
    this.combat.defence = this.combat.base + bonuses.defenceMastery + bonuses.ineptDefence;
    this.combat.damageMultiplier = 5 + bonuses.massiveDamage + bonuses.reducedDamage;
    this.combat.muscleDamageMultiplier = this.combat.damageMultiplier + bonuses.superstrength;
    this.combat.unarmedDamage = this.combat.attack + (bonuses.superstrength * 5) + this.size.strengthDamage;
    this.combat.armourRating = bonuses.armourRating + Math.max(this.size.durability, 0);
    this.combat.forceFieldRating = bonuses.forceFieldRating * 10;
    this.combat.actions = Math.max(1 + bonuses.extraActions, 1);

    this.resources.health.max = ((body + soul) * 5) + (bonuses.tough * 10) + (bonuses.fragile * 10);
    this.resources.energy.max = ((mind + soul) * 5) + (bonuses.energised * 10);

    const sourceHealth = foundry.utils.getProperty(this.parent?._source, "system.resources.health") ?? {};
    const sourceEnergy = foundry.utils.getProperty(this.parent?._source, "system.resources.energy") ?? {};

    if ((sourceHealth.max ?? 0) === 0 && (sourceHealth.value ?? 0) === 0) this.resources.health.value = this.resources.health.max;
    else this.resources.health.value = Math.min(Math.max(Number(this.resources.health.value) || 0, 0), this.resources.health.max);

    if ((sourceEnergy.max ?? 0) === 0 && (sourceEnergy.value ?? 0) === 0) this.resources.energy.value = this.resources.energy.max;
    else this.resources.energy.value = Math.min(Math.max(Number(this.resources.energy.value) || 0, 0), this.resources.energy.max);

    this.movement.walk = body * 1 * this.size.rangeSpeedMultiplier;
    this.movement.jog = body * 1.5 * this.size.rangeSpeedMultiplier;
    this.movement.run = body * 2 * this.size.rangeSpeedMultiplier;
    this.movement.sprint = body * 4.5 * this.size.rangeSpeedMultiplier;
    this.movement.crawl = body * 0.5 * this.size.rangeSpeedMultiplier;
    this.movement.swim = body * 1 * this.size.rangeSpeedMultiplier;
    this.movement.groundMax = Math.max(this.movement.sprint, Number(bonuses.movement.groundMax) || 0);
    this.movement.flightMax = Number(bonuses.movement.flightMax) || 0;
    this.movement.waterMax = Math.max(this.movement.swim, Number(bonuses.movement.waterMax) || 0);
    this.movement.spaceflightLevel = Number(bonuses.movement.spaceflightLevel) || 0;
    this.movement.spaceflightLabel = bonuses.movement.spaceflightLabel ?? "";
  }
}

export class BesmItemDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      catalogId: new fields.StringField({ initial: "" }),
      skillGroup: new fields.StringField({ initial: "" }),
      selectedStat: new fields.StringField({ initial: "" }),
      specialization: new fields.StringField({ initial: "" }),
      originType: new fields.StringField({ initial: "" }),
      originId: new fields.StringField({ initial: "" }),
      blueprintId: new fields.StringField({ initial: "" }),
      blueprintCategory: new fields.StringField({ initial: "" }),
      excludeFromTotals: new fields.BooleanField({ initial: false }),
      useManualPointCost: new fields.BooleanField({ initial: false }),
      level: new fields.NumberField({ integer: true, initial: 1, min: 0 }),
      rank: new fields.NumberField({ integer: true, initial: 1, min: 1, max: 3 }),
      enhancementSlots: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
      limiterSlots: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
      effectiveLevel: new fields.NumberField({ integer: true, initial: 1, min: 0 }),
      pointCost: new fields.NumberField({ integer: true, initial: 0 }),
      manualPointCost: new fields.NumberField({ integer: true, initial: 0 }),
      templateId: new fields.StringField({ initial: "" }),
      templateType: new fields.StringField({ initial: "" }),
      sourcePage: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
      sharedOwners: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
      mods: new fields.ArrayField(modifierSchema(), { initial: [] }),
      attackMode: new fields.StringField({ initial: "melee" }),
      weaponGroup: new fields.StringField({ initial: "" }),
      rangeRank: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
      musclePowered: new fields.BooleanField({ initial: false }),
      attackBonus: new fields.NumberField({ integer: true, initial: 0 }),
      damageBonus: new fields.NumberField({ integer: true, initial: 0 }),
      templateBody: new fields.NumberField({ integer: true, initial: 0 }),
      templateMind: new fields.NumberField({ integer: true, initial: 0 }),
      templateSoul: new fields.NumberField({ integer: true, initial: 0 }),
      templateSizeRank: new fields.NumberField({ integer: true, initial: 0 }),
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    if (this.parent?.type === "attribute") {
      this.effectiveLevel = getItemEffectiveLevel(this.parent);
    }
    else {
      this.effectiveLevel = Number(this.level) || 0;
    }

    this.pointCost = resolveItemPointCost(this.parent);

  }
}
