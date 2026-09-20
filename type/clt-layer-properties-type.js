/**
 * Section properties of one layer, resolved against the layup it belongs to.
 * This is the "SECTION PROPERTIES" table of the spreadsheet:
 * ti, yi, theta i, Ei,XX, hi (lever arm to the neutral axis), Gi.
 */
class CLTLayerPropertiesType {
    constructor({ label, thickness, centroid, angle, modulus, leverArm, shearModulus, ownInertia, steinerInertia }) {
        this.label = label;
        this.thickness = thickness;           // ti (mm)
        this.centroid = centroid;             // yi, depth from top face to layer centre (mm)
        this.angle = angle;                   // theta i (deg)
        this.modulus = modulus;               // Ei,XX (MPa)
        this.leverArm = leverArm;             // hi = yi - neutral axis (mm)
        this.shearModulus = shearModulus;     // Gi (MPa)
        this.ownInertia = ownInertia;         // beff ti^3 / 12 (mm^4)
        this.steinerInertia = steinerInertia; // beff ti hi^2 (mm^4)
    }

    /** EiIi (N-mm^2/m) */
    getFlexuralStiffness() {
        return (this.ownInertia + this.steinerInertia) * this.modulus;
    }
}
