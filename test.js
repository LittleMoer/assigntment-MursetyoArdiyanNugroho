/**
 * Self check: node test.js
 * Loads the browser classes into this scope and asserts the worked example
 * from floor-panel-properties.xlsx (MGP10, 5 layers, 35 mm, 5 m, beff 1000).
 */
const assert = require('assert');
const fs = require('fs');

const EOL = String.fromCharCode(10);

const SOURCES = [
    'type/material-grade-type.js',
    'type/clt-layer-type.js',
    'type/clt-layer-properties-type.js',
    'type/clt-layup-type.js',
    'type/panel-properties-type.js',
    'calculation/panel-properties.js',
];

// The sources are plain browser scripts with no exports, so load them the way
// a <script> tag would: concatenate, evaluate, hand back the classes.
const {
    MaterialGrade, CLTLayerType, CLTLayupType,
    PanelProperties, ShearAnalogyMethod, GammaMethod,
} = (0, eval)(
    SOURCES.map((file) => fs.readFileSync(__dirname + '/' + file, 'utf8')).join(EOL)
    + EOL + ';({ MaterialGrade, CLTLayerType, CLTLayupType, PanelProperties, ShearAnalogyMethod, GammaMethod });'
);

const close = (actual, expected, tolerance, what) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: got ${actual}, want ${expected}`);

const build = (totalLayers) => CLTLayupType.uniform({
    totalLayers,
    thickness: 35,
    grade: MaterialGrade.get('MGP10'),
    beff: 1000,
    length: 5,
});

// --- layup geometry ---------------------------------------------------------
const layup = build(5);
assert.strictEqual(layup.getTotalThickness(), 175);
assert.strictEqual(layup.getCentroid(0), 17.5);
assert.strictEqual(layup.getCentroid(4), 157.5);
assert.strictEqual(layup.getNeutralAxis(), 87.5, 'symmetric layup sits on mid depth');
assert.ok(layup.isSymmetric() && layup.isAlternating());

// --- shear analogy ----------------------------------------------------------
// EIeff = sum Ei (beff ti^3/12 + beff ti ai^2), ai = -70, -35, 0, 35, 70
// cross layers carry Ei,XX = 0, so only layers 1, 3, 5 contribute
const shear = new ShearAnalogyMethod().calculate(layup);
close(shear.effectiveStiffness, 389090625000, 1, 'shear analogy (EI)eff');
close(shear.layers[0].steinerInertia, 1000 * 35 * 70 ** 2, 1e-6, 'layer 1 Steiner term');
assert.strictEqual(shear.layers[1].flexuralStiffness, 0, 'cross layer adds no XX stiffness');

// --- gamma ------------------------------------------------------------------
// gamma1 = 1 / (1 + pi^2 E1 A1 t2 / (beff G90 Lref^2))
const gamma = new GammaMethod().calculate(layup);
const expectedGamma = 1 / (1 + (Math.PI ** 2 * 1100 * 35000 * 35) / (1000 * 62.5 * 5000 ** 2));
close(gamma.layers[0].gamma, expectedGamma, 1e-12, 'gamma 1');
assert.strictEqual(gamma.layers[1].gamma, 1, 'reference layer is rigid');
close(gamma.layers[0].leverArm, -70, 1e-9, 'a1 of a symmetric 5 ply');
close(gamma.layers[1].leverArm, 0, 1e-9, 'a2 sits on the neutral axis');
assert.strictEqual(gamma.layers.length, 3, 'only longitudinal layers appear');
assert.ok(
    gamma.effectiveStiffness < shear.effectiveStiffness,
    'shear flexible connection must be softer than the shear analogy composite'
);
// EIeff = sum Ei (beff ti^3/12 + gamma i beff ti ai^2) over layers 1, 3, 5
const ownInertia = (1000 * 35 ** 3) / 12;
close(
    gamma.effectiveStiffness,
    2 * (ownInertia + expectedGamma * 35000 * 70 ** 2) * 1100 + ownInertia * 1100,
    1e-3,
    'gamma (EI)eff'
);

// 3 ply: the bottom layer is the rigid reference and the top layer is shear
// flexible, so the composite axis sits below mid depth rather than on it.
const gamma3 = new GammaMethod().calculate(build(3));
const spacing = 70;                       // 35/2 + 35 + 35/2
const offset = (spacing * expectedGamma) / (expectedGamma + 1);
close(gamma3.layers[0].leverArm, offset - spacing, 1e-9, '3 ply a1');
close(gamma3.layers[1].leverArm, offset, 1e-9, '3 ply a2');
assert.ok(Math.abs(gamma3.layers[0].leverArm) > Math.abs(gamma3.layers[1].leverArm));

// --- limits -----------------------------------------------------------------
assert.throws(() => new ShearAnalogyMethod().calculate(build(2)), /3 to 9 layers/);
assert.throws(() => new ShearAnalogyMethod().calculate(build(10)), /3 to 9 layers/);
assert.throws(() => new GammaMethod().calculate(build(7)), /3 or 5 layers only/);
assert.throws(() => new GammaMethod().calculate(build(4)), /3 or 5 layers only/);

const asymmetric = build(5);
asymmetric.getLayers()[0].thickness = 20;
assert.throws(() => new ShearAnalogyMethod().calculate(asymmetric), /symmetric from top to bottom/);
assert.throws(() => new GammaMethod().calculate(asymmetric), /symmetric from top to bottom/);

assert.ok(PanelProperties.forMethod('gamma') instanceof GammaMethod);
assert.throws(() => PanelProperties.forMethod('nope'), /Unknown analytical method/);

console.log('all checks passed');
