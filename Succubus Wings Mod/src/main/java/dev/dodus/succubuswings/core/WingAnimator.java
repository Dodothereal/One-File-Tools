package dev.dodus.succubuswings.core;

/**
 * Procedural, physically flavoured wing animation. Call {@link #update} once per rendered frame
 * with the wearer's current state and a monotonically increasing time in seconds; then read the
 * two poses. State blending, a flap cycle with tip lag, spring driven follow-through, idle life
 * (breathing, stretches, flutters, twitches) and a verlet pendant chain all live here.
 */
public final class WingAnimator {
    public static final int RIGHT = 0, LEFT = 1;
    public static final int CHAIN_POINTS = 7;
    private static final float D = (float) (Math.PI / 180.0);

    // state indices
    private static final int IDLE = 0, WALK = 1, SPRINT = 2, SNEAK = 3, HOVER = 4, FLY = 5, GLIDE = 6, FALL = 7, RISE = 8, SWIM = 9, SLEEP = 10, RIDE = 11, STATES = 12;
    //                                         idle   walk   sprint sneak  hover  fly    glide  fall   rise   swim   sleep  ride
    public static final float[] P_SPREAD = {0.30f, 0.27f, 0.40f, 0.50f, 0.96f, 1.00f, 1.00f, 0.86f, 0.52f, 0.86f, 0.10f, 0.22f};
    public static final float[] P_SWEEP = {30, 35, 30, -50, 16, 26, 12, 36, 48, 20, 8, 38};
    public static final float[] P_RAISE = {0, -2, 10, 0, 9, 5, -15, 24, -14, -12, -4, -3};
    public static final float[] P_TWIST = {0, 2, 6, 0, -4, 6, 0, -10, 10, 4, 0, 2};
    public static final float[] P_CURL = {12, 15, 10, 45, 13, 12, 15, -16, 22, 12, -30, 14};

    public final WingPose[] pose = {new WingPose(), new WingPose()};
    public final WingSkeleton[] skeleton = {new WingSkeleton(), new WingSkeleton()};
    /** Pendant chain points per side, in body space on the real side. */
    public final float[][] chain = new float[2][CHAIN_POINTS * 3];
    private final float[][] chainPrev = new float[2][CHAIN_POINTS * 3];
    private boolean chainInit;

    /** Set for one update when a strong downstroke starts (for particles / sound). */
    public boolean flapPulse;
    /** 0..1 how strongly the wings are flapping right now. */
    public float flapStrength;

    private final float[] weight = new float[STATES];
    private final int seed;
    private double lastTime = Double.NaN;
    private float flapPhase, ripplePhase, pulse;
    private float airTime, groundTime, idleTime;
    private boolean wasOnGround = true, wasFlying;
    private float lastUp, lastForward, lastHurt, lastAttack;
    private float smForward, smUp, smStrafe, smYaw;

    // second-order followers for the main joints, per side
    private final float[] spread = new float[2], spreadV = new float[2];
    private final float[] sweep = new float[2], sweepV = new float[2];
    private final float[] raise = new float[2], raiseV = new float[2];
    private final float[] curl = new float[2], curlV = new float[2];
    // inertial offsets (springs that are only ever kicked)
    private final float[] lagSweep = new float[2], lagSweepV = new float[2];
    private final float[] lagRaise = new float[2], lagRaiseV = new float[2];
    private final float[] lagCurl = new float[2], lagCurlV = new float[2];
    private boolean first = true;
    // every finger trails the wing root with its own spring (outer fingers are looser)
    private final float[][] fLag = new float[2][WingPose.FINGERS], fLagV = new float[2][WingPose.FINGERS];
    /** Idle flourishes (stretch, flutter, twitch, shudder) happen on their own when true. */
    public boolean idleEvents = true;

    public static final int TAIL_POINTS = 18;
    /** Tail spine in body space (not mirrored), from the hips to the base of the spade. */
    public final float[] tail = new float[TAIL_POINTS * 3];
    private float tailYaw, tailYawV, tailLift, tailLiftV, tailPhase;

    // idle events
    private static final int EV_NONE = 0, EV_STRETCH = 1, EV_FLUTTER = 2, EV_TWITCH = 3, EV_SHUDDER = 4, EV_FLINCH = 5, EV_LAUNCH = 6;
    private int event = EV_NONE, eventSide, eventCount;
    private float eventT, eventDur, nextEvent = 3.5f;
    private int forcedEvent = EV_NONE;

    public WingAnimator(int seed) {
        this.seed = seed;
        weight[IDLE] = 1;
        nextEvent = 2.5f + Noise.hash(1, seed) * 5f;
    }

    /** Lets the preview screen show off an idle flourish on demand: 1 stretch, 2 flutter, 3 twitch, 4 shudder. */
    public void triggerEvent(int type) {
        forcedEvent = type;
    }

    public void update(WingInput in, double time, float size) {
        float dt = Double.isNaN(lastTime) ? 0.016f : (float) (time - lastTime);
        lastTime = time;
        if (dt <= 0) { computeSkeletons(size); return; }
        if (dt > 0.25f) dt = 0.25f;

        float k = 1 - (float) Math.exp(-dt * 10);
        smForward += (in.forward - smForward) * k;
        smUp += (in.up - smUp) * k;
        smStrafe += (in.strafe - smStrafe) * k;
        smYaw += (in.yawRate - smYaw) * k;
        float hSpeed = (float) Math.sqrt(smForward * smForward + smStrafe * smStrafe);
        float accF = (in.forward - lastForward) / Math.max(dt, 0.01f);
        float accU = (in.up - lastUp) / Math.max(dt, 0.01f);
        lastForward = in.forward;
        lastUp = in.up;

        // ---- which state are we in ----
        boolean airborne = !in.onGround && !in.flying && !in.gliding && !in.swimming && !in.sleeping && !in.riding && !in.inWater;
        airTime = airborne ? airTime + dt : 0;
        groundTime = in.onGround ? groundTime + dt : 0;
        float[] target = new float[STATES];
        if (in.sleeping) target[SLEEP] = 1;
        else if (in.gliding) target[GLIDE] = 1;
        else if (in.swimming || (in.inWater && !in.onGround)) target[SWIM] = 1;
        else if (in.flying) {
            float f = clamp01((hSpeed - 2.5f) / 6f);
            target[FLY] = f;
            target[HOVER] = 1 - f;
        } else if (in.riding) target[RIDE] = 1;
        else if (airborne && airTime > 0.08f) {
            float air = clamp01((airTime - 0.08f) / 0.3f);
            float rising = clamp01(in.up / 4f + 0.5f);
            target[RISE] = air * rising;
            target[FALL] = air * (1 - rising);
            target[IDLE] = 1 - air;
        } else if (in.sneaking) target[SNEAK] = 1;
        else {
            float move = clamp01(hSpeed / 4.3f);
            if (in.sprinting) {
                target[SPRINT] = move;
                target[IDLE] = 1 - move;
            } else {
                target[WALK] = move;
                target[IDLE] = 1 - move;
            }
        }
        float rate = 1 - (float) Math.exp(-dt * 7.5f);
        float sum = 0;
        for (int i = 0; i < STATES; i++) {
            weight[i] += (target[i] - weight[i]) * rate;
            sum += weight[i];
        }
        for (int i = 0; i < STATES; i++) weight[i] /= sum;

        float bSpread = 0, bSweep = 0, bRaise = 0, bTwist = 0, bCurl = 0;
        for (int i = 0; i < STATES; i++) {
            bSpread += weight[i] * P_SPREAD[i];
            bSweep += weight[i] * P_SWEEP[i] * D;
            bRaise += weight[i] * P_RAISE[i] * D;
            bTwist += weight[i] * P_TWIST[i] * D;
            bCurl += weight[i] * P_CURL[i] * D;
        }
        float t = (float) time;

        // ---- transitions that kick the springs ----
        if (in.onGround && !wasOnGround && lastAir > 0.25f) {
            float hit = clamp01(-landV / 14f + 0.25f);
            for (int s = 0; s < 2; s++) {
                lagRaiseV[s] -= 5.5f * hit;
                spreadV[s] += 3.2f * hit;
                lagCurlV[s] += 4.0f * hit;
            }
        }
        if (!in.onGround && wasOnGround && in.up > 2.5f && !in.flying) {
            // jump: a quick push-off stroke
            for (int s = 0; s < 2; s++) {
                lagSweepV[s] -= 3.0f;
                spreadV[s] += 4.5f;
                lagRaiseV[s] += 2.0f;
            }
        }
        if (in.flying && !wasFlying) startEvent(EV_LAUNCH, 0.9f, 0);
        if (in.hurt > 0.5f && lastHurt <= 0.5f) startEvent(EV_FLINCH, 1.0f, 0);
        if (in.attack > 0.02f && lastAttack <= 0.02f) {
            lagSweepV[RIGHT] -= 9.5f; lagSweepV[LEFT] -= 3.2f;
            spreadV[RIGHT] += 7.5f; spreadV[LEFT] += 2.6f; lagRaiseV[RIGHT] += 3.5f;
            lagCurlV[RIGHT] -= 7f; lagCurlV[LEFT] -= 2f;
        }
        if (!in.onGround) { lastAir = airTime; landV = in.up; }
        wasOnGround = in.onGround;
        wasFlying = in.flying;
        lastHurt = in.hurt;
        lastAttack = in.attack;

        // ---- flap cycle ----
        float flapAmp = weight[HOVER] + weight[FLY] * 0.82f + weight[GLIDE] * 0.0f;
        float climb = clamp(smUp / 6f, -1, 1);
        float flapHz = 1.55f * weight[HOVER] + (2.0f + 0.05f * hSpeed) * weight[FLY] + 1.1f * (1 - weight[HOVER] - weight[FLY]);
        flapHz *= 1 + 0.28f * Math.max(0, climb);
        flapAmp *= 1 + 0.3f * climb;
        if (weight[FLY] > 0.3f && climb < -0.45f) flapAmp *= 0.35f; // diving: hold the wings and glide
        float prevPhase = flapPhase;
        flapPhase += dt * flapHz * (float) (2 * Math.PI);
        if (flapPhase > 2 * Math.PI) flapPhase -= (float) (2 * Math.PI);
        // warp so the downstroke takes ~42% of the cycle
        float ph = warp(flapPhase);
        float stroke = (float) Math.cos(ph);          // +1 top (back/up), -1 bottom (forward/down)
        float vel = -(float) Math.sin(ph);            // <0 during the downstroke
        if (flapAmp > 0.25f && prevPhase > flapPhase) flapPulse = true;
        flapStrength = clamp01(flapAmp);

        // ---- idle life ----
        boolean calm = weight[IDLE] + weight[WALK] * 0.6f + weight[RIDE] > 0.85f;
        idleTime = calm ? idleTime + dt : 0;
        if (event == EV_NONE) {
            if (forcedEvent != EV_NONE) {
                beginIdleEvent(forcedEvent);
                forcedEvent = EV_NONE;
            } else if (calm && idleEvents) {
                nextEvent -= dt;
                if (nextEvent <= 0) {
                    eventCount++;
                    float r = Noise.hash(eventCount * 3 + 1, seed);
                    beginIdleEvent(r < 0.28f ? EV_STRETCH : r < 0.55f ? EV_FLUTTER : r < 0.8f ? EV_TWITCH : EV_SHUDDER);
                    nextEvent = 5f + Noise.hash(eventCount * 3 + 2, seed) * 8f;
                }
            }
        }
        float evSpread = 0, evRaise = 0, evTwist = 0, evCurl = 0, evFan = 0, evShiver = 0, evGlow = 0;
        float[] evSweep = {0, 0};
        float[][] evFlex = new float[2][WingPose.FINGERS];
        if (event != EV_NONE) {
            eventT += dt;
            float u = eventT / eventDur;
            if (u >= 1) event = EV_NONE;
            else switch (event) {
                case EV_STRETCH -> {
                    float env = smooth(clamp01(u / 0.38f)) * (1 - smooth(clamp01((u - 0.68f) / 0.32f)));
                    evSpread = 0.62f * env;
                    evRaise = 13 * D * env;
                    evSweep[0] = evSweep[1] = -13 * D * env;
                    evFan = 0.07f * env;
                    evCurl = -10 * D * env;
                    float peak = bump(u, 0.55f, 0.13f);
                    evShiver = peak;
                    evGlow = 0.6f * env;
                }
                case EV_FLUTTER -> {
                    float env = (float) Math.sin(Math.PI * u);
                    float osc = (float) Math.sin(u * eventDur * 2 * Math.PI * 4.6f);
                    evSweep[0] = evSweep[1] = 9 * D * env * osc;
                    evSpread = 0.10f * env + 0.05f * env * osc;
                    evCurl = 9 * D * env * (float) Math.sin(u * eventDur * 2 * Math.PI * 4.6f - 1.2f);
                }
                case EV_TWITCH -> {
                    float env = (float) Math.exp(-u * 4.5f) * (float) Math.sin(u * Math.PI * 5.5f);
                    evSweep[eventSide] = 11 * D * env;
                    for (int f = 0; f < WingPose.FINGERS; f++) evFlex[eventSide][f] = (f - 2) * 2.4f * D * env;
                }
                case EV_SHUDDER -> {
                    for (int s = 0; s < 2; s++)
                        for (int f = 0; f < WingPose.FINGERS; f++) {
                            float lu = u * 1.6f - f * 0.11f - s * 0.05f;
                            float env = lu > 0 && lu < 1 ? (float) Math.sin(Math.PI * lu) : 0;
                            evFlex[s][f] = 6.5f * D * env * (float) Math.sin(lu * 2 * Math.PI * 2.5f);
                        }
                    evSpread = 0.05f * (float) Math.sin(Math.PI * u);
                }
                case EV_FLINCH -> {
                    float env = (float) Math.exp(-u * 3.2f) * clamp01(u / 0.08f);
                    float snap = (float) Math.exp(-u * 9f) * clamp01(u / 0.05f);
                    evSpread = 0.55f * snap - 0.5f * bSpread * (env - snap) + 0.10f * env;
                    evCurl = -42 * D * env;
                    evRaise = 16 * D * snap - 9 * D * (env - snap);
                    evSweep[0] = -24 * D * env; evSweep[1] = -13 * D * env;
                    evTwist = 12 * D * env * (float) Math.sin(u * 22f);
                    evShiver = env * 1.6f;
                }
                case EV_LAUNCH -> {
                    float env = (float) Math.sin(Math.PI * Math.min(1, u * 1.15f));
                    evRaise = 20 * D * env * (1 - u);
                    evSweep[0] = evSweep[1] = (u < 0.35f ? 22 : -16) * D * env;
                    evGlow = 0.8f * env;
                }
                default -> { }
            }
        }

        float breathe = (float) Math.sin(t * 2 * Math.PI * 0.27f + seed);
        float swimSway = weight[SWIM] * (float) Math.sin(t * 2 * Math.PI * 0.8f);
        float calmW = weight[IDLE] + weight[WALK] + weight[SNEAK] + weight[RIDE] + weight[SLEEP];
        float weak = clamp01((0.35f - in.health) / 0.25f);
        float shiver = evShiver * (float) Math.sin(t * 2 * Math.PI * 12.5f) + weak * 0.5f * (float) Math.sin(t * 2 * Math.PI * 9.3f);
        float walkBob = (weight[WALK] * 0.8f + weight[SPRINT]) * (float) Math.sin(t * 2 * Math.PI * (1.7f + 0.25f * hSpeed));

        // ---- integrate springs ----
        int steps = Math.max(1, (int) Math.ceil(dt / 0.008f));
        float h = dt / steps;
        for (int s = 0; s < 2; s++) {
            float sideSign = s == RIGHT ? 1 : -1;
            float tSpread = clamp01(bSpread + calmW * 0.085f * breathe + weight[SWIM] * 0.22f * (float) Math.sin(t * 2 * Math.PI * 0.8f - 1.1f) + evSpread - weak * 0.05f
                    + weight[FALL] * 0.07f * (float) Math.sin(t * 2 * Math.PI * 1.15f + s * 2.1f));
            float tSweep = bSweep + calmW * 5.5f * D * Noise.smooth(t * 0.33f + s * 17, seed) - calmW * 3.5f * D * breathe + swimSway * 16 * D + evSweep[s]
                    + weight[FALL] * 9 * D * (float) Math.sin(t * 2 * Math.PI * 1.45f + s * 1.7f) + weight[SNEAK] * 5 * D * (float) Math.sin(t * 2 * Math.PI * 0.45f + s * 2.4f);
            float tRaise = bRaise + calmW * 4.5f * D * breathe + evRaise - weak * 7 * D + smStrafe * sideSign * 1.1f * D * (1 - flapAmp * 0.5f)
                    + weight[FALL] * 8 * D * (float) Math.sin(t * 2 * Math.PI * 1.9f + s * 2.6f) + weight[GLIDE] * 3.5f * D * (float) Math.sin(t * 2 * Math.PI * 0.6f + s * 1.3f);
            float tCurl = bCurl + evCurl + calmW * 7 * D * Noise.smooth(t * 0.41f + s * 5 + 40, seed) + swimSway * 14 * D;
            if (first) { spread[s] = tSpread; sweep[s] = tSweep; raise[s] = tRaise; curl[s] = tCurl; }
            // drive of the inertial springs: air drag from the body's motion
            float driveSweep = (-accF * 0.012f) + sideSign * smYaw * D * 0.035f * 60f * 0.02f;
            float driveRaise = -accU * 0.010f;
            for (int i = 0; i < steps; i++) {
                spreadV[s] += (95f * (tSpread - spread[s]) - 11.5f * spreadV[s]) * h;
                spread[s] += spreadV[s] * h;
                sweepV[s] += (85f * (tSweep - sweep[s]) - 10.5f * sweepV[s]) * h;
                sweep[s] += sweepV[s] * h;
                raiseV[s] += (85f * (tRaise - raise[s]) - 10.5f * raiseV[s]) * h;
                raise[s] += raiseV[s] * h;
                curlV[s] += (70f * (tCurl - curl[s]) - 8.5f * curlV[s]) * h;
                curl[s] += curlV[s] * h;
                lagSweepV[s] += (-60f * lagSweep[s] - 6.2f * lagSweepV[s] + driveSweep * 60f) * h;
                lagSweep[s] += lagSweepV[s] * h;
                lagRaiseV[s] += (-64f * lagRaise[s] - 6.0f * lagRaiseV[s] + driveRaise * 64f) * h;
                lagRaise[s] += lagRaiseV[s] * h;
                // finger tips trail behind whatever the wing root does
                float rootMotion = sweepV[s] + lagSweepV[s];
                lagCurlV[s] += (-48f * lagCurl[s] - 5.2f * lagCurlV[s] - rootMotion * 9.5f) * h;
                lagCurl[s] += lagCurlV[s] * h;
                float rootAll = rootMotion + raiseV[s] * 0.8f + spreadV[s] * 0.9f;
                for (int f = 0; f < WingPose.FINGERS; f++) {
                    fLagV[s][f] += (-(58f - 7f * f) * fLag[s][f] - (4.6f - 0.3f * f) * fLagV[s][f] - rootAll * (5.5f + 2.2f * f)) * h;
                    fLag[s][f] += fLagV[s][f] * h;
                }
            }
            for (int f = 0; f < WingPose.FINGERS; f++) fLag[s][f] = clamp(fLag[s][f], -0.8f, 0.8f);
            lagSweep[s] = clamp(lagSweep[s], -0.7f, 0.7f);
            lagRaise[s] = clamp(lagRaise[s], -0.6f, 0.6f);
            lagCurl[s] = clamp(lagCurl[s], -0.9f, 0.9f);

            WingPose p = pose[s];
            float upFold = Math.max(0, -vel);
            float bank = clamp(smYaw / 90f, -1, 1) * sideSign;
            p.spread = clamp01(spread[s] - flapAmp * 0.30f * (float) Math.pow(Math.max(0, vel), 1.3) + flapAmp * 0.04f * upFold
                    - weight[GLIDE] * 0.22f * Math.max(0, bank));
            p.sweep = sweep[s] + lagSweep[s] + flapAmp * 31 * D * stroke + weight[GLIDE] * (3 * D * Noise.smooth(t * 0.5f + s * 9, seed) + 16 * D * bank)
                    + walkBob * 6.5f * D + clamp(hSpeed, 0, 12) * 0.9f * D * (1 - flapAmp) * (1 - weight[GLIDE]);
            p.raise = raise[s] + lagRaise[s] + flapAmp * 17 * D * (float) Math.cos(ph - 0.45f) + walkBob * sideSign * 3.0f * D + Math.abs(walkBob) * 4.0f * D * (weight[WALK] + weight[SPRINT]) + shiver * 1.4f * D
                    + weight[GLIDE] * 16 * D * bank;
            p.twist = bTwist + evTwist + weight[GLIDE] * 15 * D * bank + weight[FALL] * 5 * D * (float) Math.sin(t * 2 * Math.PI * 1.3f + s * 2.9f) + flapAmp * 20 * D * (float) Math.sin(ph) + shiver * 1.2f * D - lagSweep[s] * 0.25f;
            p.armBend = flapAmp * 13 * D * (float) Math.sin(ph - 0.35f) + lagCurl[s] * 0.25f;
            p.curl = curl[s] + lagCurl[s] * 0.75f + flapAmp * 40 * D * (float) Math.sin(ph - 0.75f);
            p.curlTip = (weight[WALK] + weight[SPRINT]) * 13 * D * (float) Math.sin(t * 2 * Math.PI * (1.7f + 0.25f * hSpeed) - 1.3f) + swimSway * 10 * D + flapAmp * 42 * D * (float) Math.sin(ph - 1.35f) + lagCurl[s] * 0.9f + weight[GLIDE] * (20 + 9 * (float) Math.sin(t * 2 * Math.PI * 0.7f + s * 1.9f) + 14 * Math.max(0, -bank)) * D + shiver * 3 * D
                    + weight[FALL] * -14 * D * (1 + 0.6f * (float) Math.sin(t * 2 * Math.PI * 2.3f + s));
            p.fan = evFan + calmW * 0.035f * breathe + flapAmp * 0.05f * upFold;
            for (int f = 0; f < WingPose.FINGERS; f++) {
                float slow = Noise.smooth(t * 0.37f + f * 13.7f + s * 71.3f, seed);
                float quick = Noise.smooth(t * 1.9f + f * 3.1f + s * 11.9f, seed + 7);
                p.fingerFlex[f] = (calmW * (8.5f * slow + 2.2f * quick) + shiver * (f % 2 == 0 ? 1.6f : -1.6f)) * D + evFlex[s][f]
                        + (weight[GLIDE] * 6f + weight[FALL] * 11f) * D * quick + fLag[s][f] * 0.35f + walkBob * (f - 2) * 1.2f * D;
                p.fingerCurl[f] = fLag[s][f] * 0.9f + (calmW * 14f * Noise.smooth(t * 0.39f + f * 7.3f + s * 23.1f, seed + 3)) * D
                        + flapAmp * 13 * D * (float) Math.sin(ph - 0.75f - 0.22f * f) * (0.35f * f);
                float air = flapAmp * 0.21f * (float) Math.sin(ph - 0.25f - 0.12f * f);
                float wind = (weight[SPRINT] * 0.09f + weight[FALL] * -0.17f + weight[GLIDE] * -0.11f + weight[RISE] * 0.10f + weight[SWIM] * 0.05f);
                p.billow[f] = air + wind * (1 + 0.35f * quick) + 0.05f * walkBob * (weight[WALK] + weight[SPRINT]) + 0.035f * calmW * Noise.smooth(t * 0.6f + f * 5.1f + s * 3.3f, seed + 11) - lagCurl[s] * 0.06f - fLag[s][f] * 0.11f
                        + weight[FALL] * 0.09f * (float) Math.sin(t * 2 * Math.PI * 2.4f - f * 1.1f + s) + weight[GLIDE] * 0.05f * (float) Math.sin(t * 2 * Math.PI * 1.6f - f * 0.9f + s * 2);
            }
            float flutter = weight[GLIDE] * 0.085f + weight[FALL] * 0.13f + weight[SPRINT] * 0.035f + weight[WALK] * 0.012f + weight[FLY] * 0.035f + weight[HOVER] * 0.016f + weight[SWIM] * 0.03f + calmW * 0.006f
                    + clamp01(hSpeed / 20f) * 0.01f + evShiver * 0.03f;
            p.ripple = flutter;
            p.ripplePhase = ripplePhase + s * 1.7f;
            p.pulse = pulse;
            p.glowBoost = 1 + 0.35f * flapAmp * Math.max(0, -stroke) + evGlow + 0.5f * clamp01(in.hurt);
        }
        first = false;
        ripplePhase -= dt * (9f + 14f * (weight[GLIDE] + weight[FALL] + weight[FLY]));
        if (ripplePhase < -1000) ripplePhase += 1000 * (float) (2 * Math.PI) / 6.2831855f;
        float pulseHz = 0.42f + 0.5f * flapAmp + 0.25f * weight[SPRINT];
        pulse += dt * pulseHz * 1.35f;
        if (pulse > 1.35f) pulse -= 1.35f;

        computeSkeletons(size);
        simulateChains(in, dt, accF, accU, size);
        updateTail(in, dt, t, hSpeed, accF, size, flapAmp, stroke);
    }

    /** The tail: an S-curve that sways, flicks, streams behind when moving and counterbalances the flap. */
    private void updateTail(WingInput in, float dt, float t, float hSpeed, float accF, float size, float flapAmp, float stroke) {
        float calmW = weight[IDLE] + weight[SNEAK] + weight[RIDE] + weight[SLEEP];
        float moveW = weight[WALK] + weight[SPRINT];
        float hz = 0.33f * calmW + 0.95f * weight[WALK] + 1.5f * weight[SPRINT] + 0.55f * (weight[HOVER] + weight[RISE]) + 0.9f * (weight[FLY] + weight[GLIDE] + weight[FALL]) + 0.8f * weight[SWIM];
        tailPhase += dt * hz * (float) (2 * Math.PI);
        if (tailPhase > 1800) tailPhase -= (float) (2 * Math.PI) * 280;
        float sway = (24 * calmW + 30 * weight[WALK] + 16 * weight[SPRINT] + 20 * weight[HOVER] + 12 * (weight[FLY] + weight[GLIDE]) + 30 * weight[FALL] + 34 * weight[SWIM] + 18 * weight[RISE]) * D;
        // base direction of the tail root, angle above "straight back" in the body's y-z plane
        float droop = (-58 * calmW - 46 * weight[WALK] - 16 * weight[SPRINT] - 76 * weight[HOVER] - 50 * weight[FLY] - 84 * (weight[GLIDE] + weight[SWIM]) + 38 * weight[FALL] - 70 * weight[RISE]) * D;
        float curlUp = (128 * calmW + 100 * weight[WALK] + 42 * weight[SPRINT] + 118 * weight[HOVER] + 60 * weight[FLY] + 26 * (weight[GLIDE] + weight[SWIM]) + 52 * weight[FALL] + 30 * weight[RISE]) * D;
        float steps = Math.max(1, (float) Math.ceil(dt / 0.008f)), h = dt / steps;
        float driveYaw = -smYaw * D * 0.9f - smStrafe * 0.05f, driveLift = -smUp * 0.035f + accF * 0.006f;
        for (int i = 0; i < steps; i++) {
            tailYawV += (40f * (driveYaw - tailYaw) - 5.5f * tailYawV) * h;
            tailYaw += tailYawV * h;
            tailLiftV += (46f * (driveLift - tailLift) - 5.0f * tailLiftV) * h;
            tailLift += tailLiftV * h;
        }
        tailYaw = clamp(tailYaw, -1.3f, 1.3f);
        tailLift = clamp(tailLift, -0.9f, 0.9f);
        float flick = Noise.smooth(t * 0.83f + 91, seed + 13), flick2 = Noise.smooth(t * 2.7f + 12, seed + 17);
        float len = 1.42f * (float) Math.pow(size, 0.75), step = len / (TAIL_POINTS - 1);
        float x = 0, y = -0.47f, z = 0.0f;
        for (int k = 0; k < TAIL_POINTS; k++) {
            tail[k * 3] = x; tail[k * 3 + 1] = y; tail[k * 3 + 2] = z;
            float u = (k + 0.5f) / (TAIL_POINTS - 1);
            float theta = droop + curlUp * (float) Math.pow(u, 1.7) + tailLift * (0.3f + u) + 14 * D * flapAmp * stroke * u
                    + moveW * 9 * D * (float) Math.sin(2 * tailPhase - 3.2f * u) * u + 10 * D * flick * u * u;
            float phi = sway * (float) Math.sin(tailPhase - 3.4f * u) * (0.25f + 0.75f * u) + tailYaw * (0.35f + 0.9f * u)
                    + (calmW + 0.5f * weight[HOVER]) * 26 * D * flick2 * u * u * u;
            // leave the body backwards before the curve takes over
            float out = 1 - clamp01(u * 5f);
            float cy = (float) Math.sin(theta) * (1 - out) + out * -0.35f, cz = (float) Math.cos(theta) * (1 - out) + out * 0.94f;
            float cp = (float) Math.cos(phi);
            x += Math.sin(phi) * step; y += cy * cp * step; z += cz * cp * step;
        }
    }

    private float lastAir, landV;

    private void beginIdleEvent(int type) {
        switch (type) {
            case EV_STRETCH -> startEvent(EV_STRETCH, 3.6f, 0);
            case EV_FLUTTER -> startEvent(EV_FLUTTER, 0.95f, 0);
            case EV_TWITCH -> startEvent(EV_TWITCH, 0.55f, Noise.hash(eventCount, seed + 5) < 0.5f ? 0 : 1);
            default -> startEvent(EV_SHUDDER, 1.5f, 0);
        }
    }

    private void startEvent(int type, float dur, int side) {
        event = type;
        eventT = 0;
        eventDur = dur;
        eventSide = side;
    }

    private void computeSkeletons(float size) {
        skeleton[RIGHT].compute(pose[RIGHT], size);
        skeleton[LEFT].compute(pose[LEFT], size);
    }

    /** Pendants: a short verlet chain hanging from each thumb. */
    private void simulateChains(WingInput in, float dt, float accF, float accU, float size) {
        float link = 0.042f * (float) Math.pow(size, 0.6);
        // apparent gravity in body space: real gravity minus the body's own acceleration
        float gx = in.gravX * 24f, gy = in.gravY * 24f - clamp(accU, -30, 30) * 0.4f, gz = in.gravZ * 24f + clamp(accF, -30, 30) * 0.4f;
        int steps = Math.max(1, (int) Math.ceil(dt / 0.01f));
        float h = dt / steps;
        for (int s = 0; s < 2; s++) {
            float sgn = s == RIGHT ? 1 : -1;
            float[] c = chain[s], pv = chainPrev[s];
            float[] w = skeleton[s].thumb;
            float ax = w[3] * sgn, ay = w[4] - 0.02f * size, az = w[5];
            if (!chainInit) {
                for (int i = 0; i < CHAIN_POINTS; i++) {
                    c[i * 3] = pv[i * 3] = ax; c[i * 3 + 1] = pv[i * 3 + 1] = ay - i * link; c[i * 3 + 2] = pv[i * 3 + 2] = az;
                }
            }
            float sx = c[0], sy = c[1], sz = c[2];
            for (int st = 0; st < steps; st++) {
                float f = (st + 1) / (float) steps;
                c[0] = sx + (ax - sx) * f; c[1] = sy + (ay - sy) * f; c[2] = sz + (az - sz) * f;
                for (int i = 1; i < CHAIN_POINTS; i++) {
                    int o = i * 3;
                    float vx = (c[o] - pv[o]) * 0.955f, vy = (c[o + 1] - pv[o + 1]) * 0.955f, vz = (c[o + 2] - pv[o + 2]) * 0.955f;
                    pv[o] = c[o]; pv[o + 1] = c[o + 1]; pv[o + 2] = c[o + 2];
                    c[o] += vx + gx * h * h; c[o + 1] += vy + gy * h * h; c[o + 2] += vz + gz * h * h;
                }
                for (int it = 0; it < 4; it++) {
                    for (int i = 1; i < CHAIN_POINTS; i++) {
                        int o = i * 3, q = o - 3;
                        float dx = c[o] - c[q], dy = c[o + 1] - c[q + 1], dz = c[o + 2] - c[q + 2];
                        float d = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (d < 1e-6f) continue;
                        float corr = (d - link) / d;
                        if (i == 1) { c[o] -= dx * corr; c[o + 1] -= dy * corr; c[o + 2] -= dz * corr; }
                        else {
                            c[o] -= dx * corr * 0.5f; c[o + 1] -= dy * corr * 0.5f; c[o + 2] -= dz * corr * 0.5f;
                            c[q] += dx * corr * 0.5f; c[q + 1] += dy * corr * 0.5f; c[q + 2] += dz * corr * 0.5f;
                        }
                    }
                }
            }
            pv[0] = c[0]; pv[1] = c[1]; pv[2] = c[2];
        }
        chainInit = true;
    }

    private static float warp(float phase) {
        // phase 0..2pi -> stroke angle; first 42% of the time covers the downstroke (0..pi)
        float u = phase / (float) (2 * Math.PI);
        float down = 0.42f;
        float a = u < down ? u / down * 0.5f : 0.5f + (u - down) / (1 - down) * 0.5f;
        return a * (float) (2 * Math.PI);
    }

    private static float smooth(float x) {
        return x * x * (3 - 2 * x);
    }

    private static float bump(float t, float c, float w) {
        float d = (t - c) / w;
        return (float) Math.exp(-d * d);
    }

    private static float clamp01(float v) {
        return v < 0 ? 0 : Math.min(v, 1);
    }

    private static float clamp(float v, float lo, float hi) {
        return v < lo ? lo : Math.min(v, hi);
    }
}
