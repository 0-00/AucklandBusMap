const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

function create() {
    db.run("CREATE TABLE speeds (node_id, time, speed, bus_route_id)", (err) => {
        if (err) return console.log(err.message);
        console.log("table created")
    });
}

function add_entry (node_id, time, speed, bus_route_id) {
    const sql = `INSERT INTO speeds(node_id, time, speed, bus_route_id) VALUES(?,?,?,?)`
    db.serialize(() => {
        db.run(sql, [node_id, time, speed, bus_route_id], (err) => {
            if (err) return console.log(err.message);
            // console.log("entry added")
        })
    })
}

function print_table() {
    const sql = `SELECT * FROM speeds`
    db.all(sql, [], (err, rows) => {
        if (err) return console.log(err.message);

        rows.forEach((row) => {
            console.log(row)
        })
    })
}

function query_node_avg (node_id) {
    const sql = `SELECT speed FROM speeds WHERE node_id=?`
    db.all(sql, [node_id], (err, rows) => {
        if (err) return console.log(err.message);

        var i = 0;
        rows.forEach((row) => {
            i += row["speed"]
        })
        console.log(i / rows.length);
    })
}

function end() {
    db.close((err) => {
        if (err) return console.log(err.message);
        console.log("db closed")
    });
}

create();

for (var i = 0; i <= 50; i++) {
    add_entry(0, new Date().getTime(), i, 0);
}

// print_table();
query_node_avg(0);

end();