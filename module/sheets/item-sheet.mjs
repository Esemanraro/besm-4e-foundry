import { getBesmContent } from "../rules/content.mjs";

export class BesmItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["besm4e", "sheet", "item"],
      template: "systems/besm4e/templates/item/item-sheet.hbs",
      width: 620,
      height: 720,
      resizable: true
    });
  }

  getData(options) {
    const data = super.getData(options);
    const item = this.item;
    const content = getBesmContent();
    const catalog = item.type === "attribute" ? content?.attributes ?? {} : item.type === "defect" ? content?.defects ?? {} : {};
    const modifierPool = item.type === "attribute"
      ? [
        ...(content?.modifiers?.standardEnhancements ?? []),
        ...(content?.modifiers?.standardLimiters ?? []),
        ...(item.system.catalogId === "weapon" ? content?.modifiers?.weaponEnhancements ?? [] : []),
        ...(item.system.catalogId === "weapon" ? content?.modifiers?.weaponLimiters ?? [] : [])
      ]
      : [];

    data.system = item.system;
    data.item = item;
    data.content = content;
    data.catalogEntries = Object.values(catalog).sort((a, b) => a.name.localeCompare(b.name));
    data.skillGroups = Object.values(content?.skillGroups ?? {}).sort((a, b) => a.name.localeCompare(b.name));
    data.blueprintEntry = content?.itemBlueprints?.byId?.[item.system.blueprintId] ?? null;
    data.catalogEntry = item.type === "template"
      ? content?.templateIndex?.all?.find((entry) => entry.id === item.system.templateId) ?? null
      : catalog[item.system.catalogId] ?? null;
    data.isAttribute = item.type === "attribute";
    data.isTemplate = item.type === "template";
    data.isCatalogItem = item.type === "attribute" || item.type === "defect";
    data.templateRaceOptions = content?.templateIndex?.race ?? [];
    data.templateClassOptions = content?.templateIndex?.class ?? [];
    data.availableModifiers = modifierPool.sort((a, b) => a.name.localeCompare(b.name));
    data.itemLibrary = content?.itemLibrary?.sections ?? [];
    data.referenceTables = content?.referenceTables ?? [];
    data.selectedModifiers = (item.system.mods ?? []).map((selected, index) => ({
      index,
      ...selected,
      definition: content?.modifiers?.byId?.[selected.id] ?? null
    }));
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='apply-catalog-name']").on("click", async () => {
      const content = getBesmContent();
      const entry = this.item.type === "attribute"
        ? content?.attributes?.[this.item.system.catalogId]
        : this.item.type === "defect"
          ? content?.defects?.[this.item.system.catalogId]
          : null;
      if (!entry) return;
      await this.item.update({
        name: entry.name,
        "system.sourcePage": entry.sourcePage ?? this.item.system.sourcePage
      });
    });

    html.find("[data-action='apply-template-definition']").on("click", async () => {
      const content = getBesmContent();
      const definition = content?.templateIndex?.all?.find((entry) => entry.id === this.item.system.templateId);
      if (!definition) return;
      await this.item.update({
        name: definition.name,
        "system.templateType": definition.type ?? this.item.system.templateType,
        "system.templateId": definition.id,
        "system.manualPointCost": definition.points,
        "system.sourcePage": definition.page,
        "system.useManualPointCost": true,
        "system.templateBody": definition.body ?? 0,
        "system.templateMind": definition.mind ?? 0,
        "system.templateSoul": definition.soul ?? 0,
        "system.templateSizeRank": definition.sizeRank ?? 0
      });
    });

    html.find("[data-action='add-modifier']").on("click", async () => {
      const select = html.find("[name='besmModifierSelect']").val();
      if (!select) return;
      const mods = Array.from(this.item.system.mods ?? []);
      const existing = mods.find((modifier) => modifier.id === select);
      if (existing) existing.assignments += 1;
      else mods.push({ id: select, assignments: 1 });
      await this.item.update({ "system.mods": mods });
    });

    html.find("[data-action='remove-modifier']").on("click", async (event) => {
      const index = Number(event.currentTarget.dataset.index);
      const mods = Array.from(this.item.system.mods ?? []);
      mods.splice(index, 1);
      await this.item.update({ "system.mods": mods });
    });
  }
}
