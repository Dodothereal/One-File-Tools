package dev.dodus.succubuswings.core;

/** What the wearer is doing right now. Velocities are in blocks/second in the body's own frame. */
public final class WingInput {
    /** forward (+ = the way the body faces), up, and strafe (+ = wearer's right) speed. */
    public float forward, up, strafe;
    /** Body yaw change in degrees/second, + = turning right (clockwise seen from above). */
    public float yawRate;
    public boolean onGround = true;
    public boolean sneaking, sprinting, flying, gliding, swimming, sleeping, riding, inWater;
    /** 0..1, 1 right after being hit. */
    public float hurt;
    /** 0..1 arm swing progress, 0 when not attacking. */
    public float attack;
    /** 0..1 */
    public float health = 1;
    /** Direction of gravity in the wing's body space (unit vector); (0,-1,0) for an upright body. */
    public float gravX = 0, gravY = -1, gravZ = 0;

    public float horizontalSpeed() {
        return (float) Math.sqrt(forward * forward + strafe * strafe);
    }
}
