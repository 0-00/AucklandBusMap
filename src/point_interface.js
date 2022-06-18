const csv = require('csv-parser');
const fs = require('fs');

let anchor_points = []

function load_anchor_points () {
    fs.createReadStream('bus_map_dots.csv')
        .pipe(csv())
        .on('data', (row) => {
            anchor_points.push(row);
        })
        .on('end', () => {
            console.log('Anchor points loaded');
            resolve(ret)
        });
}

module.exports = {
    load_anchor_points
}