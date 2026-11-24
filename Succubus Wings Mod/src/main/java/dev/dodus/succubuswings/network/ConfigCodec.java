package dev.dodus.succubuswings.network;

import dev.dodus.succubuswings.core.WingConfig;
import net.minecraft.nbt.CompoundTag;

public final class ConfigCodec {
    public static CompoundTag write(WingConfig c) {
        CompoundTag t = new CompoundTag();
        t.putBoolean("enabled", c.enabled);
        t.putString("scheme", c.scheme);
        t.putInt("membrane", c.customMembrane);
        t.putInt("bone", c.customBone);
        t.putInt("glowColor", c.customGlow);
        t.putFloat("size", c.size);
        t.putFloat("glow", c.glow);
        t.putBoolean("particles", c.particles);
        t.putBoolean("sounds", c.sounds);
        t.putBoolean("jewelry", c.jewelry);
        t.putBoolean("tail", c.tail);
        return t;
    }

    public static WingConfig read(CompoundTag t) {
        WingConfig c = new WingConfig();
        c.enabled = t.getBoolean("enabled");
        String scheme = t.getString("scheme");
        c.scheme = scheme.length() > 64 ? "" : scheme;
        c.customMembrane = t.getInt("membrane");
        c.customBone = t.getInt("bone");
        c.customGlow = t.getInt("glowColor");
        c.size = t.getFloat("size");
        c.glow = t.getFloat("glow");
        c.particles = t.getBoolean("particles");
        c.sounds = t.getBoolean("sounds");
        c.jewelry = t.getBoolean("jewelry");
        c.tail = t.getBoolean("tail");
        return c.sanitize();
    }
}
