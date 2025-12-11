// sheetAnalytics.js

// Find a column index by header keywords
function findColumnIndex(headers, keywords) {
    const lower = headers.map((h) => (h || "").toString().toLowerCase());
    for (let i = 0; i < lower.length; i++) {
        for (const kw of keywords) {
            if (lower[i].includes(kw)) return i;
        }
    }
    return -1;
}

// Parse a date safely from a cell value
function parseDate(cell) {
    if (!cell) return null;
    const d = new Date(cell);
    if (isNaN(d.getTime())) return null;
    // Normalize to midnight for comparisons
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Detect the date range type from the question and return [start, end]
function detectDateRange(userText) {
    const lower = userText.toLowerCase();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let start, end, label;

    if (lower.includes("last 7 days") || lower.includes("last seven days")) {
        // Last 7 days = from 6 days ago up to yesterday
        end = new Date(today);
        end.setDate(end.getDate() - 1);
        start = new Date(end);
        start.setDate(start.getDate() - 6);
        label = "last 7 days";
    } else if (lower.includes("last month")) {
        // Previous full calendar month
        const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(firstThisMonth.getTime() - 24 * 60 * 60 * 1000); // day before this month
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        label = "last month";
    } else if (lower.includes("yesterday")) {
        end = new Date(today);
        end.setDate(end.getDate() - 1);
        start = new Date(end);
        label = "yesterday";
    } else {
        // Default to yesterday if no range mentioned
        end = new Date(today);
        end.setDate(end.getDate() - 1);
        start = new Date(end);
        label = "yesterday";
    }

    return { start, end, label };
}

// Parse a numeric value from a cell like "$231.27" or "231.27"
function parseNumber(cell) {
    if (!cell) return null;
    const cleaned = cell.toString().replace(/[^0-9.\-]/g, "");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}

// Main function: find ad spend metrics from a sheet for a given range
function summarizeAdSpendFromSheet(userText, sheetValues) {
    if (!sheetValues || sheetValues.length < 2) {
        return {
            ok: false,
            message: "Sheet has no data rows.",
        };
    }

    // Assume first row is headers. If you have two header rows, adjust here.
    const headers = sheetValues[0];

    // Find date and spend columns by header names
    const dateColIndex = findColumnIndex(headers, ["date"]);
    const spendColIndex = findColumnIndex(headers, ["ad spend", "ads spend", "spend", "ad_spend"]);

    if (dateColIndex === -1 || spendColIndex === -1) {
        return {
            ok: false,
            message:
                "I couldn't reliably find a Date column and Ad Spend column in this sheet. Check the header names.",
        };
    }

    const { start, end, label } = detectDateRange(userText);

    let rowsInRange = [];
    let latestOverall = null; // { date, value }

    for (let i = 1; i < sheetValues.length; i++) {
        const row = sheetValues[i];
        const dateCell = row[dateColIndex];
        const spendCell = row[spendColIndex];

        const d = parseDate(dateCell);
        if (!d) continue;

        // Track latest overall date in sheet
        if (!latestOverall || d > latestOverall.date) {
            const val = parseNumber(spendCell);
            latestOverall = {
                date: d,
                dateStr: dateCell,
                value: val,
            };
        }

        // Check if in requested range
        if (d >= start && d <= end) {
            const val = parseNumber(spendCell);
            if (val !== null) {
                rowsInRange.push({
                    date: d,
                    dateStr: dateCell,
                    value: val,
                });
            }
        }
    }

    if (!rowsInRange.length) {
        const rangeDesc =
            label === "yesterday"
                ? `yesterday (${start.toISOString().slice(0, 10)})`
                : `${label} (${start.toISOString().slice(0, 10)} to ${end
                    .toISOString()
                    .slice(0, 10)})`;

        if (!latestOverall) {
            return {
                ok: false,
                message: `I couldn't find any valid ad spend data in this sheet for ${rangeDesc}.`,
            };
        }

        return {
            ok: true,
            hasDataInRange: false,
            label,
            range: { start, end },
            latestOverall,
        };
    }

    // We have data in the range
    const total = rowsInRange.reduce((sum, r) => sum + r.value, 0);
    const days = new Set(rowsInRange.map((r) => r.date.toISOString().slice(0, 10))).size;

    // Sort by date for latest-in-range
    rowsInRange.sort((a, b) => a.date - b.date);
    const latestInRange = rowsInRange[rowsInRange.length - 1];

    return {
        ok: true,
        hasDataInRange: true,
        label,
        range: { start, end },
        total,
        days,
        latestInRange,
        latestOverall,
    };
}

module.exports = {
    summarizeAdSpendFromSheet,
};