import { BesmActorDataModel, BesmItemDataModel } from "./module/data/models.mjs";
import { BesmActor } from "./module/documents/actor.mjs";
import { BesmItem } from "./module/documents/item.mjs";
import { BesmActorSheet } from "./module/sheets/actor-sheet.mjs";
import { BesmItemSheet } from "./module/sheets/item-sheet.mjs";
import { BESM4E } from "./module/config.mjs";
import { loadBesmContent } from "./module/rules/content.mjs";

Hooks.once("init", async () => {
  CONFIG.BESM4E = BESM4E;
  CONFIG.BESM4E.content = await loadBesmContent();

  CONFIG.Actor.documentClass = BesmActor;
  CONFIG.Item.documentClass = BesmItem;

  CONFIG.Actor.dataModels = {
    character: BesmActorDataModel,
    npc: BesmActorDataModel,
    companion: BesmActorDataModel
  };

  CONFIG.Item.dataModels = {
    attribute: BesmItemDataModel,
    defect: BesmItemDataModel,
    template: BesmItemDataModel,
    gear: BesmItemDataModel
  };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: [["resources.health"], ["resources.energy"]],
      value: [["combat.attack"], ["combat.defence"]]
    },
    npc: {
      bar: [["resources.health"], ["resources.energy"]],
      value: [["combat.attack"], ["combat.defence"]]
    },
    companion: {
      bar: [["resources.health"], ["resources.energy"]],
      value: [["combat.attack"], ["combat.defence"]]
    }
  };

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("besm4e", BesmActorSheet, {
    makeDefault: true,
    types: ["character", "npc", "companion"],
    label: "BESM 4e Actor Sheet"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("besm4e", BesmItemSheet, {
    makeDefault: true,
    types: ["attribute", "defect", "template", "gear"],
    label: "BESM 4e Item Sheet"
  });
});
