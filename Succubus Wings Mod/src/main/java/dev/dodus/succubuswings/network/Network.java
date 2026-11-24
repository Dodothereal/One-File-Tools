package dev.dodus.succubuswings.network;

import dev.dodus.succubuswings.client.ClientPayloads;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.handling.DirectionalPayloadHandler;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

public final class Network {
    public static void register(RegisterPayloadHandlersEvent event) {
        // optional: the mod still works for yourself on servers that do not have it
        PayloadRegistrar reg = event.registrar("1").optional();
        reg.playBidirectional(WingsPayload.TYPE, WingsPayload.CODEC,
                new DirectionalPayloadHandler<>((p, ctx) -> ClientPayloads.wings(p), ServerWings::receive));
        reg.playToClient(FlightPayload.TYPE, FlightPayload.CODEC, (p, ctx) -> ClientPayloads.flight(p));
    }
}
