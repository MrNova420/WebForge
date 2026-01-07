/**
 * WebForge Mesh Selection
 * 
 * Selection management for vertices, edges, and faces in mesh editing.
 */

/**
 * Selection mode
 */
export enum SelectionMode {
    VERTEX = 'vertex',
    EDGE = 'edge',
    FACE = 'face'
}

/**
 * Mesh selection manager
 */
export class MeshSelection {
    private mode: SelectionMode = SelectionMode.VERTEX;
    private selectedVertices: Set<number> = new Set();
    private selectedEdges: Set<number> = new Set();
    private selectedFaces: Set<number> = new Set();
    
    /**
     * Sets the selection mode
     */
    public setMode(mode: SelectionMode): void {
        this.mode = mode;
    }
    
    /**
     * Gets the current mode
     */
    public getMode(): SelectionMode {
        return this.mode;
    }
    
    /**
     * Selects a vertex
     */
    public selectVertex(index: number): void {
        this.selectedVertices.add(index);
    }
    
    /**
     * Deselects a vertex
     */
    public deselectVertex(index: number): void {
        this.selectedVertices.delete(index);
    }
    
    /**
     * Toggles vertex selection
     */
    public toggleVertex(index: number): void {
        if (this.selectedVertices.has(index)) {
            this.selectedVertices.delete(index);
        } else {
            this.selectedVertices.add(index);
        }
    }
    
    /**
     * Selects an edge
     */
    public selectEdge(index: number): void {
        this.selectedEdges.add(index);
    }
    
    /**
     * Deselects an edge
     */
    public deselectEdge(index: number): void {
        this.selectedEdges.delete(index);
    }
    
    /**
     * Toggles edge selection
     */
    public toggleEdge(index: number): void {
        if (this.selectedEdges.has(index)) {
            this.selectedEdges.delete(index);
        } else {
            this.selectedEdges.add(index);
        }
    }
    
    /**
     * Selects a face
     */
    public selectFace(index: number): void {
        this.selectedFaces.add(index);
    }
    
    /**
     * Deselects a face
     */
    public deselectFace(index: number): void {
        this.selectedFaces.delete(index);
    }
    
    /**
     * Toggles face selection
     */
    public toggleFace(index: number): void {
        if (this.selectedFaces.has(index)) {
            this.selectedFaces.delete(index);
        } else {
            this.selectedFaces.add(index);
        }
    }
    
    /**
     * Clears all selections
     */
    public clear(): void {
        this.selectedVertices.clear();
        this.selectedEdges.clear();
        this.selectedFaces.clear();
    }
    
    /**
     * Gets selected vertices
     */
    public getSelectedVertices(): number[] {
        return Array.from(this.selectedVertices);
    }
    
    /**
     * Gets selected edges
     */
    public getSelectedEdges(): number[] {
        return Array.from(this.selectedEdges);
    }
    
    /**
     * Gets selected faces
     */
    public getSelectedFaces(): number[] {
        return Array.from(this.selectedFaces);
    }
    
    /**
     * Checks if a vertex is selected
     */
    public isVertexSelected(index: number): boolean {
        return this.selectedVertices.has(index);
    }
    
    /**
     * Checks if an edge is selected
     */
    public isEdgeSelected(index: number): boolean {
        return this.selectedEdges.has(index);
    }
    
    /**
     * Checks if a face is selected
     */
    public isFaceSelected(index: number): boolean {
        return this.selectedFaces.has(index);
    }
    
    /**
     * Gets the count of selected elements
     */
    public getSelectionCount(): number {
        switch (this.mode) {
            case SelectionMode.VERTEX:
                return this.selectedVertices.size;
            case SelectionMode.EDGE:
                return this.selectedEdges.size;
            case SelectionMode.FACE:
                return this.selectedFaces.size;
        }
    }
}
