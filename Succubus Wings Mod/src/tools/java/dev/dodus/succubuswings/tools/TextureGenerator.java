package dev.dodus.succubuswings.tools;

import dev.dodus.succubuswings.core.Noise;
import dev.dodus.succubuswings.core.WingGeometry;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Path2D;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.io.File;
import java.util.Random;

/**
 * Paints the wing texture atlas procedurally: a neutral (tintable) albedo with leathery grain,
 * tension wrinkles, thick tissue along the bones and a vein network, plus the matching glow map.
 * Run through `./gradlew generateTextures`; the PNGs are committed so the mod build does not need it.
 */
public final class TextureGenerator {
    static final int W = 2048, H = 1024;

    public static void main(String[] args) throws Exception {
        File dir = new File(args.length > 0 ? args[0] : "src/main/resources/assets/succubuswings/textures/entity");
        dir.mkdirs();
        BufferedImage[] out = generate();
        ImageIO.write(out[0], "png", new File(dir, "wings.png"));
        ImageIO.write(out[1], "png", new File(dir, "wings_glow.png"));
        System.out.println("wrote " + dir);
    }

    public static BufferedImage[] generate() {
        BufferedImage albedo = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        BufferedImage glow = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { albedo.setRGB(x, y, 0xffb0b0b0); glow.setRGB(x, y, 0xff000000); }

        int py0 = Math.round(WingGeometry.PANEL_V0 * H), py1 = Math.round(WingGeometry.PANEL_V1 * H);
        for (int p = 0; p < 5; p++) {
            int px0 = Math.round(WingGeometry.panelU0(p) * W), px1 = Math.round(WingGeometry.panelU1(p) * W);
            int pw = px1 - px0, ph = py1 - py0;
            BufferedImage veins = veins(pw, ph, 1234 + p * 77);
            BufferedImage halo = blur(blur(veins, 9), 9);
            BufferedImage soft = blur(veins, 3);
            // generous margin so bilinear filtering never bleeds the background in
            for (int y = py0 - 4; y < py1 + 4; y++) {
                for (int x = px0 - 4; x < px1 + 4; x++) {
                    int lx = Math.max(0, Math.min(pw - 1, x - px0)), ly = Math.max(0, Math.min(ph - 1, y - py0));
                    float w = lx / (float) (pw - 1), t = ly / (float) (ph - 1);
                    float edge = Math.min(w, 1 - w);
                    float grain = Noise.fbm2(w * 9 + p * 13, t * 26, 5 + p, 5);
                    float fine = Noise.fbm2(w * 60 + p * 3, t * 150, 91 + p, 3);
                    float v = 0.70f + 0.26f * grain + 0.10f * (fine - 0.5f);
                    // thick, dark tissue hugging the bones and the hub
                    v *= 1 - 0.46f * (float) Math.exp(-edge / 0.055f);
                    v *= 1 - 0.30f * (float) Math.exp(-t / 0.07f);
                    // tension wrinkles sagging between the fingers
                    float sag = 0.06f * (float) Math.sin(Math.PI * w);
                    float wr = 2 * Noise.fbm2(w * 5 + 40, (t - sag * t) * 34, 300 + p, 4) - 1;
                    v *= 1 + 0.16f * wr * (0.25f + 0.75f * t);
                    // leathery cells
                    float cell = Noise.fbm2(w * 34 + p * 7, t * 90, 640 + p, 2);
                    v *= 0.94f + 0.12f * (float) Math.pow(cell, 2);
                    // long fibres fanning out from the hub
                    float fib = 2 * Noise.fbm2(w * 48 + 9, t * 2.5f, 500 + p, 3) - 1;
                    v *= 1 + 0.07f * fib * (1 - t * 0.5f);
                    // light catching the stretched middle, dark hem on the trailing edge
                    v *= 1 + 0.10f * (float) Math.sin(Math.PI * w) * t;
                    float hem = (float) Math.exp(-(1 - t) / 0.012f);
                    v *= 1 - 0.55f * hem;
                    v *= 1 + 0.16f * (float) Math.exp(-Math.abs(1 - t - 0.035f) / 0.012f);
                    float vein = (soft.getRGB(lx, ly) & 255) / 255f;
                    v *= 1 - 0.42f * vein;
                    float orn = ornament(w, t, p), star = sparkle(w, t, p);
                    v *= 1 + 0.55f * orn;
                    int g = clamp(Math.round(v * 255));
                    albedo.setRGB(x, y, 0xff000000 | (g << 16) | (g << 8) | g);

                    float core = (veins.getRGB(lx, ly) & 255) / 255f, hl = (halo.getRGB(lx, ly) & 255) / 255f;
                    float e = core * 0.95f + hl * 1.6f * 0.55f;
                    e *= 1 - 0.35f * t;
                    // faint ember line on the hem and along the bones
                    e += 0.34f * (float) Math.exp(-Math.abs(1 - t - 0.012f) / 0.008f);
                    e += 0.12f * (float) Math.exp(-edge / 0.02f);
                    e += 0.045f * grain * (float) Math.sin(Math.PI * w);
                    e = e * (1 - 0.5f * orn) + 0.95f * orn + star;
                    int ge = clamp(Math.round(e * 255));
                    glow.setRGB(x, y, 0xff000000 | (ge << 16) | (ge << 8) | ge);
                }
            }
        }
        // strip: bone, claw, metal, gem
        int sy0 = Math.round(WingGeometry.STRIP_V0 * H) - 6, sy1 = Math.round(WingGeometry.STRIP_V1 * H) + 6;
        for (int y = sy0; y < sy1; y++) {
            float v = (y - sy0) / (float) (sy1 - sy0);
            for (int x = 0; x < W; x++) {
                float u = x / (float) W;
                float val;
                int ge = 0;
                if (u < 0.5f) {
                    float a = u / 0.5f;
                    float streak = Noise.fbm2(a * 40, v * 5, 700, 4);
                    float pores = Noise.fbm2(a * 300, v * 40, 710, 2);
                    float rings = (float) Math.sin(a * 2 * Math.PI * 46 + 3 * Noise.fbm2(a * 6, v * 3, 720, 2));
                    float sx = a * 64 + (((int) (v * 6)) & 1) * 0.5f, sy = v * 6;
                    float fx = sx - (float) Math.floor(sx) - 0.5f, fy = sy - (float) Math.floor(sy) - 0.5f;
                    float scale = 1 - Math.min(1, (fx * fx * 3.2f + fy * fy * 3.2f) * 1.3f);
                    float sheen = (float) Math.pow(Math.max(0, Math.sin(v * 2 * Math.PI + 0.9f)), 5);
                    val = 0.50f + 0.22f * streak + 0.08f * (pores - 0.5f) + 0.05f * rings + 0.30f * scale + 0.38f * sheen;
                } else if (u < 0.625f) {
                    float a = (u - 0.5f) / 0.125f;
                    float sheen = (float) Math.pow(Math.max(0, Math.sin(v * 2 * Math.PI + 0.6f)), 6);
                    float growth = (float) Math.sin(a * 2 * Math.PI * 14);
                    val = 0.62f + 0.45f * sheen + 0.05f * growth + 0.1f * Noise.fbm2(a * 20, v * 6, 800, 3);
                } else if (u < 0.75f) {
                    float brushed = Noise.fbm2(u * 900, v * 3, 900, 2);
                    float sheen = (float) Math.pow(Math.max(0, Math.sin(v * 2 * Math.PI + 1.1f)), 4);
                    float eng = (float) Math.abs(Math.sin(u * 2 * Math.PI * 70 + 4 * Math.sin(v * 2 * Math.PI * 3)));
                    val = 0.5f + 0.6f * sheen + 0.12f * (brushed - 0.5f) - 0.22f * (float) Math.pow(1 - eng, 6);
                } else if (u < 0.875f) {
                    float facet = Noise.hash2((int) (u * 260), (int) (v * 9), 1000);
                    val = 0.7f + 0.3f * facet;
                    ge = 255;
                } else {
                    val = 1;
                    ge = 255;
                }
                int g = clamp(Math.round(val * 255));
                albedo.setRGB(x, y, 0xff000000 | (g << 16) | (g << 8) | g);
                glow.setRGB(x, y, 0xff000000 | (ge << 16) | (ge << 8) | ge);
            }
        }
        return new BufferedImage[]{albedo, glow};
    }

    static float heart(float x, float y) {
        float a = x * x + y * y - 1;
        return a * a * a - x * x * y * y * y;
    }

    /** Approximate signed distance to a unit heart outline (negative inside). */
    static float heartDist(float x, float y) {
        float f = heart(x, y), e = 0.01f;
        float gx = (heart(x + e, y) - heart(x - e, y)) / (2 * e), gy = (heart(x, y + e) - heart(x, y - e)) / (2 * e);
        return f / ((float) Math.sqrt(gx * gx + gy * gy) + 0.6f);
    }

    static float line(float d, float half) {
        d = Math.abs(d);
        return d < half ? 1 : Math.max(0, 1 - (d - half) / (half * 0.9f));
    }

    /** Glowing ornament inked into the membrane: lace hem, a chain of hearts, beads and curling vines. 0..1. */
    static float ornament(float w, float t, int p) {
        final float A = 0.80f;
        float X = (w - 0.5f) * t * A, o = 0;
        // lace hem
        if (t > 0.80f && t < 0.99f) {
            o = Math.max(o, line(t - 0.838f, 0.0022f));
            o = Math.max(o, 0.8f * line(t - 0.974f, 0.0018f));
            int n = 9;
            float cu = (w * n - (float) Math.floor(w * n)) - 0.5f, cv = (t - 0.846f) / 0.118f;
            if (cv > 0 && cv < 1.1f) {
                float e = (float) Math.sqrt(cu * cu * 4 + cv * cv);
                o = Math.max(o, line(e - 0.98f, 0.035f));
                o = Math.max(o, 0.8f * line(e - 0.70f, 0.022f));
                // picots on the outer arc
                float ang = (float) Math.atan2(cv, cu * 2);
                float pic = (float) Math.abs(Math.sin(ang * 9));
                if (e > 0.98f && e < 1.1f) o = Math.max(o, 0.9f * (pic > 0.75f ? 1 : 0) * line(e - 1.05f, 0.04f));
                // spokes
                if (e > 0.72f && e < 0.96f) o = Math.max(o, 0.55f * (float) Math.pow(pic, 10));
                // little heart in every fan
                float cellW = A * t / n;
                float hd = heartDist(cu * cellW / 0.0125f, (0.33f - cv) * 0.118f / 0.0125f + 0.1f);
                if (hd < 0) o = Math.max(o, 0.95f);
            }
        }
        // chain of hearts down the middle, growing towards the edge
        float[] tc = {0.20f, 0.30f, 0.44f, 0.63f};
        float[] rr = {0.016f, 0.027f, 0.042f, 0.060f};
        for (int k = 0; k < 4; k++) {
            float hx = X * 1.35f / rr[k], hy = (tc[k] - t) / rr[k] + 0.1f;
            if (Math.abs(hx) > 2.2f || Math.abs(hy) > 2.2f) continue;
            float d = heartDist(hx, hy);
            o = Math.max(o, line(d, 0.075f));
            if (d < 0) o = Math.max(o, 0.6f);
            // glint
            float gl = (hx + 0.42f) * (hx + 0.42f) * 9 + (hy - 0.48f) * (hy - 0.48f) * 22;
            if (d < -0.12f && gl < 1) o = 1;
            // halo ring of dots
            float rad = (float) Math.sqrt(hx * hx + hy * hy), ang = (float) Math.atan2(hy, hx);
            if (Math.abs(rad - 1.85f) < 0.07f && Math.abs(Math.sin(ang * 7)) > 0.86f) o = Math.max(o, 0.85f);
        }
        // beads strung between the hearts
        if (t > 0.13f && t < 0.80f) {
            float bt = t / 0.021f, fr = bt - (float) Math.floor(bt) - 0.5f;
            float bd = (float) Math.sqrt(X * X + fr * fr * 0.021f * 0.021f);
            boolean inHeart = false;
            for (int k = 0; k < 4; k++) if (Math.abs(t - tc[k]) < rr[k] * 2.0f) inHeart = true;
            if (!inHeart && bd < 0.0032f) o = Math.max(o, 0.9f);
        }
        // curling vines either side, with leaves
        if (t > 0.16f && t < 0.83f) {
            for (int sgn = -1; sgn <= 1; sgn += 2) {
                float cx = sgn * (0.26f + 0.075f * (float) Math.sin(t * 34 + p * 1.3f)) * t * A;
                float thick = 0.0016f + 0.0012f * t;
                o = Math.max(o, 0.8f * line(X - cx, thick));
                float lt = t / 0.058f, lf = lt - (float) Math.floor(lt) - 0.5f;
                float side = ((int) Math.floor(lt) & 1) == 0 ? 1 : -1;
                float lx = (X - cx) * side * sgn - 0.011f * (0.4f + t), ly = lf * 0.058f;
                float leaf = lx * lx / (0.0085f * 0.0085f * (0.3f + t)) + ly * ly / (0.004f * 0.004f * (0.5f + t));
                if (leaf < 1) o = Math.max(o, 0.75f * (leaf > 0.55f ? 1 : 0.45f));
                // curl
                float qx = (X - cx) * side * sgn + 0.014f * (0.4f + t), qy = lf * 0.058f;
                float qr = (float) Math.sqrt(qx * qx + qy * qy) / (0.3f + t);
                float qa = (float) Math.atan2(qy, qx);
                float spiral = qr - 0.0022f * (qa + 3.1416f);
                if (qr < 0.014f) o = Math.max(o, 0.7f * line(spiral, 0.0011f));
            }
        }
        return Math.min(1, o);
    }

    /** Scattered four-point stars for the glow map. */
    static float sparkle(float w, float t, int p) {
        float gx = w * 9, gy = t * 46;
        float best = 0;
        for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) {
            int cx = (int) Math.floor(gx) + ox, cy = (int) Math.floor(gy) + oy;
            float h = Noise.hash2(cx, cy, 4100 + p);
            if (h > 0.30f) continue;
            float sx = cx + 0.2f + 0.6f * Noise.hash2(cx, cy, 4200 + p), sy = cy + 0.2f + 0.6f * Noise.hash2(cx, cy, 4300 + p);
            float size = 0.25f + 1.6f * h * 3.3f * Noise.hash2(cx, cy, 4400 + p);
            float dx = (gx - sx) / 9 * 0.8f * Math.max(0.15f, t), dy = (gy - sy) / 46;
            dx /= 0.012f * size; dy /= 0.012f * size;
            float r2 = dx * dx + dy * dy;
            float sVal = (float) Math.exp(-r2 * 9) + 0.8f * (float) Math.exp(-Math.abs(dx * dy) * 60 - r2 * 1.2f);
            best = Math.max(best, sVal);
        }
        return Math.min(1, best) * (0.35f + 0.65f * t);
    }

    /** Branching vessels growing from both bones into the membrane; white on black. */
    private static BufferedImage veins(int w, int h, long seed) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        Random r = new Random(seed);
        for (int side = 0; side < 2; side++) {
            int n = 7;
            for (int i = 0; i < n; i++) {
                double t0 = 0.03 + (i + r.nextDouble() * 0.7) / n * 0.82;
                double x = side == 0 ? 0.0 : 1.0;
                double dir = side == 0 ? 1 : -1;
                // heads into the membrane and bends towards the trailing edge
                branch(g, r, x * w, t0 * h, dir * (0.55 + r.nextDouble() * 0.25), 0.55 + r.nextDouble() * 0.35, (0.20 + r.nextDouble() * 0.20) * h, 4.6f, 0, w, h);
            }
        }
        // a few vessels straight out of the hub
        for (int i = 0; i < 3; i++) branch(g, r, (0.3 + 0.2 * i) * w, 0.01 * h, (i - 1) * 0.12, 1, (0.3 + r.nextDouble() * 0.2) * h, 4.2f, 0, w, h);
        g.dispose();
        return img;
    }

    private static void branch(Graphics2D g, Random r, double x, double y, double dx, double dy, double len, float width, int depth, int w, int h) {
        double l = Math.hypot(dx * w / h, dy);
        dx /= l; dy /= l;
        int steps = Math.max(4, (int) (len / 9));
        double step = len / steps;
        for (int i = 0; i < steps; i++) {
            float wd = width * (1 - 0.75f * i / steps);
            double ang = (r.nextDouble() - 0.5) * 0.5;
            double ndx = dx * Math.cos(ang) - dy * Math.sin(ang), ndy = dx * Math.sin(ang) + dy * Math.cos(ang);
            // keep drifting towards the trailing edge
            ndy += 0.06;
            double nl = Math.hypot(ndx, ndy);
            dx = ndx / nl; dy = ndy / nl;
            double nx = x + dx * step * w / h * 0.55, ny = y + dy * step;
            int c = clamp(Math.round(255 * (0.55f + 0.45f * (1 - i / (float) steps)) * (depth == 0 ? 1f : 0.8f)));
            g.setColor(new Color(c, c, c));
            g.setStroke(new BasicStroke(Math.max(0.9f, wd), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            Path2D.Double p = new Path2D.Double();
            p.moveTo(x, y);
            p.lineTo(nx, ny);
            g.draw(p);
            x = nx; y = ny;
            if (depth < 3 && i > 1 && r.nextDouble() < (depth == 0 ? 0.34 : 0.22)) {
                double sgn = r.nextBoolean() ? 1 : -1;
                double a = sgn * (0.5 + r.nextDouble() * 0.5);
                branch(g, r, x, y, dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a), len * (0.35 + r.nextDouble() * 0.25), wd * 0.72f, depth + 1, w, h);
            }
            if (x < -4 || x > w + 4 || y > h + 4) break;
        }
    }

    private static BufferedImage blur(BufferedImage src, int size) {
        float[] k = new float[size];
        float sum = 0;
        for (int i = 0; i < size; i++) { float d = (i - size / 2) / (size / 4f + 0.5f); k[i] = (float) Math.exp(-d * d); sum += k[i]; }
        for (int i = 0; i < size; i++) k[i] /= sum;
        BufferedImage a = new ConvolveOp(new Kernel(size, 1, k), ConvolveOp.EDGE_NO_OP, null).filter(src, null);
        return new ConvolveOp(new Kernel(1, size, k), ConvolveOp.EDGE_NO_OP, null).filter(a, null);
    }

    static int clamp(int v) {
        return v < 0 ? 0 : Math.min(255, v);
    }
}
