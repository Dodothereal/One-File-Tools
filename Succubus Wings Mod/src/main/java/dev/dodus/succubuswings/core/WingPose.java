package dev.dodus.succubuswings.core;

/** Joint parameters of one wing. Angles in radians. */
public final class WingPose {
    public static final int FINGERS = 5;

    /** 0 = folded against the back, 1 = fully spread. */
    public float spread;
    /** Rotation about the body's vertical axis; + sweeps the wing tip backwards. */
    public float sweep;
    /** In-plane rotation about the shoulder; + lifts the tip. */
    public float raise;
    /** Rotation about the wing's span axis; + tilts the leading edge backwards. */
    public float twist;
    /** Out-of-plane bend of the forearm at the elbow; + bends back. */
    public float armBend;
    /** Out-of-plane curvature of every finger (total over its length); + curls the tips backwards. */
    public float curl;
    /** Extra out-of-plane curvature concentrated at the finger tips (whip). */
    public float curlTip;
    /** Extra angular spacing between the fingers. */
    public float fan;
    public final float[] fingerFlex = new float[FINGERS];
    public final float[] fingerCurl = new float[FINGERS];
    /** Membrane bulge per panel in blocks, + = backwards. */
    public final float[] billow = new float[FINGERS];
    /** Amplitude and phase of the flutter running along the trailing edge. */
    public float ripple, ripplePhase;
    /** 0..1 position of the glow pulse travelling from the wrist to the trailing edge. */
    public float pulse;
    /** Animation clock in seconds, for twinkles. */
    public float time;
    /** Extra glow brightness multiplier. */
    public float glowBoost = 1;
}
