/**
 * WebForge Inventory System
 *
 * Phase 13-14 (Week 89-96): Character Tech
 * Comprehensive inventory management with equipment, stacking, loot tables,
 * weight tracking, and serialization support.
 */

/**
 * Rarity tiers for items
 */
export enum ItemRarity {
    Common = 'common',
    Uncommon = 'uncommon',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary',
    Mythic = 'mythic'
}

/**
 * Classification of item types
 */
export enum ItemType {
    Weapon = 'weapon',
    Armor = 'armor',
    Consumable = 'consumable',
    Material = 'material',
    QuestItem = 'quest_item',
    Currency = 'currency',
    Accessory = 'accessory',
    Ammo = 'ammo',
    Tool = 'tool',
    Misc = 'misc'
}

/**
 * Slots where equipment can be worn
 */
export enum EquipmentSlot {
    Head = 'head',
    Chest = 'chest',
    Legs = 'legs',
    Feet = 'feet',
    Hands = 'hands',
    MainHand = 'main_hand',
    OffHand = 'off_hand',
    Ring1 = 'ring1',
    Ring2 = 'ring2',
    Necklace = 'necklace',
    Back = 'back',
    Belt = 'belt'
}

/**
 * Static definition describing an item archetype
 */
export interface ItemDefinition {
    /** Unique identifier for the item type */
    id: string;
    /** Display name */
    name: string;
    /** Flavor / tooltip text */
    description: string;
    /** Item category */
    type: ItemType;
    /** Item rarity tier */
    rarity: ItemRarity;
    /** Optional icon asset path */
    icon?: string;
    /** Optional 3D model asset path */
    model?: string;
    /** Whether multiple units can occupy one slot */
    stackable: boolean;
    /** Maximum units per stack */
    maxStack: number;
    /** Weight per unit */
    weight: number;
    /** Base monetary value per unit */
    value: number;
    /** Arbitrary stat / tag map */
    properties: Record<string, number | string | boolean>;
    /** Whether the item can be used from the inventory */
    usable: boolean;
    /** Whether the item can be equipped */
    equippable: boolean;
    /** Slot the item occupies when equipped */
    equipSlot?: EquipmentSlot;
}

/**
 * Runtime instance of an item living inside an inventory
 */
export interface InventoryItem {
    /** The archetype this item was created from */
    definition: ItemDefinition;
    /** Current stack count */
    quantity: number;
    /** Current durability (undefined if item has no durability) */
    durability?: number;
    /** Maximum durability */
    maxDurability?: number;
    /** Arbitrary per-instance data (enchantments, sockets, etc.) */
    customData?: Record<string, unknown>;
}

/** Callback fired whenever the inventory contents change */
export type InventoryChangeCallback = () => void;

/**
 * Serialized representation of an inventory item for save / load
 */
interface SerializedItem {
    definitionId: string;
    quantity: number;
    durability?: number;
    maxDurability?: number;
    customData?: Record<string, unknown>;
}

/**
 * General-purpose container that manages a collection of items with
 * weight limits, slot limits, stacking, sorting, and serialization.
 */
export class Inventory {
    private _slots: (InventoryItem | null)[];
    private _maxWeight: number;

    /** Optional callback invoked after every mutation */
    public onChange: InventoryChangeCallback | null = null;

    /**
     * Create a new inventory.
     * @param maxSlots  Maximum number of item slots
     * @param maxWeight Maximum total weight the inventory can hold
     */
    constructor(maxSlots: number, maxWeight: number) {
        this._slots = new Array<InventoryItem | null>(maxSlots).fill(null);
        this._maxWeight = maxWeight;
    }

    /**
     * Add an item (or stack of items) to the inventory.
     * Tries to merge into existing stacks first, then uses empty slots.
     * @returns `true` if the full quantity was added
     */
    public addItem(definition: ItemDefinition, quantity: number = 1): boolean {
        const totalWeight = definition.weight * quantity;
        if (this.getCurrentWeight() + totalWeight > this._maxWeight) {
            return false;
        }

        let remaining = quantity;

        // Merge into existing stacks
        if (definition.stackable) {
            for (let i = 0; i < this._slots.length && remaining > 0; i++) {
                const slot = this._slots[i];
                if (slot && slot.definition.id === definition.id) {
                    const space = definition.maxStack - slot.quantity;
                    if (space > 0) {
                        const toAdd = Math.min(remaining, space);
                        slot.quantity += toAdd;
                        remaining -= toAdd;
                    }
                }
            }
        }

        // Fill empty slots
        while (remaining > 0) {
            const emptyIndex = this._slots.indexOf(null);
            if (emptyIndex === -1) {
                return false;
            }
            const stackSize = definition.stackable
                ? Math.min(remaining, definition.maxStack)
                : 1;
            this._slots[emptyIndex] = {
                definition,
                quantity: stackSize
            };
            remaining -= stackSize;
        }

        this._notify();
        return true;
    }

    /**
     * Remove a quantity of an item by its definition id.
     * @returns `true` if the full quantity was removed
     */
    public removeItem(itemId: string, quantity: number = 1): boolean {
        if (!this.hasItem(itemId, quantity)) {
            return false;
        }

        let remaining = quantity;
        for (let i = this._slots.length - 1; i >= 0 && remaining > 0; i--) {
            const slot = this._slots[i];
            if (slot && slot.definition.id === itemId) {
                const toRemove = Math.min(remaining, slot.quantity);
                slot.quantity -= toRemove;
                remaining -= toRemove;
                if (slot.quantity <= 0) {
                    this._slots[i] = null;
                }
            }
        }

        this._notify();
        return true;
    }

    /**
     * Get the first inventory item matching the given id.
     */
    public getItem(itemId: string): InventoryItem | null {
        for (const slot of this._slots) {
            if (slot && slot.definition.id === itemId) {
                return slot;
            }
        }
        return null;
    }

    /** Return all non-null items in slot order. */
    public getItems(): InventoryItem[] {
        return this._slots.filter((s): s is InventoryItem => s !== null);
    }

    /** Total quantity of an item across all stacks. */
    public getItemCount(itemId: string): number {
        let count = 0;
        for (const slot of this._slots) {
            if (slot && slot.definition.id === itemId) {
                count += slot.quantity;
            }
        }
        return count;
    }

    /**
     * Check whether the inventory contains at least `quantity` of an item.
     */
    public hasItem(itemId: string, quantity: number = 1): boolean {
        return this.getItemCount(itemId) >= quantity;
    }

    /**
     * Swap the contents of two slots.
     * @returns `true` if the move was valid
     */
    public moveItem(fromIndex: number, toIndex: number): boolean {
        if (!this._validIndex(fromIndex) || !this._validIndex(toIndex)) {
            return false;
        }
        const temp = this._slots[fromIndex];
        this._slots[fromIndex] = this._slots[toIndex];
        this._slots[toIndex] = temp;
        this._notify();
        return true;
    }

    /**
     * Split `quantity` units off an existing stack into a new slot.
     * @returns `true` if the split succeeded
     */
    public splitStack(itemId: string, quantity: number): boolean {
        const sourceIndex = this._slots.findIndex(
            (s) => s !== null && s.definition.id === itemId && s.quantity > quantity
        );
        if (sourceIndex === -1) {
            return false;
        }
        const emptyIndex = this._slots.indexOf(null);
        if (emptyIndex === -1) {
            return false;
        }

        const source = this._slots[sourceIndex]!;
        source.quantity -= quantity;
        this._slots[emptyIndex] = {
            definition: source.definition,
            quantity
        };
        this._notify();
        return true;
    }

    /**
     * Merge all stacks of the given item id into as few slots as possible.
     */
    public mergeStacks(itemId: string): void {
        const indices: number[] = [];
        for (let i = 0; i < this._slots.length; i++) {
            if (this._slots[i]?.definition.id === itemId) {
                indices.push(i);
            }
        }
        if (indices.length <= 1) return;

        let total = 0;
        const def = this._slots[indices[0]]!.definition;
        for (const idx of indices) {
            total += this._slots[idx]!.quantity;
            this._slots[idx] = null;
        }

        let ptr = 0;
        while (total > 0) {
            const stackSize = def.stackable ? Math.min(total, def.maxStack) : 1;
            this._slots[indices[ptr]] = { definition: def, quantity: stackSize };
            total -= stackSize;
            ptr++;
        }
        this._notify();
    }

    /**
     * Sort non-null items by the given criterion.
     */
    public sort(by: 'name' | 'type' | 'rarity' | 'value' | 'weight'): void {
        const rarityOrder: Record<string, number> = {
            [ItemRarity.Common]: 0,
            [ItemRarity.Uncommon]: 1,
            [ItemRarity.Rare]: 2,
            [ItemRarity.Epic]: 3,
            [ItemRarity.Legendary]: 4,
            [ItemRarity.Mythic]: 5
        };

        const items = this.getItems();
        items.sort((a, b) => {
            const dA = a.definition;
            const dB = b.definition;
            switch (by) {
                case 'name':   return dA.name.localeCompare(dB.name);
                case 'type':   return dA.type.localeCompare(dB.type);
                case 'rarity': return (rarityOrder[dB.rarity] ?? 0) - (rarityOrder[dA.rarity] ?? 0);
                case 'value':  return dB.value - dA.value;
                case 'weight': return dB.weight - dA.weight;
            }
        });

        this._slots.fill(null);
        items.forEach((item, i) => { this._slots[i] = item; });
        this._notify();
    }

    /** Total weight of all items currently held. */
    public getCurrentWeight(): number {
        let weight = 0;
        for (const slot of this._slots) {
            if (slot) {
                weight += slot.definition.weight * slot.quantity;
            }
        }
        return weight;
    }

    /** Weight capacity still available. */
    public getRemainingWeight(): number {
        return Math.max(0, this._maxWeight - this.getCurrentWeight());
    }

    /** Number of occupied slots. */
    public getUsedSlots(): number {
        return this._slots.filter((s) => s !== null).length;
    }

    /** Number of empty slots. */
    public getRemainingSlots(): number {
        return this._slots.length - this.getUsedSlots();
    }

    /** Whether every slot is occupied. */
    public isFull(): boolean {
        return this.getRemainingSlots() === 0;
    }

    /** Remove all items. */
    public clear(): void {
        this._slots.fill(null);
        this._notify();
    }

    /** Return all items matching a predicate. */
    public find(predicate: (item: InventoryItem) => boolean): InventoryItem[] {
        return this.getItems().filter(predicate);
    }

    /**
     * Serialize the inventory to a plain object.
     */
    public toJSON(): { maxSlots: number; maxWeight: number; items: (SerializedItem | null)[] } {
        return {
            maxSlots: this._slots.length,
            maxWeight: this._maxWeight,
            items: this._slots.map((slot) => {
                if (!slot) return null;
                const s: SerializedItem = {
                    definitionId: slot.definition.id,
                    quantity: slot.quantity
                };
                if (slot.durability !== undefined) s.durability = slot.durability;
                if (slot.maxDurability !== undefined) s.maxDurability = slot.maxDurability;
                if (slot.customData) s.customData = slot.customData;
                return s;
            })
        };
    }

    /**
     * Restore inventory state from serialised data.
     * @param data  Output of {@link toJSON}
     * @param registry  Lookup function that resolves a definition id to an {@link ItemDefinition}
     */
    public fromJSON(
        data: { maxSlots: number; maxWeight: number; items: (SerializedItem | null)[] },
        registry: (id: string) => ItemDefinition | undefined
    ): void {
        this._slots = new Array<InventoryItem | null>(data.maxSlots).fill(null);
        this._maxWeight = data.maxWeight;

        for (let i = 0; i < data.items.length; i++) {
            const entry = data.items[i];
            if (!entry) continue;
            const def = registry(entry.definitionId);
            if (!def) continue;
            this._slots[i] = {
                definition: def,
                quantity: entry.quantity,
                durability: entry.durability,
                maxDurability: entry.maxDurability,
                customData: entry.customData
            };
        }
        this._notify();
    }

    // ── helpers ──────────────────────────────────────────────

    private _validIndex(index: number): boolean {
        return index >= 0 && index < this._slots.length;
    }

    private _notify(): void {
        if (this.onChange) {
            this.onChange();
        }
    }
}

/**
 * Manages equipment slots and computes aggregate stat bonuses.
 */
export class EquipmentManager {
    private _equipped: Map<EquipmentSlot, InventoryItem> = new Map();

    /**
     * Equip an item into the given slot.
     * @returns The previously equipped item, or `null` if the slot was empty
     */
    public equip(slot: EquipmentSlot, item: InventoryItem): InventoryItem | null {
        const prev = this._equipped.get(slot) ?? null;
        this._equipped.set(slot, item);
        return prev;
    }

    /**
     * Remove and return the item in a slot.
     */
    public unequip(slot: EquipmentSlot): InventoryItem | null {
        const item = this._equipped.get(slot) ?? null;
        this._equipped.delete(slot);
        return item;
    }

    /** Get the item currently in a slot. */
    public getEquipped(slot: EquipmentSlot): InventoryItem | null {
        return this._equipped.get(slot) ?? null;
    }

    /** Snapshot of all equipped items. */
    public getAllEquipped(): Map<EquipmentSlot, InventoryItem> {
        return new Map(this._equipped);
    }

    /**
     * Aggregate numeric properties across all equipped items.
     * Only `number` values in each definition's `properties` are summed.
     */
    public getStatBonuses(): Record<string, number> {
        const bonuses: Record<string, number> = {};
        for (const item of this._equipped.values()) {
            for (const [key, val] of Object.entries(item.definition.properties)) {
                if (typeof val === 'number') {
                    bonuses[key] = (bonuses[key] ?? 0) + val;
                }
            }
        }
        return bonuses;
    }

    /** Sum of the `armor` property across all equipped items. */
    public getTotalArmor(): number {
        let armor = 0;
        for (const item of this._equipped.values()) {
            const val = item.definition.properties['armor'];
            if (typeof val === 'number') {
                armor += val;
            }
        }
        return armor;
    }

    /** Total weight of all equipped items. */
    public getTotalWeight(): number {
        let weight = 0;
        for (const item of this._equipped.values()) {
            weight += item.definition.weight * item.quantity;
        }
        return weight;
    }

    /** Serialize equipped items. */
    public toJSON(): SerializedEquipment[] {
        const result: SerializedEquipment[] = [];
        for (const [slot, item] of this._equipped.entries()) {
            const entry: SerializedEquipment = {
                slot,
                definitionId: item.definition.id,
                quantity: item.quantity
            };
            if (item.durability !== undefined) entry.durability = item.durability;
            if (item.maxDurability !== undefined) entry.maxDurability = item.maxDurability;
            if (item.customData) entry.customData = item.customData;
            result.push(entry);
        }
        return result;
    }

    /**
     * Restore equipment state from serialised data.
     * @param data     Output of {@link toJSON}
     * @param registry Lookup function that resolves a definition id to an {@link ItemDefinition}
     */
    public fromJSON(
        data: SerializedEquipment[],
        registry: (id: string) => ItemDefinition | undefined
    ): void {
        this._equipped.clear();
        for (const entry of data) {
            const def = registry(entry.definitionId);
            if (!def) continue;
            this._equipped.set(entry.slot, {
                definition: def,
                quantity: entry.quantity,
                durability: entry.durability,
                maxDurability: entry.maxDurability,
                customData: entry.customData
            });
        }
    }
}

// ── Loot Tables ─────────────────────────────────────────────

/**
 * Serialized representation of an equipped item for save / load
 */
interface SerializedEquipment {
    slot: EquipmentSlot;
    definitionId: string;
    quantity: number;
    durability?: number;
    maxDurability?: number;
    customData?: Record<string, unknown>;
}

interface LootEntry {
    itemId: string;
    weight: number;
    minQuantity: number;
    maxQuantity: number;
}

interface GuaranteedDrop {
    itemId: string;
    quantity: number;
}

/**
 * Weighted random loot table with guaranteed drops.
 */
export class LootTable {
    private _entries: LootEntry[] = [];
    private _guaranteed: GuaranteedDrop[] = [];

    /**
     * Add a weighted drop entry.
     * @param itemId      Definition id of the item
     * @param weight      Relative probability weight (higher = more likely)
     * @param minQuantity Minimum drop quantity (inclusive)
     * @param maxQuantity Maximum drop quantity (inclusive)
     */
    public addEntry(itemId: string, weight: number, minQuantity: number, maxQuantity: number): void {
        this._entries.push({ itemId, weight, minQuantity, maxQuantity });
    }

    /** Remove all entries for the given item id. */
    public removeEntry(itemId: string): void {
        this._entries = this._entries.filter((e) => e.itemId !== itemId);
    }

    /**
     * Roll the loot table one or more times.
     * Guaranteed drops are always included regardless of `count`.
     * @param count Number of weighted rolls to perform (default 1)
     */
    public roll(count: number = 1): Array<{ itemId: string; quantity: number }> {
        const results: Array<{ itemId: string; quantity: number }> = [];

        // Guaranteed drops first
        for (const g of this._guaranteed) {
            results.push({ itemId: g.itemId, quantity: g.quantity });
        }

        if (this._entries.length === 0) return results;

        const totalWeight = this._entries.reduce((sum, e) => sum + e.weight, 0);
        if (totalWeight <= 0) return results;

        for (let i = 0; i < count; i++) {
            let rand = Math.random() * totalWeight;
            for (const entry of this._entries) {
                rand -= entry.weight;
                if (rand <= 0) {
                    const qty = entry.minQuantity === entry.maxQuantity
                        ? entry.minQuantity
                        : entry.minQuantity + Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1));
                    results.push({ itemId: entry.itemId, quantity: qty });
                    break;
                }
            }
        }

        return results;
    }

    /**
     * Register an item that always drops, independent of weight rolls.
     */
    public setGuaranteedDrop(itemId: string, quantity: number): void {
        const existing = this._guaranteed.find((g) => g.itemId === itemId);
        if (existing) {
            existing.quantity = quantity;
        } else {
            this._guaranteed.push({ itemId, quantity });
        }
    }
}
