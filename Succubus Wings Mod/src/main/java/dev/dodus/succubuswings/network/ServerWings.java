package dev.dodus.succubuswings.network;

import dev.dodus.succubuswings.core.WingConfig;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.tick.PlayerTickEvent;
import net.neoforged.neoforge.network.PacketDistributor;
import net.neoforged.neoforge.network.handling.IPayloadContext;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Server side: remembers what every online player wears and tells the players who can see them. */
public final class ServerWings {
    private static final Map<UUID, WingConfig> CONFIGS = new ConcurrentHashMap<>();
    private static final Map<UUID, Boolean> FLYING = new ConcurrentHashMap<>();

    static void receive(WingsPayload payload, IPayloadContext ctx) {
        if (!(ctx.player() instanceof ServerPlayer player)) return;
        WingConfig cfg = ConfigCodec.read(payload.config());
        CONFIGS.put(player.getUUID(), cfg);
        WingsPayload out = new WingsPayload(player.getUUID(), ConfigCodec.write(cfg));
        for (ServerPlayer other : player.server.getPlayerList().getPlayers()) {
            if (other != player && other.connection.hasChannel(WingsPayload.TYPE)) PacketDistributor.sendToPlayer(other, out);
        }
    }

    @SubscribeEvent
    public static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer player) || !player.connection.hasChannel(WingsPayload.TYPE)) return;
        // tell the newcomer about everyone already online
        CONFIGS.forEach((id, cfg) -> {
            if (!id.equals(player.getUUID())) PacketDistributor.sendToPlayer(player, new WingsPayload(id, ConfigCodec.write(cfg)));
        });
        FLYING.forEach((id, fly) -> {
            if (fly && !id.equals(player.getUUID())) PacketDistributor.sendToPlayer(player, new FlightPayload(id, true));
        });
    }

    @SubscribeEvent
    public static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        CONFIGS.remove(event.getEntity().getUUID());
        FLYING.remove(event.getEntity().getUUID());
    }

    @SubscribeEvent
    public static void onTick(PlayerTickEvent.Post event) {
        Player p = event.getEntity();
        if (!(p instanceof ServerPlayer player) || !CONFIGS.containsKey(player.getUUID())) return;
        boolean flying = player.getAbilities().flying;
        Boolean last = FLYING.put(player.getUUID(), flying);
        if (last == null ? flying : last != flying) {
            FlightPayload out = new FlightPayload(player.getUUID(), flying);
            for (ServerPlayer other : player.server.getPlayerList().getPlayers()) {
                if (other != player && other.connection.hasChannel(FlightPayload.TYPE)) PacketDistributor.sendToPlayer(other, out);
            }
        }
    }
}
