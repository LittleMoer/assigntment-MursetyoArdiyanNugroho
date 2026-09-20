/**
 * A single lamella / plank layer of a CLT layup.
 *
 * Matches "LAYER 1", "LAYER 2" ... in the layup illustration:
 * each layer has a thickness, an orientation relative to the primary
 * direction, and a material grade.
 */
class CLTLayerType {
    /**
     * @param {number} thickness  layer thickness ti (mm)
     * @param {number} angle      orientation in degrees, 0 or 90
     * @param {MaterialGrade} grade
     */
    constructor(thickness, angle, grade) {
        this.thickness = thickness;
        this.angle = angle;
        this.grade = grade;
    }

    /** True when the layer runs along the primary direction. */
    isLongitudinal() {
        return this.angle === 0;
    }

    /** Ei,XX (MPa) */
    getModulus() {
        return this.grade.modulusAt(this.angle);
    }

    /** Gi (MPa) — rolling shear modulus for cross layers. */
    getShearModulus() {
        return this.grade.shearModulusAt(this.angle);
    }

    /** Cross sectional area Ai = beff * ti (mm^2/m) */
    getArea(beff) {
        return beff * this.thickness;
    }

    /** Own second moment of area beff * ti^3 / 12 (mm^4) */
    getOwnInertia(beff) {
        return (beff * Math.pow(this.thickness, 3)) / 12;
    }

    /** A layer only matches another if geometry, angle and grade all agree. */
    equals(other) {
        return other instanceof CLTLayerType
            && this.thickness === other.thickness
            && this.angle === other.angle
            && this.grade === other.grade;
    }
}
