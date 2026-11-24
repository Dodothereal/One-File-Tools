package dev.dodus.succubuswings.client;

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.brigadier.arguments.FloatArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import dev.dodus.succubuswings.SuccubusWings;
import dev.dodus.succubuswings.core.Palette;
import dev.dodus.succubuswings.core.WingConfig;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.resources.PlayerSkin;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;
import net.neoforged.neoforge.client.event.RegisterClientCommandsEvent;
import net.neoforged.neoforge.client.event.RegisterKeyMappingsEvent;
import net.neoforged.neoforge.common.NeoForge;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.List;

@Mod(value = SuccubusWings.MODID, dist = Dist.CLIENT)
public final class ClientSetup {
    public static final KeyMapping OPEN_KEY = new KeyMapping("key.succubuswings.open", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_J, "key.categories.succubuswings");
    public static final KeyMapping TOGGLE_KEY = new KeyMapping("key.succubuswings.toggle", InputConstants.Type.KEYSYM, InputConstants.UNKNOWN.getValue(), "key.categories.succubuswings");
    private static boolean openRequested;
    private static int tick;

    public ClientSetup(IEventBus modBus) {
        ClientWings.load();
        modBus.addListener(ClientSetup::addLayers);
        modBus.addListener((RegisterKeyMappingsEvent e) -> {
            e.register(OPEN_KEY);
            e.register(TOGGLE_KEY);
        });
        NeoForge.EVENT_BUS.addListener(ClientSetup::commands);
        NeoForge.EVENT_BUS.addListener(ClientSetup::clientTick);
        NeoForge.EVENT_BUS.addListener((ClientPlayerNetworkEvent.LoggingIn e) -> {
            ClientWings.clearRemote();
            ClientWings.send();
        });
        NeoForge.EVENT_BUS.addListener((ClientPlayerNetworkEvent.LoggingOut e) -> ClientWings.clearRemote());
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void addLayers(EntityRenderersEvent.AddLayers event) {
        for (PlayerSkin.Model skin : event.getSkins()) {
            EntityRenderer<?> r = event.getSkin(skin);
            if (r instanceof LivingEntityRenderer renderer) {
                renderer.addLayer(new WingsLayer((LivingEntityRenderer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>>) renderer));
            }
        }
    }

    private static void clientTick(ClientTickEvent.Post event) {
        Minecraft mc = Minecraft.getInstance();
        if (openRequested) {
            openRequested = false;
            mc.setScreen(new WardrobeScreen());
        }
        while (OPEN_KEY.consumeClick()) if (mc.screen == null) mc.setScreen(new WardrobeScreen());
        while (TOGGLE_KEY.consumeClick()) {
            ClientWings.LOCAL.enabled = !ClientWings.LOCAL.enabled;
            ClientWings.commit();
        }
        Effects.tick(mc);
        if (++tick % 200 == 0) ClientWings.prune();
    }

    private static void commands(RegisterClientCommandsEvent event) {
        List<String> ids = new ArrayList<>();
        for (Palette p : Palette.PRESETS) ids.add(p.id);
        ids.add(Palette.CUSTOM_ID);
        event.getDispatcher().register(Commands.literal("wings")
                .executes(ctx -> {
                    openRequested = true; // the chat screen is still closing; open on the next tick
                    return 1;
                })
                .then(Commands.literal("on").executes(ctx -> set(c -> c.enabled = true, "Wings on")))
                .then(Commands.literal("off").executes(ctx -> set(c -> c.enabled = false, "Wings off")))
                .then(Commands.literal("toggle").executes(ctx -> set(c -> c.enabled = !c.enabled, "Wings toggled")))
                .then(Commands.literal("scheme").then(Commands.argument("id", StringArgumentType.word())
                        .suggests((ctx, b) -> SharedSuggestionProvider.suggest(ids, b))
                        .executes(ctx -> {
                            String id = StringArgumentType.getString(ctx, "id");
                            if (!ids.contains(id)) {
                                ctx.getSource().sendFailure(Component.literal("Unknown color scheme: " + id));
                                return 0;
                            }
                            return set(c -> c.scheme = id, "Wing colors: " + (Palette.CUSTOM_ID.equals(id) ? "Custom" : Palette.byId(id).name));
                        })))
                .then(Commands.literal("size").then(Commands.argument("size", FloatArgumentType.floatArg(WingConfig.MIN_SIZE, WingConfig.MAX_SIZE))
                        .executes(ctx -> {
                            float v = FloatArgumentType.getFloat(ctx, "size");
                            return set(c -> c.size = v, "Wing size: " + v);
                        })))
                .then(Commands.literal("glow").then(Commands.argument("glow", FloatArgumentType.floatArg(0, 2))
                        .executes(ctx -> {
                            float v = FloatArgumentType.getFloat(ctx, "glow");
                            return set(c -> c.glow = v, "Wing glow: " + v);
                        }))));
    }

    private static int set(java.util.function.Consumer<WingConfig> change, String message) {
        change.accept(ClientWings.LOCAL);
        ClientWings.commit();
        Minecraft mc = Minecraft.getInstance();
        if (mc.player != null) mc.player.displayClientMessage(Component.literal(message), true);
        return 1;
    }
}
