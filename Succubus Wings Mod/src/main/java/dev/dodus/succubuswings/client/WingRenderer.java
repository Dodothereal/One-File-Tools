package dev.dodus.succubuswings.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import dev.dodus.succubuswings.SuccubusWings;
import dev.dodus.succubuswings.core.Palette;
import dev.dodus.succubuswings.core.WingAnimator;
import dev.dodus.succubuswings.core.WingConfig;
import dev.dodus.succubuswings.core.WingGeometry;
import dev.dodus.succubuswings.core.WingMesh;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.resources.ResourceLocation;

/** Pushes the procedural wing mesh into Minecraft's vertex buffers. Render thread only. */
public final class WingRenderer {
    public static final ResourceLocation TEXTURE = ResourceLocation.fromNamespaceAndPath(SuccubusWings.MODID, "textures/entity/wings.png");
    public static final ResourceLocation GLOW = ResourceLocation.fromNamespaceAndPath(SuccubusWings.MODID, "textures/entity/wings_glow.png");

    private static final WingMesh MESH = new WingMesh();
    private static final WingGeometry GEOMETRY = new WingGeometry();

    /** Expects the pose stack in wing body space: x = wearer's right, y = up, z = backwards, origin between the shoulder blades. */
    public static void render(PoseStack pose, MultiBufferSource buffers, WingAnimator animator, WingConfig cfg, int light, int overlay) {
        Palette pal = cfg.palette();
        MESH.clear();
        for (int s = 0; s < 2; s++) {
            GEOMETRY.build(animator.skeleton[s], animator.pose[s], cfg, pal, s == WingAnimator.RIGHT ? 1 : -1,
                    animator.chain[s], WingAnimator.CHAIN_POINTS, MESH);
        }
        if (cfg.tail) GEOMETRY.buildTail(animator.tail, WingAnimator.TAIL_POINTS, cfg, pal, cfg.size, MESH);
        PoseStack.Pose last = pose.last();
        emit(MESH.solid, buffers.getBuffer(RenderType.entityCutoutNoCull(TEXTURE)), last, light, overlay);
        emit(MESH.membrane, buffers.getBuffer(RenderType.entityTranslucentCull(TEXTURE)), last, light, overlay);
        if (MESH.glow.vertices > 0) emit(MESH.glow, buffers.getBuffer(RenderType.eyes(GLOW)), last, LightTexture.FULL_BRIGHT, overlay);
    }

    private static void emit(WingMesh.Layer layer, VertexConsumer vc, PoseStack.Pose pose, int light, int overlay) {
        float[] d = layer.data;
        int n = layer.vertices * WingMesh.STRIDE;
        for (int i = 0; i < n; i += WingMesh.STRIDE) {
            vc.addVertex(pose, d[i], d[i + 1], d[i + 2])
                    .setColor(d[i + 8], d[i + 9], d[i + 10], d[i + 11])
                    .setUv(d[i + 6], d[i + 7])
                    .setOverlay(overlay)
                    .setLight(light)
                    .setNormal(pose, d[i + 3], d[i + 4], d[i + 5]);
        }
    }
}
