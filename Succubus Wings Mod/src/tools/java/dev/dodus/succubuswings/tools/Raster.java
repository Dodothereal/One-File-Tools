package dev.dodus.succubuswings.tools;

import dev.dodus.succubuswings.core.WingMesh;

import java.awt.image.BufferedImage;
import java.util.Arrays;

/** Tiny software rasterizer (z-buffer, perspective-correct, alpha + additive) for headless previews. */
final class Raster {
    final int w, h, ss;
    final float[] col, depth;
    BufferedImage albedo, glowTex;
    // camera
    float[] eye = new float[3], right = new float[3], up = new float[3], fwd = new float[3];
    float focal;
    // body transform (pitch about x, then translate)
    float bodyPitch, bodyY;
    static final float[] L0 = norm(0.25f, 0.9f, 0.75f), L1 = norm(-0.5f, 0.45f, -0.6f);

    Raster(int width, int height, int ss) {
        this.ss = ss;
        w = width * ss; h = height * ss;
        col = new float[w * h * 3];
        depth = new float[w * h];
    }

    void clear(int top, int bottom) {
        Arrays.fill(depth, Float.MAX_VALUE);
        for (int y = 0; y < h; y++) {
            float t = y / (float) h;
            for (int x = 0; x < w; x++) {
                float dx = (x - w * 0.5f) / w, dy = (y - h * 0.45f) / h;
                float vig = 1 - 0.9f * (dx * dx + dy * dy);
                int o = (y * w + x) * 3;
                for (int c = 0; c < 3; c++) {
                    int sh = 16 - c * 8;
                    float a = ((top >> sh) & 255) / 255f, b = ((bottom >> sh) & 255) / 255f;
                    col[o + c] = (a + (b - a) * t) * vig;
                }
            }
        }
    }

    void camera(float yawDeg, float pitchDeg, float dist, float tx, float ty, float tz, float fovDeg) {
        double yaw = Math.toRadians(yawDeg), pitch = Math.toRadians(pitchDeg);
        float cx = (float) (Math.sin(yaw) * Math.cos(pitch)), cy = (float) Math.sin(pitch), cz = (float) (Math.cos(yaw) * Math.cos(pitch));
        eye[0] = tx + cx * dist; eye[1] = ty + cy * dist; eye[2] = tz + cz * dist;
        fwd[0] = -cx; fwd[1] = -cy; fwd[2] = -cz;
        // right = fwd x worldUp
        float rx = fwd[1] * 0 - fwd[2] * 1, ry = 0, rz = fwd[0] * 1 - fwd[1] * 0;
        rx = -fwd[2]; rz = fwd[0];
        float rl = (float) Math.sqrt(rx * rx + rz * rz);
        right[0] = rx / rl; right[1] = 0; right[2] = rz / rl;
        up[0] = right[1] * fwd[2] - right[2] * fwd[1];
        up[1] = right[2] * fwd[0] - right[0] * fwd[2];
        up[2] = right[0] * fwd[1] - right[1] * fwd[0];
        focal = (float) (h * 0.5 / Math.tan(Math.toRadians(fovDeg) * 0.5));
    }

    private final float[] wp = new float[12], wn = new float[12], sp = new float[12];

    /** mode: 0 solid, 1 membrane (alpha, cull back faces), 2 additive glow. */
    void draw(WingMesh.Layer layer, int mode) {
        int quads = layer.vertices / 4;
        Integer[] order = new Integer[quads];
        float[] key = new float[quads];
        float cp = (float) Math.cos(bodyPitch), spn = (float) Math.sin(bodyPitch);
        for (int q = 0; q < quads; q++) {
            order[q] = q;
            float z = 0;
            for (int v = 0; v < 4; v++) {
                int i = (q * 4 + v) * WingMesh.STRIDE;
                float y = layer.data[i + 1], zz = layer.data[i + 2];
                float wy = y * cp - zz * spn + bodyY, wz = y * spn + zz * cp;
                z += (layer.data[i] - eye[0]) * fwd[0] + (wy - eye[1]) * fwd[1] + (wz - eye[2]) * fwd[2];
            }
            key[q] = z;
        }
        if (mode != 0) Arrays.sort(order, (a, b) -> Float.compare(key[b], key[a]));
        for (int qi = 0; qi < quads; qi++) {
            int q = order[qi];
            float facing = 0;
            for (int v = 0; v < 4; v++) {
                int i = (q * 4 + v) * WingMesh.STRIDE;
                float x = layer.data[i], y = layer.data[i + 1], z = layer.data[i + 2];
                float nx = layer.data[i + 3], ny = layer.data[i + 4], nz = layer.data[i + 5];
                float wy = y * cp - z * spn + bodyY, wz = y * spn + z * cp;
                float wny = ny * cp - nz * spn, wnz = ny * spn + nz * cp;
                wp[v * 3] = x; wp[v * 3 + 1] = wy; wp[v * 3 + 2] = wz;
                wn[v * 3] = nx; wn[v * 3 + 1] = wny; wn[v * 3 + 2] = wnz;
                float dx = x - eye[0], dy = wy - eye[1], dz = wz - eye[2];
                facing += -(nx * dx + wny * dy + wnz * dz);
                float vz = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
                sp[v * 3] = w * 0.5f + (dx * right[0] + dy * right[1] + dz * right[2]) / vz * focal;
                sp[v * 3 + 1] = h * 0.5f - (dx * up[0] + dy * up[1] + dz * up[2]) / vz * focal;
                sp[v * 3 + 2] = vz;
            }
            if (mode == 1 && facing <= 0) continue;
            if (sp[2] < 0.05f || sp[5] < 0.05f || sp[8] < 0.05f || sp[11] < 0.05f) continue;
            tri(layer.data, q * 4, 0, 1, 2, mode);
            tri(layer.data, q * 4, 0, 2, 3, mode);
        }
    }

    private void tri(float[] d, int base, int a, int b, int c, int mode) {
        float ax = sp[a * 3], ay = sp[a * 3 + 1], bx = sp[b * 3], by = sp[b * 3 + 1], cx = sp[c * 3], cy = sp[c * 3 + 1];
        float area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (Math.abs(area) < 1e-6f) return;
        int x0 = Math.max(0, (int) Math.floor(Math.min(ax, Math.min(bx, cx)))), x1 = Math.min(w - 1, (int) Math.ceil(Math.max(ax, Math.max(bx, cx))));
        int y0 = Math.max(0, (int) Math.floor(Math.min(ay, Math.min(by, cy)))), y1 = Math.min(h - 1, (int) Math.ceil(Math.max(ay, Math.max(by, cy))));
        float ia = 1 / sp[a * 3 + 2], ib = 1 / sp[b * 3 + 2], ic = 1 / sp[c * 3 + 2];
        int oa = (base + a) * WingMesh.STRIDE, ob = (base + b) * WingMesh.STRIDE, oc = (base + c) * WingMesh.STRIDE;
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                float px = x + 0.5f, py = y + 0.5f;
                float w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
                float w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
                float w2 = 1 - w0 - w1;
                if (w0 < 0 || w1 < 0 || w2 < 0) continue;
                float iz = w0 * ia + w1 * ib + w2 * ic;
                float z = 1 / iz;
                int pi = y * w + x;
                if (z >= depth[pi]) continue;
                float p0 = w0 * ia * z, p1 = w1 * ib * z, p2 = w2 * ic * z;
                float u = p0 * d[oa + 6] + p1 * d[ob + 6] + p2 * d[oc + 6], v = p0 * d[oa + 7] + p1 * d[ob + 7] + p2 * d[oc + 7];
                float r = p0 * d[oa + 8] + p1 * d[ob + 8] + p2 * d[oc + 8], g = p0 * d[oa + 9] + p1 * d[ob + 9] + p2 * d[oc + 9], bl = p0 * d[oa + 10] + p1 * d[ob + 10] + p2 * d[oc + 10];
                float al = p0 * d[oa + 11] + p1 * d[ob + 11] + p2 * d[oc + 11];
                int o = pi * 3;
                if (mode == 2) {
                    float e = sample(glowTex, u, v);
                    col[o] += r * e; col[o + 1] += g * e; col[o + 2] += bl * e;
                    continue;
                }
                float nx = p0 * wn[a * 3] + p1 * wn[b * 3] + p2 * wn[c * 3], ny = p0 * wn[a * 3 + 1] + p1 * wn[b * 3 + 1] + p2 * wn[c * 3 + 1], nz = p0 * wn[a * 3 + 2] + p1 * wn[b * 3 + 2] + p2 * wn[c * 3 + 2];
                float nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (nl > 1e-6f) { nx /= nl; ny /= nl; nz /= nl; }
                float tex = albedo == null || u < 0 ? 1 : sample(albedo, u, v);
                float d0 = nx * L0[0] + ny * L0[1] + nz * L0[2], d1 = nx * L1[0] + ny * L1[1] + nz * L1[2];
                float light;
                if (mode == 1) {
                    // thin skin: lit from the front, and glowing warmly when the light is behind it
                    light = 0.42f + 0.5f * Math.max(0, d0) + 0.2f * Math.max(0, d1) + 0.3f * Math.max(0, -d0);
                } else {
                    light = 0.36f + 0.62f * Math.max(0, d0) + 0.26f * Math.max(0, d1);
                }
                r *= tex * light; g *= tex * light; bl *= tex * light;
                if (mode == 0) {
                    // cheap specular so bone, claws and metal read as glossy
                    float hx = L0[0] - fwd[0], hy = L0[1] - fwd[1], hz = L0[2] - fwd[2];
                    float hl = (float) Math.sqrt(hx * hx + hy * hy + hz * hz);
                    float s = Math.max(0, (nx * hx + ny * hy + nz * hz) / hl);
                    float spec = (float) Math.pow(s, 28) * 0.4f * tex;
                    r += spec; g += spec; bl += spec;
                    depth[pi] = z;
                    col[o] = r; col[o + 1] = g; col[o + 2] = bl;
                } else {
                    col[o] += (r - col[o]) * al; col[o + 1] += (g - col[o + 1]) * al; col[o + 2] += (bl - col[o + 2]) * al;
                }
            }
        }
    }

    private static float sample(BufferedImage img, float u, float v) {
        float fx = u * img.getWidth() - 0.5f, fy = v * img.getHeight() - 0.5f;
        int x = (int) Math.floor(fx), y = (int) Math.floor(fy);
        float ax = fx - x, ay = fy - y;
        float a = px(img, x, y), b = px(img, x + 1, y), c = px(img, x, y + 1), dd = px(img, x + 1, y + 1);
        return (a + (b - a) * ax) * (1 - ay) + (c + (dd - c) * ax) * ay;
    }

    private static float px(BufferedImage img, int x, int y) {
        x = Math.max(0, Math.min(img.getWidth() - 1, x));
        y = Math.max(0, Math.min(img.getHeight() - 1, y));
        return (img.getRGB(x, y) & 255) / 255f;
    }

    BufferedImage resolve() {
        int ow = w / ss, oh = h / ss;
        BufferedImage out = new BufferedImage(ow, oh, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < oh; y++)
            for (int x = 0; x < ow; x++) {
                float r = 0, g = 0, b = 0;
                for (int sy = 0; sy < ss; sy++)
                    for (int sx = 0; sx < ss; sx++) {
                        int o = ((y * ss + sy) * w + x * ss + sx) * 3;
                        r += Math.min(1, col[o]); g += Math.min(1, col[o + 1]); b += Math.min(1, col[o + 2]);
                    }
                float n = ss * ss;
                out.setRGB(x, y, (c(r / n) << 16) | (c(g / n) << 8) | c(b / n));
            }
        return out;
    }

    private static int c(float v) {
        return Math.max(0, Math.min(255, Math.round((float) Math.pow(v, 1 / 1.0) * 255)));
    }

    private static float[] norm(float x, float y, float z) {
        float l = (float) Math.sqrt(x * x + y * y + z * z);
        return new float[]{x / l, y / l, z / l};
    }
}
