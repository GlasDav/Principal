const fs = require('fs');
const path = "c:\\Users\\David Glasser\\OneDrive\\Documents\\Projects\\DollarData\\frontend\\src\\pages\\NetWorth.jsx";

try {
    const content = fs.readFileSync(path, 'utf8');
    // split by \r\n or \n
    const lines = content.split(/\r?\n/);

    console.log(`Line 456 (to delete): ${lines[455].trim()}`);
    console.log(`Line 624 (to delete): ${lines[623].trim()}`);
    console.log(`Line 625 (to keep): ${lines[624].trim()}`);

    const newLines = [...lines.slice(0, 455), ...lines.slice(624)];

    fs.writeFileSync(path, newLines.join('\n'));
    console.log('Successfully processed file');
} catch (e) {
    console.error(e);
}
