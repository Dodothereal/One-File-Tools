package dev.dodus.succubuswings.core;

/** Tiny deterministic smooth noise helpers. */
public final class Noise {
    private Noise() {}

    public static float hash(int x, int seed) {
        int h = x * 374761393 + seed * 668265263;
        h = (h ^ (h >>> 13)) * 1274126177;
        h ^= h >>> 16;
        return (h & 0xffffff) / (float) 0xffffff;
    }

    /** Smooth 1D value noise in [-1, 1]. */
    public static float smooth(float x, int seed) {
        int i = (int) Math.floor(x);
        float f = x - i;
        float u = f * f * f * (f * (f * 6 - 15) + 10);
        float a = hash(i, seed) * 2 - 1, b = hash(i + 1, seed) * 2 - 1;
        return a + (b - a) * u;
    }

    public static float hash2(int x, int y, int seed) {
        return hash(x * 7919 + y * 104729, seed);
    }

    /** Smooth 2D value noise in [0, 1]. */
    public static float smooth2(float x, float y, int seed) {
        int xi = (int) Math.floor(x), yi = (int) Math.floor(y);
        float fx = x - xi, fy = y - yi;
        float ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        float a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
        return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
    }

    public static float fbm2(float x, float y, int seed, int octaves) {
        float sum = 0, amp = 0.5f, norm = 0;
        for (int o = 0; o < octaves; o++) {
            sum += amp * smooth2(x, y, seed + o * 31);
            norm += amp;
            x *= 2.03f;
            y *= 2.03f;
            amp *= 0.5f;
        }
        return sum / norm;
    }
}
