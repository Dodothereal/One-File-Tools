package dev.dodus.succubuswings.core;

import static dev.dodus.succubuswings.core.WingSkeleton.SEG;

/**
 * Builds the renderable wing from a posed skeleton: the membrane panels stretched between the
 * fingers (with scalloped trailing edges, air-pressure billow, slack pleats when folded and
 * trailing-edge flutter), tapered bones with knuckles, claws, thorns and jewelry.
 * Not thread safe; use one instance per thread.
 */
public final class WingGeometry {
    public static final int GW = 14, GT = 18, SIDES = 8;

    // ---- texture atlas layout (shared by the albedo and the glow texture) ----
    public static final float PANEL_V0 = 0.004f, PANEL_V1 = 0.84f;
    public static final float STRIP_V0 = 0.885f, STRIP_V1 = 0.985f;
    public static final float BONE_U0 = 0.005f, BONE_U1 = 0.495f;
    public static final float CLAW_U0 = 0.505f, CLAW_U1 = 0.62f;
    public static final float METAL_U0 = 0.63f, METAL_U1 = 0.745f;
    public static final float GEM_U0 = 0.755f, GEM_U1 = 0.87f;
    public static final float WHITE_U = 0.94f, WHITE_V = 0.94f;

    public static float panelU0(int i) { return i * 0.2f + 0.004f; }
    public static float panelU1(int i) { return (i + 1) * 0.2f - 0.004f; }

    private static final float[] SCALLOP = {0.20f, 0.24f, 0.26f, 0.22f, 0.30f};
    private static final float[] TEAR = {0.36f, 0.71f, 0.27f, 0.62f, 0.44f};
    private static final float[][] REST_WIDTH = new float[WingPose.FINGERS][GT + 1];

    static {
        WingPose open = new WingPose();
        open.spread = 1;
        WingSkeleton sk = new WingSkeleton();
        sk.compute(open, 1);
        float[] a = new float[3], b = new float[3];
        for (int i = 0; i < WingPose.FINGERS; i++) {
            for (int j = 0; j <= GT; j++) {
                float t = j / (float) GT;
                sample(sk.finger[i], t, a);
                sample(i == 4 ? sk.bodyLine : sk.finger[i + 1], t, b);
                REST_WIDTH[i][j] = dist(a, b);
            }
        }
    }

    private final float[] grid = new float[(GW + 1) * (GT + 1) * 3];
    private final float[] gridN = new float[(GW + 1) * (GT + 1) * 3];
    private final float[] pa = new float[3], pb = new float[3], ta = new float[3], tb = new float[3], tmp = new float[3], tmp2 = new float[3];
    private final float[] ringPts = new float[64 * 3], ringRad = new float[64], ringCol = new float[64 * 3], ringAlong = new float[64];
    private final float[] ringA = new float[SIDES * 6], ringB = new float[SIDES * 6];
    private final float[] q = new float[4 * WingMesh.STRIDE];
    private int qn;
    private float sg = 1;

    /**
     * @param side  +1 for the wearer's right wing, -1 for the left
     * @param chain pendant chain points (already on the correct side, body space) or null
     */
    public void build(WingSkeleton sk, WingPose pose, WingConfig cfg, Palette pal, int side, float[] chain, int chainPoints, WingMesh mesh) {
        sg = side;
        float size = sk.size;
        buildBones(sk, pal, cfg, size, mesh);
        for (int i = 0; i < WingPose.FINGERS; i++) buildPanel(sk, pose, cfg, pal, i, size, mesh);
        if (cfg.jewelry && chain != null) {
            buildDrapes(sk, chain, chainPoints, pal, cfg, size, mesh);
            buildPendant(chain, chainPoints, pal, cfg, size, mesh);
        }
    }

    // ------------------------------------------------------------------ membrane

    private void buildPanel(WingSkeleton sk, WingPose pose, WingConfig cfg, Palette pal, int i, float size, WingMesh mesh) {
        float[] A = sk.finger[i], B = i == 4 ? sk.bodyLine : sk.finger[i + 1];
        float[] N = sk.axisN;
        float billow = (pose.billow[i] + 0.13f) * size;
        float tearA = TEAR[i], tearB = TEAR[(i + 2) % 5] * 0.55f + 0.3f;
        for (int j = 0; j <= GT; j++) {
            float t = j / (float) GT;
            for (int k = 0; k <= GW; k++) {
                float w = k / (float) GW;
                float sw = (float) Math.sin(Math.PI * w);
                float tt = t * (1 - SCALLOP[i] * (float) Math.pow(sw, 0.85));
                sample(A, tt, pa);
                sample(B, tt, pb);
                tangent(A, tt, ta);
                tangent(B, tt, tb);
                float px = pa[0] + (pb[0] - pa[0]) * w, py = pa[1] + (pb[1] - pa[1]) * w, pz = pa[2] + (pb[2] - pa[2]) * w;
                // local normal = across x along, biased towards the wing plane normal so it stays stable when folded
                float ax = pb[0] - pa[0], ay = pb[1] - pa[1], az = pb[2] - pa[2];
                float lx = ta[0] + (tb[0] - ta[0]) * w, ly = ta[1] + (tb[1] - ta[1]) * w, lz = ta[2] + (tb[2] - ta[2]) * w;
                float nx = ay * lz - az * ly, ny = az * lx - ax * lz, nz = ax * ly - ay * lx;
                float cur = (float) Math.sqrt(ax * ax + ay * ay + az * az);
                float nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
                float bias = 0.04f * size;
                nx = nx + N[0] * bias; ny = ny + N[1] * bias; nz = nz + N[2] * bias;
                nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
                nx /= nl; ny /= nl; nz /= nl;
                // slack: a membrane wider than the gap it spans has to bulge / pleat
                float rest = REST_WIDTH[i][j] * size;
                float slack = rest > cur ? (float) Math.sqrt(rest * rest - cur * cur) * 0.5f : 0;
                float fold = WingSkeleton.clamp01((1 - cur / Math.max(rest, 1e-4f) - 0.25f) / 0.45f);
                float pleat = (1 - fold) * sw + fold * (0.45f * sw + 0.42f * (float) Math.sin(3 * Math.PI * w) * ((i & 1) == 0 ? 1 : -1));
                float d = Math.min(slack, 0.34f * size) * 0.55f * pleat;
                float tEase = t * t * (3 - 2 * t);
                d += billow * sw * (0.25f + 0.75f * tEase);
                if (pose.ripple != 0) {
                    d += pose.ripple * size * t * t * (0.35f + 0.65f * sw) * (float) Math.sin(pose.ripplePhase + 7.5f * t + 2.1f * i + 2.6f * w);
                }
                int o = (j * (GW + 1) + k) * 3;
                grid[o] = px + nx * d; grid[o + 1] = py + ny * d; grid[o + 2] = pz + nz * d;
            }
        }
        // smooth vertex normals
        for (int j = 0; j <= GT; j++) {
            for (int k = 0; k <= GW; k++) {
                int k0 = Math.max(0, k - 1), k1 = Math.min(GW, k + 1), j0 = Math.max(0, j - 1), j1 = Math.min(GT, j + 1);
                int a = (j * (GW + 1) + k0) * 3, b = (j * (GW + 1) + k1) * 3, c = (j0 * (GW + 1) + k) * 3, d = (j1 * (GW + 1) + k) * 3;
                float wx = grid[b] - grid[a], wy = grid[b + 1] - grid[a + 1], wz = grid[b + 2] - grid[a + 2];
                float tx = grid[d] - grid[c], ty = grid[d + 1] - grid[c + 1], tz = grid[d + 2] - grid[c + 2];
                float nx = wy * tz - wz * ty, ny = wz * tx - wx * tz, nz = wx * ty - wy * tx;
                float nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (nl < 1e-7f) { nx = N[0]; ny = N[1]; nz = N[2]; nl = 1; }
                // when pleated the cross product can flip; keep it on the outer side
                int o = (j * (GW + 1) + k) * 3;
                gridN[o] = nx / nl; gridN[o + 1] = ny / nl; gridN[o + 2] = nz / nl;
            }
        }
        float u0 = panelU0(i), u1 = panelU1(i);
        memPal = pal; memPanel = i;
        float glowBase = cfg.glow * pose.glowBoost;
        float gr = ((pal.glow >> 16) & 255) / 255f, gg = ((pal.glow >> 8) & 255) / 255f, gb = (pal.glow & 255) / 255f;
        for (int j = 0; j < GT; j++) {
            for (int k = 0; k < GW; k++) {
                // outer face (seen from behind)
                memVert(mesh.membrane, j, k, u0, u1, pal.outerHub, pal.outerEdge, 1);
                memVert(mesh.membrane, j, k + 1, u0, u1, pal.outerHub, pal.outerEdge, 1);
                memVert(mesh.membrane, j + 1, k + 1, u0, u1, pal.outerHub, pal.outerEdge, 1);
                memVert(mesh.membrane, j + 1, k, u0, u1, pal.outerHub, pal.outerEdge, 1);
                flush(mesh.membrane);
                // inner face
                memVert(mesh.membrane, j, k, u0, u1, pal.innerHub, pal.innerEdge, -1);
                memVert(mesh.membrane, j + 1, k, u0, u1, pal.innerHub, pal.innerEdge, -1);
                memVert(mesh.membrane, j + 1, k + 1, u0, u1, pal.innerHub, pal.innerEdge, -1);
                memVert(mesh.membrane, j, k + 1, u0, u1, pal.innerHub, pal.innerEdge, -1);
                flush(mesh.membrane);
                if (glowBase > 0.01f) {
                    glowVert(j, k, u0, u1, gr, gg, gb, glowBase, pose.pulse);
                    glowVert(j, k + 1, u0, u1, gr, gg, gb, glowBase, pose.pulse);
                    glowVert(j + 1, k + 1, u0, u1, gr, gg, gb, glowBase, pose.pulse);
                    glowVert(j + 1, k, u0, u1, gr, gg, gb, glowBase, pose.pulse);
                    flush(mesh.glow);
                }
            }
        }
    }

    private Palette memPal;
    private int memPanel;

    private void memVert(WingMesh.Layer layer, int j, int k, float u0, float u1, int hub, int edge, float face) {
        int o = (j * (GW + 1) + k) * 3;
        float t = j / (float) GT, w = k / (float) GW;
        Palette pal = memPal;
        int mid = face > 0 ? pal.outerMid : pal.innerMid;
        if (face > 0) {
            // let the bright inner colour bleed through the outer face towards the edge
            mid = Palette.mix(mid, pal.innerMid, 0.38f);
            edge = Palette.mix(edge, pal.innerEdge, 0.55f);
            hub = Palette.mix(hub, pal.innerHub, 0.12f);
        }
        float g = (float) Math.pow(t, 1.15) * (0.85f + 0.15f * (float) Math.sin(Math.PI * w));
        float r, gc, b;
        if (g < 0.5f) { float q = g * 2; r = lerpC(hub >> 16, mid >> 16, q); gc = lerpC(hub >> 8, mid >> 8, q); b = lerpC(hub, mid, q); }
        else { float q = g * 2 - 1; r = lerpC(mid >> 16, edge >> 16, q); gc = lerpC(mid >> 8, edge >> 8, q); b = lerpC(mid, edge, q); }
        float shade = 1, rimAmt = 0;
        switch (pal.pattern) {
            case 1 -> shade = 0.78f + 0.3f * (float) Math.sin(t * 17f + 2.2f * (float) Math.sin(Math.PI * w) + memPanel * 0.9f);
            case 2 -> rimAmt = (float) Math.pow(t, 6) * 0.75f + 0.25f * bump(t, 0.45f, 0.05f);
            case 3 -> { shade = (memPanel & 1) == 0 ? 1.12f : 0.72f; rimAmt = (memPanel & 1) == 0 ? 0 : 0.4f * (float) Math.pow(t, 3); }
            default -> rimAmt = 0.3f * (float) Math.pow(t, 9);
        }
        // darker, thicker tissue towards the bones on the inner face, brighter stretched middle
        if (face < 0) shade *= (0.5f + 0.5f * (float) Math.pow(t, 0.7)) * (0.7f + 0.4f * (float) Math.sin(Math.PI * w));
        else shade *= 0.84f + 0.2f * (float) Math.pow(Math.sin(Math.PI * w), 0.6);
        r *= shade; gc *= shade; b *= shade;
        if (rimAmt > 0) {
            float am = face > 0 ? rimAmt * 0.55f : rimAmt;
            r += (((pal.rim >> 16) & 255) / 255f - r) * am; gc += (((pal.rim >> 8) & 255) / 255f - gc) * am; b += ((pal.rim & 255) / 255f - b) * am;
        }
        float alpha = 0.97f - 0.09f * (float) Math.sin(Math.PI * w) * t;
        put(grid[o], grid[o + 1], grid[o + 2], gridN[o] * face, gridN[o + 1] * face, gridN[o + 2] * face,
                u0 + (u1 - u0) * w, PANEL_V0 + (PANEL_V1 - PANEL_V0) * t, r, gc, b, alpha);
    }

    private void glowVert(int j, int k, float u0, float u1, float r, float g, float b, float base, float pulse) {
        int o = (j * (GW + 1) + k) * 3;
        float t = j / (float) GT, w = k / (float) GW;
        float d = (t - pulse) / 0.16f;
        float d2 = (t - pulse + 1.35f) / 0.16f;
        float in = base * (0.5f + 1.1f * ((float) Math.exp(-d * d) + (float) Math.exp(-d2 * d2)));
        in = Math.min(in, 2f) * 0.5f;
        put(grid[o], grid[o + 1], grid[o + 2], gridN[o], gridN[o + 1], gridN[o + 2],
                u0 + (u1 - u0) * w, PANEL_V0 + (PANEL_V1 - PANEL_V0) * t, Math.min(1, r * in * 2), Math.min(1, g * in * 2), Math.min(1, b * in * 2), 1);
    }

    // ------------------------------------------------------------------ bones

    private void buildBones(WingSkeleton sk, Palette pal, WingConfig cfg, float size, WingMesh mesh) {
        float rs = (float) Math.pow(size, 0.85);
        // arm: root -> elbow -> wrist as one tube
        int n = 0;
        int armSeg = 6;
        for (int k = 0; k <= armSeg; k++) {
            float t = k / (float) armSeg;
            setRing(n++, lerp3(sk.root, sk.elbow, t), (0.074f - 0.022f * t + 0.012f * bump(t, 1, 0.16f) + 0.02f * bump(t, 0, 0.2f)) * rs, pal, 0.02f + 0.1f * t, 0.3f * bump(t, 1, 0.14f), t * 0.4f);
        }
        for (int k = 1; k <= armSeg + 2; k++) {
            float t = k / (float) (armSeg + 2);
            setRing(n++, lerp3(sk.elbow, sk.wrist, t), (0.052f - 0.014f * t + 0.016f * bump(t, 1, 0.12f)) * rs, pal, 0.12f + 0.16f * t, 0.35f * bump(t, 1, 0.12f), 0.4f + t * 0.6f);
        }
        tube(mesh.solid, n, sk.axisN, BONE_U0, BONE_U1, 1f);
        // shoulder cap so the arm does not look hollow where it leaves the back
        cap(mesh.solid, sk.root, sk.elbow, 0.094f * rs, pal.boneBase, BONE_U0 + 0.01f);

        float[] D = tmp2;
        for (int i = 0; i < WingPose.FINGERS; i++) {
            float[] F = sk.finger[i];
            float r0 = (i == 4 ? 0.034f : 0.036f - 0.002f * i) * rs, r1 = 0.0095f * rs;
            for (int k = 0; k <= SEG; k++) {
                float t = k / (float) SEG;
                float knuckle = 0.75f * bump(t, 0.0f, 0.05f) + 0.8f * bump(t, 0.36f, 0.03f) + 0.7f * bump(t, 0.68f, 0.028f);
                float r = (r0 + (r1 - r0) * (float) Math.pow(t, 0.8)) * (1 + knuckle) * ((k & 1) == 0 ? 1.07f : 0.93f);
                ringPts[k * 3] = F[k * 3]; ringPts[k * 3 + 1] = F[k * 3 + 1]; ringPts[k * 3 + 2] = F[k * 3 + 2];
                ringRad[k] = r;
                color(k, pal, 0.3f + 0.7f * t, 0.5f * knuckle);
                ringAlong[k] = t;
            }
            tube(mesh.solid, SEG + 1, sk.axisN, BONE_U0, BONE_U1, 1f);

            // hooked claw continuing the finger tip
            tangent(F, 1f, ta);
            cross(ta, sk.axisN, D);
            normalize(D);
            float clawLen = (i == 4 ? 0.2f : 0.15f - 0.012f * i) * rs;
            claw(mesh.solid, F[SEG * 3], F[SEG * 3 + 1], F[SEG * 3 + 2], ta, D, clawLen, r1 * 1.45f, 0.9f, pal);

            // little thorns on the knuckles, pointing away from the membrane
            for (int kn = 0; kn < 2; kn++) {
                float t = kn == 0 ? 0.36f : 0.68f;
                sample(F, t, pa);
                tangent(F, t, ta);
                cross(ta, sk.axisN, D);
                normalize(D);
                float rad = (r0 + (r1 - r0) * (float) Math.pow(t, 0.8)) * 1.3f;
                tb[0] = -D[0] * 0.8f + ta[0] * 0.6f; tb[1] = -D[1] * 0.8f + ta[1] * 0.6f; tb[2] = -D[2] * 0.8f + ta[2] * 0.6f;
                normalize(tb);
                D[0] = -D[0]; D[1] = -D[1]; D[2] = -D[2];
                claw(mesh.solid, pa[0] + tb[0] * rad * 0.5f, pa[1] + tb[1] * rad * 0.5f, pa[2] + tb[2] * rad * 0.5f, tb, ta, (i == 0 ? 0.075f : 0.05f) * rs, rad * 0.62f, -0.5f, pal);
            }
            // jewelry band near the finger base
            if (cfg.jewelry && i < 4) {
                band(mesh.solid, F, 0.13f + 0.015f * i, 0.035f, r0 * 1.42f, pal.accent);
                if (i == 0) band(mesh.solid, F, 0.205f, 0.014f, r0 * 1.3f, pal.accent);
            }
        }
        // thorns along the leading edge of the arm
        for (int kth = 0; kth < 5; kth++) {
            float t = (kth + 0.6f) / 5.4f;
            boolean upper = kth < 2;
            float[] a = upper ? sk.root : sk.elbow, b = upper ? sk.elbow : sk.wrist;
            float lt = upper ? (kth + 1) / 2.6f : (kth - 1.6f) / 3.4f;
            float[] p = lerp3(a, b, lt);
            float px = p[0], py = p[1], pz = p[2];
            ta[0] = b[0] - a[0]; ta[1] = b[1] - a[1]; ta[2] = b[2] - a[2];
            normalize(ta);
            cross(ta, sk.axisN, D);
            normalize(D);
            float rad = (upper ? 0.06f : 0.045f) * rs;
            tb[0] = -D[0] * 0.85f + ta[0] * 0.5f; tb[1] = -D[1] * 0.85f + ta[1] * 0.5f; tb[2] = -D[2] * 0.85f + ta[2] * 0.5f;
            normalize(tb);
            claw(mesh.solid, px + tb[0] * rad * 0.6f, py + tb[1] * rad * 0.6f, pz + tb[2] * rad * 0.6f, tb, ta, (0.11f - 0.012f * Math.abs(kth - 2)) * rs, rad * 0.5f, 0.55f, pal);
        }
        // elbow spur pointing back along the arm
        ta[0] = sk.elbow[0] - sk.wrist[0]; ta[1] = sk.elbow[1] - sk.wrist[1]; ta[2] = sk.elbow[2] - sk.wrist[2];
        normalize(ta);
        cross(ta, sk.axisN, D);
        normalize(D);
        tb[0] = ta[0] * 0.75f + D[0] * 0.65f; tb[1] = ta[1] * 0.75f + D[1] * 0.65f; tb[2] = ta[2] * 0.75f + D[2] * 0.65f;
        normalize(tb);
        D[0] = -D[0]; D[1] = -D[1]; D[2] = -D[2];
        claw(mesh.solid, sk.elbow[0], sk.elbow[1], sk.elbow[2], tb, D, 0.2f * rs, 0.04f * rs, 0.7f, pal);

        // thumb: a big hooked talon on the wrist
        for (int k = 0; k <= WingSkeleton.THUMB_SEG; k++) {
            float t = k / (float) WingSkeleton.THUMB_SEG;
            ringPts[k * 3] = sk.thumb[k * 3]; ringPts[k * 3 + 1] = sk.thumb[k * 3 + 1]; ringPts[k * 3 + 2] = sk.thumb[k * 3 + 2];
            ringRad[k] = 0.036f * rs * (float) Math.pow(1 - t, 0.75) * (1 + 0.3f * bump(t, 0.12f, 0.1f));
            float c = t < 0.3f ? 0 : (t - 0.3f) / 0.7f;
            ringCol[k * 3] = lerpC(pal.boneTip >> 16, pal.claw >> 16, c);
            ringCol[k * 3 + 1] = lerpC(pal.boneTip >> 8, pal.claw >> 8, c);
            ringCol[k * 3 + 2] = lerpC(pal.boneTip, pal.claw, c);
            ringAlong[k] = t;
        }
        tube(mesh.solid, WingSkeleton.THUMB_SEG + 1, sk.axisN, CLAW_U0, CLAW_U1, 1f);
        if (cfg.jewelry) {
            // cuff on the forearm
            float[] arm = ringPts;
            for (int k = 0; k <= 4; k++) {
                float[] p = lerp3(sk.elbow, sk.wrist, 0.52f + 0.07f * k);
                arm[k * 3] = p[0]; arm[k * 3 + 1] = p[1]; arm[k * 3 + 2] = p[2];
                ringRad[k] = (0.057f + 0.008f * (k == 0 || k == 4 ? 1 : 0) + 0.004f * (k == 2 ? 1 : 0)) * rs;
                rgb(k, pal.accent, 1.45f * (k % 2 == 0 ? 1.25f : 0.6f));
                ringAlong[k] = k / 4f;
            }
            tube(mesh.solid, 5, sk.axisN, METAL_U0, METAL_U1, 1f);
        }
    }

    private void buildPendant(float[] chain, int points, Palette pal, WingConfig cfg, float size, WingMesh mesh) {
        float saved = sg;
        sg = 1; // chain points are simulated on their real side
        float flip = saved;
        for (int k = 0; k < points; k++) {
            ringPts[k * 3] = chain[k * 3]; ringPts[k * 3 + 1] = chain[k * 3 + 1]; ringPts[k * 3 + 2] = chain[k * 3 + 2];
            ringRad[k] = 0.0075f * (1 + 0.5f * (k & 1));
            rgb(k, pal.accent, 1.45f * ((k & 1) == 0 ? 1f : 0.7f));
            ringAlong[k] = k / (float) (points - 1);
        }
        float[] up = {0, 0, 1};
        tube(mesh.solid, points, up, METAL_U0, METAL_U1, flip);
        // gem: elongated octahedron hanging from the last link
        int e = (points - 1) * 3, p = (points - 2) * 3;
        float dx = chain[e] - chain[p], dy = chain[e + 1] - chain[p + 1], dz = chain[e + 2] - chain[p + 2];
        float dl = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dl < 1e-5f) { dx = 0; dy = -1; dz = 0; dl = 1; }
        dx /= dl; dy /= dl; dz /= dl;
        float gs = 0.105f * (float) Math.pow(size, 0.6);
        float lx = -dy, ly = dx, lz = 0, ll = (float) Math.sqrt(lx * lx + ly * ly);
        if (ll < 1e-3f) { lx = 1; ly = 0; ll = 1; }
        lx /= ll; ly /= ll;
        float[] o = {chain[e] + dx * gs * 0.3f, chain[e + 1] + dy * gs * 0.3f, chain[e + 2] + dz * gs * 0.3f}, dd = {dx, dy, dz}, la = {lx, ly, lz},
                no = {dy * lz - dz * ly, dz * lx - dx * lz, dx * ly - dy * lx};
        heart(mesh, o, dd, la, no, gs, gs * 0.56f, gs * 0.16f, pal.gem, pal, cfg);
        sg = saved;
    }

    private void band(WingMesh.Layer layer, float[] F, float t, float halfLen, float radius, int rgb) {
        // bevelled cuff profile: rim, groove, raised engraved centre, groove, rim
        float[] off = {-1f, -0.82f, -0.6f, -0.3f, 0f, 0.3f, 0.6f, 0.82f, 1f};
        float[] rr = {0.9f, 1.1f, 1.0f, 1.07f, 1.13f, 1.07f, 1.0f, 1.1f, 0.9f};
        float[] li = {0.55f, 1.25f, 0.6f, 0.95f, 1.2f, 0.95f, 0.6f, 1.25f, 0.55f};
        for (int k = 0; k < 9; k++) {
            sample(F, t + off[k] * halfLen, pa);
            ringPts[k * 3] = pa[0]; ringPts[k * 3 + 1] = pa[1]; ringPts[k * 3 + 2] = pa[2];
            ringRad[k] = radius * rr[k];
            rgb(k, rgb, 1.45f * li[k]);
            ringAlong[k] = k / 8f;
        }
        float[] up = {0.2f, 0.3f, 1};
        tube(layer, 9, up, METAL_U0, METAL_U1, 1f);
    }

    /** A faceted gem (octahedron) sitting at p, pointing along d. */
    private void gem(WingMesh mesh, float[] p, float[] d, float gs, Palette pal, WingConfig cfg, float winding) {
        float[] pts = {-0.5f, 0.1f, 0.55f, 1.0f, 1.5f};
        float[] rad = {0.0f, 0.8f, 1.0f, 0.55f, 0.0f};
        for (int k = 0; k < 5; k++) {
            ringPts[k * 3] = p[0] + d[0] * gs * pts[k]; ringPts[k * 3 + 1] = p[1] + d[1] * gs * pts[k]; ringPts[k * 3 + 2] = p[2] + d[2] * gs * pts[k];
            ringRad[k] = gs * rad[k];
            rgb(k, pal.gem, 0.7f + 0.5f * (k % 2));
            ringAlong[k] = k / 4f;
        }
        float[] up = {0.3f, 1, 0.2f};
        tubeSides = 6;
        tube(mesh.solid, 5, up, GEM_U0, GEM_U1, winding);
        if (cfg.glow > 0.01f) {
            for (int k = 0; k < 5; k++) { ringRad[k] *= 1.25f; rgb(k, pal.glow, Math.min(1, 0.5f * cfg.glow)); }
            tube(mesh.glow, 5, up, GEM_U0, GEM_U1, winding);
        }
        tubeSides = SIDES;
    }

    /** Fine chains draped from finger to finger and along the forearm; they sway with the pendant. */
    private void buildDrapes(WingSkeleton sk, float[] chain, int points, Palette pal, WingConfig cfg, float size, WingMesh mesh) {
        float rs = (float) Math.pow(size, 0.85);
        // sag direction follows the simulated pendant (converted into this wing's mirrored space)
        int e = (points - 1) * 3;
        float gx = (chain[e] - chain[0]) * sg, gy = chain[e + 1] - chain[1], gz = chain[e + 2] - chain[2];
        float gl = (float) Math.sqrt(gx * gx + gy * gy + gz * gz);
        if (gl < 1e-5f) { gx = 0; gy = -1; gz = 0; gl = 1; }
        gx /= gl; gy /= gl; gz /= gl;
        float[] a = new float[3], b = new float[3];
        int N = 10;
        for (int c = 0; c < 5; c++) {
            if (c < 3) {
                sample(sk.finger[c], 0.13f + 0.015f * c, a);
                sample(sk.finger[c + 1], 0.13f + 0.015f * (c + 1), b);
            } else if (c == 3) {
                float[] p = lerp3(sk.elbow, sk.wrist, 0.6f); a[0] = p[0]; a[1] = p[1]; a[2] = p[2];
                sample(sk.finger[0], 0.13f, b);
            } else {
                float[] p = lerp3(sk.root, sk.elbow, 0.55f); a[0] = p[0]; a[1] = p[1]; a[2] = p[2];
                p = lerp3(sk.elbow, sk.wrist, 0.56f); b[0] = p[0]; b[1] = p[1]; b[2] = p[2];
            }
            float span = dist(a, b);
            float sag = Math.max(0.05f * rs, 0.45f * span) + 0.03f * rs * (c & 1);
            for (int k = 0; k <= N; k++) {
                float t = k / (float) N, s4 = 4 * t * (1 - t) * sag;
                ringPts[k * 3] = a[0] + (b[0] - a[0]) * t + gx * s4;
                ringPts[k * 3 + 1] = a[1] + (b[1] - a[1]) * t + gy * s4;
                ringPts[k * 3 + 2] = a[2] + (b[2] - a[2]) * t + gz * s4 - 0.03f * rs * 4 * t * (1 - t);
                ringRad[k] = 0.0055f * rs * (1 + 0.6f * (k & 1));
                rgb(k, pal.accent, 1.45f * ((k & 1) == 0 ? 1.15f : 0.65f));
                ringAlong[k] = t;
            }
            float[] up = {0.2f, 0.3f, 1};
            tubeSides = 4;
            tube(mesh.solid, N + 1, up, METAL_U0, METAL_U1, 1f);
            tubeSides = SIDES;
            if (c < 3 && (c & 1) == 0) {
                // a small drop gem at the lowest point of the drape
                int m = (N / 2) * 3;
                float[] p = {ringPts[m], ringPts[m + 1], ringPts[m + 2]}, d = {gx, gy, gz};
                gem(mesh, p, d, 0.02f * rs, pal, cfg, 1f);
            }
        }
        // cabochons set into the forearm cuff, one on each face
        float[] cp = lerp3(sk.elbow, sk.wrist, 0.66f);
        for (int f = -1; f <= 1; f += 2) {
            float[] p = {cp[0] + sk.axisN[0] * 0.05f * rs * f, cp[1] + sk.axisN[1] * 0.05f * rs * f, cp[2] + sk.axisN[2] * 0.05f * rs * f};
            float[] d = {sk.axisN[0] * f, sk.axisN[1] * f, sk.axisN[2] * f};
            gem(mesh, p, d, 0.032f * rs, pal, cfg, 1f);
        }
    }

    /** The tail: a tapering ridged tube ending in a glowing spade. Points are in body space, not mirrored. */
    public void buildTail(float[] tail, int points, WingConfig cfg, Palette pal, float size, WingMesh mesh) {
        float saved = sg;
        sg = 1;
        float rs = (float) Math.pow(size, 0.75);
        for (int k = 0; k < points; k++) {
            float t = k / (float) (points - 1);
            ringPts[k * 3] = tail[k * 3]; ringPts[k * 3 + 1] = tail[k * 3 + 1]; ringPts[k * 3 + 2] = tail[k * 3 + 2];
            ringRad[k] = (0.05f - 0.034f * (float) Math.pow(t, 0.8)) * rs * ((k & 1) == 0 ? 1.08f : 0.94f);
            color(k, pal, 0.1f + 0.8f * t, (k & 1) == 0 ? 0.12f : 0);
            ringAlong[k] = t;
        }
        float[] up = {1, 0, 0};
        tube(mesh.solid, points, up, BONE_U0, BONE_U1, 1f);
        if (cfg.jewelry) {
            band(mesh.solid, tail, 0.34f, 0.022f, 0.052f * rs, pal.accent);
            band(mesh.solid, tail, 0.93f, 0.02f, 0.03f * rs, pal.accent);
        }
        // spade
        int e = (points - 1) * 3, p = (points - 2) * 3;
        float dx = tail[e] - tail[p], dy = tail[e + 1] - tail[p + 1], dz = tail[e + 2] - tail[p + 2];
        float dl = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        dx /= dl; dy /= dl; dz /= dl;
        float lx = 1 - dx * dx, ly = -dx * dy, lz = -dx * dz;
        float ll = (float) Math.sqrt(lx * lx + ly * ly + lz * lz);
        if (ll < 1e-3f) { lx = 0; ly = 0; lz = 1; ll = 1; }
        lx /= ll; ly /= ll; lz /= ll;
        float nx = dy * lz - dz * ly, ny = dz * lx - dx * lz, nz = dx * ly - dy * lx;
        float[] o = {tail[e], tail[e + 1], tail[e + 2]}, dd = {dx, dy, dz}, la = {lx, ly, lz}, no = {nx, ny, nz};
        heart(mesh, o, dd, la, no, 0.36f * rs, 0.2f * rs, 0.045f * rs, Palette.mix(pal.claw, pal.gem, 0.72f), pal, cfg);
        sg = saved;
    }

    /**
     * A puffy 3D heart lying in the plane of d (notch at o, point at o + d * len) and l, domed along n,
     * with a bright rim in the solid layer and a halo in the glow layer.
     */
    private void heart(WingMesh mesh, float[] o, float[] d, float[] l, float[] n, float len, float wid, float thick, int rgb, Palette pal, WingConfig cfg) {
        final int N = 28;
        float[] ring = {0f, 0.5f, 0.86f, 1f}, dome = {1f, 0.86f, 0.5f, 0.12f}, lit = {1.25f, 1.0f, 0.8f, 1.5f};
        float cr = ((rgb >> 16) & 255) / 255f, cg = ((rgb >> 8) & 255) / 255f, cb = (rgb & 255) / 255f;
        float gr = ((pal.glow >> 16) & 255) / 255f, gg = ((pal.glow >> 8) & 255) / 255f, gb = (pal.glow & 255) / 255f;
        float um = (GEM_U0 + GEM_U1) * 0.5f, vm = (STRIP_V0 + STRIP_V1) * 0.5f;
        for (int pass = 0; pass < 2; pass++) {
            if (pass == 1 && cfg.glow <= 0.01f) break;
            WingMesh.Layer layer = pass == 0 ? mesh.solid : mesh.glow;
            float grow = pass == 0 ? 1 : 1.16f, gm = Math.min(1, 0.55f * cfg.glow);
            for (int k = 0; k < N; k++) {
                for (int r = 0; r < 3; r++) {
                    for (int face = -1; face <= 1; face += 2) {
                        for (int v = 0; v < 4; v++) {
                            int vv = face > 0 ? v : 3 - v;
                            int rr = (vv == 0 || vv == 1) ? r : r + 1, kk = (vv == 0 || vv == 3) ? k : k + 1;
                            heartVert(o, d, l, n, len, wid, thick * face, kk / (float) N, ring[rr] * grow, dome[rr], face,
                                    pass == 0 ? um : WHITE_U, pass == 0 ? vm : WHITE_V,
                                    pass == 0 ? cr * lit[rr] + (rr == 3 ? gr * 0.5f : 0) : gr * gm * (0.3f + 0.7f * ring[rr]),
                                    pass == 0 ? cg * lit[rr] + (rr == 3 ? gg * 0.5f : 0) : gg * gm * (0.3f + 0.7f * ring[rr]),
                                    pass == 0 ? cb * lit[rr] + (rr == 3 ? gb * 0.5f : 0) : gb * gm * (0.3f + 0.7f * ring[rr]));
                        }
                        flush(layer);
                    }
                }
            }
        }
    }

    private void heartVert(float[] o, float[] d, float[] l, float[] n, float len, float wid, float thick, float a, float scale, float dome, float face,
                           float u, float v, float r, float g, float b) {
        double th = a * 2 * Math.PI;
        float hx = (float) Math.pow(Math.sin(th), 3);
        float hy = (float) (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th));
        // heart-space: notch at along = 0, point at along = 1, centre of mass at about 0.33
        float al = 0.33f + ((5 - hy) / 22f - 0.33f) * scale, la = hx * scale;
        float h = thick * dome;
        float nn = 0.35f + 0.65f * dome, ns = (1 - nn) * 0.9f;
        float rx = (al - 0.33f), ry = la, rl = (float) Math.sqrt(rx * rx + ry * ry) + 1e-5f;
        rx /= rl; ry /= rl;
        float fx = n[0] * nn * face + (d[0] * rx + l[0] * ry) * ns, fy = n[1] * nn * face + (d[1] * rx + l[1] * ry) * ns, fz = n[2] * nn * face + (d[2] * rx + l[2] * ry) * ns;
        float fl = (float) Math.sqrt(fx * fx + fy * fy + fz * fz);
        put(o[0] + d[0] * al * len + l[0] * la * wid + n[0] * h, o[1] + d[1] * al * len + l[1] * la * wid + n[1] * h, o[2] + d[2] * al * len + l[2] * la * wid + n[2] * h,
                fx / fl, fy / fl, fz / fl, u, v, r, g, b, 1);
    }

    /** A curved cone starting at (x,y,z) along dir, hooking towards hook. */
    private void claw(WingMesh.Layer layer, float x, float y, float z, float[] dir, float[] hook, float len, float radius, float curve, Palette pal) {
        int n = 6;
        float dx = dir[0], dy = dir[1], dz = dir[2];
        float step = len / (n - 1);
        for (int k = 0; k < n; k++) {
            float t = k / (float) (n - 1);
            ringPts[k * 3] = x; ringPts[k * 3 + 1] = y; ringPts[k * 3 + 2] = z;
            ringRad[k] = radius * (float) Math.pow(1 - t, 0.8) * (k == 0 ? 0.9f : 1f);
            float c = 0.35f + 0.65f * t;
            ringCol[k * 3] = lerpC(pal.boneTip >> 16, pal.claw >> 16, c);
            ringCol[k * 3 + 1] = lerpC(pal.boneTip >> 8, pal.claw >> 8, c);
            ringCol[k * 3 + 2] = lerpC(pal.boneTip, pal.claw, c);
            ringAlong[k] = t;
            x += dx * step; y += dy * step; z += dz * step;
            float b = curve * 0.32f;
            dx += hook[0] * b; dy += hook[1] * b; dz += hook[2] * b;
            float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
            dx /= l; dy /= l; dz /= l;
        }
        int saved = tubeSides;
        tubeSides = 6;
        tube(layer, n, hook, CLAW_U0, CLAW_U1, 1f);
        tubeSides = saved;
    }

    private void cap(WingMesh.Layer layer, float[] at, float[] towards, float radius, int rgb, float u) {
        // a small dome behind the start of the arm
        float dx = at[0] - towards[0], dy = at[1] - towards[1], dz = at[2] - towards[2];
        float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        dx /= l; dy /= l; dz /= l;
        for (int k = 0; k < 4; k++) {
            float a = k / 3f * (float) (Math.PI / 2);
            ringPts[k * 3] = at[0] + dx * radius * (float) Math.sin(a) * 0.7f;
            ringPts[k * 3 + 1] = at[1] + dy * radius * (float) Math.sin(a) * 0.7f;
            ringPts[k * 3 + 2] = at[2] + dz * radius * (float) Math.sin(a) * 0.7f;
            ringRad[k] = radius * (float) Math.cos(a);
            rgb(k, rgb, 1f);
            ringAlong[k] = 0.02f * k;
        }
        float[] up = {0, 0, 1};
        tube(layer, 4, up, BONE_U0, BONE_U1, -1f);
    }

    private void setRing(int k, float[] p, float r, Palette pal, float along, float light, float texAlong) {
        ringPts[k * 3] = p[0]; ringPts[k * 3 + 1] = p[1]; ringPts[k * 3 + 2] = p[2];
        ringRad[k] = r;
        color(k, pal, along, light);
        ringAlong[k] = texAlong;
    }

    private void color(int k, Palette pal, float along, float light) {
        float m = Math.min(1, 0.12f + along * 0.75f + light);
        ringCol[k * 3] = lerpC(pal.boneBase >> 16, pal.boneTip >> 16, m);
        ringCol[k * 3 + 1] = lerpC(pal.boneBase >> 8, pal.boneTip >> 8, m);
        ringCol[k * 3 + 2] = lerpC(pal.boneBase, pal.boneTip, m);
    }

    private void rgb(int k, int rgb, float f) {
        ringCol[k * 3] = ((rgb >> 16) & 255) / 255f * f;
        ringCol[k * 3 + 1] = ((rgb >> 8) & 255) / 255f * f;
        ringCol[k * 3 + 2] = (rgb & 255) / 255f * f;
    }

    private int tubeSides = SIDES;

    /** Sweeps a ring along ringPts[0..n) using ringRad / ringCol / ringAlong. */
    private void tube(WingMesh.Layer layer, int n, float[] upHint, float u0, float u1, float winding) {
        int S = tubeSides;
        float nx = upHint[0], ny = upHint[1], nz = upHint[2];
        float[] prev = ringA, cur = ringB;
        for (int k = 0; k < n; k++) {
            int a = Math.max(0, k - 1) * 3, b = Math.min(n - 1, k + 1) * 3;
            float tx = ringPts[b] - ringPts[a], ty = ringPts[b + 1] - ringPts[a + 1], tz = ringPts[b + 2] - ringPts[a + 2];
            float tl = (float) Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tl < 1e-7f) { tx = 0; ty = 1; tz = 0; tl = 1; }
            tx /= tl; ty /= tl; tz /= tl;
            float d = nx * tx + ny * ty + nz * tz;
            nx -= tx * d; ny -= ty * d; nz -= tz * d;
            float nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nl < 1e-4f) {
                // hint was parallel to the bone: pick any perpendicular
                if (Math.abs(tx) < 0.8f) { nx = 0; ny = -tz; nz = ty; } else { nx = -ty; ny = tx; nz = 0; }
                nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
            }
            nx /= nl; ny /= nl; nz /= nl;
            float bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
            float r = ringRad[k];
            for (int j = 0; j < S; j++) {
                float ang = (float) (2 * Math.PI * j / S);
                float c = (float) Math.cos(ang), s = (float) Math.sin(ang);
                float ox = nx * c + bx * s, oy = ny * c + by * s, oz = nz * c + bz * s;
                cur[j * 6] = ringPts[k * 3] + ox * r; cur[j * 6 + 1] = ringPts[k * 3 + 1] + oy * r; cur[j * 6 + 2] = ringPts[k * 3 + 2] + oz * r;
                cur[j * 6 + 3] = ox; cur[j * 6 + 4] = oy; cur[j * 6 + 5] = oz;
            }
            if (k > 0) {
                float ua = u0 + (u1 - u0) * ringAlong[k - 1], ub = u0 + (u1 - u0) * ringAlong[k];
                int ca = (k - 1) * 3, cb = k * 3;
                for (int j = 0; j < S; j++) {
                    int j1 = (j + 1) % S;
                    float va = STRIP_V0 + (STRIP_V1 - STRIP_V0) * j / S, vb = STRIP_V0 + (STRIP_V1 - STRIP_V0) * (j + 1) / S;
                    if (winding > 0) {
                        ringVert(prev, j, ua, va, ca);
                        ringVert(prev, j1, ua, vb, ca);
                        ringVert(cur, j1, ub, vb, cb);
                        ringVert(cur, j, ub, va, cb);
                    } else {
                        ringVert(cur, j, ub, va, cb);
                        ringVert(cur, j1, ub, vb, cb);
                        ringVert(prev, j1, ua, vb, ca);
                        ringVert(prev, j, ua, va, ca);
                    }
                    flush(layer);
                }
            }
            float[] sw = prev; prev = cur; cur = sw;
        }
    }

    private void ringVert(float[] ring, int j, float u, float v, int c) {
        put(ring[j * 6], ring[j * 6 + 1], ring[j * 6 + 2], ring[j * 6 + 3], ring[j * 6 + 4], ring[j * 6 + 5], u, v, ringCol[c], ringCol[c + 1], ringCol[c + 2], 1);
    }

    // ------------------------------------------------------------------ helpers

    private void put(float x, float y, float z, float nx, float ny, float nz, float u, float v, float r, float g, float b, float a) {
        r = Math.min(1, Math.max(0, r)); g = Math.min(1, Math.max(0, g)); b = Math.min(1, Math.max(0, b));
        int i = qn * WingMesh.STRIDE;
        q[i] = x * sg; q[i + 1] = y; q[i + 2] = z;
        q[i + 3] = nx * sg; q[i + 4] = ny; q[i + 5] = nz;
        q[i + 6] = u; q[i + 7] = v; q[i + 8] = r; q[i + 9] = g; q[i + 10] = b; q[i + 11] = a;
        qn++;
    }

    /** Emits the buffered quad, reversing the winding for the mirrored wing so faces stay outward. */
    private void flush(WingMesh.Layer layer) {
        for (int n = 0; n < 4; n++) {
            int i = (sg > 0 ? n : 3 - n) * WingMesh.STRIDE;
            layer.vertex(q[i], q[i + 1], q[i + 2], q[i + 3], q[i + 4], q[i + 5], q[i + 6], q[i + 7], q[i + 8], q[i + 9], q[i + 10], q[i + 11]);
        }
        qn = 0;
    }

    private final float[] l3 = new float[3];

    private float[] lerp3(float[] a, float[] b, float t) {
        l3[0] = a[0] + (b[0] - a[0]) * t; l3[1] = a[1] + (b[1] - a[1]) * t; l3[2] = a[2] + (b[2] - a[2]) * t;
        return l3;
    }

    static void sample(float[] line, float t, float[] out) {
        float f = Math.max(0, Math.min(1, t)) * SEG;
        int i = Math.min(SEG - 1, (int) f);
        float r = f - i;
        out[0] = line[i * 3] + (line[i * 3 + 3] - line[i * 3]) * r;
        out[1] = line[i * 3 + 1] + (line[i * 3 + 4] - line[i * 3 + 1]) * r;
        out[2] = line[i * 3 + 2] + (line[i * 3 + 5] - line[i * 3 + 2]) * r;
    }

    static void tangent(float[] line, float t, float[] out) {
        float f = Math.max(0, Math.min(1, t)) * SEG;
        int i = Math.min(SEG - 1, (int) f);
        out[0] = line[i * 3 + 3] - line[i * 3]; out[1] = line[i * 3 + 4] - line[i * 3 + 1]; out[2] = line[i * 3 + 5] - line[i * 3 + 2];
        normalize(out);
    }

    static void cross(float[] a, float[] b, float[] out) {
        float x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
        out[0] = x; out[1] = y; out[2] = z;
    }

    static void normalize(float[] v) {
        float l = (float) Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        if (l < 1e-8f) { v[0] = 0; v[1] = 1; v[2] = 0; return; }
        v[0] /= l; v[1] /= l; v[2] /= l;
    }

    static float dist(float[] a, float[] b) {
        float x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    static float bump(float t, float c, float w) {
        float d = (t - c) / w;
        return (float) Math.exp(-d * d);
    }

    static float lerpC(int a, int b, float t) {
        return ((a & 255) + ((b & 255) - (a & 255)) * t) / 255f;
    }
}
