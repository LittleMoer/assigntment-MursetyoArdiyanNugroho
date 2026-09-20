/**
 * A combination of CLTLayerType, top to bottom, plus the panel geometry the
 * calculation needs: effective width and reference span.
 *
 * Layer order follows the illustration: layers[0] is LAYER 1, the top face.
 */
class CLTLayupType {
    /**
     * @param {object} options
     * @param {CLTLayerType[]} options.layers  top-to-bottom
     * @param {number} options.beff            effective width (mm)
     * @param {number} options.length          reference span (m)
     * @param {string} [options.name]
     */
    constructor({ layers = [], beff = 1000, length = 5, name = 'CLT Layup' } = {}) {
        this.name = name;
        /** @type {CLTLayerType[]} */
        this.layers = layers;
        this.beff = beff;
        this.length = length;
    }

    /**
     * Build the alternating 0/90 layup of the illustration: uniform thickness,
     * uniform grade, top layer along the primary direction.
     */
    static uniform({ totalLayers, thickness, grade, beff, length }) {
        const layers = Array.from(
            { length: totalLayers },
            (_, i) => new CLTLayerType(thickness, i % 2 === 0 ? 0 : 90, grade)
        );
        return new CLTLayupType({ layers, beff, length });
    }

    /** @returns {CLTLayerType[]} */
    getLayers() {
        return this.layers;
    }

    addLayer(layer) {
        this.layers.push(layer);
        return this;
    }

    getTotalLayers() {
        return this.layers.length;
    }

    /** Total slab thickness (mm) */
    getTotalThickness() {
        return this.layers.reduce((sum, layer) => sum + layer.thickness, 0);
    }

    /** Reference span in mm. */
    getReferenceLength() {
        return this.length * 1000;
    }

    /** Depth from the top face to the centre of layer i (mm). */
    getCentroid(index) {
        let depth = 0;
        for (let i = 0; i < index; i++) depth += this.layers[i].thickness;
        return depth + this.layers[index].thickness / 2;
    }

    /**
     * Depth from the top face to the neutral axis (mm), weighted by EA.
     * Falls back to mid-depth when no layer carries stiffness.
     */
    getNeutralAxis() {
        let numerator = 0;
        let denominator = 0;
        this.layers.forEach((layer, i) => {
            const ea = layer.getModulus() * layer.getArea(this.beff);
            numerator += ea * this.getCentroid(i);
            denominator += ea;
        });
        return denominator === 0 ? this.getTotalThickness() / 2 : numerator / denominator;
    }

    /** True when the layup reads the same top-to-bottom and bottom-to-top. */
    isSymmetric() {
        const layers = this.layers;
        for (let i = 0, j = layers.length - 1; i < j; i++, j--) {
            if (!layers[i].equals(layers[j])) return false;
        }
        return true;
    }

    /** True when orientations alternate 0/90 starting at 0 on the top face. */
    isAlternating() {
        return this.layers.every((layer, i) => layer.angle === (i % 2 === 0 ? 0 : 90));
    }

    /** Longitudinal (0 degree) layers, top to bottom. */
    getLongitudinalLayers() {
        return this.layers.filter((layer) => layer.isLongitudinal());
    }

    /** Cross (90 degree) layers, top to bottom. */
    getCrossLayers() {
        return this.layers.filter((layer) => !layer.isLongitudinal());
    }

    /**
     * Section properties per layer, resolved against the neutral axis.
     * @returns {CLTLayerPropertiesType[]}
     */
    getSectionProperties() {
        const neutralAxis = this.getNeutralAxis();
        return this.layers.map((layer, i) => {
            const centroid = this.getCentroid(i);
            const leverArm = centroid - neutralAxis;
            return new CLTLayerPropertiesType({
                label: `Layer ${i + 1}`,
                thickness: layer.thickness,
                centroid,
                angle: layer.angle,
                modulus: layer.getModulus(),
                leverArm,
                shearModulus: layer.getShearModulus(),
                ownInertia: layer.getOwnInertia(this.beff),
                steinerInertia: layer.getArea(this.beff) * leverArm * leverArm,
            });
        });
    }

    /** Throws when the layup itself is not buildable, regardless of method. */
    validate() {
        if (this.layers.length === 0) throw new Error('Layup has no layers.');
        if (this.layers.some((layer) => !(layer.thickness > 0))) {
            throw new Error('Every layer must have a thickness greater than 0 mm.');
        }
        if (this.layers.some((layer) => layer.angle !== 0 && layer.angle !== 90)) {
            throw new Error('Layer orientation must be 0 or 90 degrees.');
        }
        if (!(this.beff > 0)) throw new Error('Effective width beff must be greater than 0 mm.');
        if (!(this.length > 0)) throw new Error('Length must be greater than 0 m.');
    }
}
