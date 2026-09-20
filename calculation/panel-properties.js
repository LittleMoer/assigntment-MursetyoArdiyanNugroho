/**
 * Class Panel Properties is used to calculate the properties of panel CLT Layup.
 * Panel properties can calculate
 *  - Shear Analogy Method  (proHolz Vol1, Section 4.1.3)
 *  - Gamma Method          (proHolz Vol1, Section 4.2)
 *
 * How to use :
 * calculate(CLTLayup) => PanelProperties
 *
 * Note on the source spreadsheet: several of its cells point at empty or
 * shifted helper cells, so its numbers do not follow proHolz. The lever arms
 * hi were measured from 0 instead of the neutral axis, and the gamma factors
 * dropped the layer area Ai (leaving gamma ~ 1, i.e. a rigid composite). Both
 * are corrected here; see README for the resulting figures.
 */

// Base class for panel properties
class PanelProperties {
    /** Human readable method name, used by the renderer. */
    getName() {
        return 'Panel Properties';
    }

    /**
     * Throws when the layup is outside what this method can handle.
     * @param {CLTLayupType} cltLayup
     */
    validate(cltLayup) {
        cltLayup.validate();
    }

    /**
     * @param {CLTLayupType} cltLayup
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup) {
        throw new Error('calculate() must be implemented by a method subclass.');
    }

    /** @returns {PanelProperties} */
    static forMethod(method) {
        const Method = PanelProperties.METHODS[method];
        if (!Method) throw new Error(`Unknown analytical method: ${method}`);
        return new Method();
    }
}

/**
 * Shear Analogy: every layer contributes its own bending stiffness plus its
 * Steiner term about the neutral axis. Valid for 3 to 9 layers and only for a
 * layup that is symmetric top to bottom.
 */
class ShearAnalogyMethod extends PanelProperties {
    getName() {
        return 'Shear Analogy';
    }

    validate(cltLayup) {
        super.validate(cltLayup);
        const total = cltLayup.getTotalLayers();
        if (total < 3 || total > 9) {
            throw new Error(`Shear Analogy handles 3 to 9 layers, got ${total}.`);
        }
        if (!cltLayup.isSymmetric()) {
            throw new Error('Shear Analogy requires a layup that is symmetric from top to bottom.');
        }
    }

    calculate(cltLayup) {
        this.validate(cltLayup);

        const sectionLayers = cltLayup.getSectionProperties();
        const layers = [];
        let effectiveStiffness = 0;

        for (let section of sectionLayers) {
            const flexuralStiffness = section.getFlexuralStiffness();
            effectiveStiffness += flexuralStiffness;
            layers.push(new ShearAnalogyLayerResult({
                label: section.label,
                ownInertia: section.ownInertia,
                steinerInertia: section.steinerInertia,
                modulus: section.modulus,
                flexuralStiffness,
            }));
        }

        return new PanelPropertiesType({
            method: this.getName(),
            layup: cltLayup,
            layers,
            sectionLayers,
            effectiveStiffness,
        });
    }
}

/**
 * Gamma method: the cross layers are treated as shear flexible connections
 * between the longitudinal layers, so each longitudinal layer gets a
 * connection efficiency factor gamma between 0 (no composite action) and 1
 * (rigid). Restricted to 3 and 5 layer layups.
 */
class GammaMethod extends PanelProperties {
    getName() {
        return 'Gamma';
    }

    validate(cltLayup) {
        super.validate(cltLayup);
        const total = cltLayup.getTotalLayers();
        if (total !== 3 && total !== 5) {
            throw new Error(`Gamma handles 3 or 5 layers only, got ${total}.`);
        }
        if (!cltLayup.isAlternating()) {
            throw new Error('Gamma requires layers alternating 0 / 90 starting at 0 on the top face.');
        }
        if (!cltLayup.isSymmetric()) {
            throw new Error('Gamma requires a layup that is symmetric from top to bottom.');
        }
    }

    calculate(cltLayup) {
        this.validate(cltLayup);

        const beff = cltLayup.beff;
        const lref = cltLayup.getReferenceLength();
        const effective = cltLayup.getLongitudinalLayers();   // 2 layers for 3-ply, 3 for 5-ply
        const cross = cltLayup.getCrossLayers();              // the connections between them

        // The reference layer is held rigid (gamma = 1): the middle layer of a
        // 5 ply, the bottom layer of a 3 ply. Index 1 is both.
        const REFERENCE = 1;

        const gammas = effective.map((layer, i) => {
            if (i === REFERENCE) return 1;
            // Cross layer sitting between this layer and the reference layer.
            const connection = cross[i < REFERENCE ? i : i - 1];
            const slip = (Math.PI ** 2 * layer.getModulus() * layer.getArea(beff) * connection.thickness)
                / (beff * connection.getShearModulus() * lref ** 2);
            return 1 / (1 + slip);
        });

        // Spacing between the centres of consecutive longitudinal layers.
        const spacing = effective.slice(0, -1).map((layer, i) =>
            layer.thickness / 2 + cross[i].thickness + effective[i + 1].thickness / 2
        );

        // Neutral axis offset, measured from the centre of the reference layer.
        // Layers above pull it up, layers below push it down.
        const stiffnesses = effective.map((layer, i) => gammas[i] * layer.getModulus() * layer.getArea(beff));
        const totalStiffness = stiffnesses.reduce((sum, value) => sum + value, 0);
        const moment = effective.reduce((sum, layer, i) => {
            if (i === REFERENCE) return sum;
            const distance = i < REFERENCE ? -spacing[i] : spacing[i - 1];
            return sum + stiffnesses[i] * distance;
        }, 0);
        const offset = totalStiffness === 0 ? 0 : -moment / totalStiffness;

        const leverArms = effective.map((layer, i) => {
            if (i === REFERENCE) return offset;
            const distance = i < REFERENCE ? -spacing[i] : spacing[i - 1];
            return distance + offset;
        });

        const layers = [];
        let effectiveStiffness = 0;

        effective.forEach((layer, i) => {
            const ownInertia = layer.getOwnInertia(beff);
            const steinerInertia = layer.getArea(beff) * leverArms[i] ** 2;
            const flexuralStiffness = (ownInertia + gammas[i] * steinerInertia) * layer.getModulus();
            effectiveStiffness += flexuralStiffness;
            layers.push(new GammaLayerResult({
                label: `Layer ${cltLayup.getLayers().indexOf(layer) + 1}`,
                modulus: layer.getModulus(),
                leverArm: leverArms[i],
                ownInertia,
                steinerInertia,
                gamma: gammas[i],
                flexuralStiffness,
            }));
        });

        return new PanelPropertiesType({
            method: this.getName(),
            layup: cltLayup,
            layers,
            sectionLayers: cltLayup.getSectionProperties(),
            effectiveStiffness,
        });
    }
}

PanelProperties.METHODS = {
    'shear-analogy': ShearAnalogyMethod,
    gamma: GammaMethod,
};
