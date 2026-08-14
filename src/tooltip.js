const _captionTooltipStateByDocument = new WeakMap();
let _captionTooltipNextId = 0;

function _captionTooltipDocument(element) {
    return element?.ownerDocument ?? globalThis.document ?? null;
}

function _captionTooltipWindow(doc) {
    return doc?.defaultView ?? globalThis.window ?? null;
}

function _removeNativeTitle(element) {
    if (typeof element?.removeAttribute === "function") {
        element.removeAttribute("title");
    }
    if (element != null && Object.prototype.hasOwnProperty.call(element, "title")) {
        delete element.title;
    }
}

function _readAttribute(element, name) {
    if (typeof element?.getAttribute === "function") {
        return element.getAttribute(name) ?? "";
    }
    return element?.attributes?.[name] ?? "";
}

function _writeAttribute(element, name, value) {
    if (typeof element?.setAttribute === "function") {
        element.setAttribute(name, value);
    } else if (element != null) {
        element.attributes ??= {};
        element.attributes[name] = value;
    }
}

function _removeAttribute(element, name) {
    if (typeof element?.removeAttribute === "function") {
        element.removeAttribute(name);
    } else if (element?.attributes != null) {
        delete element.attributes[name];
    }
}

function _captionPlainText(value) {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.map(_captionPlainText).join("");
    if (value?.nodeType != null) return value.textContent ?? value.nodeValue ?? "";
    return String(value);
}

function _createCaptionTooltip(doc) {
    const tooltip = doc.createElement("div");
    const id = `timeline-reprise-tooltip-${++_captionTooltipNextId}`;

    tooltip.id = id;
    tooltip.className = "timeline-reprise-tooltip";
    _writeAttribute(tooltip, "role", "tooltip");
    _writeAttribute(tooltip, "aria-hidden", "true");
    tooltip.style.display = "none";
    tooltip.style.position = "fixed";
    tooltip.style.pointerEvents = "none";

    const parent = doc.body ?? doc.documentElement;
    parent?.appendChild?.(tooltip);

    return { tooltip, activeBinding: null };
}

function _captionTooltipState(doc) {
    let state = _captionTooltipStateByDocument.get(doc);
    if (state == null) {
        state = _createCaptionTooltip(doc);
        _captionTooltipStateByDocument.set(doc, state);
    }
    return state;
}

function _setDescribedBy(element, tooltipId, enabled) {
    const values = String(_readAttribute(element, "aria-describedby"))
        .split(/\s+/)
        .filter(Boolean)
        .filter(value => value !== tooltipId);

    if (enabled) values.push(tooltipId);
    if (values.length === 0) {
        _removeAttribute(element, "aria-describedby");
    } else {
        _writeAttribute(element, "aria-describedby", values.join(" "));
    }
}

function _viewportSize(doc) {
    const view = _captionTooltipWindow(doc);
    const width = Number(view?.innerWidth) || Number(doc?.documentElement?.clientWidth);
    const height = Number(view?.innerHeight) || Number(doc?.documentElement?.clientHeight);

    return {
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null
    };
}

function _pointerCoordinate(event, name, pageName, scrollName, view) {
    if (Number.isFinite(event?.[name])) return event[name];
    if (Number.isFinite(event?.[pageName])) {
        return event[pageName] - (Number(view?.[scrollName]) || 0);
    }
    return null;
}

function _positionCaptionTooltip(binding, event) {
    const { element, tooltip, maxWidth } = binding;
    const doc = _captionTooltipDocument(element);
    const view = _captionTooltipWindow(doc);
    const viewport = _viewportSize(doc);
    const margin = 8;
    const gap = 10;
    const availableWidth = viewport.width == null
        ? maxWidth
        : Math.max(1, viewport.width - margin * 2);

    tooltip.style.maxWidth = Math.min(maxWidth, availableWidth) + "px";

    const targetRect = element.getBoundingClientRect?.() ?? {};
    const pointerX = _pointerCoordinate(event, "clientX", "pageX", "pageXOffset", view);
    const pointerY = _pointerCoordinate(event, "clientY", "pageY", "pageYOffset", view);
    const tooltipRect = tooltip.getBoundingClientRect?.() ?? {};
    const tooltipWidth = Number(tooltipRect.width) || Number(tooltip.offsetWidth) || 0;
    const tooltipHeight = Number(tooltipRect.height) || Number(tooltip.offsetHeight) || 0;
    const targetLeft = Number(targetRect.left) || 0;
    const targetTop = Number(targetRect.top) || 0;
    const targetWidth = Number(targetRect.width) || Number(element.offsetWidth) || 0;
    const targetHeight = Number(targetRect.height) || Number(element.offsetHeight) || 0;
    let left = pointerX == null
        ? targetLeft + targetWidth / 2 - tooltipWidth / 2
        : pointerX + gap;
    let top = pointerY == null
        ? targetTop + targetHeight + gap
        : pointerY + gap;

    if (viewport.width != null) {
        left = Math.min(left, viewport.width - tooltipWidth - margin);
        left = Math.max(margin, left);
    }
    if (viewport.height != null && top + tooltipHeight > viewport.height - margin) {
        top = (pointerY == null ? targetTop : pointerY) - tooltipHeight - gap;
    }
    if (viewport.height != null) {
        top = Math.min(top, viewport.height - tooltipHeight - margin);
        top = Math.max(margin, top);
    }

    tooltip.style.left = Math.round(left) + "px";
    tooltip.style.top = Math.round(top) + "px";
}

function _hideCaptionTooltip(binding) {
    const doc = _captionTooltipDocument(binding?.element);
    const state = doc == null ? null : _captionTooltipStateByDocument.get(doc);
    if (state?.activeBinding !== binding) return;

    state.tooltip.style.display = "none";
    _writeAttribute(state.tooltip, "aria-hidden", "true");
    _setDescribedBy(binding.element, state.tooltip.id, false);
    state.activeBinding = null;
}

function _showCaptionTooltip(binding, event) {
    const value = binding.renderCaption();
    const text = _captionPlainText(value);
    if (text === "") {
        _hideCaptionTooltip(binding);
        return;
    }

    const doc = _captionTooltipDocument(binding.element);
    if (doc == null || typeof doc.createElement !== "function") return;

    const state = _captionTooltipState(doc);
    if (state.activeBinding != null && state.activeBinding !== binding) {
        _setDescribedBy(
            state.activeBinding.element,
            state.tooltip.id,
            false
        );
    }

    state.activeBinding = binding;
    binding.tooltip = state.tooltip;
    state.tooltip.textContent = text;
    state.tooltip.style.display = "block";
    _writeAttribute(state.tooltip, "aria-hidden", "false");
    _setDescribedBy(binding.element, state.tooltip.id, true);
    _positionCaptionTooltip(binding, event);
}

function _installCaptionHandler(element, name, handler) {
    if (typeof element.addEventListener === "function") {
        element.addEventListener(name, handler);
        return;
    }

    const property = "on" + name;
    const previous = element[property];
    element[property] = function () {
        if (typeof previous === "function") previous.apply(this, arguments);
        return handler.apply(this, arguments);
    };
}

function _makeCaptionTargetFocusable(element) {
    const tagName = String(element?.tagName ?? "").toLowerCase();
    const naturallyFocusable = tagName === "button" ||
        tagName === "input" ||
        tagName === "select" ||
        tagName === "textarea" ||
        (tagName === "a" && _readAttribute(element, "href") !== "");
    const hasTabIndex = _readAttribute(element, "tabindex") !== "";

    if (!naturallyFocusable && !hasTabIndex) {
        _writeAttribute(element, "tabindex", "0");
    }
}

function installCaptionTooltip(
    element,
    {
        enabled = true,
        maxWidth = 300,
        renderCaption,
        focusable = true
    } = {}
) {
    _removeNativeTitle(element);
    if (element == null || !enabled || typeof renderCaption !== "function") {
        return false;
    }

    const binding = { element, maxWidth, renderCaption, tooltip: null };
    element._repriseCaptionTooltipBinding = binding;
    if (focusable) _makeCaptionTargetFocusable(element);

    _installCaptionHandler(element, "mouseenter", event => {
        _showCaptionTooltip(binding, event);
    });
    _installCaptionHandler(element, "mousemove", event => {
        const doc = _captionTooltipDocument(element);
        const state = doc == null ? null : _captionTooltipStateByDocument.get(doc);
        if (state?.activeBinding === binding) {
            _positionCaptionTooltip(binding, event);
        }
    });
    _installCaptionHandler(element, "mouseleave", () => {
        _hideCaptionTooltip(binding);
    });
    _installCaptionHandler(element, "focus", event => {
        _showCaptionTooltip(binding, event);
    });
    _installCaptionHandler(element, "blur", () => {
        _hideCaptionTooltip(binding);
    });

    return true;
}

export { installCaptionTooltip };
