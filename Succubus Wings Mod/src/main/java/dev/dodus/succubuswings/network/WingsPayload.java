package dev.dodus.succubuswings.network;

import dev.dodus.succubuswings.SuccubusWings;
import net.minecraft.core.UUIDUtil;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

import java.util.UUID;

/**
 * A player's wing settings. Client to server: "these are my wings" (the id is ignored).
 * Server to client: "this is what that player wears".
 */
public record WingsPayload(UUID player, CompoundTag config) implements CustomPacketPayload {
    public static final Type<WingsPayload> TYPE = new Type<>(ResourceLocation.fromNamespaceAndPath(SuccubusWings.MODID, "wings"));
    public static final StreamCodec<FriendlyByteBuf, WingsPayload> CODEC = StreamCodec.composite(
            UUIDUtil.STREAM_CODEC, WingsPayload::player,
            ByteBufCodecs.COMPOUND_TAG, WingsPayload::config,
            WingsPayload::new);

    @Override
    public Type<WingsPayload> type() {
        return TYPE;
    }
}
