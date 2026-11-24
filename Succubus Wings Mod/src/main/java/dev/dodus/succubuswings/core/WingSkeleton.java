package dev.dodus.succubuswings.core;

/**
 * Turns a {@link WingPose} into bone positions. Everything is computed for the wearer's
 * right wing in body space (x = outwards, y = up, z = backwards, origin between the
 * shoulder blades, units = blocks); the left wing is the mirror image.
 */
public final class WingSkeleton {
    public static final int SEG = 16;
    public static final int FINGERS = WingPose.FINGERS;
    public static final int THUMB_SEG = 6;

    private static final float D = (float) (Math.PI / 180.0);
    static final float HUMERUS = 0.56f, FOREARM = 0.80f;
    static final float HUMERUS_OPEN = 56 * D, HUMERUS_FOLD = 36 * D;
    static final float FOREARM_OPEN = 20 * D, FOREARM_FOLD = 104 * D;
    static final float[] LEN = {1.62f, 1.80f, 1.70f, 1.46f, 1.12f};
    static final float[] OPEN = {13 * D, -17 * D, -48 * D, -80 * D, -99 * D};
    static final float[] FOLD = {-75 * D, -82 * D, -89 * D, -96 * D, -101 * D};
    static final float[] DROOP_OPEN = {-44 * D, -28 * D, -16 * D, -8 * D, -2 * D};
    static final float[] DROOP_FOLD = {-12 * D, -7 * D, -3 * D, 2 * D, 8 * D};

    public final float[] root = new float[3], elbow = new float[3], wrist = new float[3];
    /** finger[i] = (SEG+1) xyz points. Fingers 0-3 start at the wrist, finger 4 (the spur) at the elbow. */
    public final float[][] finger = new float[FINGERS][(SEG + 1) * 3];
    /** Where the innermost membrane meets the back. */
    public final float[] bodyLine = new float[(SEG + 1) * 3];
    public final float[] thumb = new float[(THUMB_SEG + 1) * 3];
    /** Unit axes of the wing plane in body space: outwards, up (towards the leading edge), and the plane normal (backwards). */
    public final float[] axisU = new float[3], axisV = new float[3], axisN = new float[3];
    public float size = 1;

    private float cs, sn, cr, sr, ct, st;

    public void compute(WingPose p, float size) {
        this.size = size;
        float s = clamp01(p.spread);
        float e = s * s * (3 - 2 * s);
        cs = (float) Math.cos(p.sweep); sn = (float) Math.sin(p.sweep);
        cr = (float) Math.cos(p.raise); sr = (float) Math.sin(p.raise);
        ct = (float) Math.cos(p.twist); st = (float) Math.sin(p.twist);
        root[0] = 0.075f; root[1] = 0f; root[2] = 0.035f;
        toBody(1, 0, 0, axisU, false);
        toBody(0, 1, 0, axisV, false);
        toBody(0, 0, 1, axisN, false);

        float h = lerp(HUMERUS_FOLD, HUMERUS_OPEN, e);
        float f = lerp(FOREARM_FOLD, FOREARM_OPEN, e);
        float eu = (float) Math.cos(h) * HUMERUS * size, ev = (float) Math.sin(h) * HUMERUS * size;
        float cb = (float) Math.cos(p.armBend), sb = (float) Math.sin(p.armBend);
        float wu = eu + (float) Math.cos(f) * cb * FOREARM * size, wv = ev + (float) Math.sin(f) * cb * FOREARM * size, wn = sb * FOREARM * size;
        toBody(eu, ev, 0, elbow, true);
        toBody(wu, wv, wn, wrist, true);

        float[] tmp = new float[3];
        for (int i = 0; i < FINGERS; i++) {
            float su = i < 4 ? wu : eu, sv = i < 4 ? wv : ev, sN = i < 4 ? wn : 0;
            float a0 = lerp(FOLD[i], OPEN[i], e) + p.fingerFlex[i] + (i < 4 ? p.fan * (1.5f - i) * e : 0);
            float droop = lerp(DROOP_FOLD[i], DROOP_OPEN[i], e);
            float len = LEN[i] * size * (0.86f + 0.14f * e);
            float step = len / SEG;
            float baseB = i < 4 ? p.armBend * 0.6f : 0;
            float curl = p.curl + p.fingerCurl[i];
            float[] out = finger[i];
            float u = su, v = sv, n = sN;
            for (int k = 0; k <= SEG; k++) {
                toBody(u, v, n, tmp, true);
                out[k * 3] = tmp[0]; out[k * 3 + 1] = tmp[1]; out[k * 3 + 2] = tmp[2];
                float t = (k + 0.5f) / SEG;
                float alpha = a0 + droop * t;
                float beta = baseB + curl * (float) Math.pow(t, 1.3) + p.curlTip * t * t * t;
                float cbt = (float) Math.cos(beta);
                u += Math.cos(alpha) * cbt * step;
                v += Math.sin(alpha) * cbt * step;
                n += Math.sin(beta) * step;
            }
        }

        // thumb claw: hooks up and forwards from the wrist
        {
            float a = f + 62 * D, u = wu, v = wv, n = wn, step = 0.26f * size / THUMB_SEG;
            for (int k = 0; k <= THUMB_SEG; k++) {
                toBody(u, v, n, tmp, true);
                thumb[k * 3] = tmp[0]; thumb[k * 3 + 1] = tmp[1]; thumb[k * 3 + 2] = tmp[2];
                float t = (k + 0.5f) / THUMB_SEG;
                float alpha = a - 95 * D * t * t;
                float beta = -0.35f - 0.5f * t;
                u += Math.cos(alpha) * Math.cos(beta) * step;
                v += Math.sin(alpha) * Math.cos(beta) * step;
                n += Math.sin(beta) * step;
            }
        }

        // the membrane's seam down the back
        float hipY = -0.60f - 0.16f * (size - 1);
        for (int k = 0; k <= SEG; k++) {
            float t = k / (float) SEG;
            bodyLine[k * 3] = lerp(root[0], 0.045f, t);
            bodyLine[k * 3 + 1] = lerp(root[1], hipY, (float) Math.pow(t, 0.85));
            bodyLine[k * 3 + 2] = lerp(root[2], 0.012f, Math.min(1, t * 3));
        }
    }

    /** Wing-plane coordinates (out, up, back) to body space. */
    private void toBody(float u, float v, float n, float[] out, boolean translate) {
        float v1 = v * ct - n * st, n1 = v * st + n * ct;
        float u2 = u * cr - v1 * sr, v2 = u * sr + v1 * cr;
        float x = u2 * cs - n1 * sn, z = u2 * sn + n1 * cs;
        out[0] = x + (translate ? root[0] : 0);
        out[1] = v2 + (translate ? root[1] : 0);
        out[2] = z + (translate ? root[2] : 0);
    }

    public void fingerTip(int i, float[] out) {
        out[0] = finger[i][SEG * 3]; out[1] = finger[i][SEG * 3 + 1]; out[2] = finger[i][SEG * 3 + 2];
    }

    static float lerp(float a, float b, float t) {
        return a + (b - a) * t;
    }

    static float clamp01(float v) {
        return v < 0 ? 0 : Math.min(v, 1);
    }
}
