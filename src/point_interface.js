const csv = require('csv-parser');
const fs = require('fs');
const {QuadTree, Box, Point, Circle} = require('js-quadtree');
const {measure} = require('./geo_utils.js');

var quadtree;

function load_anchor_points () {
    let [max_x, max_y, min_x, min_y] = [-Infinity, -Infinity, Infinity, Infinity]

    return new Promise((resolve, reject) => {
        let anchor_points = []
        fs.createReadStream('bus_map_dots.csv')
            .pipe(csv())
            .on('data', (row) => {
                max_x = Math.max(row.x, max_x);
                max_y = Math.max(row.y, max_y);
                min_x = Math.min(row.x, min_x);
                min_y = Math.min(row.y, min_y);

                anchor_points.push(row);
            })
            .on('end', () => {
                console.log('Anchor points loaded');
                resolve(anchor_points)
            });
    }).then((anchor_points) => {
        quadtree = new QuadTree(new Box(min_x, min_y, max_x, max_y));
        anchor_points.forEach((element) => {
            quadtree.insert(element);
        });
        console.log('Quadtree populated');
    });    
}

const QUERY_DIST_LIMIT = 0.005;

function query_nearest_point (x, y) {
    if (!quadtree) return -1;

    const points = quadtree.query(new Circle(x, y, QUERY_DIST_LIMIT));

    if (points.length == 0) return -2;

    return points.reduce((left, right) => {
        (measure(x, y, left.x, left.y) < measure(x, y, right.x, right.y)) ? left : right;
    }, {x: Infinity, y: Infinity, FID:-3}).FID;
}

module.exports = {
    load_anchor_points,
    query_nearest_point
}