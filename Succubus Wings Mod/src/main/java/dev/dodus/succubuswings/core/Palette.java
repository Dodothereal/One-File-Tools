package dev.dodus.succubuswings.core;

import java.util.List;

/**
 * A wing color scheme. Colors are 0xRRGGBB. The membrane has a different gradient on the
 * outer face (seen from behind) and the inner face (seen from the front), running from the
 * wrist/arm ("hub") to the trailing edge.
 */
public final class Palette {
    public final String id;
    public final String name;
    public final int outerHub, outerEdge;
    public final int innerHub, innerEdge;
    public final int boneBase, boneTip;
    public final int claw;
    public final int accent;
    public final int glow;
    public final int gem;
    /** Mid-gradient stops and a pattern id (0 plain, 1 bands, 2 gilded rim, 3 alternating panels). */
    public int outerMid, innerMid, pattern, rim;

    public Palette(String id, String name, int outerHub, int outerEdge, int innerHub, int innerEdge,
                   int boneBase, int boneTip, int claw, int accent, int glow, int gem) {
        this.id = id;
        this.name = name;
        this.outerHub = outerHub;
        this.outerEdge = outerEdge;
        this.innerHub = innerHub;
        this.innerEdge = innerEdge;
        this.boneBase = boneBase;
        this.boneTip = boneTip;
        this.claw = claw;
        this.accent = accent;
        this.glow = glow;
        this.gem = gem;
        this.outerMid = mix(outerHub, outerEdge, 0.5f);
        this.innerMid = mix(innerHub, innerEdge, 0.5f);
        this.rim = accent;
    }

    private Palette look(int outerMid, int innerMid, int pattern, int rim) {
        this.outerMid = outerMid; this.innerMid = innerMid; this.pattern = pattern; this.rim = rim;
        return this;
    }

    public static final String CUSTOM_ID = "custom";

    public static final List<Palette> PRESETS = List.of(
            new Palette("crimson_temptress", "Crimson Temptress", 0x14030a, 0x7a0f2c, 0x8f0f24, 0xff5a86, 0x16090b, 0x3a1218, 0x0a0405, 0xe9b044, 0xff4f8e, 0xff7ab0).look(0x3d0618, 0xd01c50, 0, 0xffa0c0),
            new Palette("violet_hex", "Violet Hex", 0x130a24, 0x3a1466, 0x5a1fa8, 0xc04dff, 0x120a1c, 0x32204a, 0x08050f, 0xc9c2e8, 0xc86bff, 0xb44dff).look(0x2a1a7a, 0x3a3ad0, 1, 0xff4de0),
            new Palette("rose_quartz", "Rose Quartz", 0x8a3f5c, 0xf2a3c0, 0xf7b9d0, 0xffe6ef, 0xe9d5d9, 0xfff4f2, 0xfbe9e4, 0xf6d48a, 0xff9ec4, 0xff6fa8).look(0xd98ab8, 0xfff0c8, 2, 0xf6d48a),
            new Palette("midnight_sapphire", "Midnight Sapphire", 0x060b1f, 0x0f2a6b, 0x12399c, 0x3fa0ff, 0x090d1a, 0x1c2a4a, 0x04060d, 0xb8c6e0, 0x4fd2ff, 0x39b8ff).look(0x1a1258, 0x3a22b0, 2, 0xdfe8ff),
            new Palette("infernal_ember", "Infernal Ember", 0x120907, 0x3b1206, 0x8c2a05, 0xffc02a, 0x140c0a, 0x402015, 0x070403, 0x8a8f99, 0xff7a1a, 0xffb02e).look(0x5a1005, 0xd01a05, 1, 0xffd23a),
            new Palette("venom", "Venom", 0x07120a, 0x103d1c, 0x15702c, 0x9dff3a, 0x0a120c, 0x1f3a24, 0x040805, 0x9aa39b, 0x8dff4f, 0x5dff7a).look(0x2a0f3a, 0x6a1f8a, 3, 0xd8ff3a),
            new Palette("abyssal_tide", "Abyssal Tide", 0x02140f, 0x0a5a40, 0x0a6a58, 0x7affc0, 0x061812, 0x1c4a3a, 0x030b08, 0xe8c66a, 0x5affb0, 0xfff08a).look(0x06302a, 0x0f7a8a, 1, 0xfff0a0),
            new Palette("blood_moon", "Blood Moon", 0x050203, 0x1a0606, 0x2a0404, 0xff4a1c, 0x0a0606, 0x3a1410, 0xff6a2a, 0x9a9aa2, 0xff5a1c, 0xffb02a).look(0x0c0303, 0x8a1206, 3, 0xff3a10),
            new Palette("fallen_seraph", "Fallen Seraph", 0xb9b2a6, 0xf6f1e6, 0xe9dcc0, 0xfffaf0, 0xcfb980, 0xf3e3b0, 0xf8f0d8, 0xe9bd4f, 0xffe9a8, 0xfff2c4).look(0xe0d6c2, 0xf2d48a, 2, 0xe9bd4f),
            new Palette("obsidian_gold", "Obsidian Gold", 0x0b0b0e, 0x2e2b33, 0x17151c, 0x9a7420, 0x1c1508, 0x7a5a18, 0xd8a531, 0xf0c04a, 0xffc94a, 0xffd86b).look(0x17161c, 0x3a2c12, 2, 0xffc94a),
            new Palette("twilight", "Twilight", 0x101a4a, 0xff9a3c, 0x0e3a5c, 0xffd27a, 0x0c1230, 0x2a4a7a, 0x060914, 0xffd9a0, 0xffb347, 0x4fe0d0).look(0x1a2a7a, 0xff5a3c, 0, 0xffe08a),
            new Palette("frostbite", "Frostbite", 0x1c3550, 0x8fd0f0, 0x6fb4e6, 0xe9fbff, 0xb9cfe0, 0xf2fbff, 0xe6f6ff, 0xd0e4f2, 0xa8f0ff, 0x7ee0ff).look(0x4a78b0, 0x9a8cf0, 1, 0xffffff),
            new Palette("bubblegum_imp", "Bubblegum Imp", 0xb0146a, 0xff4fa8, 0x1f8f80, 0x8ff4e0, 0x2a1030, 0x6a2a70, 0x1a0820, 0xfff0f6, 0x7af0e0, 0x7af0e0).look(0xe02a8c, 0x46c8b4, 3, 0x9ff8ea),
            new Palette("void", "Voidborn", 0x020203, 0x0a0a10, 0x050509, 0x1c2030, 0x08080a, 0x2a2e3a, 0xe8f4ff, 0xdfe8f2, 0xe8fbff, 0x7af0ff).look(0x050508, 0x10141c, 3, 0xffffff),
            new Palette("sakura", "Sakura Dream", 0xf6e9ee, 0xff8fb8, 0xfffafc, 0xffb0cf, 0x3a2218, 0x6a4028, 0x241209, 0x9fd8a8, 0xff6fa5, 0x8fe0a0).look(0xffd6e4, 0xe0457f, 0, 0xfff7c8)
    );

    public static Palette byId(String id) {
        for (Palette p : PRESETS) if (p.id.equals(id)) return p;
        return PRESETS.get(0);
    }

    public static int indexOf(String id) {
        for (int i = 0; i < PRESETS.size(); i++) if (PRESETS.get(i).id.equals(id)) return i;
        return -1;
    }

    /** Builds a full palette from three user-picked colors. */
    public static Palette custom(int membrane, int bone, int glow) {
        int outerHub = scale(membrane, 0.16f);
        int outerEdge = scale(membrane, 0.42f);
        int innerHub = scale(membrane, 0.62f);
        int innerEdge = mix(membrane, 0xffffff, 0.18f);
        int boneBase = scale(bone, 0.55f);
        int boneTip = bone;
        int claw = scale(bone, 0.28f);
        int accent = mix(glow, 0xffffff, 0.55f);
        return new Palette(CUSTOM_ID, "Custom", outerHub, outerEdge, innerHub, innerEdge, boneBase, boneTip, claw, accent, glow, mix(glow, 0xffffff, 0.2f));
    }

    public static int scale(int rgb, float f) {
        int r = Math.min(255, Math.round(((rgb >> 16) & 255) * f));
        int g = Math.min(255, Math.round(((rgb >> 8) & 255) * f));
        int b = Math.min(255, Math.round((rgb & 255) * f));
        return (r << 16) | (g << 8) | b;
    }

    public static int mix(int a, int b, float t) {
        int r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
        int g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
        int bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
        return (r << 16) | (g << 8) | bl;
    }

    public static int hsv(float h, float s, float v) {
        h = (h % 1f + 1f) % 1f;
        float c = v * s, x = c * (1 - Math.abs((h * 6f) % 2f - 1)), m = v - c;
        float r, g, b;
        switch ((int) (h * 6f)) {
            case 0 -> { r = c; g = x; b = 0; }
            case 1 -> { r = x; g = c; b = 0; }
            case 2 -> { r = 0; g = c; b = x; }
            case 3 -> { r = 0; g = x; b = c; }
            case 4 -> { r = x; g = 0; b = c; }
            default -> { r = c; g = 0; b = x; }
        }
        return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
    }

    /** @return {h, s, v} each 0..1 */
    public static float[] toHsv(int rgb) {
        float r = ((rgb >> 16) & 255) / 255f, g = ((rgb >> 8) & 255) / 255f, b = (rgb & 255) / 255f;
        float max = Math.max(r, Math.max(g, b)), min = Math.min(r, Math.min(g, b)), d = max - min;
        float h;
        if (d == 0) h = 0;
        else if (max == r) h = ((g - b) / d % 6f) / 6f;
        else if (max == g) h = ((b - r) / d + 2f) / 6f;
        else h = ((r - g) / d + 4f) / 6f;
        if (h < 0) h += 1;
        return new float[]{h, max == 0 ? 0 : d / max, max};
    }
}
