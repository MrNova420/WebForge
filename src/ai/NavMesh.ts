import { Vector3 } from '../math/Vector3';

/**
 * Navigation mesh node representing a walkable triangle
 */
interface NavNode {
    id: number;
    vertices: [Vector3, Vector3, Vector3];
    centroid: Vector3;
    neighbors: number[];
    cost: number;
}

/**
 * Navigation mesh with A* pathfinding
 * 
 * Represents walkable areas as a triangle mesh and provides
 * efficient pathfinding using A* algorithm.
 */
export class NavMesh {
    private nodes: Map<number, NavNode> = new Map();
    private nextId: number = 0;

    /**
     * Add a walkable triangle to the navigation mesh
     */
    public addTriangle(v0: Vector3, v1: Vector3, v2: Vector3): number {
        const id = this.nextId++;
        const centroid = new Vector3(
            (v0.x + v1.x + v2.x) / 3,
            (v0.y + v1.y + v2.y) / 3,
            (v0.z + v1.z + v2.z) / 3
        );

        this.nodes.set(id, {
            id,
            vertices: [v0.clone(), v1.clone(), v2.clone()],
            centroid,
            neighbors: [],
            cost: 1.0
        });

        return id;
    }

    /**
     * Build connectivity graph by finding shared edges
     */
    public buildGraph(): void {
        const nodeArray = Array.from(this.nodes.values());

        for (let i = 0; i < nodeArray.length; i++) {
            const nodeA = nodeArray[i];

            for (let j = i + 1; j < nodeArray.length; j++) {
                const nodeB = nodeArray[j];

                if (this.sharesEdge(nodeA, nodeB)) {
                    nodeA.neighbors.push(nodeB.id);
                    nodeB.neighbors.push(nodeA.id);
                }
            }
        }
    }

    /**
     * Find path from start to end using A* algorithm
     */
    public findPath(start: Vector3, end: Vector3): Vector3[] {
        const startNode = this.findNearestNode(start);
        const endNode = this.findNearestNode(end);

        if (!startNode || !endNode) {
            return [];
        }

        return this.aStar(startNode.id, endNode.id);
    }

    /**
     * A* pathfinding algorithm
     */
    private aStar(startId: number, endId: number): Vector3[] {
        const openSet = new Set<number>([startId]);
        const cameFrom = new Map<number, number>();
        const gScore = new Map<number, number>();
        const fScore = new Map<number, number>();

        gScore.set(startId, 0);
        fScore.set(startId, this.heuristic(startId, endId));

        while (openSet.size > 0) {
            // Find node in openSet with lowest fScore
            let current = -1;
            let lowestF = Infinity;

            for (const id of openSet) {
                const f = fScore.get(id) || Infinity;
                if (f < lowestF) {
                    lowestF = f;
                    current = id;
                }
            }

            if (current === endId) {
                return this.reconstructPath(cameFrom, current);
            }

            openSet.delete(current);
            const currentNode = this.nodes.get(current)!;

            for (const neighborId of currentNode.neighbors) {
                const neighbor = this.nodes.get(neighborId)!;
                const tentativeG = (gScore.get(current) || Infinity) + neighbor.cost;

                if (tentativeG < (gScore.get(neighborId) || Infinity)) {
                    cameFrom.set(neighborId, current);
                    gScore.set(neighborId, tentativeG);
                    fScore.set(neighborId, tentativeG + this.heuristic(neighborId, endId));

                    if (!openSet.has(neighborId)) {
                        openSet.add(neighborId);
                    }
                }
            }
        }

        return []; // No path found
    }

    /**
     * Reconstruct path from cameFrom map
     */
    private reconstructPath(cameFrom: Map<number, number>, current: number): Vector3[] {
        const path: Vector3[] = [];
        const node = this.nodes.get(current);
        if (node) {
            path.push(node.centroid.clone());
        }

        while (cameFrom.has(current)) {
            current = cameFrom.get(current)!;
            const node = this.nodes.get(current);
            if (node) {
                path.unshift(node.centroid.clone());
            }
        }

        return path;
    }

    /**
     * Heuristic function for A* (Euclidean distance)
     */
    private heuristic(fromId: number, toId: number): number {
        const from = this.nodes.get(fromId);
        const to = this.nodes.get(toId);

        if (!from || !to) {
            return Infinity;
        }

        return from.centroid.distanceTo(to.centroid);
    }

    /**
     * Find nearest navigation node to a position
     */
    private findNearestNode(pos: Vector3): NavNode | null {
        let nearest: NavNode | null = null;
        let minDist = Infinity;

        for (const node of this.nodes.values()) {
            const dist = node.centroid.distanceTo(pos);
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }

        return nearest;
    }

    /**
     * Check if two triangles share an edge
     */
    private sharesEdge(nodeA: NavNode, nodeB: NavNode): boolean {
        const epsilon = 0.001;

        for (let i = 0; i < 3; i++) {
            const a1 = nodeA.vertices[i];
            const a2 = nodeA.vertices[(i + 1) % 3];

            for (let j = 0; j < 3; j++) {
                const b1 = nodeB.vertices[j];
                const b2 = nodeB.vertices[(j + 1) % 3];

                if (
                    (a1.distanceTo(b1) < epsilon && a2.distanceTo(b2) < epsilon) ||
                    (a1.distanceTo(b2) < epsilon && a2.distanceTo(b1) < epsilon)
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get all nodes
     */
    public getNodes(): NavNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Clear all nodes
     */
    public clear(): void {
        this.nodes.clear();
        this.nextId = 0;
    }

    /**
     * Get node count
     */
    public getNodeCount(): number {
        return this.nodes.size;
    }
}
