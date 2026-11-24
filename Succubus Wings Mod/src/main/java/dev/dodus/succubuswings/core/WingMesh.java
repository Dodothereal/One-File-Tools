package dev.dodus.succubuswings.core;

/**
 * Growable quad buffers. Each vertex is 12 floats: x y z, nx ny nz, u v, r g b a.
 * Three layers share one texture atlas layout: opaque parts (bones, claws, jewelry),
 * the translucent membrane, and the additive glow.
 */
public final class WingMesh {
    public static final int STRIDE = 12;

    public static final class Layer {
        public float[] data = new float[STRIDE * 4 * 512];
        public int vertices;

        public void clear() {
            vertices = 0;
        }

        void vertex(float x, float y, float z, float nx, float ny, float nz, float u, float v, float r, float g, float b, float a) {
            int i = vertices * STRIDE;
            if (i + STRIDE > data.length) data = java.util.Arrays.copyOf(data, data.length * 2);
            data[i] = x; data[i + 1] = y; data[i + 2] = z;
            data[i + 3] = nx; data[i + 4] = ny; data[i + 5] = nz;
            data[i + 6] = u; data[i + 7] = v;
            data[i + 8] = r; data[i + 9] = g; data[i + 10] = b; data[i + 11] = a;
            vertices++;
        }
    }

    public final Layer solid = new Layer();
    public final Layer membrane = new Layer();
    public final Layer glow = new Layer();

    public void clear() {
        solid.clear();
        membrane.clear();
        glow.clear();
    }
}
