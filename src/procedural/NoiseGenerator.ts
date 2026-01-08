/**
 * Noise generator for procedural content
 * 
 * Implements various noise algorithms for terrain, textures, and other procedural generation.
 */
export class NoiseGenerator {
    private seed: number;
    private permutation: number[];

    constructor(seed: number = 0) {
        this.seed = seed;
        this.permutation = this.generatePermutation();
    }

    /**
     * Generate permutation table for Perlin noise
     */
    private generatePermutation(): number[] {
        const p: number[] = [];

        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }

        // Fisher-Yates shuffle with seed
        const rng = this.seededRandom(this.seed);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }

        // Duplicate for overflow
        return [...p, ...p];
    }

    /**
     * Seeded random number generator
     */
    private seededRandom(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }

    /**
     * 2D Perlin noise
     */
    public perlin2D(x: number, y: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const aa = this.permutation[this.permutation[X] + Y];
        const ab = this.permutation[this.permutation[X] + Y + 1];
        const ba = this.permutation[this.permutation[X + 1] + Y];
        const bb = this.permutation[this.permutation[X + 1] + Y + 1];

        const res = this.lerp(
            v,
            this.lerp(u, this.grad2D(aa, x, y), this.grad2D(ba, x - 1, y)),
            this.lerp(u, this.grad2D(ab, x, y - 1), this.grad2D(bb, x - 1, y - 1))
        );

        return (res + 1) / 2; // Normalize to [0, 1]
    }

    /**
     * 3D Perlin noise
     */
    public perlin3D(x: number, y: number, z: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const aaa = this.permutation[this.permutation[this.permutation[X] + Y] + Z];
        const aba = this.permutation[this.permutation[this.permutation[X] + Y + 1] + Z];
        const aab = this.permutation[this.permutation[this.permutation[X] + Y] + Z + 1];
        const abb = this.permutation[this.permutation[this.permutation[X] + Y + 1] + Z + 1];
        const baa = this.permutation[this.permutation[this.permutation[X + 1] + Y] + Z];
        const bba = this.permutation[this.permutation[this.permutation[X + 1] + Y + 1] + Z];
        const bab = this.permutation[this.permutation[this.permutation[X + 1] + Y] + Z + 1];
        const bbb = this.permutation[this.permutation[this.permutation[X + 1] + Y + 1] + Z + 1];

        const x1 = this.lerp(u, this.grad3D(aaa, x, y, z), this.grad3D(baa, x - 1, y, z));
        const x2 = this.lerp(u, this.grad3D(aba, x, y - 1, z), this.grad3D(bba, x - 1, y - 1, z));
        const y1 = this.lerp(v, x1, x2);

        const x3 = this.lerp(u, this.grad3D(aab, x, y, z - 1), this.grad3D(bab, x - 1, y, z - 1));
        const x4 = this.lerp(u, this.grad3D(abb, x, y - 1, z - 1), this.grad3D(bbb, x - 1, y - 1, z - 1));
        const y2 = this.lerp(v, x3, x4);

        const res = this.lerp(w, y1, y2);
        return (res + 1) / 2; // Normalize to [0, 1]
    }

    /**
     * Fractal Brownian Motion (fBm) - layered noise
     */
    public fbm2D(x: number, y: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2.0): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.perlin2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue;
    }

    /**
     * Fractal Brownian Motion 3D
     */
    public fbm3D(x: number, y: number, z: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2.0): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.perlin3D(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue;
    }

    /**
     * Simplex noise (2D) - better than Perlin for some uses
     */
    public simplex2D(x: number, y: number): number {
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);

        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;

        let i1, j1;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        const ii = i & 255;
        const jj = j & 255;

        const gi0 = this.permutation[ii + this.permutation[jj]] % 12;
        const gi1 = this.permutation[ii + i1 + this.permutation[jj + j1]] % 12;
        const gi2 = this.permutation[ii + 1 + this.permutation[jj + 1]] % 12;

        let n0 = 0, n1 = 0, n2 = 0;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            n0 = t0 * t0 * this.dot2D(gi0, x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            n1 = t1 * t1 * this.dot2D(gi1, x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            n2 = t2 * t2 * this.dot2D(gi2, x2, y2);
        }

        return 70.0 * (n0 + n1 + n2);
    }

    /**
     * Voronoi noise (cellular) - creates cell-like patterns
     */
    public voronoi2D(x: number, y: number, cellSize: number = 1.0): number {
        const xCell = Math.floor(x / cellSize);
        const yCell = Math.floor(y / cellSize);

        let minDist = Infinity;

        // Check 3x3 neighborhood
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cx = xCell + dx;
                const cy = yCell + dy;

                // Generate pseudo-random point in cell
                const pointX = (cx + this.hash2D(cx, cy)) * cellSize;
                const pointY = (cy + this.hash2D(cy, cx)) * cellSize;

                const dist = Math.sqrt(
                    (x - pointX) ** 2 + (y - pointY) ** 2
                );

                minDist = Math.min(minDist, dist);
            }
        }

        return Math.min(minDist / cellSize, 1.0);
    }

    /**
     * Fade function for Perlin noise
     */
    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    /**
     * Linear interpolation
     */
    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    /**
     * 2D gradient
     */
    private grad2D(hash: number, x: number, y: number): number {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    /**
     * 3D gradient
     */
    private grad3D(hash: number, x: number, y: number, z: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    /**
     * 2D dot product for simplex
     */
    private dot2D(g: number, x: number, y: number): number {
        const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
        const [gx, gy] = grad[g % 4];
        return gx * x + gy * y;
    }

    /**
     * Simple 2D hash
     */
    private hash2D(x: number, y: number): number {
        const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
        return n - Math.floor(n);
    }
}
