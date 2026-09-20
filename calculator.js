/**
 * This class to organize the input data for panel calculation
 * To Render the input data, you can use the following code:
 *
 * const panelProperties = new PanelProperties();
 *
 * Wiring only: reads the form into a CLTLayupType, hands it to the analytical
 * method, and renders the returned PanelPropertiesType.
 */
class PanelCalculatorView {
    constructor(document) {
        this.document = document;
        this.form = document.getElementById('panel-form');
        this.error = document.getElementById('error');
        this.output = document.getElementById('output');
        this.layupRows = document.getElementById('layup-rows');
    }

    start() {
        const grade = this.document.getElementById('grade');
        grade.innerHTML = MaterialGrade.names()
            .map((name) => `<option value="${name}">${name}</option>`)
            .join('');

        // Total layers and thickness regenerate the layup table; everything
        // else is read straight off the form at calculate time.
        ['total-layers', 'thickness', 'grade'].forEach((id) =>
            this.document.getElementById(id).addEventListener('change', () => {
                this.renderLayupRows();
                this.submit();
            })
        );
        this.document.getElementById('method').addEventListener('change', () => this.submit());
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.submit();
        });

        this.renderLayupRows();
        this.submit();
    }

    /** Rebuild the editable layer table from total layers / thickness. */
    renderLayupRows() {
        const total = this.number('total-layers');
        const thickness = this.number('thickness');
        const grade = this.document.getElementById('grade').value;

        this.layupRows.innerHTML = Array.from({ length: Math.max(0, total) }, (_, i) => `
            <tr>
                <td>Layer ${i + 1}</td>
                <td><input class="form-control form-control-sm layer-thickness" type="number" min="1" step="1" value="${thickness}"></td>
                <td>
                    <select class="form-select form-select-sm layer-angle">
                        <option value="0"${i % 2 === 0 ? ' selected' : ''}>0</option>
                        <option value="90"${i % 2 === 1 ? ' selected' : ''}>90</option>
                    </select>
                </td>
                <td>${grade}</td>
            </tr>`).join('');

        this.layupRows.querySelectorAll('input, select').forEach((field) =>
            field.addEventListener('change', () => this.submit())
        );
    }

    /** @returns {CLTLayupType} */
    buildLayup() {
        const grade = MaterialGrade.get(this.document.getElementById('grade').value);
        const thicknesses = this.layupRows.querySelectorAll('.layer-thickness');
        const angles = this.layupRows.querySelectorAll('.layer-angle');

        const layers = Array.from(thicknesses, (field, i) =>
            new CLTLayerType(Number(field.value), Number(angles[i].value), grade)
        );

        return new CLTLayupType({
            layers,
            beff: this.number('beff'),
            length: this.number('length'),
        });
    }

    submit() {
        try {
            const method = PanelProperties.forMethod(this.document.getElementById('method').value);
            this.render(method.calculate(this.buildLayup()));
            this.showError(null);
        } catch (failure) {
            this.showError(failure.message);
        }
    }

    /** @param {PanelPropertiesType} properties */
    render(properties) {
        const isGamma = properties.method === 'Gamma';

        this.rows('section-rows', properties.sectionLayers, (layer) => [
            layer.label,
            this.format(layer.thickness),
            this.format(layer.centroid),
            layer.angle,
            this.format(layer.modulus),
            this.format(layer.leverArm),
            this.format(layer.shearModulus),
        ]);

        if (isGamma) {
            this.rows('gamma-rows', properties.layers, (layer) => [
                layer.label,
                this.format(layer.modulus),
                this.format(layer.leverArm),
                this.format(layer.ownInertia),
                this.format(layer.steinerInertia),
                this.format(layer.gamma, 6),
                this.format(layer.flexuralStiffness),
            ]);
        } else {
            this.rows('shear-analogy-rows', properties.layers, (layer) => [
                layer.label,
                this.format(layer.ownInertia),
                this.format(layer.steinerInertia),
                this.format(layer.modulus),
                this.format(layer.flexuralStiffness),
            ]);
        }

        // Only the chosen method's section is shown.
        this.document.getElementById('gamma-section').classList.toggle('d-none', !isGamma);
        this.document.getElementById('shear-analogy-section').classList.toggle('d-none', isGamma);

        this.document.getElementById('summary').innerHTML = [
            ['Method', properties.method],
            ['Total Thickness', `${this.format(properties.layup.getTotalThickness())} mm`],
            ['(EI)eff', `${this.format(properties.effectiveStiffness)} N-mm&sup2;/m`],
            ['(EI)eff', `${this.format(properties.getEffectiveStiffnessKNm2())} kN-m&sup2;/m`],
        ].map(([term, value]) =>
            `<dt class="col-sm-4">${term}</dt><dd class="col-sm-8">${value}</dd>`
        ).join('');

        this.output.classList.remove('d-none');
    }

    rows(id, items, toCells) {
        this.document.getElementById(id).innerHTML = items.map((item) => {
            const [label, ...values] = toCells(item);
            return `<tr><td>${label}</td>${values.map((v) => `<td class="num">${v}</td>`).join('')}</tr>`;
        }).join('');
    }

    number(id) {
        return Number(this.document.getElementById(id).value);
    }

    format(value, digits = 3) {
        if (!Number.isFinite(value)) return '-';
        if (value === 0) return '0';   // also collapses -0
        // Big stiffness figures stay readable in exponential form.
        if (Math.abs(value) >= 1e9) return value.toExponential(4);
        return value.toLocaleString('en-US', { maximumFractionDigits: digits });
    }

    showError(message) {
        this.error.textContent = message || '';
        this.error.classList.toggle('d-none', !message);
        if (message) this.output.classList.add('d-none');
    }
}

document.addEventListener('DOMContentLoaded', () => new PanelCalculatorView(document).start());
