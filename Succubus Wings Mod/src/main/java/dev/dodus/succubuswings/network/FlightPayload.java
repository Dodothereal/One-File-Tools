package dev.dodus.succubuswings.network;

import dev.dodus.succubuswings.SuccubusWings;
import net.minecraft.core.UUIDUtil;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

import java.util.UUID;

/** Vanilla does not tell clients whether another player is in creative flight, so the server does. */
public record FlightPayload(UUID player, boolean flying) implements CustomPacketPayload {
    public static final Type<FlightPayload> TYPE = new Type<>(ResourceLocation.fromNamespaceAndPath(SuccubusWings.MODID, "flight"));
    public static final StreamCodec<FriendlyByteBuf, FlightPayload> CODEC = StreamCodec.composite(
            UUIDUtil.STREAM_CODEC, FlightPayload::player,
            ByteBufCodecs.BOOL, FlightPayload::flying,
            FlightPayload::new);

    @Override
    public Type<FlightPayload> type() {
        return TYPE;
    }
}
