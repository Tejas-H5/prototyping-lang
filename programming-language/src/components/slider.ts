import { cssVars } from 'src/styling';
import { deferClickEventToParent, elementHasMouseDown, getCurrentRoot, getMouse, imBeginDiv, imBeginList, imBeginMemo, imEnd, imEndList, imEndMemo, imInit, imState, imTrackSize, nextListRoot, setStyle } from 'src/utils/im-dom-utils';
import { clamp, inverseLerp, lerp } from 'src/utils/math-utils';

export function newSliderState() {
    return {
        value: 0,
        start: 0,
        end: 1,
        step: 0 as number | null,
        t: 0,
    };
}

export function renderSliderBody(
    sliderStart: number,
    sliderEnd: number,
    step: number | null,
    value: number = sliderStart,
) {
    const s = imState(newSliderState);

    // slider body
    imBeginDiv(); {
        const { rect } = imTrackSize();

        if (imInit()) {
            setStyle("display", "flex");
            setStyle("flex", "1");
            setStyle("position", "relative");
            setStyle("backgroundColor", cssVars.bg2);
            setStyle("borderRadius", "1000px");
            setStyle("cursor", "ew-resize");
            setStyle("userSelect", "none");
        }

        s.start = sliderStart;
        s.end = sliderEnd;
        if (s.end < s.start) {
            [s.start, s.end] = [s.end, s.start];
        }
        s.step = step;

        if (imBeginMemo().val(value).changed()) {
            s.value = value;
        } imEndMemo();

        s.value = clamp(s.value, s.start, s.end);

        const sliderHandleSize = rect.height;

        // little dots for every step
        imBeginList(); {
            if (s.step) {
                const width = s.end - s.start;
                const count = Math.floor(width / s.step);
                if (count < 50) {
                    for (let i = 0; i < count - 1; i++) {
                        let t = (i + 1) / count;
                        const sliderPos = lerp(0, rect.width - sliderHandleSize, t);

                        nextListRoot();

                        imBeginDiv(); {
                            if (imInit()) {
                                setStyle("position", "absolute");
                                setStyle("aspectRatio", "1 / 1");
                                setStyle("height", "100%");
                                setStyle("backgroundColor", cssVars.mg);
                                setStyle("transformOrigin", "center");
                                setStyle("transform", "scale(0.4) rotate(45deg)");
                            }

                            setStyle("left", sliderPos + "px");
                        } imEnd();
                    }
                }
            }
        }
        imEndList();

        // slider handle
        imBeginDiv(); {
            if (imInit()) {
                setStyle("position", "absolute");
                setStyle("backgroundColor", cssVars.fg);
                setStyle("borderRadius", "1000px");
                setStyle("aspectRatio", "1 / 1");
                setStyle("height", "100%");

                setStyle("userSelect", "none");
                setStyle("cursor", "ew-resize");
            }

            if (imBeginMemo().objectVals(s).changed()) {
                const t = inverseLerp(s.start, s.end, s.value);
                const sliderPos = lerp(0, rect.width - sliderHandleSize, t);
                setStyle("left", sliderPos + "px");
            } imEndMemo();

            deferClickEventToParent();
        } imEnd();

        const mouse = getMouse();
        if (mouse.leftMouseButton && elementHasMouseDown()) {
            const rect = getCurrentRoot().root.getBoundingClientRect();
            const x0 = rect.left + sliderHandleSize / 2;
            const x1 = rect.right - sliderHandleSize / 2;
            let t = inverseLerp(x0, x1, mouse.X);
            t = clamp(t, 0, 1);

            s.value = lerp(s.start, s.end, t);
            s.t = s.value;
            if (s.step && s.step > 0.0001) {
                s.value = Math.round(s.value / s.step) * s.step;
            }
            s.value = clamp(s.value, s.start, s.end);

        }

    } imEnd();

    return s;
}
