import { calculateWeaponDamage, calculateWeaponRollBonus, computeBenchmarkWarnings, computeBuildWarnings, statPointCost, summarizeActorItems, summarizeTemplateItems } from "../rules/math.mjs";
import { getBesmContent } from "../rules/content.mjs";

const CREATION_STEPS = [
  { id: "scope", label: "1. Scope" },
  { id: "templates", label: "2. Templates" },
  { id: "stats", label: "3. Stats" },
  { id: "attributes", label: "4. Powers" },
  { id: "defects", label: "5. Defects" },
  { id: "items", label: "6. Items" },
  { id: "review", label: "7. Review" },
  { id: "library", label: "8. Library" }
];

export class BesmActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
    this._step = "scope";
    this._libraryCategory = "attributes";
    this._libraryEntryId = null;
    this._pendingTemplateApplication = null;
    this._playMode = this.actor.system.creationComplete || false;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["besm4e", "sheet", "actor"],
      template: "systems/besm4e/templates/actor/character-sheet.hbs",
      width: 980,
      height: 840,
      resizable: true
    });
  }

  getData(options) {
    const data = super.getData(options);
    const actor = this.actor;
    const content = getBesmContent();
    const items = actor.items.contents.slice().sort((a, b) => a.name.localeCompare(b.name));
    const attributes = items.filter((item) => item.type === "attribute");
    const defects = items.filter((item) => item.type === "defect");
    const templates = items.filter((item) => item.type === "template");
    const gear = items.filter((item) => item.type === "gear");
    const attacks = attributes.filter((item) => item.system.catalogId === "weapon");
    const itemBonuses = summarizeActorItems(items);
    const templateBonuses = summarizeTemplateItems(items);
    const statIds = ["body", "mind", "soul"];

    data.system = actor.system;
    data.actor = actor;
    data.content = content;
    data.steps = CREATION_STEPS.map((step) => ({ ...step, active: step.id === this._step }));
    data.stepFlags = Object.fromEntries(CREATION_STEPS.map((step) => [step.id, step.id === this._step]));
    data.attributes = attributes
      .filter((item) => item.system.catalogId !== "weapon")
      .map((item) => this.#decorateItem(item));
    data.defects = defects.map((item) => this.#decorateItem(item));
    data.templates = templates.map((item) => this.#decorateItem(item));
    data.gear = gear.map((item) => this.#decorateItem(item));
    data.attacks = attacks.map((item) => ({
      ...this.#decorateItem(item),
      attackBonus: calculateWeaponRollBonus(actor, item),
      damage: calculateWeaponDamage(actor, item)
    }));
    data.powerLevels = content?.powerLevels ?? [];
    data.appliedRaceTemplates = templates.filter((item) => item.system.templateType === "race").map((item) => this.#decorateItem(item));
    data.appliedClassTemplates = templates.filter((item) => item.system.templateType === "class").map((item) => this.#decorateItem(item));
    data.benchmark = content?.benchmarks?.[actor.system.powerLevel] ?? null;
    data.benchmarkWarnings = computeBenchmarkWarnings(actor);
    data.buildWarnings = computeBuildWarnings(actor);
    data.statRows = statIds.map((statId) => ({
      id: statId,
      label: statId[0].toUpperCase() + statId.slice(1),
      base: Number(actor.system.stats?.[statId]) || 0,
      effective: Number(actor.system.effectiveStats?.[statId]) || Number(actor.system.stats?.[statId]) || 0,
      templateBonus: Number(templateBonuses?.[statId]) || 0,
      attributeBonus: Number(itemBonuses?.statMods?.[statId]) || 0,
      cost: statPointCost(actor.system.stats?.[statId])
    }));
    data.powerLevelEntry = (content?.powerLevels ?? []).find((entry) => entry.id === actor.system.powerLevel) ?? null;
    data.library = this.#buildLibraryData(content);
    data.pendingTemplateApplication = this.#buildPendingTemplateApplication();
    data.editable = this.isEditable;
    data.isPlayMode = this._playMode;
    data.isCreationMode = !this._playMode;
    data.canEditPoints = !this._playMode;
    data.creationComplete = this.actor.system.creationComplete || false;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-action='goto-step']").on("click", (event) => {
      this._step = event.currentTarget.dataset.step;
      this.render(false);
    });

    html.find("[data-action='library-category']").on("click", (event) => {
      this._libraryCategory = event.currentTarget.dataset.category;
      this._libraryEntryId = null;
      this.render(false);
    });

    html.find("[data-action='library-open']").on("click", (event) => {
      this._libraryCategory = event.currentTarget.dataset.category;
      this._libraryEntryId = event.currentTarget.dataset.entryId;
      this._step = "library";
      this.render(false);
    });

    html.find("[data-action='step-next']").on("click", () => {
      const index = CREATION_STEPS.findIndex((step) => step.id === this._step);
      this._step = CREATION_STEPS[Math.min(index + 1, CREATION_STEPS.length - 1)].id;
      this.render(false);
    });

    html.find("[data-action='step-prev']").on("click", () => {
      const index = CREATION_STEPS.findIndex((step) => step.id === this._step);
      this._step = CREATION_STEPS[Math.max(index - 1, 0)].id;
      this.render(false);
    });

    html.find("[data-action='roll-stat']").on("click", (event) => {
      const stat = event.currentTarget.dataset.stat;
      this.actor.rollStat(stat);
    });

    html.find("[data-action='roll-initiative']").on("click", () => this.actor.rollInitiative());

    html.find("[data-action='roll-attack']").on("click", (event) => {
      this.actor.rollWeapon(event.currentTarget.dataset.itemId);
    });

    html.find("[data-action='roll-damage']").on("click", (event) => {
      this.actor.rollWeaponDamage(event.currentTarget.dataset.itemId);
    });

    html.find("[data-action='create-item']").on("click", async (event) => {
      const type = event.currentTarget.dataset.type;
      const catalogId = event.currentTarget.dataset.catalogId;
      const content = getBesmContent();
      const defaultName = type === "attribute"
        ? content?.attributes?.[catalogId || "attack-mastery"]?.name ?? "New Attribute"
        : type === "defect"
          ? content?.defects?.fragile?.name ?? "New Defect"
          : type === "template"
            ? "New Template"
            : "New Gear";
      const defaults = {
        attribute: { name: defaultName, type, system: { catalogId: catalogId || "attack-mastery" } },
        defect: { name: defaultName, type, system: { catalogId: "fragile" } },
        template: { name: defaultName, type, system: { manualPointCost: 0 } },
        gear: { name: defaultName, type, system: { manualPointCost: 0 } }
      };
      await this.actor.createEmbeddedDocuments("Item", [defaults[type]]);
    });

    html.find("[data-action='edit-item']").on("click", (event) => {
      const item = this.actor.items.get(event.currentTarget.dataset.itemId);
      item?.sheet.render(true);
    });

    html.find("[data-action='delete-item']").on("click", async (event) => {
      const item = this.actor.items.get(event.currentTarget.dataset.itemId);
      if (!item) return;
      await this.#deleteWithChildren(item);
    });

    html.find("[data-action='add-template']").on("click", async (event) => {
      const templateType = event.currentTarget.dataset.templateType;
      const templateId = event.currentTarget.dataset.templateId;
      const content = getBesmContent();
      const definition = content?.templateIndex?.all?.find((entry) => entry.id === templateId);
      if (!definition) return;
      await this.#queueTemplateApplication({ ...definition, type: templateType });
    });

    html.find("[data-action='library-create']").on("click", async (event) => {
      const itemType = event.currentTarget.dataset.itemType;
      const entryId = event.currentTarget.dataset.entryId;
      const content = getBesmContent();

      if (itemType === "attribute") {
        const definition = content?.attributes?.[entryId];
        if (!definition) return;
        await this.actor.createEmbeddedDocuments("Item", [{
          name: definition.name,
          type: "attribute",
          system: { catalogId: definition.id, sourcePage: definition.sourcePage }
        }]);
      }

      if (itemType === "defect") {
        const definition = content?.defects?.[entryId];
        if (!definition) return;
        await this.actor.createEmbeddedDocuments("Item", [{
          name: definition.name,
          type: "defect",
          system: { catalogId: definition.id, sourcePage: definition.sourcePage }
        }]);
      }

      if (itemType === "template") {
        const definition = content?.templateIndex?.all?.find((entry) => entry.id === entryId);
        if (!definition) return;
        await this.#queueTemplateApplication(definition);
      }

      if (itemType === "blueprint") {
        const definition = content?.itemBlueprints?.byId?.[entryId];
        if (!definition) return;
        await this.#createFromBlueprint(definition);
      }

      if (itemType === "companion") {
        const definition = content?.companions?.byId?.[entryId];
        if (!definition) return;
        await this.#createCompanionFromDefinition(definition);
      }
    });

    html.find("[data-action='template-conflict-toggle']").on("click", (event) => {
      const key = event.currentTarget.dataset.key;
      this.#togglePendingTemplateConflict(key);
    });

    html.find("[data-action='template-conflict-apply']").on("click", async () => {
      await this.#applyPendingTemplateApplication();
    });

    html.find("[data-action='template-conflict-cancel']").on("click", () => {
      this._pendingTemplateApplication = null;
      this.render(false);
    });

    html.find("[data-action='toggle-play-mode']").on("click", () => this.#togglePlayMode());
    html.find("[data-action='finish-creation']").on("click", () => this.#togglePlayMode());
    html.find("[data-action='back-to-creation']").on("click", () => this.#togglePlayMode());

    html.find(".collapse-toggle").on("click", (event) => {
      const section = event.currentTarget.closest(".collapsible-section");
      section.classList.toggle("collapsed");
    });
  }

  async #togglePlayMode() {
    const newState = !this._playMode;

    if (newState) {
      const dialog = new Dialog({
        title: "Finish Character Creation",
        content: "<p>Mark this character as complete and switch to play mode?</p><p>You can return to creation mode later if needed.</p>",
        buttons: {
          yes: {
            label: "Yes, Finish Character",
            callback: async () => {
              await this.actor.update({ "system.creationComplete": true });
              this._playMode = true;
              this.render(false);
            }
          },
          no: { label: "Cancel" }
        },
        default: "no"
      });
      dialog.render(true);
    } else {
      await this.actor.update({ "system.creationComplete": false });
      this._playMode = false;
      this._step = "scope";
      this.render(false);
    }
  }

  #decorateItem(item) {
    const content = getBesmContent();
    const catalog = item.type === "attribute"
      ? content?.attributes?.[item.system.catalogId]
      : item.type === "defect"
        ? content?.defects?.[item.system.catalogId]
        : item.type === "template"
          ? content?.templateIndex?.all?.find((entry) => entry.id === item.system.templateId)
          : null;

    return {
      id: item.id,
      name: item.name,
      type: item.type,
      page: catalog?.sourcePage ?? catalog?.page ?? item.system.sourcePage ?? "",
      points: item.system.pointCost,
      sharedOwners: item.system.sharedOwners,
      level: item.system.level,
      rank: item.system.rank,
      effectiveLevel: item.system.effectiveLevel,
      specialization: item.system.specialization,
      mode: item.system.attackMode,
      rangeRank: item.system.rangeRank,
      templateType: item.system.templateType,
      blueprintCategory: item.system.blueprintCategory,
      item
    };
  }

  #buildLibraryData(content) {
    const categoryEntries = {
      attributes: (content?.attributeList ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage,
        cost: entry.costPerLevel ?? entry.costType ?? "",
        itemType: "attribute",
        entry
      })),
      defects: (content?.defectList ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage,
        cost: entry.pointsByRank?.join("/") ?? entry.costType ?? "",
        itemType: "defect",
        entry
      })),
      templates: (content?.templateIndex?.all ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage ?? entry.page,
        cost: entry.points,
        itemType: "template",
        entry
      })),
      blueprints: (content?.itemBlueprints?.list ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage,
        cost: entry.itemCost ?? entry.points ?? "",
        itemType: "blueprint",
        entry
      })),
      companions: (content?.companions?.list ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage,
        cost: entry.totalPoints ?? "",
        itemType: "companion",
        entry
      })),
      modifiers: (content?.modifiers?.all ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage ?? entry.page,
        cost: `${entry.kind} / ${entry.slotCost}`,
        itemType: null,
        entry
      })),
      itemSections: (content?.itemLibrary?.sections ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage,
        cost: "",
        itemType: null,
        entry
      })),
      reference: (content?.referenceTables ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        page: entry.sourcePage,
        cost: entry.category ?? "",
        itemType: null,
        entry
      }))
    };

    const categories = [
      { id: "attributes", label: "Attributes" },
      { id: "defects", label: "Defects" },
      { id: "templates", label: "Templates" },
      { id: "blueprints", label: "Blueprints" },
      { id: "companions", label: "Companions" },
      { id: "modifiers", label: "Modifiers" },
      { id: "itemSections", label: "Items" },
      { id: "reference", label: "Tables" }
    ].map((category) => ({ ...category, active: category.id === this._libraryCategory }));

    const activeEntries = categoryEntries[this._libraryCategory] ?? [];
    if (!activeEntries.length) {
      return { activeCategory: this._libraryCategory, categories, entries: [], detail: null };
    }

    const selectedId = this._libraryEntryId && activeEntries.some((entry) => entry.id === this._libraryEntryId)
      ? this._libraryEntryId
      : activeEntries[0].id;
    this._libraryEntryId = selectedId;

    const detail = this.#decorateLibraryDetail(activeEntries.find((entry) => entry.id === selectedId) ?? activeEntries[0]);
    return {
      activeCategory: this._libraryCategory,
      categories,
      entries: activeEntries.map((entry) => ({ ...entry, active: entry.id === selectedId })),
      detail
    };
  }

  #buildPendingTemplateApplication() {
    if (!this._pendingTemplateApplication) return null;
    const conflicts = this._pendingTemplateApplication.components.filter((component) => component.conflict);
    const included = this._pendingTemplateApplication.components.filter((component) => !component.suppressed);
    const suppressed = conflicts.filter((component) => component.suppressed);
    return {
      id: this._pendingTemplateApplication.id,
      name: this._pendingTemplateApplication.name,
      type: this._pendingTemplateApplication.type,
      page: this._pendingTemplateApplication.sourcePage,
      totalComponents: this._pendingTemplateApplication.components.length,
      includedCount: included.length,
      suppressedCount: suppressed.length,
      conflicts: conflicts.map((component) => ({
        key: component.key,
        type: component.type,
        name: component.name,
        specialization: component.specialization,
        existingItemName: component.existingItemName,
        suppressed: component.suppressed
      }))
    };
  }

  #decorateLibraryDetail(detail) {
    if (!detail) return null;
    const entry = detail.entry ?? {};
    const sections = [];
    let buttonLabel = "Add To Character";

    if (detail.itemType === "template") {
      buttonLabel = "Apply Template";
      const statLines = [];
      if (Number(entry.body) || Number(entry.mind) || Number(entry.soul)) {
        if (Number(entry.body)) statLines.push(`Body +${entry.body}`);
        if (Number(entry.mind)) statLines.push(`Mind +${entry.mind}`);
        if (Number(entry.soul)) statLines.push(`Soul +${entry.soul}`);
      }
      if (statLines.length) sections.push({ title: "Stats", lines: statLines });
      if (Array.isArray(entry.attributes) && entry.attributes.length) {
        sections.push({ title: "Attributes", lines: entry.attributes.map((component) => `${component.name} (${component.points} pts)`) });
      }
      if (Array.isArray(entry.defects) && entry.defects.length) {
        sections.push({ title: "Defects", lines: entry.defects.map((component) => `${component.name} (${component.points} pts)`) });
      }
    }

    if (detail.itemType === "blueprint") {
      buttonLabel = "Create Item";
      const summary = [];
      if (entry.category) summary.push(`Category: ${entry.category}`);
      if (entry.catalogId) summary.push(`Base Attribute: ${entry.catalogId}`);
      if (entry.levelText) summary.push(`Level: ${entry.levelText}`);
      if (entry.armourRating) summary.push(`Armour Rating: ${entry.armourRating}`);
      if (entry.attackMode) summary.push(`Attack Mode: ${entry.attackMode}`);
      if (summary.length) sections.push({ title: "Profile", lines: summary });
      if (Array.isArray(entry.enhancements) && entry.enhancements.length) {
        sections.push({ title: "Enhancements", lines: entry.enhancements.map((modifier) => `${modifier.name} ${modifier.assignments}`.trim()) });
      }
      if (Array.isArray(entry.limiters) && entry.limiters.length) {
        sections.push({ title: "Limiters", lines: entry.limiters.map((modifier) => `${modifier.name} ${modifier.assignments}`.trim()) });
      }
      if (Array.isArray(entry.mods) && entry.mods.length) {
        sections.push({ title: "Modifiers", lines: entry.mods.map((modifier) => `${modifier.name} ${modifier.assignments}`.trim()) });
      }
    }

    if (detail.itemType === "companion") {
      buttonLabel = "Create Companion";
      const statLines = [];
      if (entry.stats?.body !== undefined) statLines.push(`Body ${entry.stats.body}`);
      if (entry.stats?.mind !== undefined) statLines.push(`Mind ${entry.stats.mind}`);
      if (entry.stats?.soul !== undefined) statLines.push(`Soul ${entry.stats.soul}`);
      if (Number.isFinite(Number(entry.sizeRank))) statLines.push(`Size Rank ${entry.sizeRank}`);
      if (statLines.length) sections.push({ title: "Stats", lines: statLines });
      if (entry.derived && Object.keys(entry.derived).length) {
        sections.push({ title: "Derived", lines: Object.entries(entry.derived).map(([key, value]) => `${key.replace(/-/g, " ")}: ${value}`) });
      }
      if (Array.isArray(entry.attributes) && entry.attributes.length) {
        sections.push({ title: "Attributes", lines: entry.attributes.map((component) => `${component.name} (${component.points} pts)`) });
      }
      if (Array.isArray(entry.defects) && entry.defects.length) {
        sections.push({ title: "Defects", lines: entry.defects.map((component) => `${component.name} (${component.points} pts)`) });
      }
    }

    return { ...detail, buttonLabel, sections };
  }

  async #queueTemplateApplication(definition) {
    const existingKeys = new Map(this.actor.items.contents.map((item) => [
      this.#componentKey(item.type, item.name, item.system.catalogId, item.system.specialization),
      item.name
    ]));

    const components = [
      ...((definition.attributes ?? []).map((entry) => ({ entry, type: "attribute" }))),
      ...((definition.defects ?? []).map((entry) => ({ entry, type: "defect" })))
    ].map(({ entry, type }) => {
      const key = this.#componentKey(type, entry.name, entry.catalogId, entry.specialization);
      const existingItemName = existingKeys.get(key) ?? "";
      return {
        key,
        type,
        entry,
        name: entry.name,
        specialization: entry.specialization ?? "",
        conflict: !!existingItemName,
        existingItemName,
        suppressed: !!existingItemName
      };
    });

    const hasConflicts = components.some((component) => component.conflict);
    if (!hasConflicts) {
      await this.#createTemplateFromDefinition(definition, components);
      return;
    }

    this._pendingTemplateApplication = {
      id: definition.id,
      name: definition.name,
      type: definition.type,
      sourcePage: definition.sourcePage ?? definition.page ?? 0,
      definition,
      components
    };
    this._step = "templates";
    this.render(false);
  }

  #togglePendingTemplateConflict(key) {
    if (!this._pendingTemplateApplication) return;
    const component = this._pendingTemplateApplication.components.find((entry) => entry.key === key);
    if (!component) return;
    component.suppressed = !component.suppressed;
    this.render(false);
  }

  async #applyPendingTemplateApplication() {
    if (!this._pendingTemplateApplication) return;
    const pending = this._pendingTemplateApplication;
    this._pendingTemplateApplication = null;
    await this.#createTemplateFromDefinition(pending.definition, pending.components);
  }

  async #createTemplateFromDefinition(definition, preparedComponents = null) {
    const [templateItem] = await this.actor.createEmbeddedDocuments("Item", [{
      name: definition.name,
      type: "template",
      system: {
        templateId: definition.id,
        templateType: definition.type,
        sourcePage: definition.sourcePage ?? definition.page,
        manualPointCost: definition.points,
        useManualPointCost: true,
        templateBody: definition.body ?? 0,
        templateMind: definition.mind ?? 0,
        templateSoul: definition.soul ?? 0,
        templateSizeRank: definition.sizeRank ?? 0,
        notes: definition.notesText ?? ""
      }
    }]);

    if (!templateItem) return;

    const components = preparedComponents ?? [
      ...((definition.attributes ?? []).map((entry) => ({ entry, type: "attribute", name: entry.name, suppressed: false, conflict: false }))),
      ...((definition.defects ?? []).map((entry) => ({ entry, type: "defect", name: entry.name, suppressed: false, conflict: false })))
    ];

    const componentDocs = components
      .filter((component) => !component.suppressed)
      .map((component) => this.#buildStructuredComponent(component.entry, component.type, templateItem.id, definition.sourcePage ?? definition.page));
    const suppressed = components.filter((component) => component.suppressed).map((component) => component.name);

    if (componentDocs.length) await this.actor.createEmbeddedDocuments("Item", componentDocs);
    if (suppressed.length) {
      const note = `<p>Suppressed overlapping template components: ${suppressed.join(", ")}</p>`;
      await templateItem.update({ "system.notes": `${templateItem.system.notes ?? ""}${note}` });
    }
  }

  async #createFromBlueprint(definition) {
    const blueprintModifiers = [
      ...((definition.enhancements ?? []).map((modifier) => ({ id: modifier.id, assignments: modifier.assignments }))),
      ...((definition.limiters ?? []).map((modifier) => ({ id: modifier.id, assignments: modifier.assignments }))),
      ...((definition.mods ?? []).map((modifier) => ({ id: modifier.id, assignments: modifier.assignments })))
    ];
    const system = {
      sourcePage: definition.sourcePage,
      blueprintId: definition.id,
      blueprintCategory: definition.category,
      useManualPointCost: true,
      manualPointCost: Number(definition.itemCost ?? definition.points) || 0,
      notes: definition.rulesText ?? "",
      mods: blueprintModifiers.length ? blueprintModifiers : this.#parseModifierAssignments([
        definition.enhancementsText ?? "",
        definition.limitersText ?? "",
        definition.detailsText ?? "",
        definition.modifiersText ?? ""
      ].join("; "))
    };

    if ((definition.itemType ?? "attribute") === "attribute") {
      Object.assign(system, {
        catalogId: definition.catalogId,
        level: Number(definition.level) || 0,
        attackMode: definition.attackMode ?? "melee",
        rangeRank: Number(definition.rangeRank) || 0,
        musclePowered: !!definition.musclePowered,
        specialization: definition.specialization ?? "",
        skillGroup: definition.skillGroup ?? "",
        selectedStat: definition.selectedStat ?? "",
        weaponGroup: definition.weaponGroup ?? ""
      });
    }

    await this.actor.createEmbeddedDocuments("Item", [{
      name: definition.name,
      type: definition.itemType ?? "attribute",
      system
    }]);
  }

  async #createCompanionFromDefinition(definition) {
    const actor = await Actor.create({
      name: definition.name,
      type: "companion",
      system: {
        size: { rank: definition.sizeRank ?? 0 },
        targetPoints: definition.totalPoints ?? 0,
        stats: {
          body: definition.stats?.body ?? 4,
          mind: definition.stats?.mind ?? 4,
          soul: definition.stats?.soul ?? 4
        },
        notes: definition.notesText ?? definition.rulesText ?? ""
      }
    });

    const docs = [
      ...((definition.attributes ?? []).map((entry) => this.#buildStructuredComponent(entry, "attribute", "", definition.sourcePage))),
      ...((definition.defects ?? []).map((entry) => this.#buildStructuredComponent(entry, "defect", "", definition.sourcePage)))
    ];
    if (docs.length) await actor.createEmbeddedDocuments("Item", docs);
    actor.sheet?.render(true);
  }

  #buildStructuredComponent(entry, type, originId, sourcePage) {
    const specialization = this.#extractComponentSpecialization(entry);
    const selectedStat = this.#extractSelectedStat(entry);
    const skillGroup = this.#extractSkillGroupId(entry);
    const mods = entry.mods?.length
      ? entry.mods.map((modifier) => ({ id: modifier.id, assignments: modifier.assignments }))
      : this.#parseModifierAssignments([entry.label, entry.specialization, entry.rulesText].filter(Boolean).join("; "));
    const rangeRank = Number(entry.rangeRank) || this.#extractRangeRank(entry, mods);
    const musclePowered = entry.musclePowered ?? mods.some((modifier) => modifier.id === "muscle");
    const attackMode = entry.attackMode ?? this.#extractAttackMode(entry, rangeRank, mods);
    return {
      name: this.#extractItemName(entry),
      type,
      system: {
        catalogId: entry.catalogId ?? "",
        sourcePage: entry.sourcePage ?? sourcePage ?? 0,
        originType: originId ? "template" : "",
        originId,
        excludeFromTotals: !!originId,
        useManualPointCost: true,
        manualPointCost: Number(entry.points) || 0,
        level: Number(entry.level) || 0,
        rank: Number(entry.rank) || 1,
        specialization,
        selectedStat,
        skillGroup,
        mods,
        rangeRank,
        musclePowered,
        attackMode,
        weaponGroup: entry.weaponGroup ?? "",
        notes: entry.rulesText ?? entry.label ?? ""
      }
    };
  }

  #extractItemName(entry) {
    if ((entry.catalogId ?? "") !== "weapon") return entry.name;
    const label = entry.label ?? entry.name ?? "";
    const match = /^Weapon:\s*([^()]+?)(?:\s*\(|$)/i.exec(label);
    return match?.[1]?.trim() || entry.specialization || entry.name;
  }

  #extractComponentSpecialization(entry) {
    if (entry.specialization) return entry.specialization;
    const label = entry.label ?? entry.name ?? "";
    const match = /\(([^()]+)\)/.exec(label);
    if ((entry.catalogId ?? "") === "weapon") return this.#extractItemName(entry);
    return match?.[1]?.trim() ?? "";
  }

  #extractSelectedStat(entry) {
    const raw = `${entry.specialization ?? ""} ${entry.label ?? ""} ${entry.name ?? ""}`.toLowerCase();
    if (!raw.includes("body") && !raw.includes("mind") && !raw.includes("soul")) return entry.selectedStat ?? "";
    if (raw.includes("body")) return "body";
    if (raw.includes("mind")) return "mind";
    if (raw.includes("soul")) return "soul";
    return entry.selectedStat ?? "";
  }

  #extractSkillGroupId(entry) {
    if ((entry.catalogId ?? "") !== "skill-group") return entry.skillGroup ?? "";
    const content = getBesmContent();
    const needle = (entry.specialization ?? entry.label ?? entry.name ?? "").toLowerCase();
    const match = (content?.skillGroupList ?? []).find((group) => {
      const id = String(group.id ?? "").toLowerCase();
      const name = String(group.name ?? "").toLowerCase();
      return needle.includes(id) || needle.includes(name);
    });
    return match?.id ?? entry.skillGroup ?? "";
  }

  #extractRangeRank(entry, mods) {
    if (Number.isFinite(Number(entry.rangeRank)) && Number(entry.rangeRank) > 0) return Number(entry.rangeRank);
    const rangeModifier = mods.find((modifier) => modifier.id === "range");
    return rangeModifier ? Number(rangeModifier.assignments) || 0 : 0;
  }

  #extractAttackMode(entry, rangeRank, mods) {
    if (entry.attackMode) return entry.attackMode;
    const text = `${entry.label ?? ""} ${entry.specialization ?? ""} ${entry.name ?? ""}`.toLowerCase();
    if (text.includes("ranged")) return "ranged";
    if (rangeRank > 0) return "ranged";
    if (mods.some((modifier) => modifier.id === "range")) return "ranged";
    return "melee";
  }

  #parseModifierAssignments(text) {
    const content = getBesmContent();
    const lookup = (content?.modifiers?.all ?? [])
      .map((modifier) => ({
        id: modifier.id,
        key: String(modifier.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
        name: modifier.name
      }))
      .filter((modifier) => modifier.key)
      .sort((left, right) => right.key.length - left.key.length);

    const assignments = new Map();
    for (const chunk of String(text ?? "")
      .replace(/[()]/g, " ")
      .split(/[,+;\n]/)
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (chunk === "-") continue;
      const normalized = chunk.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const match = lookup.find((modifier) => normalized.startsWith(modifier.key));
      if (!match) continue;
      const amountMatch = normalized.slice(match.key.length).match(/-?\d+/);
      const amount = Math.max(Math.abs(Number(amountMatch?.[0] ?? 1)), 1);
      assignments.set(match.id, (assignments.get(match.id) ?? 0) + amount);
    }

    return [...assignments.entries()].map(([id, assignments]) => ({ id, assignments }));
  }

  #componentKey(type, name, catalogId, specialization) {
    return [type, catalogId ?? "", (name ?? "").toLowerCase(), (specialization ?? "").toLowerCase()].join("|");
  }

  async #deleteWithChildren(item) {
    const childIds = this.actor.items.contents
      .filter((child) => child.system.originId === item.id)
      .map((child) => child.id);
    if (childIds.length) await this.actor.deleteEmbeddedDocuments("Item", childIds);
    await item.delete();
  }
}
