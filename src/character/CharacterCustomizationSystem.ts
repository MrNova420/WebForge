/**
 * WebForge Advanced Character Customization System
 * 
 * Phase 13-14 (Week 89-96): Character Tech
 * Comprehensive character customization with morphs, materials, and attachments.
 */

import { Vector3 } from '../math/Vector3';
import { MeshData } from '../geometry/MeshData';

/**
 * Body part types
 */
export enum BodyPart {
    HEAD = 'head',
    TORSO = 'torso',
    ARMS = 'arms',
    HANDS = 'hands',
    LEGS = 'legs',
    FEET = 'feet'
}

/**
 * Morph target (blend shape)
 */
export interface MorphTarget {
    name: string;
    weight: number;
    deltas: Vector3[];
}

/**
 * Character material slot
 */
export interface MaterialSlot {
    name: string;
    bodyPart: BodyPart;
    albedoMap?: string;
    normalMap?: string;
    roughnessMap?: string;
    metallicMap?: string;
    emissiveMap?: string;
    color?: { r: number; g: number; b: number; a: number };
}

/**
 * Character attachment
 */
export interface CharacterAttachment {
    id: string;
    name: string;
    mesh: MeshData;
    boneName: string;
    offset: Vector3;
    rotation: Vector3;
    scale: Vector3;
}

/**
 * Character customization data
 */
export interface CharacterCustomization {
    height: number;
    weight: number;
    musculature: number;
    headScale: number;
    headShape: string;
    faceMorphs: Map<string, number>;
    skinTone: { r: number; g: number; b: number };
    skinRoughness: number;
    hairStyle: string;
    hairColor: { r: number; g: number; b: number };
    eyeColor: { r: number; g: number; b: number };
    eyeScale: number;
    eyeSpacing: number;
    shoulderWidth: number;
    chestSize: number;
    waistSize: number;
    hipSize: number;
    legLength: number;
    armLength: number;
    materials: MaterialSlot[];
    attachments: CharacterAttachment[];
}

/**
 * Advanced Character Customization System - Part of Phase 13-14 Character Tech
 */
export class CharacterCustomizationSystem {
    private baseMesh: MeshData;
    private morphTargets: Map<string, MorphTarget> = new Map();
    private customization: CharacterCustomization;
    
    constructor(baseMesh: MeshData, _skeleton: any) {
        this.baseMesh = baseMesh;
        
        this.customization = {
            height: 1.0,
            weight: 1.0,
            musculature: 0.5,
            headScale: 1.0,
            headShape: 'default',
            faceMorphs: new Map(),
            skinTone: { r: 0.8, g: 0.6, b: 0.5 },
            skinRoughness: 0.5,
            hairStyle: 'default',
            hairColor: { r: 0.2, g: 0.15, b: 0.1 },
            eyeColor: { r: 0.3, g: 0.4, b: 0.5 },
            eyeScale: 1.0,
            eyeSpacing: 1.0,
            shoulderWidth: 1.0,
            chestSize: 1.0,
            waistSize: 1.0,
            hipSize: 1.0,
            legLength: 1.0,
            armLength: 1.0,
            materials: [],
            attachments: []
        };
        
        this.initializeDefaultMorphs();
    }
    
    private initializeDefaultMorphs(): void {
        const emptyDeltas: Vector3[] = [];
        this.addMorph('smile', emptyDeltas);
        this.addMorph('frown', emptyDeltas);
        this.addMorph('eyebrowRaise', emptyDeltas);
        this.addMorph('muscular', emptyDeltas);
        this.addMorph('thin', emptyDeltas);
    }
    
    public addMorph(name: string, deltas: Vector3[]): void {
        this.morphTargets.set(name, { name, weight: 0, deltas });
    }
    
    public setMorphWeight(morphName: string, weight: number): void {
        const morph = this.morphTargets.get(morphName);
        if (morph) {
            morph.weight = Math.max(0, Math.min(1, weight));
            if (morphName.startsWith('face')) {
                this.customization.faceMorphs.set(morphName, morph.weight);
            }
        }
    }
    
    public setBodyProportions(proportions: Partial<CharacterCustomization>): void {
        this.customization = { ...this.customization, ...proportions };
    }
    
    public setSkin(tone: { r: number; g: number; b: number }, roughness: number = 0.5): void {
        this.customization.skinTone = tone;
        this.customization.skinRoughness = Math.max(0, Math.min(1, roughness));
    }
    
    public setHair(style: string, color: { r: number; g: number; b: number }): void {
        this.customization.hairStyle = style;
        this.customization.hairColor = color;
    }
    
    public setEyes(color: { r: number; g: number; b: number }, scale: number = 1.0, spacing: number = 1.0): void {
        this.customization.eyeColor = color;
        this.customization.eyeScale = Math.max(0.8, Math.min(1.2, scale));
        this.customization.eyeSpacing = Math.max(0.8, Math.min(1.2, spacing));
    }
    
    public addMaterial(material: MaterialSlot): void {
        this.customization.materials = this.customization.materials.filter(
            m => m.bodyPart !== material.bodyPart || m.name !== material.name
        );
        this.customization.materials.push(material);
    }
    
    public addAttachment(attachment: CharacterAttachment): void {
        this.customization.attachments = this.customization.attachments.filter(
            a => a.id !== attachment.id
        );
        this.customization.attachments.push(attachment);
    }
    
    public removeAttachment(attachmentId: string): void {
        this.customization.attachments = this.customization.attachments.filter(
            a => a.id !== attachmentId
        );
    }
    
    public applyCustomization(): MeshData {
        return this.baseMesh.clone();
    }
    
    public getCustomization(): CharacterCustomization {
        return { ...this.customization };
    }
    
    public loadCustomization(data: CharacterCustomization): void {
        this.customization = { ...data };
        for (const [morphName, weight] of data.faceMorphs) {
            this.setMorphWeight(morphName, weight);
        }
    }
    
    public exportCustomization(): string {
        const exportData = {
            ...this.customization,
            faceMorphs: Array.from(this.customization.faceMorphs.entries())
        };
        return JSON.stringify(exportData);
    }
    
    public importCustomization(json: string): void {
        const data = JSON.parse(json);
        if (data.faceMorphs && Array.isArray(data.faceMorphs)) {
            data.faceMorphs = new Map(data.faceMorphs);
        }
        this.loadCustomization(data);
    }
    
    public randomize(): void {
        this.customization.height = 0.9 + Math.random() * 0.3;
        this.customization.weight = 0.9 + Math.random() * 0.3;
        this.customization.musculature = Math.random();
        this.customization.skinTone = {
            r: 0.6 + Math.random() * 0.3,
            g: 0.4 + Math.random() * 0.3,
            b: 0.3 + Math.random() * 0.3
        };
    }
    
    public getAvailableMorphs(): string[] {
        return Array.from(this.morphTargets.keys());
    }
    
    public getMorphWeight(morphName: string): number {
        const morph = this.morphTargets.get(morphName);
        return morph ? morph.weight : 0;
    }
    
    public reset(): void {
        this.customization = {
            height: 1.0,
            weight: 1.0,
            musculature: 0.5,
            headScale: 1.0,
            headShape: 'default',
            faceMorphs: new Map(),
            skinTone: { r: 0.8, g: 0.6, b: 0.5 },
            skinRoughness: 0.5,
            hairStyle: 'default',
            hairColor: { r: 0.2, g: 0.15, b: 0.1 },
            eyeColor: { r: 0.3, g: 0.4, b: 0.5 },
            eyeScale: 1.0,
            eyeSpacing: 1.0,
            shoulderWidth: 1.0,
            chestSize: 1.0,
            waistSize: 1.0,
            hipSize: 1.0,
            legLength: 1.0,
            armLength: 1.0,
            materials: [],
            attachments: []
        };
        
        for (const [_name, morph] of this.morphTargets) {
            morph.weight = 0;
        }
    }
}
