package dev.dodus.succubuswings.tools;

import dev.dodus.succubuswings.core.Palette;
import dev.dodus.succubuswings.core.WingAnimator;
import dev.dodus.succubuswings.core.WingConfig;
import dev.dodus.succubuswings.core.WingGeometry;
import dev.dodus.succubuswings.core.WingInput;
import dev.dodus.succubuswings.core.WingMesh;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.function.BiConsumer;

/**
 * Renders the wings without Minecraft, using exactly the geometry and animation code the mod uses.
 * Usage: renderPreview -Pargs="outDir [what]" where what is all | hero | palettes | anim
 */
public final class PreviewRenderer {
    static BufferedImage albedo, glowTex;
    static File out;

    public static void main(String[] args) throws Exception {
        out = new File(args.length > 0 ? args[0] : "build/preview");
        out.mkdirs();
        String what = args.length > 1 ? args[1] : "all";
        BufferedImage[] tex = TextureGenerator.generate();
        albedo = tex[0];
        glowTex = tex[1];
        if (what.equals("lab")) { lab(args); return; }
        if (what.equals("all") || what.equals("hero")) hero();
        if (what.equals("all") || what.equals("palettes")) palettes();
        if (what.equals("all") || what.equals("anim")) anim();
        if (what.equals("video")) video(args);
    }

    // ---------------------------------------------------------------- scenes

    record State(String name, String label, float bodyPitch, float warm, float span, BiConsumer<WingInput, Float> script) { }

    static final State[] STATES = {
            new State("idle", "Standing idle (breathing, finger drift)", 0, 6.0f, 3.7f, (in, t) -> { }),
            new State("stretch", "Idle flourish: slow stretch and shiver", 0, 2f, 3.6f, (in, t) -> { }),
            new State("walk", "Walking", 0, 3, 1.2f, (in, t) -> in.forward = 4.3f),
            new State("sprint", "Sprinting", 0, 3, 1.0f, (in, t) -> { in.forward = 5.6f; in.sprinting = true; }),
            new State("sneak", "Sneaking (wings wrap around the body)", 0, 3, 1.5f, (in, t) -> in.sneaking = true),
            new State("jump", "Jump, fall and landing", 0, 2, 1.3f, (in, t) -> {
                float u = t - 2.15f;
                boolean air = u > 0 && u < 0.95f;
                in.onGround = !air;
                in.up = air ? 8.4f - 20f * u : 0;
            }),
            new State("hover", "Creative flight, hovering (one full flap)", 0, 4, 0.645f, (in, t) -> { in.flying = true; in.onGround = false; }),
            new State("fly", "Creative flight, flying forward fast", 0.35f, 4, 0.40f, (in, t) -> { in.flying = true; in.onGround = false; in.forward = 10.8f; in.sprinting = true; }),
            new State("glide", "Elytra gliding, banking", 1.35f, 4, 1.6f, (in, t) -> { in.gliding = true; in.onGround = false; in.forward = 22; in.yawRate = 45 * (float) Math.sin(t * 2.2f); }),
            new State("fall", "Falling (wings parachute, edges flutter)", 0, 2, 0.8f, (in, t) -> { in.onGround = false; in.up = -18; }),
            new State("swim", "Swimming (swept back along the body, sculling)", 1.45f, 3, 1.2f, (in, t) -> { in.swimming = true; in.inWater = true; in.onGround = false; in.forward = 3.5f; }),
            new State("hurt", "Taking damage (wings snap shut, tremble, release)", 0, 3, 1.5f, (in, t) -> in.hurt = t > 3.05f ? Math.max(0, 1 - (t - 3.05f) * 2) : 0),
            new State("attack", "Attacking (wind-up, both wings whip forward)", 0, 3, 0.9f, (in, t) -> in.attack = t > 3.05f && t < 3.35f ? (t - 3.05f) / 0.3f : 0),
    };

    static State state(String n) {
        for (State s : STATES) if (s.name.equals(n)) return s;
        throw new IllegalArgumentException(n);
    }

    /** Simulates a state and hands every requested frame to the callback. */
    static WingAnimator simulate(State s, float until) {
        WingAnimator an = new WingAnimator(7);
        WingInput in = new WingInput();
        float dt = 1 / 120f;
        boolean fired = false;
        for (float t = 0; t <= until + 1e-4f; t += dt) {
            WingInput fresh = new WingInput();
            s.script.accept(fresh, t);
            if (s.name.equals("stretch") && !fired && t >= s.warm) { an.triggerEvent(1); fired = true; }
            an.update(fresh, t, 1f);
        }
        return an;
    }

    static BufferedImage render(WingAnimator an, WingConfig cfg, float bodyPitch, int w, int h, float yaw, float pitch, float dist, float tx, float ty, float fov) {
        Raster r = new Raster(w, h, 2);
        r.albedo = albedo;
        r.glowTex = glowTex;
        r.clear(0x23202b, 0x0b0a0f);
        r.camera(yaw, pitch, dist, tx, ty, 0, fov);
        r.bodyPitch = bodyPitch;
        WingMesh mesh = new WingMesh();
        WingGeometry geo = new WingGeometry();
        Palette pal = cfg.palette();
        for (int s = 0; s < 2; s++)
            geo.build(an.skeleton[s], an.pose[s], cfg, pal, s == 0 ? 1 : -1, an.chain[s], WingAnimator.CHAIN_POINTS, mesh);
        if (cfg.tail) geo.buildTail(an.tail, WingAnimator.TAIL_POINTS, cfg, pal, 1f, mesh);
        WingMesh body = new WingMesh();
        body(body.solid);
        Raster.class.getClass();
        var keepAlbedo = r.albedo;
        r.albedo = null;
        r.draw(body.solid, 0);
        r.albedo = keepAlbedo;
        r.draw(mesh.solid, 0);
        r.draw(mesh.membrane, 1);
        r.draw(mesh.glow, 2);
        return r.resolve();
    }

    /** A plain mannequin with Minecraft player proportions; origin between the shoulder blades. */
    static void body(WingMesh.Layer l) {
        int skin = 0x8d7f86, cloth = 0x3a3440, legs = 0x2b2731;
        box(l, -0.25f, 0.2f, -0.375f, 0.25f, 0.7f, 0.125f, skin);      // head
        box(l, -0.25f, -0.55f, -0.25f, 0.25f, 0.2f, 0f, cloth);        // torso
        box(l, 0.25f, -0.55f, -0.25f, 0.5f, 0.2f, 0f, skin);           // arms
        box(l, -0.5f, -0.55f, -0.25f, -0.25f, 0.2f, 0f, skin);
        box(l, 0f, -1.3f, -0.25f, 0.25f, -0.55f, 0f, legs);            // legs
        box(l, -0.25f, -1.3f, -0.25f, 0f, -0.55f, 0f, legs);
    }

    static void box(WingMesh.Layer l, float x0, float y0, float z0, float x1, float y1, float z1, int rgb) {
        float r = ((rgb >> 16) & 255) / 255f, g = ((rgb >> 8) & 255) / 255f, b = (rgb & 255) / 255f;
        float[][] f = {
                {x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1}, {x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1},
                {x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0}, {x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0},
                {x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0}, {x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0}};
        for (float[] q : f)
            for (int v = 0; v < 4; v++) put(l, q[v * 3], q[v * 3 + 1], q[v * 3 + 2], q[12], q[13], q[14], r, g, b);
    }

    static void put(WingMesh.Layer l, float x, float y, float z, float nx, float ny, float nz, float r, float g, float b) {
        int i = l.vertices * WingMesh.STRIDE;
        if (i + WingMesh.STRIDE > l.data.length) l.data = java.util.Arrays.copyOf(l.data, l.data.length * 2);
        float[] d = l.data;
        d[i] = x; d[i + 1] = y; d[i + 2] = z; d[i + 3] = nx; d[i + 4] = ny; d[i + 5] = nz; d[i + 6] = -1; d[i + 7] = -1;
        d[i + 8] = r; d[i + 9] = g; d[i + 10] = b; d[i + 11] = 1;
        l.vertices++;
    }

    static WingConfig cfg(String scheme) {
        WingConfig c = new WingConfig();
        c.enabled = true;
        c.scheme = scheme;
        return c;
    }

    static void hero() throws Exception {
        WingConfig c = cfg(Palette.PRESETS.get(0).id);
        State hover = state("hover");
        // top of the upstroke: fully open
        WingAnimator open = simulate(hover, 4.0f + 0.60f);
        save(label(render(open, c, 0, 1600, 1000, 0, 8, 6.4f, 0, 0.35f, 40), "Hovering, wings open - back view"), "hero_back.png");
        save(label(render(open, c, 0, 1600, 1000, 38, 14, 6.4f, -0.9f, 0.35f, 40), "Hovering - three-quarter back view"), "hero_34.png");
        save(label(render(open, c, 0, 1600, 1000, 180, 6, 6.4f, 0, 0.35f, 40), "Hovering - front view (inner membrane)"), "hero_front.png");
        save(label(render(open, c, 0, 1600, 1000, 90, 5, 6.0f, 0, 0.3f, 40), "Hovering - side view"), "hero_side.png");
        save(label(render(open, c, 0, 1600, 1000, 0, 80, 6.6f, 0, 0.0f, 40), "Hovering - top view"), "hero_top.png");
        save(label(render(open, c, 0, 1600, 1000, 14, 10, 2.3f, 1.25f, 0.75f, 40), "Close-up: wrist, thumb talon, jewelry, membrane"), "detail_wrist.png");
        save(label(render(open, c, 0, 1600, 1000, 6, 4, 2.8f, 0.95f, -0.1f, 40), "Close-up: trailing edge, veins, finger claws"), "detail_edge.png");
        WingAnimator idle = simulate(state("idle"), 4.0f);
        save(label(render(idle, c, 0, 1600, 1000, 0, 8, 4.6f, 0, -0.2f, 40), "Standing idle, wings folded - back view"), "idle_back.png");
        save(label(render(idle, c, 0, 1600, 1000, 55, 12, 4.6f, 0, -0.2f, 40), "Standing idle - three-quarter view"), "idle_34.png");
        save(label(render(idle, c, 0, 1600, 1000, 180, 6, 4.6f, 0, -0.2f, 40), "Standing idle - front view"), "idle_front.png");
    }

    static void palettes() throws Exception {
        WingAnimator open = simulate(state("hover"), 4.0f + 0.60f);
        int cols = 5, n = Palette.PRESETS.size(), rows = (n + cols - 1) / cols, cw = 640, ch = 420;
        BufferedImage sheet = new BufferedImage(cols * cw, rows * ch, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = sheet.createGraphics();
        for (int i = 0; i < n; i++) {
            Palette p = Palette.PRESETS.get(i);
            BufferedImage img = label(render(open, cfg(p.id), 0, cw, ch, 0, 8, 5.4f, 0, 0.1f, 40), p.name);
            g.drawImage(img, (i % cols) * cw, (i / cols) * ch, null);
        }
        g.dispose();
        save(sheet, "palettes.png");
    }

    static void anim() throws Exception {
        WingConfig c = cfg(Palette.PRESETS.get(0).id);
        for (State s : STATES) {
            int frames = 8, cw = 560, ch = 400;
            BufferedImage sheet = new BufferedImage(4 * cw, 2 * ch * 2 + 40, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = sheet.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setColor(Color.WHITE);
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 22));
            g.drawString(s.label + "  -  8 consecutive frames over " + String.format("%.2f", s.span) + " s; top: back view, bottom: three-quarter view", 12, 28);
            for (int f = 0; f < frames; f++) {
                float t = s.warm + s.span * f / frames;
                WingAnimator an = simulate(s, t);
                String tag = String.format("t = %.2fs", s.span * f / frames);
                boolean prone = Math.abs(s.bodyPitch) > 0.5f;
                boolean folded = java.util.Set.of("idle", "walk", "sprint", "sneak", "hurt", "attack").contains(s.name);
                float dist = folded ? 4.7f : prone ? 7.6f : 6.6f, p0 = prone ? 80 : 10, p1 = prone ? 40 : 16, ty = folded ? 0.1f : 0.2f;
                g.drawImage(label(render(an, c, s.bodyPitch, cw, ch, 0, p0, dist, 0, ty, 40), tag), (f % 4) * cw, 40 + (f / 4) * ch, null);
                g.drawImage(label(render(an, c, s.bodyPitch, cw, ch, 50, p1, dist, 0, ty, 40), tag), (f % 4) * cw, 40 + (2 + f / 4) * ch, null);
            }
            g.dispose();
            save(sheet, "anim_" + s.name + ".png");
        }
    }

    /** video [state...] : 30 fps frames of every state (back view and three-quarter view side by side) under video/<state>/. */
    static void video(String[] a) throws Exception {
        WingConfig c = cfg(Palette.PRESETS.get(0).id);
        java.util.Set<String> only = new java.util.HashSet<>(java.util.Arrays.asList(a).subList(2, a.length));
        for (State s : STATES) {
            if (!only.isEmpty() && !only.contains(s.name)) continue;
            File dir = new File(out, "video/" + s.name);
            dir.mkdirs();
            WingAnimator an = new WingAnimator(7);
            if (s.name.equals("stretch")) an.idleEvents = false;
            boolean prone = Math.abs(s.bodyPitch) > 0.5f, fired = false;
            float dt = 1 / 120f, len = Math.max(4f, Math.min(6f, s.span * 2.5f)), start = Math.max(0, s.warm - 0.6f);
            int cw = 640, ch = 480, n = 0;
            for (int i = 0; i * dt <= start + len; i++) {
                float t = i * dt;
                WingInput in = new WingInput();
                // loop one-shot scripts so the reaction is seen more than once
                float ts = s.name.equals("jump") || s.name.equals("hurt") || s.name.equals("attack") ? (t < s.warm - 1 ? t : s.warm - 1 + (t - s.warm + 1) % 2f) : t;
                s.script.accept(in, ts);
                if (s.name.equals("stretch") && !fired && t >= s.warm) { an.triggerEvent(1); fired = true; }
                an.update(in, t, 1f);
                if (t < start || i % 4 != 0) continue;
                float dist = prone ? 6.8f : (s.name.equals("idle") || s.name.equals("walk") || s.name.equals("sneak") || s.name.equals("hurt")) ? 4.4f : 5.6f;
                BufferedImage f = new BufferedImage(cw * 2, ch, BufferedImage.TYPE_INT_RGB);
                Graphics2D g = f.createGraphics();
                g.drawImage(render(an, c, s.bodyPitch, cw, ch, 0, prone ? 80 : 10, dist, 0, 0.1f, 40), 0, 0, null);
                g.drawImage(render(an, c, s.bodyPitch, cw, ch, 50, prone ? 40 : 16, dist, 0, 0.1f, 40), cw, 0, null);
                g.dispose();
                ImageIO.write(label(f, s.label), "png", new File(dir, String.format("%04d.png", n++)));
            }
            System.out.println("wrote video/" + s.name + " (" + n + " frames)");
        }
    }

    /** lab <state> <stateIndex> <tag> spread sweep raise twist curl : quick three-view contact strip for tuning a base pose. */
    static void lab(String[] a) throws Exception {
        State s = state(a[2]);
        int idx = Integer.parseInt(a[3]);
        if (a.length > 9) {
            WingAnimator.P_SPREAD[idx] = Float.parseFloat(a[5]); WingAnimator.P_SWEEP[idx] = Float.parseFloat(a[6]);
            WingAnimator.P_RAISE[idx] = Float.parseFloat(a[7]); WingAnimator.P_TWIST[idx] = Float.parseFloat(a[8]); WingAnimator.P_CURL[idx] = Float.parseFloat(a[9]);
        }
        WingConfig c = cfg(Palette.PRESETS.get(0).id);
        int cw = 520, ch = 420;
        BufferedImage sheet = new BufferedImage(4 * cw, 2 * ch, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = sheet.createGraphics();
        boolean prone = Math.abs(s.bodyPitch) > 0.5f;
        for (int k = 0; k < 2; k++) {
            WingAnimator an = simulate(s, s.warm + s.span * (0.15f + 0.5f * k));
            float[][] v = {{0, prone ? 62 : 10}, {50, prone ? 40 : 16}, {90, 5}, {180, prone ? -50 : 8}};
            for (int i = 0; i < 4; i++)
                g.drawImage(render(an, c, s.bodyPitch, cw, ch, v[i][0], v[i][1], 6.2f, 0, 0.1f, 40), i * cw, k * ch, null);
        }
        g.dispose();
        save(sheet, "lab_" + a[4] + ".png");
    }

    static BufferedImage label(BufferedImage img, String text) {
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, Math.max(13, img.getHeight() / 34)));
        g.setColor(new Color(255, 255, 255, 215));
        g.drawString(text, 12, img.getHeight() - 12);
        g.dispose();
        return img;
    }

    static void save(BufferedImage img, String name) throws Exception {
        ImageIO.write(img, "png", new File(out, name));
        System.out.println("wrote " + name);
    }
}
