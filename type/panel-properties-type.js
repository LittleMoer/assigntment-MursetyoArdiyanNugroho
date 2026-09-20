/**
 * Result of PanelProperties.calculate(CLTLayupType).
 *
 * layers          : the per-layer rows of the method's own table
 * sectionLayers   : the shared SECTION PROPERTIES rows of the layup
 * effectiveStiffness : (EI)eff in N-mm^2/m
 */
class PanelPropertiesType {
    constructor({ method, layup, layers = [], sectionLayers = [], effectiveStiffness = 0 }) {
        this.method = method;
        this.layup = layup;
        this.layers = layers;
        this.sectionLayers = sectionLayers;
        this.effectiveStiffness = effectiveStiffness;
    }

    /** (EI)eff expressed in kN-m^2/m, the unit engineers usually quote. */
    getEffectiveStiffnessKNm2() {
        return this.effectiveStiffness / 1e12 * 1e3;
    }
}

/**
 * One row of the Shear Analogy table:
 * beff ti^3/12 | beff ti hi^2 | Ei,XX | EiIi
 */
class ShearAnalogyLayerResult {
    constructor({ label, ownInertia, steinerInertia, modulus, flexuralStiffness }) {
        this.label = label;
        this.ownInertia = ownInertia;
        this.steinerInertia = steinerInertia;
        this.modulus = modulus;
        this.flexuralStiffness = flexuralStiffness;
    }
}

/**
 * One row of the Gamma table, covering a single longitudinal layer:
 * Ei | ai | beff ti^3/12 | beff ti ai^2 | gamma i | EiIi,eff,gamma
 */
class GammaLayerResult {
    constructor({ label, modulus, leverArm, ownInertia, steinerInertia, gamma, flexuralStiffness }) {
        this.label = label;
        this.modulus = modulus;
        this.leverArm = leverArm;
        this.ownInertia = ownInertia;
        this.steinerInertia = steinerInertia;
        this.gamma = gamma;
        this.flexuralStiffness = flexuralStiffness;
    }
}
