package dev.dodus.succubuswings.client;

import dev.dodus.succubuswings.network.ConfigCodec;
import dev.dodus.succubuswings.network.FlightPayload;
import dev.dodus.succubuswings.network.WingsPayload;

public final class ClientPayloads {
    public static void wings(WingsPayload p) {
        ClientWings.setRemote(p.player(), ConfigCodec.read(p.config()));
    }

    public static void flight(FlightPayload p) {
        ClientWings.setRemoteFlying(p.player(), p.flying());
    }
}
