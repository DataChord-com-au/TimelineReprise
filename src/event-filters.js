function filterEvents(events, {
    tagsContain = [],
    tagsNotContain = [],
    tagsNotOnlyContain = []
} = {}) {
    return events.filter(event => {
        const tags = event.tags || [];

        if (tagsContain.length && !tagsContain.some(tag => tags.includes(tag))) {
            return false;
        }

        if (tagsNotContain.length && tagsNotContain.some(tag => tags.includes(tag))) {
            return false;
        }

        if (
            tagsNotOnlyContain.length &&
            tags.length &&
            tags.every(tag => tagsNotOnlyContain.includes(tag))
        ) {
            return false;
        }

        return true;
    });
}

export { filterEvents };
