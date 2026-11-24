package dev.dodus.succubuswings.client;

import dev.dodus.succubuswings.core.Palette;
import dev.dodus.succubuswings.core.WingAnimator;
import dev.dodus.succubuswings.core.WingConfig;
import dev.dodus.succubuswings.network.ConfigCodec;
import dev.dodus.succubuswings.network.WingsPayload;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.world.entity.player.Player;
import net.neoforged.fml.loading.FMLPaths;
import net.neoforged.neoforge.network.PacketDistributor;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

/** Client side state: your own settings (saved to disk), what other players wear, and their animation state. */
public final class ClientWings {
    public static final WingConfig LOCAL = new WingConfig();
    private static final Map<UUID, WingConfig> REMOTE = new HashMap<>();
    private static final Map<UUID, Boolean> REMOTE_FLYING = new HashMap<>();
    private static final Map<UUID, WingState> STATES = new HashMap<>();

    /** Per player animation state. */
    public static final class WingState {
        public final WingAnimator animator;
        public long lastUsed;
        public int hoverTicks;
        public double lastVy;
        public int lastTick = -1;

        WingState(int seed) {
            animator = new WingAnimator(seed);
        }
    }

    public static WingConfig configFor(Player player) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player != null && player.getUUID().equals(mc.player.getUUID())) return LOCAL;
        return REMOTE.get(player.getUUID());
    }

    public static WingState stateFor(Player player) {
        WingState s = STATES.computeIfAbsent(player.getUUID(), id -> new WingState(id.hashCode()));
        s.lastUsed = System.currentTimeMillis();
        return s;
    }

    public static boolean remoteFlying(UUID id) {
        return REMOTE_FLYING.getOrDefault(id, false);
    }

    static void setRemote(UUID id, WingConfig cfg) {
        REMOTE.put(id, cfg);
    }

    static void setRemoteFlying(UUID id, boolean flying) {
        REMOTE_FLYING.put(id, flying);
    }

    static void clearRemote() {
        REMOTE.clear();
        REMOTE_FLYING.clear();
        STATES.clear();
    }

    static void prune() {
        long now = System.currentTimeMillis();
        STATES.values().removeIf(s -> now - s.lastUsed > 30_000);
    }

    /** True when the server we are on also runs the mod, i.e. other players can see our wings. */
    public static boolean serverHasMod() {
        ClientPacketListener c = Minecraft.getInstance().getConnection();
        return c != null && c.hasChannel(WingsPayload.TYPE);
    }

    /** Saves the local settings and, when possible, shows them to everyone else. */
    public static void commit() {
        LOCAL.sanitize();
        save();
        send();
    }

    static void send() {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player != null && serverHasMod()) PacketDistributor.sendToServer(new WingsPayload(mc.player.getUUID(), ConfigCodec.write(LOCAL)));
    }

    private static Path file() {
        return FMLPaths.CONFIGDIR.get().resolve("succubuswings-client.properties");
    }

    static void load() {
        Path f = file();
        if (!Files.exists(f)) {
            LOCAL.enabled = true; // first launch: show them off straight away
            return;
        }
        try (Reader r = Files.newBufferedReader(f)) {
            Properties p = new Properties();
            p.load(r);
            LOCAL.enabled = Boolean.parseBoolean(p.getProperty("enabled", "true"));
            LOCAL.scheme = p.getProperty("scheme", Palette.PRESETS.get(0).id);
            LOCAL.customMembrane = hex(p, "customMembrane", LOCAL.customMembrane);
            LOCAL.customBone = hex(p, "customBone", LOCAL.customBone);
            LOCAL.customGlow = hex(p, "customGlow", LOCAL.customGlow);
            LOCAL.size = Float.parseFloat(p.getProperty("size", "1"));
            LOCAL.glow = Float.parseFloat(p.getProperty("glow", "1"));
            LOCAL.particles = Boolean.parseBoolean(p.getProperty("particles", "true"));
            LOCAL.sounds = Boolean.parseBoolean(p.getProperty("sounds", "true"));
            LOCAL.jewelry = Boolean.parseBoolean(p.getProperty("jewelry", "true"));
            LOCAL.tail = Boolean.parseBoolean(p.getProperty("tail", "true"));
        } catch (Exception e) {
            LOCAL.set(new WingConfig());
            LOCAL.enabled = true;
        }
        LOCAL.sanitize();
    }

    private static int hex(Properties p, String key, int def) {
        try {
            return Integer.parseInt(p.getProperty(key, Integer.toHexString(def)), 16);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    static void save() {
        Properties p = new Properties();
        p.setProperty("enabled", Boolean.toString(LOCAL.enabled));
        p.setProperty("scheme", LOCAL.scheme);
        p.setProperty("customMembrane", Integer.toHexString(LOCAL.customMembrane));
        p.setProperty("customBone", Integer.toHexString(LOCAL.customBone));
        p.setProperty("customGlow", Integer.toHexString(LOCAL.customGlow));
        p.setProperty("size", Float.toString(LOCAL.size));
        p.setProperty("glow", Float.toString(LOCAL.glow));
        p.setProperty("particles", Boolean.toString(LOCAL.particles));
        p.setProperty("sounds", Boolean.toString(LOCAL.sounds));
        p.setProperty("jewelry", Boolean.toString(LOCAL.jewelry));
        p.setProperty("tail", Boolean.toString(LOCAL.tail));
        try (Writer w = Files.newBufferedWriter(file())) {
            p.store(w, "Succubus Wings - your wings. Edit in game with /wings");
        } catch (Exception ignored) {
        }
    }
}
