package dev.dodus.succubuswings.core;

/** Everything a player can customise about their wings. Plain data, shared by client, server and tools. */
public final class WingConfig {
    public static final float MIN_SIZE = 0.5f, MAX_SIZE = 1.6f;
    /** Size 1.0 in the menu is already big: the skeleton is authored at 1 / BASE_SCALE. */
    public static final float BASE_SCALE = 1.3f;

    public float scale() {
        return size * BASE_SCALE;
    }

    public boolean enabled = false;
    public String scheme = Palette.PRESETS.get(0).id;
    public int customMembrane = 0xc2185b;
    public int customBone = 0x2a1a22;
    public int customGlow = 0xff4fa3;
    public float size = 1.0f;
    public float glow = 1.0f;
    public boolean particles = true;
    public boolean sounds = true;
    public boolean jewelry = true;
    public boolean tail = true;

    private transient Palette cached;
    private transient String cachedKey;

    public Palette palette() {
        String key = scheme + customMembrane + ":" + customBone + ":" + customGlow;
        if (cached == null || !key.equals(cachedKey)) {
            cached = Palette.CUSTOM_ID.equals(scheme) ? Palette.custom(customMembrane, customBone, customGlow) : Palette.byId(scheme);
            cachedKey = key;
        }
        return cached;
    }

    public WingConfig copy() {
        WingConfig c = new WingConfig();
        c.set(this);
        return c;
    }

    public void set(WingConfig o) {
        enabled = o.enabled;
        scheme = o.scheme;
        customMembrane = o.customMembrane;
        customBone = o.customBone;
        customGlow = o.customGlow;
        size = o.size;
        glow = o.glow;
        particles = o.particles;
        sounds = o.sounds;
        jewelry = o.jewelry;
        tail = o.tail;
    }

    /** Clamps everything to legal values (used on data from the network or disk). */
    public WingConfig sanitize() {
        if (scheme == null || (!Palette.CUSTOM_ID.equals(scheme) && Palette.indexOf(scheme) < 0)) scheme = Palette.PRESETS.get(0).id;
        if (Float.isNaN(size)) size = 1;
        if (Float.isNaN(glow)) glow = 1;
        size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
        glow = Math.max(0f, Math.min(2f, glow));
        customMembrane &= 0xffffff;
        customBone &= 0xffffff;
        customGlow &= 0xffffff;
        return this;
    }
}
