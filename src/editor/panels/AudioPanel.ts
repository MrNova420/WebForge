/**
 * @fileoverview Audio Editor Panel for WebForge Editor
 * @module editor/panels/AudioPanel
 * 
 * Complete audio editing system with:
 * - Audio mixer with volume/pan/mute controls
 * - Spatial audio configuration
 * - Sound event system
 * - Audio effects (reverb, delay, filters)
 * - Real-time waveform visualization
 * - Audio bus routing
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';

// ============================================================================
// TYPES
// ============================================================================

/** Audio source type */
export type AudioSourceType = 'sound' | 'music' | 'voice' | 'ambient' | 'sfx';

/** Audio rolloff model for 3D sounds */
export type AudioRolloffMode = 'linear' | 'logarithmic' | 'custom';

/** Audio effect type */
export type AudioEffectType = 'reverb' | 'delay' | 'lowpass' | 'highpass' | 'bandpass' | 'compressor' | 'distortion' | 'chorus';

/** Audio bus configuration */
export interface AudioBusConfig {
    id: string;
    name: string;
    volume: number;
    muted: boolean;
    solo: boolean;
    pan: number;
    parentBus: string | null;
    effects: AudioEffect[];
}

/** Audio effect configuration */
export interface AudioEffect {
    type: AudioEffectType;
    enabled: boolean;
    params: Record<string, number>;
}

/** Audio source configuration */
export interface EditorAudioSourceConfig {
    id: string;
    name: string;
    type: AudioSourceType;
    filePath: string;
    
    // Playback
    volume: number;
    pitch: number;
    loop: boolean;
    playOnAwake: boolean;
    
    // Spatial audio
    spatialize: boolean;
    minDistance: number;
    maxDistance: number;
    rolloffMode: AudioRolloffMode;
    dopplerLevel: number;
    spread: number;
    
    // Routing
    outputBus: string;
    
    // Priority (for voice limiting)
    priority: number;
}

/** Sound event configuration */
export interface SoundEventConfig {
    id: string;
    name: string;
    sounds: SoundEntry[];
    playMode: 'random' | 'sequential' | 'shuffle';
    cooldown: number;
    maxInstances: number;
}

/** Sound entry in an event */
export interface SoundEntry {
    sourceId: string;
    weight: number;
    volumeMin: number;
    volumeMax: number;
    pitchMin: number;
    pitchMax: number;
    delay: number;
}

/** Audio snapshot for mixing states */
export interface AudioSnapshot {
    id: string;
    name: string;
    busStates: Map<string, { volume: number; muted: boolean }>;
    transitionTime: number;
}

// ============================================================================
// AUDIO PANEL
// ============================================================================

/**
 * Audio Editor Panel
 * 
 * Complete audio editing system with mixer, spatial audio,
 * effects, and visualization.
 */
export class AudioPanel extends Panel {
    // Audio data
    private audioBuses: Map<string, AudioBusConfig> = new Map();
    private audioSources: Map<string, EditorAudioSourceConfig> = new Map();
    private soundEvents: Map<string, SoundEventConfig> = new Map();
    private snapshots: Map<string, AudioSnapshot> = new Map();
    
    // UI state
    private selectedBusId: string | null = null;
    private selectedSourceId: string | null = null;
    private selectedEventId: string | null = null;
    private activeTab: 'mixer' | 'sources' | 'events' | 'snapshots' = 'mixer';
    private previewingSource: string | null = null;
    
    // Content element
    private content: HTMLElement | null = null;

    constructor(_context: EditorContext, id: string = 'audio', title: string = 'Audio') {
        super(id, title);
        this.initializeDefaultData();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    private initializeDefaultData(): void {
        // Create default master bus
        this.audioBuses.set('master', {
            id: 'master',
            name: 'Master',
            volume: 1.0,
            muted: false,
            solo: false,
            pan: 0,
            parentBus: null,
            effects: []
        });

        // Create default sub-buses
        const defaultBuses = ['Music', 'SFX', 'Voice', 'Ambient'];
        defaultBuses.forEach(name => {
            const busId = name.toLowerCase();
            this.audioBuses.set(busId, {
                id: busId,
                name,
                volume: 1.0,
                muted: false,
                solo: false,
                pan: 0,
                parentBus: 'master',
                effects: []
            });
        });

        // Select master by default
        this.selectedBusId = 'master';
    }

    // ========================================================================
    // PANEL LIFECYCLE
    // ========================================================================

    protected onMount(container: HTMLElement): void {
        this.content = document.createElement('div');
        this.content.style.cssText = `
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
            color: #ddd;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            height: 100%;
            overflow: hidden;
        `;
        container.appendChild(this.content);
        this.renderContent();
    }

    protected onUpdate(_deltaTime: number): void {
        // Update visualization if needed
    }

    protected onUnmount(): void {
        this.content = null;
    }

    private renderContent(): void {
        if (!this.content) return;
        this.content.innerHTML = '';

        // Tabs
        const tabBar = this.createTabBar();
        this.content.appendChild(tabBar);

        // Content based on active tab
        const tabContent = document.createElement('div');
        tabContent.style.cssText = 'flex: 1; overflow: auto; padding: 8px;';
        
        switch (this.activeTab) {
            case 'mixer':
                this.renderMixerTab(tabContent);
                break;
            case 'sources':
                this.renderSourcesTab(tabContent);
                break;
            case 'events':
                this.renderEventsTab(tabContent);
                break;
            case 'snapshots':
                this.renderSnapshotsTab(tabContent);
                break;
        }
        
        this.content.appendChild(tabContent);
    }

    private createTabBar(): HTMLElement {
        const tabBar = document.createElement('div');
        tabBar.style.cssText = `
            display: flex;
            background: #252526;
            border-bottom: 1px solid #3e3e42;
        `;

        type TabId = 'mixer' | 'sources' | 'events' | 'snapshots';
        const tabs: Array<{ id: TabId; label: string }> = [
            { id: 'mixer', label: '🎛️ Mixer' },
            { id: 'sources', label: '🔊 Sources' },
            { id: 'events', label: '⚡ Events' },
            { id: 'snapshots', label: '📸 Snapshots' }
        ];

        tabs.forEach(tab => {
            const tabEl = document.createElement('button');
            tabEl.textContent = tab.label;
            tabEl.style.cssText = `
                padding: 8px 16px;
                border: none;
                background: ${this.activeTab === tab.id ? '#1e1e1e' : 'transparent'};
                color: ${this.activeTab === tab.id ? '#fff' : '#888'};
                cursor: pointer;
                font-size: 12px;
                border-bottom: 2px solid ${this.activeTab === tab.id ? '#0078d4' : 'transparent'};
            `;
            tabEl.onclick = () => {
                this.activeTab = tab.id;
                this.renderContent();
            };
            tabBar.appendChild(tabEl);
        });

        return tabBar;
    }

    // ========================================================================
    // MIXER TAB
    // ========================================================================

    private renderMixerTab(container: HTMLElement): void {
        // Mixer channels
        const mixerContainer = document.createElement('div');
        mixerContainer.style.cssText = `
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding: 8px 0;
        `;

        // Render each bus as a channel strip
        this.audioBuses.forEach(bus => {
            const channel = this.createChannelStrip(bus);
            mixerContainer.appendChild(channel);
        });

        // Add new bus button
        const addBusBtn = document.createElement('button');
        addBusBtn.textContent = '+';
        addBusBtn.style.cssText = `
            width: 80px;
            min-height: 300px;
            background: #2d2d30;
            border: 2px dashed #3e3e42;
            color: #888;
            font-size: 24px;
            cursor: pointer;
            border-radius: 4px;
        `;
        addBusBtn.onclick = () => this.addNewBus();
        mixerContainer.appendChild(addBusBtn);

        container.appendChild(mixerContainer);

        // Effects section for selected bus
        if (this.selectedBusId) {
            const effectsSection = this.createEffectsSection();
            container.appendChild(effectsSection);
        }
    }

    private createChannelStrip(bus: AudioBusConfig): HTMLElement {
        const isSelected = bus.id === this.selectedBusId;
        
        const strip = document.createElement('div');
        strip.style.cssText = `
            width: 80px;
            min-height: 300px;
            background: ${isSelected ? '#2d2d30' : '#252526'};
            border: 1px solid ${isSelected ? '#0078d4' : '#3e3e42'};
            border-radius: 4px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            cursor: pointer;
        `;
        strip.onclick = (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON') {
                this.selectedBusId = bus.id;
                this.renderContent();
            }
        };

        // Bus name
        const name = document.createElement('div');
        name.textContent = bus.name;
        name.style.cssText = 'text-align: center; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        strip.appendChild(name);

        // Volume meter
        const meter = document.createElement('div');
        meter.style.cssText = `
            flex: 1;
            background: linear-gradient(to top, #4caf50, #ffeb3b, #f44336);
            border-radius: 2px;
            position: relative;
        `;
        const meterFill = document.createElement('div');
        const level = bus.muted ? 0 : bus.volume;
        meterFill.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: ${100 - level * 100}%;
            background: #1a1a1a;
            transition: height 0.1s;
        `;
        meter.appendChild(meterFill);
        strip.appendChild(meter);

        // Volume slider
        const volumeContainer = document.createElement('div');
        volumeContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
        
        const volumeSlider = document.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.min = '0';
        volumeSlider.max = '100';
        volumeSlider.value = String(bus.volume * 100);
        volumeSlider.style.cssText = 'width: 100%; accent-color: #0078d4;';
        volumeSlider.oninput = () => {
            bus.volume = parseInt(volumeSlider.value) / 100;
            this.renderContent();
        };
        
        const volumeLabel = document.createElement('div');
        volumeLabel.textContent = `${Math.round(bus.volume * 100)}%`;
        volumeLabel.style.cssText = 'font-size: 10px; color: #888;';
        
        volumeContainer.appendChild(volumeSlider);
        volumeContainer.appendChild(volumeLabel);
        strip.appendChild(volumeContainer);

        // Pan slider
        const panContainer = document.createElement('div');
        panContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
        
        const panLabel = document.createElement('div');
        panLabel.textContent = 'Pan';
        panLabel.style.cssText = 'font-size: 10px; color: #888;';
        
        const panSlider = document.createElement('input');
        panSlider.type = 'range';
        panSlider.min = '-100';
        panSlider.max = '100';
        panSlider.value = String(bus.pan * 100);
        panSlider.style.cssText = 'width: 100%; accent-color: #0078d4;';
        panSlider.oninput = () => {
            bus.pan = parseInt(panSlider.value) / 100;
        };
        
        panContainer.appendChild(panLabel);
        panContainer.appendChild(panSlider);
        strip.appendChild(panContainer);

        // Mute/Solo buttons
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 4px;';
        
        const muteBtn = document.createElement('button');
        muteBtn.textContent = 'M';
        muteBtn.style.cssText = `
            flex: 1;
            padding: 4px;
            border: none;
            background: ${bus.muted ? '#f44336' : '#3e3e42'};
            color: white;
            cursor: pointer;
            border-radius: 2px;
            font-size: 10px;
        `;
        muteBtn.onclick = (e) => {
            e.stopPropagation();
            bus.muted = !bus.muted;
            this.renderContent();
        };
        
        const soloBtn = document.createElement('button');
        soloBtn.textContent = 'S';
        soloBtn.style.cssText = `
            flex: 1;
            padding: 4px;
            border: none;
            background: ${bus.solo ? '#ffc107' : '#3e3e42'};
            color: ${bus.solo ? 'black' : 'white'};
            cursor: pointer;
            border-radius: 2px;
            font-size: 10px;
        `;
        soloBtn.onclick = (e) => {
            e.stopPropagation();
            bus.solo = !bus.solo;
            this.renderContent();
        };
        
        buttons.appendChild(muteBtn);
        buttons.appendChild(soloBtn);
        strip.appendChild(buttons);

        return strip;
    }

    private createEffectsSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-top: 16px;
            padding: 12px;
            background: #252526;
            border-radius: 4px;
        `;

        const bus = this.audioBuses.get(this.selectedBusId!);
        if (!bus) return section;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        
        const title = document.createElement('div');
        title.textContent = `Effects: ${bus.name}`;
        title.style.cssText = 'font-weight: bold;';
        header.appendChild(title);

        const addEffectBtn = document.createElement('button');
        addEffectBtn.textContent = '+ Add Effect';
        addEffectBtn.style.cssText = `
            padding: 4px 8px;
            border: none;
            background: #0078d4;
            color: white;
            cursor: pointer;
            border-radius: 2px;
            font-size: 11px;
        `;
        addEffectBtn.onclick = () => this.showAddEffectMenu(bus);
        header.appendChild(addEffectBtn);
        section.appendChild(header);

        // Effects list
        if (bus.effects.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No effects';
            empty.style.cssText = 'color: #888; font-style: italic;';
            section.appendChild(empty);
        } else {
            bus.effects.forEach((effect, index) => {
                const effectEl = this.createEffectEditor(bus, effect, index);
                section.appendChild(effectEl);
            });
        }

        return section;
    }

    private createEffectEditor(bus: AudioBusConfig, effect: AudioEffect, index: number): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = `
            background: #1e1e1e;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 8px;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = effect.enabled;
        checkbox.onchange = () => {
            effect.enabled = checkbox.checked;
        };
        
        const label = document.createElement('span');
        label.textContent = this.getEffectName(effect.type);
        label.style.cssText = 'margin-left: 8px;';
        
        const headerLeft = document.createElement('div');
        headerLeft.appendChild(checkbox);
        headerLeft.appendChild(label);
        header.appendChild(headerLeft);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = `
            width: 20px;
            height: 20px;
            border: none;
            background: #f44336;
            color: white;
            cursor: pointer;
            border-radius: 50%;
            font-size: 14px;
            line-height: 1;
        `;
        removeBtn.onclick = () => {
            bus.effects.splice(index, 1);
            this.renderContent();
        };
        header.appendChild(removeBtn);
        container.appendChild(header);

        // Effect parameters
        const params = this.getEffectDefaultParams(effect.type);
        Object.keys(params).forEach(key => {
            const param = this.createParamSlider(key, effect.params[key] ?? params[key], (value) => {
                effect.params[key] = value;
            });
            container.appendChild(param);
        });

        return container;
    }

    private createParamSlider(name: string, value: number, onChange: (value: number) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';

        const label = document.createElement('div');
        label.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        label.style.cssText = 'width: 80px; font-size: 11px;';
        container.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = String(value * 100);
        slider.style.cssText = 'flex: 1; accent-color: #0078d4;';

        const valueDisplay = document.createElement('div');
        valueDisplay.textContent = value.toFixed(2);
        valueDisplay.style.cssText = 'width: 40px; text-align: right; font-size: 11px; color: #888;';

        slider.oninput = () => {
            const newValue = parseInt(slider.value) / 100;
            valueDisplay.textContent = newValue.toFixed(2);
            onChange(newValue);
        };
        container.appendChild(slider);
        container.appendChild(valueDisplay);

        return container;
    }

    private showAddEffectMenu(bus: AudioBusConfig): void {
        const effectTypes: AudioEffectType[] = ['reverb', 'delay', 'lowpass', 'highpass', 'compressor', 'distortion', 'chorus'];
        
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            background: #2d2d30;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            padding: 4px 0;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
        `;

        effectTypes.forEach(type => {
            const item = document.createElement('div');
            item.textContent = this.getEffectName(type);
            item.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.1s;
            `;
            item.onmouseenter = () => { item.style.background = '#3e3e42'; };
            item.onmouseleave = () => { item.style.background = ''; };
            item.onclick = () => {
                bus.effects.push({
                    type,
                    enabled: true,
                    params: this.getEffectDefaultParams(type)
                });
                document.body.removeChild(menu);
                this.renderContent();
            };
            menu.appendChild(item);
        });

        // Click outside to close
        const closeHandler = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                if (menu.parentNode) document.body.removeChild(menu);
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
        
        document.body.appendChild(menu);
    }

    private getEffectName(type: AudioEffectType): string {
        const names: Record<AudioEffectType, string> = {
            reverb: 'Reverb',
            delay: 'Delay',
            lowpass: 'Low Pass Filter',
            highpass: 'High Pass Filter',
            bandpass: 'Band Pass Filter',
            compressor: 'Compressor',
            distortion: 'Distortion',
            chorus: 'Chorus'
        };
        return names[type];
    }

    private getEffectDefaultParams(type: AudioEffectType): Record<string, number> {
        switch (type) {
            case 'reverb':
                return { roomSize: 0.5, damping: 0.5, wet: 0.3, dry: 0.7 };
            case 'delay':
                return { time: 0.25, feedback: 0.3, wet: 0.3 };
            case 'lowpass':
            case 'highpass':
            case 'bandpass':
                return { frequency: 0.5, Q: 0.5 };
            case 'compressor':
                return { threshold: 0.5, ratio: 0.5, attack: 0.1, release: 0.25 };
            case 'distortion':
                return { amount: 0.5, tone: 0.5 };
            case 'chorus':
                return { rate: 0.5, depth: 0.5, wet: 0.3 };
            default:
                return {};
        }
    }

    // ========================================================================
    // SOURCES TAB
    // ========================================================================

    private renderSourcesTab(container: HTMLElement): void {
        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Source';
        addBtn.style.cssText = `
            padding: 6px 12px;
            border: none;
            background: #0078d4;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        addBtn.onclick = () => this.addNewSource();
        toolbar.appendChild(addBtn);
        
        container.appendChild(toolbar);

        // Split view: list and editor
        const splitView = document.createElement('div');
        splitView.style.cssText = 'display: flex; gap: 12px; height: calc(100% - 50px);';

        // Sources list
        const listPanel = document.createElement('div');
        listPanel.style.cssText = `
            width: 250px;
            background: #252526;
            border-radius: 4px;
            overflow-y: auto;
        `;

        if (this.audioSources.size === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No audio sources. Click "Add Source" to create one.';
            empty.style.cssText = 'padding: 16px; color: #888; font-style: italic;';
            listPanel.appendChild(empty);
        } else {
            this.audioSources.forEach(source => {
                const item = this.createSourceListItem(source);
                listPanel.appendChild(item);
            });
        }
        splitView.appendChild(listPanel);

        // Source editor
        const editorPanel = document.createElement('div');
        editorPanel.style.cssText = `
            flex: 1;
            background: #252526;
            border-radius: 4px;
            padding: 12px;
            overflow-y: auto;
        `;

        if (this.selectedSourceId) {
            const source = this.audioSources.get(this.selectedSourceId);
            if (source) {
                this.renderSourceEditor(editorPanel, source);
            }
        } else {
            editorPanel.innerHTML = '<div style="color: #888; font-style: italic;">Select a source to edit</div>';
        }
        splitView.appendChild(editorPanel);

        container.appendChild(splitView);
    }

    private createSourceListItem(source: EditorAudioSourceConfig): HTMLElement {
        const isSelected = source.id === this.selectedSourceId;
        
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 10px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            background: ${isSelected ? '#0078d4' : 'transparent'};
            border-bottom: 1px solid #3e3e42;
        `;
        item.onclick = () => {
            this.selectedSourceId = source.id;
            this.renderContent();
        };

        // Icon based on type
        const icon = document.createElement('span');
        const icons: Record<AudioSourceType, string> = {
            sound: '🔊',
            music: '🎵',
            voice: '🎤',
            ambient: '🌳',
            sfx: '💥'
        };
        icon.textContent = icons[source.type];
        item.appendChild(icon);

        // Name
        const name = document.createElement('div');
        name.textContent = source.name;
        name.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis;';
        item.appendChild(name);

        // Preview button
        const previewBtn = document.createElement('button');
        previewBtn.textContent = this.previewingSource === source.id ? '⏹' : '▶';
        previewBtn.style.cssText = `
            padding: 2px 6px;
            border: none;
            background: #3e3e42;
            color: white;
            cursor: pointer;
            border-radius: 2px;
        `;
        previewBtn.onclick = (e) => {
            e.stopPropagation();
            this.togglePreview(source.id);
        };
        item.appendChild(previewBtn);

        return item;
    }

    private renderSourceEditor(container: HTMLElement, source: EditorAudioSourceConfig): void {
        // Title
        const title = document.createElement('h3');
        title.textContent = `Edit: ${source.name}`;
        title.style.cssText = 'margin-bottom: 16px;';
        container.appendChild(title);

        // Basic settings
        const basicGroup = this.createSettingsGroup('Basic Settings');
        basicGroup.appendChild(this.createInput('Name', source.name, (v) => { source.name = v; this.renderContent(); }));
        basicGroup.appendChild(this.createSelect('Type', source.type, ['sound', 'music', 'voice', 'ambient', 'sfx'], (v) => { source.type = v as AudioSourceType; }));
        basicGroup.appendChild(this.createInput('File Path', source.filePath, (v) => { source.filePath = v; }));
        container.appendChild(basicGroup);

        // Playback settings
        const playbackGroup = this.createSettingsGroup('Playback');
        playbackGroup.appendChild(this.createSlider('Volume', source.volume, 0, 1, (v) => { source.volume = v; }));
        playbackGroup.appendChild(this.createSlider('Pitch', source.pitch, 0.5, 2, (v) => { source.pitch = v; }));
        playbackGroup.appendChild(this.createCheckbox('Loop', source.loop, (v) => { source.loop = v; }));
        playbackGroup.appendChild(this.createCheckbox('Play On Awake', source.playOnAwake, (v) => { source.playOnAwake = v; }));
        container.appendChild(playbackGroup);

        // Spatial audio settings
        const spatialGroup = this.createSettingsGroup('Spatial Audio');
        spatialGroup.appendChild(this.createCheckbox('Enable 3D', source.spatialize, (v) => { source.spatialize = v; this.renderContent(); }));
        
        if (source.spatialize) {
            spatialGroup.appendChild(this.createSlider('Min Distance', source.minDistance, 0.1, 100, (v) => { source.minDistance = v; }));
            spatialGroup.appendChild(this.createSlider('Max Distance', source.maxDistance, 1, 500, (v) => { source.maxDistance = v; }));
            spatialGroup.appendChild(this.createSelect('Rolloff', source.rolloffMode, ['linear', 'logarithmic', 'custom'], (v) => { source.rolloffMode = v as AudioRolloffMode; }));
            spatialGroup.appendChild(this.createSlider('Doppler Level', source.dopplerLevel, 0, 5, (v) => { source.dopplerLevel = v; }));
            spatialGroup.appendChild(this.createSlider('Spread', source.spread, 0, 360, (v) => { source.spread = v; }));
        }
        container.appendChild(spatialGroup);

        // Routing
        const routingGroup = this.createSettingsGroup('Routing');
        const busOptions = Array.from(this.audioBuses.keys());
        routingGroup.appendChild(this.createSelect('Output Bus', source.outputBus, busOptions, (v) => { source.outputBus = v; }));
        routingGroup.appendChild(this.createSlider('Priority', source.priority, 0, 256, (v) => { source.priority = Math.round(v); }));
        container.appendChild(routingGroup);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️ Delete Source';
        deleteBtn.style.cssText = `
            margin-top: 16px;
            padding: 8px 16px;
            border: none;
            background: #f44336;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        deleteBtn.onclick = () => {
            this.audioSources.delete(source.id);
            this.selectedSourceId = null;
            this.renderContent();
        };
        container.appendChild(deleteBtn);
    }

    // ========================================================================
    // EVENTS TAB
    // ========================================================================

    private renderEventsTab(container: HTMLElement): void {
        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Event';
        addBtn.style.cssText = `
            padding: 6px 12px;
            border: none;
            background: #0078d4;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        addBtn.onclick = () => this.addNewEvent();
        toolbar.appendChild(addBtn);
        container.appendChild(toolbar);

        // Split view
        const splitView = document.createElement('div');
        splitView.style.cssText = 'display: flex; gap: 12px; height: calc(100% - 50px);';

        // Events list
        const listPanel = document.createElement('div');
        listPanel.style.cssText = `
            width: 250px;
            background: #252526;
            border-radius: 4px;
            overflow-y: auto;
        `;

        if (this.soundEvents.size === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No sound events.';
            empty.style.cssText = 'padding: 16px; color: #888; font-style: italic;';
            listPanel.appendChild(empty);
        } else {
            this.soundEvents.forEach(event => {
                const item = this.createEventListItem(event);
                listPanel.appendChild(item);
            });
        }
        splitView.appendChild(listPanel);

        // Event editor
        const editorPanel = document.createElement('div');
        editorPanel.style.cssText = `
            flex: 1;
            background: #252526;
            border-radius: 4px;
            padding: 12px;
            overflow-y: auto;
        `;

        if (this.selectedEventId) {
            const event = this.soundEvents.get(this.selectedEventId);
            if (event) {
                this.renderEventEditor(editorPanel, event);
            }
        } else {
            editorPanel.innerHTML = '<div style="color: #888; font-style: italic;">Select an event to edit</div>';
        }
        splitView.appendChild(editorPanel);

        container.appendChild(splitView);
    }

    private createEventListItem(event: SoundEventConfig): HTMLElement {
        const isSelected = event.id === this.selectedEventId;
        
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 10px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            background: ${isSelected ? '#0078d4' : 'transparent'};
            border-bottom: 1px solid #3e3e42;
        `;
        item.onclick = () => {
            this.selectedEventId = event.id;
            this.renderContent();
        };

        const icon = document.createElement('span');
        icon.textContent = '⚡';
        item.appendChild(icon);

        const name = document.createElement('div');
        name.textContent = event.name;
        name.style.cssText = 'flex: 1;';
        item.appendChild(name);

        const badge = document.createElement('div');
        badge.textContent = `${event.sounds.length}`;
        badge.style.cssText = `
            padding: 2px 6px;
            background: #3e3e42;
            border-radius: 10px;
            font-size: 10px;
        `;
        item.appendChild(badge);

        return item;
    }

    private renderEventEditor(container: HTMLElement, event: SoundEventConfig): void {
        // Title
        const title = document.createElement('h3');
        title.textContent = `Edit: ${event.name}`;
        title.style.cssText = 'margin-bottom: 16px;';
        container.appendChild(title);

        // Basic settings
        const basicGroup = this.createSettingsGroup('Event Settings');
        basicGroup.appendChild(this.createInput('Name', event.name, (v) => { event.name = v; this.renderContent(); }));
        basicGroup.appendChild(this.createSelect('Play Mode', event.playMode, ['random', 'sequential', 'shuffle'], (v) => { event.playMode = v as 'random' | 'sequential' | 'shuffle'; }));
        basicGroup.appendChild(this.createSlider('Cooldown', event.cooldown, 0, 5, (v) => { event.cooldown = v; }));
        basicGroup.appendChild(this.createSlider('Max Instances', event.maxInstances, 1, 16, (v) => { event.maxInstances = Math.round(v); }));
        container.appendChild(basicGroup);

        // Sound entries
        const soundsGroup = this.createSettingsGroup('Sound Entries');
        
        event.sounds.forEach((entry, index) => {
            const entryEl = this.createSoundEntryEditor(event, entry, index);
            soundsGroup.appendChild(entryEl);
        });

        const addSoundBtn = document.createElement('button');
        addSoundBtn.textContent = '+ Add Sound';
        addSoundBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #3e3e42;
            background: transparent;
            color: #ddd;
            cursor: pointer;
            border-radius: 4px;
            margin-top: 8px;
        `;
        addSoundBtn.onclick = () => {
            event.sounds.push({
                sourceId: '',
                weight: 1,
                volumeMin: 1,
                volumeMax: 1,
                pitchMin: 1,
                pitchMax: 1,
                delay: 0
            });
            this.renderContent();
        };
        soundsGroup.appendChild(addSoundBtn);
        
        container.appendChild(soundsGroup);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️ Delete Event';
        deleteBtn.style.cssText = `
            margin-top: 16px;
            padding: 8px 16px;
            border: none;
            background: #f44336;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        deleteBtn.onclick = () => {
            this.soundEvents.delete(event.id);
            this.selectedEventId = null;
            this.renderContent();
        };
        container.appendChild(deleteBtn);
    }

    private createSoundEntryEditor(event: SoundEventConfig, entry: SoundEntry, index: number): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = `
            background: #1e1e1e;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 8px;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
        
        const titleEl = document.createElement('div');
        titleEl.textContent = `Sound ${index + 1}`;
        titleEl.style.cssText = 'font-weight: bold;';
        header.appendChild(titleEl);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = `
            width: 20px;
            height: 20px;
            border: none;
            background: #f44336;
            color: white;
            cursor: pointer;
            border-radius: 50%;
        `;
        removeBtn.onclick = () => {
            event.sounds.splice(index, 1);
            this.renderContent();
        };
        header.appendChild(removeBtn);
        container.appendChild(header);

        // Source selection
        const sourceOptions = ['', ...Array.from(this.audioSources.keys())];
        container.appendChild(this.createSelect('Source', entry.sourceId, sourceOptions, (v) => { entry.sourceId = v; }));
        
        // Parameters
        container.appendChild(this.createSlider('Weight', entry.weight, 0, 10, (v) => { entry.weight = v; }));
        container.appendChild(this.createSlider('Volume Min', entry.volumeMin, 0, 2, (v) => { entry.volumeMin = v; }));
        container.appendChild(this.createSlider('Volume Max', entry.volumeMax, 0, 2, (v) => { entry.volumeMax = v; }));
        container.appendChild(this.createSlider('Pitch Min', entry.pitchMin, 0.5, 2, (v) => { entry.pitchMin = v; }));
        container.appendChild(this.createSlider('Pitch Max', entry.pitchMax, 0.5, 2, (v) => { entry.pitchMax = v; }));
        container.appendChild(this.createSlider('Delay', entry.delay, 0, 2, (v) => { entry.delay = v; }));

        return container;
    }

    // ========================================================================
    // SNAPSHOTS TAB
    // ========================================================================

    private renderSnapshotsTab(container: HTMLElement): void {
        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Create Snapshot';
        addBtn.style.cssText = `
            padding: 6px 12px;
            border: none;
            background: #0078d4;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        addBtn.onclick = () => this.createSnapshot();
        toolbar.appendChild(addBtn);
        container.appendChild(toolbar);

        // Snapshots grid
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
        `;

        if (this.snapshots.size === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No snapshots. Create one to save the current mixer state.';
            empty.style.cssText = 'color: #888; font-style: italic; grid-column: 1 / -1;';
            grid.appendChild(empty);
        } else {
            this.snapshots.forEach(snapshot => {
                const card = this.createSnapshotCard(snapshot);
                grid.appendChild(card);
            });
        }

        container.appendChild(grid);
    }

    private createSnapshotCard(snapshot: AudioSnapshot): HTMLElement {
        const card = document.createElement('div');
        card.style.cssText = `
            background: #252526;
            border-radius: 4px;
            padding: 12px;
        `;

        const title = document.createElement('div');
        title.textContent = snapshot.name;
        title.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
        card.appendChild(title);

        const info = document.createElement('div');
        info.textContent = `${snapshot.busStates.size} buses • ${snapshot.transitionTime}s transition`;
        info.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 12px;';
        card.appendChild(info);

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 8px;';

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = `
            flex: 1;
            padding: 6px;
            border: none;
            background: #4caf50;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        applyBtn.onclick = () => this.applySnapshot(snapshot);
        buttons.appendChild(applyBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.style.cssText = `
            padding: 6px 10px;
            border: none;
            background: #f44336;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        deleteBtn.onclick = () => {
            this.snapshots.delete(snapshot.id);
            this.renderContent();
        };
        buttons.appendChild(deleteBtn);

        card.appendChild(buttons);

        return card;
    }

    // ========================================================================
    // UI HELPERS
    // ========================================================================

    private createSettingsGroup(title: string): HTMLElement {
        const group = document.createElement('div');
        group.style.cssText = 'margin-bottom: 16px;';
        
        const header = document.createElement('div');
        header.textContent = title;
        header.style.cssText = 'font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #3e3e42; padding-bottom: 4px;';
        group.appendChild(header);
        
        return group;
    }

    private createInput(label: string, value: string, onChange: (v: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        
        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = 'width: 100px; font-size: 11px;';
        container.appendChild(labelEl);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.style.cssText = `
            flex: 1;
            padding: 4px 8px;
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            color: #ddd;
            border-radius: 2px;
        `;
        input.oninput = () => onChange(input.value);
        container.appendChild(input);
        
        return container;
    }

    private createSelect(label: string, value: string, options: string[], onChange: (v: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        
        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = 'width: 100px; font-size: 11px;';
        container.appendChild(labelEl);
        
        const select = document.createElement('select');
        select.style.cssText = `
            flex: 1;
            padding: 4px 8px;
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            color: #ddd;
            border-radius: 2px;
        `;
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt || '(none)';
            option.selected = opt === value;
            select.appendChild(option);
        });
        
        select.onchange = () => onChange(select.value);
        container.appendChild(select);
        
        return container;
    }

    private createSlider(label: string, value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        
        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = 'width: 100px; font-size: 11px;';
        container.appendChild(labelEl);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String((max - min) / 100);
        slider.value = String(value);
        slider.style.cssText = 'flex: 1; accent-color: #0078d4;';
        
        const valueDisplay = document.createElement('div');
        valueDisplay.textContent = value.toFixed(2);
        valueDisplay.style.cssText = 'width: 50px; text-align: right; font-size: 11px; color: #888;';
        
        slider.oninput = () => {
            const newValue = parseFloat(slider.value);
            valueDisplay.textContent = newValue.toFixed(2);
            onChange(newValue);
        };
        
        container.appendChild(slider);
        container.appendChild(valueDisplay);
        
        return container;
    }

    private createCheckbox(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        
        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = 'width: 100px; font-size: 11px;';
        container.appendChild(labelEl);
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = value;
        checkbox.onchange = () => onChange(checkbox.checked);
        container.appendChild(checkbox);
        
        return container;
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    private addNewBus(): void {
        const id = `bus_${Date.now()}`;
        this.audioBuses.set(id, {
            id,
            name: 'New Bus',
            volume: 1.0,
            muted: false,
            solo: false,
            pan: 0,
            parentBus: 'master',
            effects: []
        });
        this.selectedBusId = id;
        this.renderContent();
    }

    private addNewSource(): void {
        const id = `source_${Date.now()}`;
        this.audioSources.set(id, {
            id,
            name: 'New Sound',
            type: 'sound',
            filePath: '',
            volume: 1,
            pitch: 1,
            loop: false,
            playOnAwake: false,
            spatialize: false,
            minDistance: 1,
            maxDistance: 100,
            rolloffMode: 'logarithmic',
            dopplerLevel: 1,
            spread: 0,
            outputBus: 'master',
            priority: 128
        });
        this.selectedSourceId = id;
        this.renderContent();
    }

    private addNewEvent(): void {
        const id = `event_${Date.now()}`;
        this.soundEvents.set(id, {
            id,
            name: 'New Event',
            sounds: [],
            playMode: 'random',
            cooldown: 0,
            maxInstances: 4
        });
        this.selectedEventId = id;
        this.renderContent();
    }

    private createSnapshot(): void {
        const id = `snapshot_${Date.now()}`;
        const busStates = new Map<string, { volume: number; muted: boolean }>();
        
        this.audioBuses.forEach((bus, busId) => {
            busStates.set(busId, { volume: bus.volume, muted: bus.muted });
        });
        
        this.snapshots.set(id, {
            id,
            name: `Snapshot ${this.snapshots.size + 1}`,
            busStates,
            transitionTime: 0.5
        });
        this.renderContent();
    }

    private applySnapshot(snapshot: AudioSnapshot): void {
        snapshot.busStates.forEach((state, busId) => {
            const bus = this.audioBuses.get(busId);
            if (bus) {
                bus.volume = state.volume;
                bus.muted = state.muted;
            }
        });
        this.renderContent();
    }

    private togglePreview(sourceId: string): void {
        if (this.previewingSource === sourceId) {
            this.previewingSource = null;
        } else {
            this.previewingSource = sourceId;
            console.log(`[AudioPanel] Preview started for ${sourceId}`);
        }
        this.renderContent();
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Export audio data as JSON
     */
    public exportData(): string {
        return JSON.stringify({
            buses: Array.from(this.audioBuses.entries()),
            sources: Array.from(this.audioSources.entries()),
            events: Array.from(this.soundEvents.entries()),
            snapshots: Array.from(this.snapshots.entries()).map(([id, snapshot]) => [
                id,
                {
                    ...snapshot,
                    busStates: Array.from(snapshot.busStates.entries())
                }
            ])
        }, null, 2);
    }

    /**
     * Import audio data from JSON
     */
    public importData(json: string): void {
        try {
            const data = JSON.parse(json);
            
            if (data.buses) {
                this.audioBuses = new Map(data.buses);
            }
            if (data.sources) {
                this.audioSources = new Map(data.sources);
            }
            if (data.events) {
                this.soundEvents = new Map(data.events);
            }
            if (data.snapshots) {
                this.snapshots = new Map(data.snapshots.map(([id, snapshot]: [string, { busStates: [string, { volume: number; muted: boolean }][] }]) => [
                    id,
                    {
                        ...snapshot,
                        busStates: new Map(snapshot.busStates)
                    }
                ]));
            }
            
            this.renderContent();
        } catch (error) {
            console.error('[AudioPanel] Failed to import data:', error);
        }
    }
}
