package dev.dodus.succubuswings.client;

import com.mojang.blaze3d.vertex.PoseStack;
import dev.dodus.succubuswings.core.WingAnimator;
import dev.dodus.succubuswings.core.WingConfig;
import dev.dodus.succubuswings.core.WingInput;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.util.Mth;

public final class WingsLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
    /** Set by the wardrobe screen while it draws its preview: overrides the animation and the settings. */
    public static WingAnimator previewAnimator;
    public static WingConfig previewConfig;

    private final WingInput input = new WingInput();

    public WingsLayer(RenderLayerParent<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> parent) {
        super(parent);
    }

    @Override
    public void render(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer player, float limbSwing, float limbSwingAmount,
                       float partialTick, float ageInTicks, float netHeadYaw, float headPitch) {
        WingAnimator animator;
        WingConfig cfg;
        if (previewAnimator != null) {
            animator = previewAnimator;
            cfg = previewConfig;
        } else {
            cfg = ClientWings.configFor(player);
            if (cfg == null || !cfg.enabled || player.isInvisible()) return;
            ClientWings.WingState state = ClientWings.stateFor(player);
            gather(player, state, partialTick);
            animator = state.animator;
            animator.update(input, (player.tickCount + (double) partialTick) / 20.0, cfg.scale());
        }
        if (cfg == null || !cfg.enabled) return;
        pose.pushPose();
        getParentModel().body.translateAndRotate(pose);
        // model space (x = wearer's left, y = down, 1/16 block units already applied) -> wing body space
        pose.translate(0, 0.2f, 0.125f);
        pose.scale(-1, -1, 1);
        WingRenderer.render(pose, buffers, animator, cfg, light, LivingEntityRenderer.getOverlayCoords(player, 0));
        pose.popPose();
    }

    private void gather(AbstractClientPlayer p, ClientWings.WingState state, float partialTick) {
        WingInput in = input;
        double dx = (p.getX() - p.xo) * 20, dy = (p.getY() - p.yo) * 20, dz = (p.getZ() - p.zo) * 20;
        float yaw = Mth.rotLerp(partialTick, p.yBodyRotO, p.yBodyRot) * Mth.DEG_TO_RAD;
        float sin = Mth.sin(yaw), cos = Mth.cos(yaw);
        in.forward = (float) (dx * -sin + dz * cos);
        in.strafe = (float) (dx * -cos + dz * -sin);
        in.up = (float) dy;
        in.yawRate = Mth.wrapDegrees(p.yBodyRot - p.yBodyRotO) * 20;
        in.onGround = p.onGround();
        in.sneaking = p.isCrouching();
        in.sprinting = p.isSprinting();
        in.gliding = p.isFallFlying();
        in.swimming = p.isVisuallySwimming();
        in.sleeping = p.isSleeping();
        in.riding = p.isPassenger();
        in.inWater = p.isInWater();
        in.hurt = p.hurtTime > 0 ? (p.hurtTime - partialTick) / Math.max(1, p.hurtDuration) : 0;
        in.attack = p.getAttackAnim(partialTick);
        in.health = p.getMaxHealth() > 0 ? p.getHealth() / p.getMaxHealth() : 1;

        boolean local = p == Minecraft.getInstance().player;
        if (local) {
            in.flying = p.getAbilities().flying;
        } else {
            // The server tells us when it runs the mod; otherwise guess from "hanging in the air without falling".
            if (state.lastTick != p.tickCount) {
                state.lastTick = p.tickCount;
                boolean hanging = !in.onGround && !in.gliding && !in.inWater && !in.riding && !p.onClimbable()
                        && Math.abs(dy - state.lastVy) < 0.6 && dy > -6;
                state.hoverTicks = hanging ? state.hoverTicks + 1 : 0;
                state.lastVy = dy;
            }
            in.flying = ClientWings.remoteFlying(p.getUUID()) || state.hoverTicks > 12;
        }
        if (in.flying && in.onGround) in.flying = false;

        // gravity as the body sees it, so pendants hang correctly while gliding or swimming face down
        float tilt = 0;
        if (in.gliding || in.swimming) tilt = (90 + p.getViewXRot(partialTick)) * Mth.DEG_TO_RAD;
        tilt = Mth.clamp(tilt, 0, Mth.PI);
        in.gravX = 0;
        in.gravY = -Mth.cos(tilt);
        in.gravZ = -Mth.sin(tilt);
    }
}
