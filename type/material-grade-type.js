/**
 * Material grade of a CLT lamella.
 *
 * E    : modulus of elasticity parallel to grain (MPa)
 * E90  : modulus of elasticity perpendicular to grain (MPa)
 * G    : shear modulus parallel to grain (MPa)
 * G90  : rolling shear modulus (MPa)
 */
class MaterialGrade {
    constructor(name, e, e90, g, g90) {
        this.name = name;
        this.e = e;
        this.e90 = e90;
        this.g = g;
        this.g90 = g90;
    }

    /**
     * Modulus of elasticity in the XX (primary/span) direction for a lamella
     * laid at the given angle. Cross layers carry no bending stiffness about
     * the major axis, so they are taken as 0 — standard CLT practice and what
     * the source spreadsheet does.
     */
    modulusAt(angle) {
        return angle === 0 ? this.e : 0;
    }

    /** Shear modulus of a lamella at the given angle. 90 deg = rolling shear. */
    shearModulusAt(angle) {
        return angle === 0 ? this.g : this.g90;
    }

    static get(name) {
        const grade = MaterialGrade.LIST[name];
        if (!grade) throw new Error(`Unknown material grade: ${name}`);
        return grade;
    }

    static names() {
        return Object.keys(MaterialGrade.LIST);
    }
}

MaterialGrade.LIST = {
    MGP10: new MaterialGrade('MGP10', 1100, 110, 687.5, 62.5),
    MGP12: new MaterialGrade('MGP12', 1100, 110, 687.5, 62.5),
};
