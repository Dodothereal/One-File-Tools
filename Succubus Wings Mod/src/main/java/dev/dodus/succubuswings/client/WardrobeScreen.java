package dev.dodus.succubuswings.client;

import dev.dodus.succubuswings.core.Palette;
import dev.dodus.succubuswings.core.WingAnimator;
import dev.dodus.succubuswings.core.WingConfig;
import dev.dodus.succubuswings.core.WingInput;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractButton;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Pose;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** The wardrobe: a live, rotatable 3D preview of you wearing the wings next to every setting. Opened with /wings. */
public final class WardrobeScreen extends Screen {
    private record Mode(String name, float bodyPitch, boolean crouch, Consumer<WingInput> input) { }

    private static final Mode[] MODES = {
            new Mode("Idle", 0, false, in -> { }),
            new Mode("Walk", 0, false, in -> in.forward = 4.3f),
            new Mode("Sprint", 0, false, in -> { in.forward = 5.6f; in.sprinting = true; }),
            new Mode("Sneak", 0, true, in -> in.sneaking = true),
            new Mode("Hover", 0, false, in -> { in.flying = true; in.onGround = false; }),
            new Mode("Fly", 0.3f, false, in -> { in.flying = true; in.onGround = false; in.forward = 10.8f; in.sprinting = true; }),
            new Mode("Glide", 1.3f, false, in -> { in.gliding = true; in.onGround = false; in.forward = 22; }),
            new Mode("Fall", 0, false, in -> { in.onGround = false; in.up = -18; }),
            new Mode("Swim", 1.4f, false, in -> { in.swimming = true; in.inWater = true; in.onGround = false; in.forward = 3.5f; }),
    };

    private static final int PANEL = 204, ROW = 14;

    private final WingConfig cfg = ClientWings.LOCAL;
    private final WingAnimator animator = new WingAnimator(4711);
    private final WingInput input = new WingInput();
    private final List<AbstractWidget> customWidgets = new ArrayList<>();
    private final float[][] hsv = new float[3][];
    private int mode = 4;
    private float yaw = 205, pitch = -8, zoom = 1, bodyPitch;
    private boolean autoRotate = true, dragging;
    private float baseYaw = 180;
    private long lastNanos = System.nanoTime();
    private double time;
    private int previewW, previewH, hsbY;

    public WardrobeScreen() {
        super(Component.literal("Succubus Wings"));
    }

    @Override
    protected void init() {
        customWidgets.clear();
        previewW = width - PANEL - 8;
        previewH = height - 2 * ROW - 16;
        hsv[0] = Palette.toHsv(cfg.customMembrane);
        hsv[1] = Palette.toHsv(cfg.customBone);
        hsv[2] = Palette.toHsv(cfg.customGlow);
        int x = width - PANEL - 2, y = 16, w = PANEL - 4;

        int q = (w - 4) / 4;
        addRenderableWidget(toggle(x, y, 2 * q, "Wings", () -> cfg.enabled, v -> cfg.enabled = v));
        Flat rnd = new Flat(x + 2 * q + 2, y, q, ROW, Component.literal("Random"), b -> {
            java.util.Random r = new java.util.Random();
            float h = r.nextFloat();
            setCustom(0, h, 0.55f + 0.4f * r.nextFloat(), 0.45f + 0.5f * r.nextFloat());
            setCustom(1, (h + 0.9f + 0.2f * r.nextFloat()) % 1f, 0.3f + 0.5f * r.nextFloat(), 0.12f + 0.3f * r.nextFloat());
            setCustom(2, (h + (r.nextBoolean() ? 0.08f : 0.45f) + 0.1f * r.nextFloat()) % 1f, 0.5f + 0.4f * r.nextFloat(), 1f);
            cfg.scheme = Palette.CUSTOM_ID;
            rebuildWidgets();
        }, () -> false);
        rnd.setTooltip(Tooltip.create(Component.literal("Roll a random custom colour set")));
        addRenderableWidget(rnd);
        Flat rst = new Flat(x + 3 * q + 4, y, w - 3 * q - 4, ROW, Component.literal("Reset"), b -> {
            WingConfig d = new WingConfig();
            cfg.scheme = d.scheme; cfg.size = d.size; cfg.glow = d.glow;
            cfg.customMembrane = d.customMembrane; cfg.customBone = d.customBone; cfg.customGlow = d.customGlow;
            cfg.jewelry = cfg.tail = cfg.particles = cfg.sounds = true;
            rebuildWidgets();
        }, () -> false);
        rst.setTooltip(Tooltip.create(Component.literal("Back to the default look")));
        addRenderableWidget(rst);
        y += ROW + 14;

        // color scheme swatches
        int cols = 4, sw = (w - (cols - 1) * 2) / cols, sh = height < 285 ? 16 : 20;
        for (int i = 0; i <= Palette.PRESETS.size(); i++) {
            boolean custom = i == Palette.PRESETS.size();
            Palette p = custom ? null : Palette.PRESETS.get(i);
            addRenderableWidget(new Swatch(x + (i % cols) * (sw + 2), y + (i / cols) * (sh + 2), sw, sh, custom ? Palette.CUSTOM_ID : p.id, custom ? "Custom colors" : p.name));
        }
        y += 4 * (sh + 2) + 2;
        hsbY = y;

        // custom colors: hue / saturation / brightness for membrane, bone and glow
        String[] names = {"Skin", "Bone", "Glow"};
        int lw = 30, cw = (w - lw - 4) / 3;
        for (int r = 0; r < 3; r++) {
            final int row = r;
            for (int c = 0; c < 3; c++) {
                final int ch = c;
                Slider s = new Slider(x + lw + c * (cw + 2), y, cw, 12, () -> "", hsv[r][c], v -> {
                    hsv[row][ch] = (float) v;
                    cfg.scheme = Palette.CUSTOM_ID;
                    int rgb = Palette.hsv(Math.min(0.9999f, hsv[row][0]), hsv[row][1], hsv[row][2]);
                    if (row == 0) cfg.customMembrane = rgb;
                    else if (row == 1) cfg.customBone = rgb;
                    else cfg.customGlow = rgb;
                });
                s.track = u -> ch == 0 ? Palette.hsv(Math.min(0.9999f, u), 0.85f, 1f)
                        : ch == 1 ? Palette.hsv(Math.min(0.9999f, hsv[row][0]), u, Math.max(0.35f, hsv[row][2]))
                        : Palette.hsv(Math.min(0.9999f, hsv[row][0]), hsv[row][1], u);
                s.setTooltip(Tooltip.create(Component.literal(names[r] + (c == 0 ? " hue" : c == 1 ? " saturation" : " brightness"))));
                addRenderableWidget(s);
            }
            y += 13;
        }
        y += 3;

        int half = (w - 2) / 2;
        addRenderableWidget(new Slider(x, y, half, ROW, () -> "Size " + Math.round(cfg.size * 100) + "%",
                (cfg.size - WingConfig.MIN_SIZE) / (WingConfig.MAX_SIZE - WingConfig.MIN_SIZE),
                v -> cfg.size = (float) (WingConfig.MIN_SIZE + v * (WingConfig.MAX_SIZE - WingConfig.MIN_SIZE))));
        addRenderableWidget(new Slider(x + half + 2, y, half, ROW, () -> "Glow " + Math.round(cfg.glow * 100) + "%", cfg.glow / 2f, v -> cfg.glow = (float) v * 2f));
        y += ROW + 2;
        addRenderableWidget(toggle(x, y, half, "Jewelry", () -> cfg.jewelry, v -> cfg.jewelry = v));
        addRenderableWidget(toggle(x + half + 2, y, half, "Tail", () -> cfg.tail, v -> cfg.tail = v));
        y += ROW + 2;
        addRenderableWidget(toggle(x, y, half, "Embers", () -> cfg.particles, v -> cfg.particles = v));
        addRenderableWidget(toggle(x + half + 2, y, half, "Sound", () -> cfg.sounds, v -> cfg.sounds = v));

        addRenderableWidget(new Flat(x, height - ROW - 6, w, ROW + 2, Component.literal("\u2764 Done"), b -> onClose(), () -> true));

        // animation picker under the preview
        int n = MODES.length + 2, perRow = (n + 1) / 2, bw = (previewW - (perRow - 1) * 2) / perRow;
        for (int i = 0; i < n; i++) {
            int bx = 4 + (i % perRow) * (bw + 2), by = height - 2 * ROW - 8 + (i / perRow) * (ROW + 1);
            if (i < MODES.length) {
                final int m = i;
                addRenderableWidget(new ModeButton(bx, by, bw, ROW, m));
            } else if (i == MODES.length) {
                Flat st = new Flat(bx, by, bw, ROW, Component.literal("Stretch!"), b -> {
                    if (MODES[mode].name.equals("Idle") || MODES[mode].name.equals("Walk")) animator.triggerEvent(1);
                    else { mode = 0; animator.triggerEvent(1); }
                }, () -> false);
                st.setTooltip(Tooltip.create(Component.literal("Idle flourish: a slow stretch and shiver. Others happen on their own.")));
                addRenderableWidget(st);
            } else {
                Flat sp = new Flat(bx, by, bw, ROW, Component.literal("Sway"), b -> autoRotate = !autoRotate, () -> autoRotate);
                sp.setTooltip(Tooltip.create(Component.literal("Slow camera sway on / off")));
                addRenderableWidget(sp);
            }
        }
    }

    private void setCustom(int row, float h, float sat, float v) {
        int rgb = Palette.hsv(Math.min(0.9999f, h), sat, v);
        if (row == 0) cfg.customMembrane = rgb;
        else if (row == 1) cfg.customBone = rgb;
        else cfg.customGlow = rgb;
    }

    private static String c2(int ch) {
        return ch == 0 ? "H " : ch == 1 ? "S " : "B ";
    }

    private Button toggle(int x, int y, int w, String name, Supplier<Boolean> get, Consumer<Boolean> set) {
        return new Flat(x, y, w, ROW, Component.literal(name + (get.get() ? "  \u2714" : "  \u2716")), b -> {
            set.accept(!get.get());
            b.setMessage(Component.literal(name + (get.get() ? "  \u2714" : "  \u2716")));
        }, get);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        boolean custom = Palette.CUSTOM_ID.equals(cfg.scheme);
        super.render(g, mouseX, mouseY, partialTick);

        int x = width - PANEL - 2;
        g.drawString(font, "\u2726 Succubus Wings \u2726", x, 4, 0xff000000 | cfg.palette().accent);
        g.drawString(font, cfg.palette().name, 8, 18, 0xff000000 | cfg.palette().glow);
        String scheme = custom ? "Custom" : Palette.byId(cfg.scheme).name;
        g.drawString(font, "Colors: " + scheme, x, 16 + ROW + 3, 0xffe8c8d8);
        String hex = String.format("#%06X  #%06X  #%06X", cfg.palette().outerEdge & 0xffffff, cfg.palette().boneTip & 0xffffff, cfg.palette().glow & 0xffffff);
        g.pose().pushPose();
        g.pose().translate(width - 4 - font.width(hex) * 0.75f, 16 + ROW + 4, 0);
        g.pose().scale(0.75f, 0.75f, 1);
        g.drawString(font, hex, 0, 0, 0xff9a86a6, false);
        g.pose().popPose();
        int cy = hsbY;
        String[] names = {"Skin", "Bone", "Glow"};
        int[] colors = {cfg.customMembrane, cfg.customBone, cfg.customGlow};
        for (int r = 0; r < 3; r++) {
            g.fill(x, cy + r * 13 + 1, x + 4, cy + r * 13 + 11, 0xff000000 | colors[r]);
            g.drawString(font, names[r], x + 6, cy + r * 13 + 2, custom ? 0xffffffff : 0xffb9a6c2, false);
        }
        g.drawString(font, ClientWings.serverHasMod() ? "Other players see your wings" : "Only you see them here (server lacks the mod)",
                4, 4, ClientWings.serverHasMod() ? 0xff9be89b : 0xffe8c06a);

        renderPreview(g, partialTick);
        if (cfg.particles && cfg.enabled) {
            // drifting motes, like the ones the wings shed in the world
            int glowC = cfg.palette().glow & 0xffffff;
            for (int i = 0; i < 46; i++) {
                float life = (float) ((time * (0.12 + 0.05 * (i % 5)) + i * 0.377) % 1.0);
                float px = 4 + previewW * (0.12f + 0.76f * (float) ((i * 0.6180339) % 1.0)) + 9 * Mth.sin((float) time * 1.3f + i);
                float py = 14 + previewH * (0.86f - 0.72f * life);
                int a = (int) (190 * Mth.sin(life * Mth.PI) * (0.55f + 0.45f * Mth.sin((float) time * 5 + i * 1.7f)));
                if (a <= 4) continue;
                int col = (a << 24) | (i % 3 == 0 ? 0xffffff : glowC);
                int ix = (int) px, iy = (int) py;
                g.fill(ix, iy, ix + 1, iy + 1, col);
                if (i % 4 == 0) { g.fill(ix - 1, iy, ix + 2, iy + 1, (a / 2 << 24) | glowC); g.fill(ix, iy - 1, ix + 1, iy + 2, (a / 2 << 24) | glowC); }
            }
        }
        g.drawString(font, "Drag to rotate - scroll to zoom", 6, previewH - 4, 0x99ffffff);
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        // an opaque studio: dark backdrop, a pool of coloured light behind the wings, a floor line
        Palette pal = cfg.palette();
        int glow = pal.glow & 0xffffff;
        g.fill(0, 0, width, height, 0xff07060b);
        g.fillGradient(4, 14, 4 + previewW, 8 + previewH, 0xff1b1422, 0xff060509);
        int cx = 4 + previewW / 2, cy = 14 + previewH * 45 / 100;
        int rings = 40;
        for (int i = rings; i >= 1; i--) {
            int rw = previewW * i / (rings * 2) , rh = previewH * i / (rings * 2);
            int a = 2;
            g.fill(Math.max(4, cx - rw), Math.max(14, cy - rh), Math.min(4 + previewW, cx + rw), Math.min(8 + previewH, cy + rh), (a << 24) | glow);
        }
        int floor = 8 + previewH - previewH / 7;
        g.fillGradient(4, floor, 4 + previewW, 8 + previewH, 0x30ffffff & ((0x30 << 24) | glow), 0x00000000);
        g.fill(4, floor, 4 + previewW, floor + 1, 0x50000000 | glow);
        // frame
        g.fill(3, 13, 5 + previewW, 14, 0xff3a2a44); g.fill(3, 8 + previewH, 5 + previewW, 9 + previewH, 0xff3a2a44);
        g.fill(3, 13, 4, 9 + previewH, 0xff3a2a44); g.fill(4 + previewW, 13, 5 + previewW, 9 + previewH, 0xff3a2a44);
        // control panel
        g.fillGradient(width - PANEL - 5, 0, width, height, 0xff17111d, 0xff0c0910);
        g.fill(width - PANEL - 5, 0, width - PANEL - 4, height, 0xff000000 | glow);
        g.fill(width - PANEL - 2, 14, width - 4, 15, 0x80000000 | (pal.accent & 0xffffff));
    }

    private void renderPreview(GuiGraphics g, float partialTick) {
        LocalPlayer player = minecraft.player;
        if (player == null) return;
        long now = System.nanoTime();
        float dt = Math.min(0.1f, (now - lastNanos) / 1e9f);
        lastNanos = now;
        time += dt;
        if (autoRotate && !dragging) yaw = baseYaw + 42 * (float) Math.sin(time * 0.55);
        Mode m = MODES[mode];
        bodyPitch += (m.bodyPitch - bodyPitch) * (1 - (float) Math.exp(-dt * 6));

        WingInput in = input;
        in.forward = in.up = in.strafe = in.yawRate = in.hurt = in.attack = 0;
        in.onGround = true;
        in.sneaking = in.sprinting = in.flying = in.gliding = in.swimming = in.sleeping = in.riding = in.inWater = false;
        m.input.accept(in);
        in.gravY = -Mth.cos(bodyPitch);
        in.gravZ = -Mth.sin(bodyPitch);
        animator.update(in, time, cfg.scale());

        // fit: the open wings span roughly 7.5 blocks at size 1
        float fit = Math.min(previewW / (7.6f * Math.max(1f, cfg.size)), previewH / 4.6f) * 1.5f * zoom;
        float cx = 4 + previewW / 2f, cyc = 12 + previewH * 0.56f;
        Quaternionf pose = new Quaternionf().rotateZ(Mth.PI).rotateX(pitch * Mth.DEG_TO_RAD - bodyPitch * 0.6f).rotateY(yaw * Mth.DEG_TO_RAD).rotateX(bodyPitch);
        // pivot around chest height instead of the feet
        Vector3f pivot = pose.transform(new Vector3f(0, 1.25f, 0)).negate();

        float bodyRot = player.yBodyRot, bodyRotO = player.yBodyRotO, yRot = player.getYRot(), yRotO = player.yRotO, xRot = player.getXRot(), xRotO = player.xRotO;
        float head = player.yHeadRot, headO = player.yHeadRotO;
        Pose oldPose = player.getPose();
        player.yBodyRot = player.yBodyRotO = 180;
        player.setYRot(180); player.yRotO = 180;
        player.setXRot(0); player.xRotO = 0;
        player.yHeadRot = player.yHeadRotO = 180;
        if (m.crouch) player.setPose(Pose.CROUCHING);
        else if (oldPose != Pose.STANDING) player.setPose(Pose.STANDING);
        WingsLayer.previewAnimator = animator;
        WingsLayer.previewConfig = cfg;
        g.enableScissor(4, 14, 4 + previewW, 8 + previewH);
        try {
            InventoryScreen.renderEntityInInventory(g, cx, cyc, fit, pivot, pose, null, player);
        } finally {
            g.disableScissor();
            WingsLayer.previewAnimator = null;
            WingsLayer.previewConfig = null;
            player.yBodyRot = bodyRot; player.yBodyRotO = bodyRotO;
            player.setYRot(yRot); player.yRotO = yRotO;
            player.setXRot(xRot); player.xRotO = xRotO;
            player.yHeadRot = head; player.yHeadRotO = headO;
            player.setPose(oldPose);
        }
    }

    private boolean inPreview(double x, double y) {
        return x >= 4 && x < 4 + previewW && y >= 14 && y < 8 + previewH;
    }

    @Override
    public boolean mouseClicked(double x, double y, int button) {
        if (super.mouseClicked(x, y, button)) return true;
        if (inPreview(x, y)) {
            dragging = true;
            return true;
        }
        return false;
    }

    @Override
    public boolean mouseReleased(double x, double y, int button) {
        dragging = false;
        return super.mouseReleased(x, y, button);
    }

    @Override
    public boolean mouseDragged(double x, double y, int button, double dx, double dy) {
        if (dragging) {
            baseYaw += (float) dx * 0.9f;
            yaw = baseYaw + (autoRotate ? 42 * (float) Math.sin(time * 0.55) : 0);
            pitch = Mth.clamp(pitch - (float) dy * 0.6f, -80, 80);
            return true;
        }
        return super.mouseDragged(x, y, button, dx, dy);
    }

    @Override
    public boolean mouseScrolled(double x, double y, double sx, double sy) {
        if (inPreview(x, y)) {
            zoom = Mth.clamp(zoom * (float) Math.pow(1.12, sy), 0.5f, 5f);
            return true;
        }
        return super.mouseScrolled(x, y, sx, sy);
    }

    @Override
    public void onClose() {
        ClientWings.commit();
        super.onClose();
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    /** A color scheme chip painted with the scheme's own gradient. */
    private final class Swatch extends AbstractButton {
        private final String id;

        Swatch(int x, int y, int w, int h, String id, String name) {
            super(x, y, w, h, Component.literal(name));
            this.id = id;
            setTooltip(Tooltip.create(Component.literal(name)));
        }

        @Override
        public void onPress() {
            cfg.scheme = id;
        }

        @Override
        protected void renderWidget(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
            Palette p = Palette.CUSTOM_ID.equals(id) ? Palette.custom(cfg.customMembrane, cfg.customBone, cfg.customGlow) : Palette.byId(id);
            int x0 = getX(), y0 = getY(), x1 = x0 + width, y1 = y0 + height;
            boolean selected = id.equals(cfg.scheme);
            g.fill(x0, y0, x1, y1, selected ? 0xffffffff : isHoveredOrFocused() ? 0xffb0b0b0 : 0xff000000);
            int mid = y0 + height / 2;
            g.fillGradient(x0 + 1, y0 + 1, x1 - 1, mid, 0xff000000 | p.outerHub, 0xff000000 | p.outerEdge);
            g.fillGradient(x0 + 1, mid, x1 - 1, y1 - 1, 0xff000000 | p.innerHub, 0xff000000 | p.innerEdge);
            g.fill(x0 + 1, y0 + 1, x0 + 4, y1 - 1, 0xff000000 | p.boneTip);
            g.fill(x1 - 6, mid - 2, x1 - 2, mid + 2, 0xff000000 | p.glow);
            g.fill(x1 - 6, y0 + 2, x1 - 2, y0 + 4, 0xff000000 | p.accent);
            String shortName = getMessage().getString().split(" ")[0];
            float sc = Math.min(0.75f, (width - 4f) / font.width(shortName));
            int stripe = Math.round(8 * sc) + 2;
            g.fill(x0 + 1, y1 - 1 - stripe, x1 - 1, y1 - 1, 0xd0100a14);
            g.pose().pushPose();
            g.pose().translate(x0 + width / 2f, y1 - stripe, 0);
            g.pose().scale(sc, sc, 1);
            g.drawCenteredString(font, shortName, 0, 0, 0xffffffff);
            g.pose().popPose();
            if (selected) g.renderOutline(x0 - 1, y0 - 1, width + 2, height + 2, 0xff000000 | p.glow);
        }

        @Override
        protected void updateWidgetNarration(NarrationElementOutput out) {
            defaultButtonNarrationText(out);
        }
    }

    /** A flat themed button: dark plum, outlined and lit in the current scheme's glow colour when on. */
    private class Flat extends Button {
        private final Supplier<Boolean> lit;

        Flat(int x, int y, int w, int h, Component text, OnPress press, Supplier<Boolean> lit) {
            super(x, y, w, h, text, press, DEFAULT_NARRATION);
            this.lit = lit;
        }

        @Override
        protected void renderWidget(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
            Palette p = cfg.palette();
            int glow = p.glow & 0xffffff, x0 = getX(), y0 = getY(), x1 = x0 + width, y1 = y0 + height;
            boolean on = lit.get(), hover = isHoveredOrFocused();
            g.fillGradient(x0, y0, x1, y1, on ? 0xff000000 | Palette.scale(glow, 0.42f) : 0xff241a2c, on ? 0xff000000 | Palette.scale(glow, 0.2f) : 0xff150f1b);
            g.fill(x0 + 1, y0 + 1, x1 - 1, y0 + 2, 0x28ffffff);
            g.renderOutline(x0, y0, width, height, hover ? 0xffffffff : on ? 0xff000000 | glow : 0xff4a3858);
            g.drawCenteredString(font, getMessage(), x0 + width / 2, y0 + (height - 8) / 2, !active ? 0xff777777 : on || hover ? 0xffffffff : 0xffcbb8d2);
        }
    }

    private final class ModeButton extends Flat {
        ModeButton(int x, int y, int w, int h, int index) {
            super(x, y, w, h, Component.literal(MODES[index].name), b -> mode = index, () -> mode == index);
        }
    }

    private static final class Slider extends AbstractSliderButton {
        private final Supplier<String> label;
        private final java.util.function.DoubleConsumer apply;
        java.util.function.Function<Float, Integer> track;

        Slider(int x, int y, int w, int h, Supplier<String> label, double value, java.util.function.DoubleConsumer apply) {
            super(x, y, w, h, Component.literal(label.get()), Mth.clamp(value, 0, 1));
            this.label = label;
            this.apply = apply;
        }

        @Override
        protected void updateMessage() {
            setMessage(Component.literal(label.get()));
        }

        @Override
        public void renderWidget(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
            int x0 = getX(), y0 = getY(), x1 = x0 + width, y1 = y0 + height;
            int glow = ClientWings.LOCAL.palette().glow & 0xffffff;
            g.fill(x0, y0, x1, y1, 0xff150f1b);
            if (track != null) {
                for (int px = x0 + 1; px < x1 - 1; px++)
                    g.fill(px, y0 + 2, px + 1, y1 - 2, 0xff000000 | track.apply((px - x0 - 1) / (float) (width - 3)));
                int tx = x0 + 1 + (int) Math.round((width - 3) * value);
                g.fill(tx - 1, y0, tx + 2, y1, 0xff000000);
                g.fill(tx, y0, tx + 1, y1, 0xffffffff);
                g.renderOutline(x0, y0, width, height, isHoveredOrFocused() ? 0xffffffff : 0xff4a3858);
                return;
            }
            int fx = x0 + 1 + (int) Math.round((width - 2) * value);
            if (active) g.fillGradient(x0 + 1, y0 + 1, fx, y1 - 1, 0xff000000 | Palette.scale(glow, 0.62f), 0xff000000 | Palette.scale(glow, 0.3f));
            g.fill(Math.max(x0 + 1, fx - 1), y0 + 1, Math.min(x1 - 1, fx + 1), y1 - 1, active ? 0xffffffff : 0xff555555);
            g.renderOutline(x0, y0, width, height, isHoveredOrFocused() && active ? 0xffffffff : 0xff4a3858);
            g.drawCenteredString(Minecraft.getInstance().font, getMessage(), x0 + width / 2, y0 + (height - 8) / 2, active ? 0xffffffff : 0xff777777);
        }

        @Override
        protected void applyValue() {
            apply.accept(value);
        }
    }
}
