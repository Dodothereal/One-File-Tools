package dev.dodus.succubuswings.client;

import dev.dodus.succubuswings.core.Palette;
import dev.dodus.succubuswings.core.WingAnimator;
import dev.dodus.succubuswings.core.WingConfig;
import dev.dodus.succubuswings.core.WingSkeleton;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import org.joml.Vector3f;

/** Embers shed from the wings and the soft whoosh of each downstroke. Purely client side. */
public final class Effects {
    private static final RandomSource RANDOM = RandomSource.create();
    private static final float[] TIP = new float[3];

    static void tick(Minecraft mc) {
        if (mc.level == null || mc.player == null || mc.isPaused()) return;
        for (AbstractClientPlayer p : mc.level.players()) {
            WingConfig cfg = ClientWings.configFor(p);
            if (cfg == null || !cfg.enabled || p.isInvisible() || p.distanceToSqr(mc.player) > 64 * 64) continue;
            boolean firstPerson = p == mc.player && mc.options.getCameraType().isFirstPerson();
            ClientWings.WingState state = ClientWings.stateFor(p);
            WingAnimator an = state.animator;
            if (firstPerson) continue; // the layer is not drawn, so the animation is not advancing either
            float flap = an.flapStrength;
            if (cfg.sounds && an.flapPulse && flap > 0.3f) {
                an.flapPulse = false;
                mc.level.playLocalSound(p.getX(), p.getY() + 1.2, p.getZ(), SoundEvents.ENDER_DRAGON_FLAP, SoundSource.PLAYERS,
                        0.16f * flap * Math.min(1.3f, cfg.scale()), 1.25f + RANDOM.nextFloat() * 0.25f, false);
            }
            if (!cfg.particles || cfg.glow <= 0.01f) continue;
            double speed = p.getDeltaMovement().length();
            float chance = 0.035f + 0.35f * flap + (float) Math.min(0.3, speed * 0.35);
            if (RANDOM.nextFloat() > chance) continue;
            Palette pal = cfg.palette();
            int side = RANDOM.nextInt(2);
            WingSkeleton sk = an.skeleton[side];
            float[] line = sk.finger[RANDOM.nextInt(WingSkeleton.FINGERS)];
            int k = (WingSkeleton.SEG / 2 + RANDOM.nextInt(WingSkeleton.SEG / 2 + 1)) * 3;
            TIP[0] = line[k] * (side == WingAnimator.RIGHT ? 1 : -1);
            TIP[1] = line[k + 1];
            TIP[2] = line[k + 2];
            float yaw = p.yBodyRot * Mth.DEG_TO_RAD;
            float sin = Mth.sin(yaw), cos = Mth.cos(yaw);
            float s = 0.9375f;
            // body space (x right, z back) -> world
            double wx = p.getX() + (TIP[0] * -cos + TIP[2] * sin) * s;
            double wz = p.getZ() + (TIP[0] * -sin + TIP[2] * -cos) * s;
            double wy = p.getY() + (p.isCrouching() ? 1.0 : 1.22) + TIP[1] * s;
            int c = RANDOM.nextFloat() < 0.75f ? pal.glow : pal.gem;
            Vector3f color = new Vector3f(((c >> 16) & 255) / 255f, ((c >> 8) & 255) / 255f, (c & 255) / 255f);
            mc.level.addParticle(new DustParticleOptions(color, 0.55f + RANDOM.nextFloat() * 0.5f), wx, wy, wz, 0, -0.01, 0);
        }
    }
}
