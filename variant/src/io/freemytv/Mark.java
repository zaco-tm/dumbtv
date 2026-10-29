package io.freemytv;

import android.graphics.Canvas;
import android.graphics.Paint;

/**
 * AverageTV's mark: the letter A drawn as an old television aerial — two rods with three
 * horizontal elements between them — between square brackets.
 *
 * Upstream's mark was a four-pointed sparkle. This product does without that kind of
 * decoration: the mark is a drawing of the thing itself, the name built out of the old
 * television's antenna.
 *
 * It is drawn, not a picture: the same `Canvas` the rest of the app draws on, so it is
 * sharp at every size and takes the colour it is given.
 */
final class Mark {
    private Mark() {}

    /** The mark, `size` tall overall, centred on (cx, cy). */
    static void draw(Canvas c, float cx, float cy, float size, int color) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color);
        p.setStyle(Paint.Style.STROKE);

        // The aerial: two rods and three elements — a rooftop antenna.
        float apex = cy - size * 0.377f;
        float base = cy + size * 0.230f;
        float half = size * 0.300f;
        p.setStrokeWidth(size * 0.055f);
        c.drawLine(cx, apex, cx - half, base, p);
        c.drawLine(cx, apex, cx + half, base, p);
        for (int i = 0; i < 3; i++) {
            float y = apex + (base - apex) * (0.34f + i * 0.22f);
            float w = half * ((y - apex) / (base - apex));
            c.drawLine(cx - w, y, cx + w, y, p);
        }

        // The brackets it stands in.
        p.setStrokeWidth(size * 0.065f);
        float bx = half + size * 0.16f;
        float top = apex - size * 0.05f;
        float h = (base - apex) + size * 0.10f;
        float arm = size * 0.11f;
        c.drawLine(cx - bx, top, cx - bx, top + h, p);
        c.drawLine(cx - bx, top, cx - bx + arm, top, p);
        c.drawLine(cx - bx, top + h, cx - bx + arm, top + h, p);
        c.drawLine(cx + bx, top, cx + bx, top + h, p);
        c.drawLine(cx + bx, top, cx + bx - arm, top, p);
        c.drawLine(cx + bx, top + h, cx + bx - arm, top + h, p);
    }
}
