# BESM 4e Rule Map

This project now has a Foundry system scaffold whose rules math is keyed to the BESM 4e corebook and the fillable character sheet already present in this repository.

## Primary sources used

- `BESM 4e - Corebook - Core Rulebook 4th Edition.pdf`
- `BESM_4E_Character_Sheet_-_Fillable_v0.4.pdf`
- Foundry official article: `https://foundryvtt.com/article/system-development/`

## Corebook sections encoded so far

### Character creation

- Character power levels and starting point bands: corebook pages 22-23
- Character benchmarks table identified for future validation rules: page 24
- Size templates and size math: pages 32-35
- Stat definitions, stat costs, and above-12 escalation: pages 71-73
- Attribute index and per-level costs: pages 77-78
- Defect index and rank values: pages 155-167
- Derived values: pages 169-171

### Action economy and rolls

- Target numbers: page 177
- Stat rolls, skill rolls, and initiative rolls: pages 179-182
- Edges and obstacles: pages 182-183
- Attack, defence, and damage formulas: pages 189-194
- Recovery and energy recovery: page 195

### Character sheet mapping

The fillable sheet confirms these persistent fields:

- Identity fields for name, player, GM, race/species, class/occupation, habitat, and notes
- Core stats: Body, Mind, Soul
- Derived fields: Health Points, Energy Points, Attack, Defence, Damage Multiplier
- Repeating attack rows with level, points, description, and cost
- Repeating defect rows with rank, points, and description

## Automation currently implemented

- Point-cost calculation for Stats
- Point-cost calculation for cataloged Attributes and Defects
- Variable/manual point support for Unique Attribute, Unique Defect, Unknown Power, Items, templates, and gear
- Structured modifier support for Chapter 6 standard Enhancements/Limiters and Chapter 5 Weapon customisations
- Size rank automation for template point value, strength damage modifier, ranged attack/defence modifier, durability, lifting multiplier, and movement multiplier
- Derived combat values from Body/Mind/Soul, Attack Mastery, Defence Mastery, Inept Attack, and Inept Defence
- Derived Health Points from Body, Soul, Tough, and Fragile
- Derived Energy Points from Mind, Soul, and Energised
- Derived Damage Multiplier from Massive Damage, Reduced Damage, and Superstrength
- Weapon attack and damage roll helpers
- Initiative roll helper with Lightning Reflexes edge handling
- Guided creation workflow with stages for scope, templates, stats, powers, defects, items, and final review
- Benchmark warning pass keyed to the page 24 character benchmark table

## Catalog coverage

### Attributes

All attribute names from the Chapter 5 summary table are now exported to `data/attributes.json`, including:

- every named attribute in the table on page 77
- a dedicated `Skill Group` entry with the 12 grouped specializations from pages 120-121
- source page references for each entry
- extracted rules-bearing text from the corebook PDF

### Defects

All defect names from the Chapter 7 summary table are now exported to `data/defects.json`, with:

- their category
- standard point returns by rank where applicable
- source page references
- extracted rules-bearing text from the corebook PDF

### Templates and modifiers

Structured source data now exists for:

- all 25 race templates and 25 class templates from Chapter 3 in `data/templates.json`
- reference data for stats, power levels, skill groups, size ranks, and benchmark tables in `data/reference-data.json`
- standard Enhancements/Limiters plus Weapon customisations in `data/modifiers.json`
- imported Chapter 10 rules sections in `data/item-library.json`
- coverage metadata in `data/coverage.json`

## Runtime data flow

- `scripts/generate_besm_content.py` extracts rules-bearing text from the local BESM PDF and regenerates the canonical JSON files in `data/`
- `module/rules/content.mjs` loads the generated content and exposes it to Foundry runtime lookups
- `module/sheets/item-sheet.mjs` shows imported exact book entry text for attributes, defects, and templates
- `module/sheets/actor-sheet.mjs` exposes an in-sheet Library step for browsing imported rules content and reference tables

## Current gaps

- Some `rulesText` extractions still include neighbouring text when the PDF has overlapping OCR/layout blocks on the same page
- Template entries are fully imported and browseable, but not yet decomposed into reversible structured component bundles
- Chapter 10 example item tables are imported as exact reference text, not yet as fully parsed per-row blueprint objects
- Chapter 11 companion examples are not yet broken out into a dedicated canonical content file

## Recommended next implementation order

1. Improve section extraction so same-page OCR overlaps do not bleed adjacent rules text into imported entries.
2. Parse template stat/attribute/defect rows into structured component arrays for automatic application and reversal.
3. Parse Chapter 10 tables into row-level blueprint objects for quick item creation.
4. Import Chapter 11 companion examples into canonical content and expose them through the Foundry library.
5. Expand modifier support beyond the current standard and weapon customisation pass when item/table parsing depends on it.
