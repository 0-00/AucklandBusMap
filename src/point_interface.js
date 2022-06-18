const csv = require('csv-parser');
const fs = require('fs');
const {QuadTree, Box, Point, Circle} = require('js-quadtree');

function load_anchor_points () {
    let anchor_points = []
    max_x, max_y, min_x, min_y = -Infinity, -Infinity, Infinity, Infinity

    return new Promise((resolve, reject) => {
        fs.createReadStream('bus_map_dots.csv')
            .pipe(csv())
            .on('data', (row) => {
                max_x = max(row.x, max_x);
                max_y = max(row.y, max_y);
                min_x = min(row.x, min_x);
                min_y = min(row.y, min_y);

                anchor_points.push(row);
            })
            .on('end', () => {
                console.log('Anchor points loaded');
                resolve(ret)
            });
    }).then(() => {
        const quadtree = new QuadTree(new Box(min_x, min_y, max_x, max_y));
        anchor_points.forEach((element) => {
            quadtree.insert(element);
        });
        console.log('Quadtree populated');
    });
    
}

module.exports = {
    load_anchor_points
}