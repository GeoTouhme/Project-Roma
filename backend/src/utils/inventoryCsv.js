'use strict';
const csvParser = require('csv-parser');
const { Readable } = require('node:stream');

// Parse logical CSV records, including quoted newlines, with the existing dependency.
async function parseInventoryCSV(buffer) {
  // csv-parser accepts an unfinished quoted cell at EOF. Reject malformed quote
  // syntax before handing logical-record parsing to the library.
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  let state = 'start';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (state === 'quoted') {
      if (char === '"' && text[i + 1] === '"') i++;
      else if (char === '"') state = 'closed';
    } else if (char === ',' || char === '\r' || char === '\n') state = 'start';
    else if (char === '"' && state === 'start') state = 'quoted';
    else if (char === '"' || state === 'closed') throw new Error('Malformed CSV quote syntax');
    else state = 'unquoted';
  }
  if (state === 'quoted') throw new Error('Unterminated quoted CSV field');
  const records = [];
  const parser = Readable.from([Buffer.from(text)]).pipe(csvParser({ headers: false, maxRowBytes: 10 * 1024 * 1024 }));
  for await (const row of parser) {
    const values = Object.values(row);
    if (values.some(value => value.trim() !== '')) records.push(values);
  }
  return records;
}
module.exports = { parseInventoryCSV };
