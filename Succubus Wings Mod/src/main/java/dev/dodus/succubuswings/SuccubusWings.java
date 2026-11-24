package dev.dodus.succubuswings;

import dev.dodus.succubuswings.network.Network;
import dev.dodus.succubuswings.network.ServerWings;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;

@Mod(SuccubusWings.MODID)
public class SuccubusWings {
    public static final String MODID = "succubuswings";

    public SuccubusWings(IEventBus modBus) {
        modBus.addListener(Network::register);
        NeoForge.EVENT_BUS.register(ServerWings.class);
    }
}
