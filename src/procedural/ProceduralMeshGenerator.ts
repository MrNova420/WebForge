import { NoiseGenerator } from './NoiseGenerator';
import { Vector3 } from '../math/Vector3';
import { MeshData } from '../geometry/MeshData';

/**
 * Procedural mesh generator
 * 
 * Generates various procedural meshes using algorithms and noise.
 */
export class ProceduralMeshGenerator {
    private noise: NoiseGenerator;

    constructor(seed: number = 0) {
        this.noise = new NoiseGenerator(seed);
    }

    /**
     * Generate a planet mesh with continents and oceans
     */
    public generatePlanet(radius: number, segments: number, waterLevel: number = 0.4): MeshData {
        const mesh = new MeshData();
        const vertices: Vector3[] = [];
        const indices: number[] = [];

        // Generate UV sphere
        for (let lat = 0; lat <= segments; lat++) {
            const theta = (lat * Math.PI) / segments;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= segments; lon++) {
                const phi = (lon * 2 * Math.PI) / segments;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                // Base sphere position
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;

                // Add noise for terrain
                const noiseValue = this.noise.fbm3D(x * 4, y * 4, z * 4, 5, 0.5, 2.0);

                // Elevation above water level
                const elevation = noiseValue > waterLevel ? (noiseValue - waterLevel) * 0.2 : 0;
                const r = radius * (1.0 + elevation);

                vertices.push(new Vector3(x * r, y * r, z * r));
            }
        }

        // Generate indices
        for (let lat = 0; lat < segments; lat++) {
            for (let lon = 0; lon < segments; lon++) {
                const first = lat * (segments + 1) + lon;
                const second = first + segments + 1;

                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        // Add vertices and faces
        for (const v of vertices) {
            mesh.addVertex(v, new Vector3(), new Vector3(0, 0));
        }

        for (let i = 0; i < indices.length; i += 3) {
            mesh.addFace([indices[i], indices[i + 1], indices[i + 2]]);
        }

        mesh.computeNormals();
        return mesh;
    }

    /**
     * Generate a cave system using 3D noise
     */
    public generateCave(width: number, height: number, depth: number, threshold: number = 0.5): MeshData {
        const mesh = new MeshData();
        const voxels = new Map<string, boolean>();

        // Generate voxel grid
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    const noise = this.noise.fbm3D(x * 0.1, y * 0.1, z * 0.1, 3, 0.5, 2.0);

                    if (noise < threshold) {
                        voxels.set(`${x},${y},${z}`, true); // Solid
                    }
                }
            }
        }

        // Generate mesh faces for visible voxel faces
        // (Simplified - full implementation would check neighbors)
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    if (voxels.get(`${x},${y},${z}`)) {
                        // Add cube faces if neighbor is air
                        this.addVoxelFaces(mesh, x, y, z, voxels);
                    }
                }
            }
        }

        mesh.computeNormals();
        return mesh;
    }

    /**
     * Generate a tree mesh procedurally
     */
    public generateTree(trunkHeight: number, crownRadius: number): MeshData {
        const mesh = new MeshData();

        // Generate trunk (cylinder)
        const trunkSegments = 8;
        const trunkRadius = 0.2;

        for (let i = 0; i <= trunkSegments; i++) {
            const angle = (i * 2 * Math.PI) / trunkSegments;
            const x = Math.cos(angle) * trunkRadius;
            const z = Math.sin(angle) * trunkRadius;

            mesh.addVertex(new Vector3(x, 0, z), new Vector3(), new Vector3(0, 0));
            mesh.addVertex(new Vector3(x, trunkHeight, z), new Vector3(), new Vector3(0, 1));
        }

        // Trunk faces
        for (let i = 0; i < trunkSegments; i++) {
            const b0 = i * 2;
            const b1 = ((i + 1) % (trunkSegments + 1)) * 2;
            const t0 = b0 + 1;
            const t1 = b1 + 1;

            mesh.addFace([b0, t0, b1]);
            mesh.addFace([t0, t1, b1]);
        }

        // Generate crown (sphere-ish with noise)
        const crownSegments = 16;
        const crownY = trunkHeight;

        for (let lat = 0; lat < crownSegments; lat++) {
            const theta = ((lat + 1) * Math.PI) / crownSegments;

            for (let lon = 0; lon < crownSegments; lon++) {
                const phi = (lon * 2 * Math.PI) / crownSegments;

                const x = Math.sin(theta) * Math.cos(phi);
                const y = Math.cos(theta);
                const z = Math.sin(theta) * Math.sin(phi);

                // Add noise for organic shape
                const noise = 1.0 + this.noise.perlin3D(x * 3, y * 3, z * 3) * 0.3;

                const vIdx = mesh.addVertex(
                    new Vector3(x * crownRadius * noise, crownY + y * crownRadius * noise, z * crownRadius * noise),
                    new Vector3(),
                    new Vector3(0, 0)
                );

                // Add faces (simplified)
                if (lat > 0 && lon > 0) {
                    const v0 = vIdx;
                    const v1 = vIdx - 1;
                    const v2 = vIdx - crownSegments;
                    const v3 = vIdx - crownSegments - 1;

                    mesh.addFace([v0, v2, v1]);
                    mesh.addFace([v1, v2, v3]);
                }
            }
        }

        mesh.computeNormals();
        return mesh;
    }

    /**
     * Generate a rock/asteroid mesh with noise
     */
    public generateRock(radius: number, roughness: number = 0.3): MeshData {
        const mesh = new MeshData();
        const segments = 16;

        // Icosphere-like generation with noise
        for (let lat = 0; lat <= segments; lat++) {
            const theta = (lat * Math.PI) / segments;

            for (let lon = 0; lon <= segments; lon++) {
                const phi = (lon * 2 * Math.PI) / segments;

                const x = Math.sin(theta) * Math.cos(phi);
                const y = Math.cos(theta);
                const z = Math.sin(theta) * Math.sin(phi);

                // Multi-octave noise for rock surface
                const noise = this.noise.fbm3D(x * 5, y * 5, z * 5, 4, 0.6, 2.0);
                const displacement = 1.0 + (noise - 0.5) * roughness;

                const r = radius * displacement;

                mesh.addVertex(new Vector3(x * r, y * r, z * r), new Vector3(), new Vector3(0, 0));
            }
        }

        // Generate indices
        for (let lat = 0; lat < segments; lat++) {
            for (let lon = 0; lon < segments; lon++) {
                const first = lat * (segments + 1) + lon;
                const second = first + segments + 1;

                mesh.addFace([first, second, first + 1]);
                mesh.addFace([second, second + 1, first + 1]);
            }
        }

        mesh.computeNormals();
        return mesh;
    }

    /**
     * Generate a building mesh procedurally
     */
    public generateBuilding(width: number, depth: number, height: number, floors: number): MeshData {
        const mesh = new MeshData();
        const floorHeight = height / floors;

        // Base building shape (box)
        const hw = width / 2;
        const hd = depth / 2;

        // Vertices for each floor
        for (let floor = 0; floor <= floors; floor++) {
            const y = floor * floorHeight;

            // 4 corners
            mesh.addVertex(new Vector3(-hw, y, -hd), new Vector3(), new Vector3(0, 0));
            mesh.addVertex(new Vector3(hw, y, -hd), new Vector3(), new Vector3(1, 0));
            mesh.addVertex(new Vector3(hw, y, hd), new Vector3(), new Vector3(1, 1));
            mesh.addVertex(new Vector3(-hw, y, hd), new Vector3(), new Vector3(0, 1));
        }

        // Generate walls
        for (let floor = 0; floor < floors; floor++) {
            const base = floor * 4;

            // Front wall
            mesh.addFace([base, base + 4, base + 1]);
            mesh.addFace([base + 1, base + 4, base + 5]);

            // Right wall
            mesh.addFace([base + 1, base + 5, base + 2]);
            mesh.addFace([base + 2, base + 5, base + 6]);

            // Back wall
            mesh.addFace([base + 2, base + 6, base + 3]);
            mesh.addFace([base + 3, base + 6, base + 7]);

            // Left wall
            mesh.addFace([base + 3, base + 7, base]);
            mesh.addFace([base, base + 7, base + 4]);
        }

        // Top face
        const topBase = floors * 4;
        mesh.addFace([topBase, topBase + 1, topBase + 2]);
        mesh.addFace([topBase, topBase + 2, topBase + 3]);

        mesh.computeNormals();
        return mesh;
    }

    /**
     * Add voxel faces to mesh (helper for cave generation)
     */
    private addVoxelFaces(mesh: MeshData, x: number, y: number, z: number, voxels: Map<string, boolean>): void {
        const size = 1.0;

        // Check each face and add if neighbor is air
        const faces = [
            { dir: [0, 1, 0], vertices: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] }, // Top
            { dir: [0, -1, 0], vertices: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] }, // Bottom
            { dir: [1, 0, 0], vertices: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] }, // Right
            { dir: [-1, 0, 0], vertices: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] }, // Left
            { dir: [0, 0, 1], vertices: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] }, // Front
            { dir: [0, 0, -1], vertices: [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0]] }  // Back
        ];

        for (const face of faces) {
            const [dx, dy, dz] = face.dir;
            const neighborKey = `${x + dx},${y + dy},${z + dz}`;

            if (!voxels.get(neighborKey)) {
                // Neighbor is air, add this face
                const vIndices = [];

                for (const [vx, vy, vz] of face.vertices) {
                    const worldX = x + vx * size;
                    const worldY = y + vy * size;
                    const worldZ = z + vz * size;

                    vIndices.push(mesh.addVertex(new Vector3(worldX, worldY, worldZ), new Vector3(), new Vector3(0, 0)));
                }

                mesh.addFace([vIndices[0], vIndices[1], vIndices[2]]);
                mesh.addFace([vIndices[0], vIndices[2], vIndices[3]]);
            }
        }
    }
}
