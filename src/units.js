const _MILLISECOND = 1;
const _SECOND = 1000 * _MILLISECOND;
const _MINUTE = 60 * _SECOND;
const _HOUR = 60 * _MINUTE;
const _DAY = 24 * _HOUR;

function _isDate(value) {
    return Object.prototype.toString.call(value) === "[object Date]" &&
        Number.isFinite(value.getTime());
}

function _plural(value, singular, plural = `${singular}s`) {
    return `${value} ${value === 1 ? singular : plural}`;
}

function _formatElapsedMilliseconds(value) {
    if (!Number.isFinite(value) || value < 0) return "";

    const units = [
        [_DAY, "day"],
        [_HOUR, "hour"],
        [_MINUTE, "minute"],
        [_SECOND, "second"]
    ];
    let remaining = value;
    const parts = [];

    for (const [size, name] of units) {
        const count = Math.floor(remaining / size);
        if (count === 0) continue;

        parts.push(_plural(count, name));
        remaining -= count * size;
    }

    if (remaining !== 0 || parts.length === 0) {
        parts.push(`${remaining} ms`);
    }

    return parts.join(", ");
}

function _installDurationLabeller(labeller) {
    if (
        labeller != null &&
        typeof labeller === "object" &&
        typeof labeller.labelDuration !== "function"
    ) {
        try {
            labeller.labelDuration = _formatElapsedMilliseconds;
        } catch {
            return labeller;
        }
    }

    return labeller;
}

function _installNativeDateDurationSupport() {
    const units = new Set([
        globalThis.Timeline?.NativeDateUnit,
        globalThis.SimileAjax?.NativeDateUnit
    ]);

    for (const unit of units) {
        if (unit == null || typeof unit !== "object") continue;

        if (typeof unit.duration !== "function") {
            try {
                unit.duration = function (start, end) {
                    return _isDate(start) && _isDate(end)
                        ? Math.abs(end.getTime() - start.getTime())
                        : null;
                };
            } catch {
                continue;
            }
        }

        if (
            typeof unit.createLabeller === "function" &&
            unit.createLabeller._repriseDuration !== true
        ) {
            const createLabeller = unit.createLabeller;
            const createDurationLabeller = function (...args) {
                return _installDurationLabeller(
                    createLabeller.apply(this, args)
                );
            };
            createDurationLabeller._repriseDuration = true;
            try {
                unit.createLabeller = createDurationLabeller;
            } catch {
                continue;
            }
        }
    }

    const GregorianDateLabeller =
        globalThis.Timeline?.GregorianDateLabeller;
    if (
        typeof GregorianDateLabeller === "function" &&
        typeof GregorianDateLabeller.prototype.labelDuration !== "function"
    ) {
        try {
            GregorianDateLabeller.prototype.labelDuration =
                _formatElapsedMilliseconds;
        } catch {
            return;
        }
    }
}

class PlanningDayLabeller {
    labelPrecise(value) {
        return `Day ${value}`;
    }

    labelInterval(value) {
        return {
            text: `Day ${value}`,
            emphasized: value % 20 === 0
        };
    }

    labelDuration(value) {
        return _plural(value, "day");
    }
}

const PlanningDayUnit = {
    parseFromObject(value) {
        if (value == null || value === "") return null;

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    },

    getParser() {
        return this.parseFromObject;
    },

    makeDefaultValue() {
        return 0;
    },

    cloneValue(value) {
        return Number(value);
    },

    toNumber(value) {
        return Number(value);
    },

    fromNumber(value) {
        return value;
    },

    compare(left, right) {
        return Number(left) - Number(right);
    },

    earlier(left, right) {
        return this.compare(left, right) < 0 ? left : right;
    },

    later(left, right) {
        return this.compare(left, right) > 0 ? left : right;
    },

    change(value, delta) {
        return Number(value) + delta;
    },

    duration(start, end) {
        return Math.abs(Number(end) - Number(start));
    },

    createLabeller() {
        return new PlanningDayLabeller();
    }
};

class Ma {
    constructor(value) {
        this.value = Number(value);
    }

    valueOf() {
        return -this.value;
    }

    toString() {
        return `${this.value} Ma`;
    }
}

function _formatMa(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";

    if (Math.abs(number) < 1 && !Number.isInteger(number)) {
        return number.toFixed(1);
    }

    return String(number);
}

class MaLabeller {
    labelPrecise(value) {
        return `${_formatMa(value.value)} Ma`;
    }

    labelInterval(value) {
        return {
            text: this.labelPrecise(value),
            emphasized: value.value % 50 === 0
        };
    }

    labelDuration(value) {
        return `${_formatMa(value)} Ma`;
    }
}

const MaUnit = {
    Ma,

    parseFromObject(value) {
        if (value instanceof Ma) return value;

        const candidate =
            value != null &&
            typeof value === "object" &&
            Object.prototype.hasOwnProperty.call(value, "value")
                ? value.value
                : value;
        const number = Number(candidate);
        return Number.isFinite(number) ? new Ma(number) : null;
    },

    getParser() {
        return this.parseFromObject;
    },

    makeDefaultValue() {
        return new Ma(100);
    },

    cloneValue(value) {
        return new Ma(value.value);
    },

    toNumber(value) {
        return -value.value;
    },

    fromNumber(value) {
        return new Ma(-value);
    },

    compare(left, right) {
        return right.value - left.value;
    },

    earlier(left, right) {
        return this.compare(left, right) < 0 ? left : right;
    },

    later(left, right) {
        return this.compare(left, right) > 0 ? left : right;
    },

    change(value, delta) {
        return new Ma(value.value - delta);
    },

    duration(start, end) {
        return Math.abs(start.value - end.value);
    },

    createLabeller() {
        return new MaLabeller();
    }
};

_installNativeDateDurationSupport();

export {
    Ma,
    MaLabeller,
    MaUnit,
    PlanningDayLabeller,
    PlanningDayUnit
};
