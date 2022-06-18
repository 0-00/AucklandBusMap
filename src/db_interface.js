const knex = require('knex')({
    client: 'sqlite3',
    connection: {
      filename: "../bus_speeds.db"
    }
  });

const sum_rows = (rows) => {
    ret = -1;
    for (row of rows) {
        ret += row["speed"]
    }
    return ret / rows.length;
}

function add_entry (node_id, time, speed, bearing, bus_route_id) {
    knex().from("speeds").insert({
        "node_id": node_id,
        "time": time,
        "speed": speed,
        "bearing": bearing,
        "bus_route_id": bus_route_id
    });
}

async function get_average_speed(node_id) {
    const query = knex.from("speeds")
                       .select("speed")
                       .where("node_id", node_id);

    return await query.then(sum_rows);
}

function close() {
    knex.destroy();
}

// async function main() { 
//     const res = get_average_speed(0).then((ret) => {
//         console.log("output", ret);
//     }).finally(() => {
//         close();
//     });
// }

module.exports = {
    add_entry,
    get_average_speed,
    close
}