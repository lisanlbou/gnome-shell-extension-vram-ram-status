// ui/progressBar.js — Cairo-drawn progress bar for the dropdown menu.
//
// Runs inside the GNOME Shell process. Mirrors GNOME Shell's own BarLevel
// widget: a St.DrawingArea whose vfunc_repaint draws a rounded track and a
// fill whose width is proportional to a 0..1 fraction. The fill color is
// resolved by lib/color.js so this widget stays a thin drawing layer.
//
// Accessibility: the widget is exposed as an Atk level bar (like GNOME's
// BarLevel) with a GenericAccessible that reports the current 0..1 value, so
// screen readers can announce the bar's state rather than a nameless canvas.

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

const BAR_HEIGHT = 6;

/**
 * A menu progress bar. `fill` is an [r, g, b, a] array (components 0..1), or
 * null to use the theme's foreground color for the neutral state.
 */
export const ProgressBar = GObject.registerClass({
    GTypeName: 'MemoryMonitorProgressBar',
    Properties: {
        'value': GObject.ParamSpec.double(
            'value', null, null,
            GObject.ParamFlags.READWRITE,
            0, 1, 0),
    },
}, class ProgressBar extends St.DrawingArea {
    _init(params = {}) {
        const { fraction = 0, fill = null, ...rest } = params;
        super._init({
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: false,
            accessible_role: Atk.Role.LEVEL_BAR,
            ...rest,
        });
        this._fraction = this._clampFraction(fraction);
        this._fill = fill;

        // Expose the 0..1 fraction through a GenericAccessible so Orca reads a
        // progress value (current/minimum/maximum) instead of an empty canvas.
        this._customAccessible = St.GenericAccessible.new_for_actor(this);
        this.set_accessible(this._customAccessible);
        this._customAccessible.connect('get-current-value', this._getCurrentValue.bind(this));
        this._customAccessible.connect('get-minimum-value', this._getMinimumValue.bind(this));
        this._customAccessible.connect('get-maximum-value', this._getMaximumValue.bind(this));
        this._customAccessible.connect('set-current-value', this._setCurrentValue.bind(this));
    }

    /** The current 0..1 fraction, exposed as a GObject property for a11y. */
    get value() {
        return this._fraction;
    }

    set value(value) {
        const clamped = this._clampFraction(value);
        if (clamped === this._fraction)
            return;
        this._fraction = clamped;
        this.notify('value');
        this.queue_repaint();
    }

    /** Update the fraction (0..1) and fill color, repainting only on change. */
    setValue(fraction, fill) {
        const value = this._clampFraction(fraction);
        if (value === this._fraction && fill === this._fill)
            return;
        this._fraction = value;
        this._fill = fill;
        this.notify('value');
        this.queue_repaint();
    }

    _clampFraction(value) {
        const n = Number(value);
        if (!Number.isFinite(n))
            return 0;
        return Math.min(1, Math.max(0, n));
    }

    _getCurrentValue() {
        return this._fraction;
    }

    _getMinimumValue() {
        return 0;
    }

    _getMaximumValue() {
        return 1;
    }

    _setCurrentValue(_actor, value) {
        this.value = value;
    }

    // Clutter.Actor.get_preferred_height must return a [minimum, natural] pair.
    // Returning the scalar BAR_HEIGHT was the original defect: GJS maps the
    // single return value to "minimum" and leaves "natural" unset (0), so the
    // actor could collapse to zero height. GNOME's own BarLevel returns
    // themeNode.adjust_preferred_height(height, height) — a [min, natural] pair.
    vfunc_get_preferred_height(_forWidth) {
        return [BAR_HEIGHT, BAR_HEIGHT];
    }

    vfunc_repaint() {
        const cr = this.get_context();
        const themeNode = this.get_theme_node();
        const [width, height] = this.get_surface_size();
        if (width <= 0 || height <= 0) {
            cr.$dispose();
            return;
        }

        const barHeight = Math.min(BAR_HEIGHT, height);
        const y = (height - barHeight) / 2;
        const radius = barHeight / 2;
        const rtl = this.get_text_direction() === Clutter.TextDirection.RTL;

        // Track (subtle translucent gray, legible on light and dark themes).
        cr.setSourceRGBA(0.5, 0.5, 0.5, 0.25);
        this._roundedRect(cr, 0, y, width, barHeight, radius);
        cr.fill();

        if (this._fraction > 0) {
            const fillWidth = Math.max(barHeight, Math.round(width * this._fraction));
            const fillX = rtl ? width - fillWidth : 0;

            if (this._fill)
                cr.setSourceRGBA(this._fill[0], this._fill[1], this._fill[2], this._fill[3]);
            else
                cr.setSourceColor(themeNode.get_foreground_color());

            this._roundedRect(cr, fillX, y, fillWidth, barHeight, radius);
            cr.fill();
        }

        cr.$dispose();
    }

    _roundedRect(cr, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        cr.newSubPath();
        cr.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
        cr.arc(x + width - r, y + r, r, Math.PI * 1.5, Math.PI * 2);
        cr.arc(x + width - r, y + height - r, r, 0, Math.PI * 0.5);
        cr.arc(x + r, y + height - r, r, Math.PI * 0.5, Math.PI);
        cr.closePath();
    }
});
