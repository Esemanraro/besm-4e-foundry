import { buildRollFormula, calculateWeaponDamage, calculateWeaponRollBonus, getActorEffectiveStat, getLightningReflexesMode } from "../rules/math.mjs";

export class BesmActor extends Actor {
  getRollData() {
    const data = super.getRollData();
    data.system = this.system;
    return data;
  }

  async rollStat(stat, mode = "normal") {
    const label = game.i18n.localize(`BESM4E.Stat.${stat}`) || stat;
    const bonus = getActorEffectiveStat(this, stat);
    const formula = buildRollFormula(mode, bonus);
    const roll = await new Roll(formula, this.getRollData()).evaluate();
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${this.name}: ${label} Roll`
    });
    return roll;
  }

  async rollInitiative() {
    const mode = getLightningReflexesMode(this);
    const formula = buildRollFormula(mode, this.system.combat.attack);
    const roll = await new Roll(formula, this.getRollData()).evaluate();
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${this.name}: Initiative`
    });
    return roll;
  }

  async rollWeapon(itemId) {
    const item = this.items.get(itemId);
    if (!item) return null;

    const formula = buildRollFormula("normal", calculateWeaponRollBonus(this, item));
    const roll = await new Roll(formula, this.getRollData()).evaluate();
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${this.name}: ${item.name} Attack`
    });
    return roll;
  }

  async rollWeaponDamage(itemId) {
    const item = this.items.get(itemId);
    if (!item) return null;

    const damage = calculateWeaponDamage(this, item);
    const roll = await new Roll(String(damage), this.getRollData()).evaluate();
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${this.name}: ${item.name} Damage`
    });
    return roll;
  }
}
