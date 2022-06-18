const express = require("express");
const cors = require("cors");
const db = require("../src/db_interface.js");
const anchor_points = require("../src/point_interface.js");
const app = express();
app.use(cors());
const superagent = require("superagent");
const { measure } = require("../src/geo_utils.js");

var vehicles = {};
var routes_lookup = {};

const sum = (values) => {
  return values.reduce((partialSum, a) => partialSum + a, 0);
};

const avg = (values, denom) => {
  return values.reduce((partialSum, a) => partialSum + a, 0) / denom;
};

const min = (values) => {
  if (values.length == 0) return Infinity;
  if (values.length == 1) return values[0];
  return values.reduce(
    (left, right) => (left > right ? right : left),
    Infinity
  );
};

const max = (values) => {
  if (values.length == 0) return -Infinity;
  if (values.length == 1) return values[0];
  return values.reduce(
    (left, right) => (left < right ? right : left),
    -Infinity
  );
};

const zip = (a, b) => a.map((k, i) => [k, b[i]]);

function pull_routes() {
  return superagent
    .get("https://api.at.govt.nz/v2/gtfs/routes")
    .set("Ocp-Apim-Subscription-Key", "d3fc3fa4997b49569eb479e701004670")
    .then((res) => {
      routes = res.body.response;
      routes.forEach((element) => {
        routes_lookup[element.route_id] = element.route_short_name;
      });
      console.log("Routes Pulled.");
    })
    .catch((err) => {
      console.log("Error, aborting...");
      console.log(err);
    });
}

const is_entry_well_formed = (element) => {
  return (
    element.vehicle.vehicle &&
    element.vehicle.trip &&
    element.vehicle.position &&
    element.vehicle.timestamp
  );
};

const build_vehicle_entry = (vehicle) => {
  route = undefined;
  bearing = undefined;
  if (
    vehicle.trip.route_id !== undefined &&
    routes_lookup[vehicle.trip.route_id] !== undefined
  ) {
    route = routes_lookup[vehicle.trip.route_id];
  }
  if (vehicle.position.bearing !== undefined) {
    bearing = vehicle.position.bearing;
  }
  return {
    lon: vehicle.position.longitude,
    lat: vehicle.position.latitude,
    route: route,
    bearing: bearing,
  };
};

function log_delta(delta) {
  const moved_vehicles = delta.length;

  const vehicle_distances = delta.map((entry) => {
    let timestamps = Object.keys(vehicles[entry]);
    let pos1 = vehicles[entry][timestamps[timestamps.length - 1]];
    let pos2 = vehicles[entry][timestamps[timestamps.length - 2]];
    return measure(pos1.lat, pos1.lon, pos2.lat, pos2.lon);
  });

  const vehicle_times = delta.map((entry) => {
    let timestamps = Object.keys(vehicles[entry]);
    return (
      Number(timestamps[timestamps.length - 1]) -
      Number(timestamps[timestamps.length - 2])
    );
  });

  const vehicle_speeds = zip(vehicle_distances, vehicle_times).map((entry) => {
    return (entry[0] / entry[1]) * 3.6;
  });

  const aging_count = (eval) => {
    let timestamps = Object.values(vehicles).map((entry) => {
      return max(Object.keys(entry));
    });
    let latestTime = max(timestamps);
    return sum(
      timestamps.map((value) => {
        return eval(Number(latestTime) - Number(value)) ? 1 : 0;
      }, Infinity)
    );
  };

  console.log("Update for", moved_vehicles, "vehicles");
  if (moved_vehicles > 0) {
    console.log(
      "TIME (s)     | ",
      "min:",
      parseInt(min(vehicle_times)),
      "avg:",
      parseInt(avg(vehicle_times, moved_vehicles)),
      "max:",
      parseInt(max(vehicle_times))
    );
    console.log(
      "DISTANCE (m) | ",
      "min:",
      parseInt(min(vehicle_distances)),
      "avg:",
      parseInt(avg(vehicle_distances, moved_vehicles)),
      "max:",
      parseInt(max(vehicle_distances))
    );
    console.log(
      "SPEED (kmh)  | ",
      "min:",
      parseInt(min(vehicle_speeds)),
      "avg:",
      parseInt(avg(vehicle_speeds, moved_vehicles)),
      "max:",
      parseInt(max(vehicle_speeds))
    );
  }
  console.log(new_vehicles.length, "new vehicles discovered\n");
  console.log("Aging vehicles:");
  console.log(
    "Less than 5 seconds ",
    aging_count((value) => value >= 0 && value < 5)
  );
  console.log(
    "Less than 10 seconds",
    aging_count((value) => value >= 5 && value < 10)
  );
  console.log(
    "Less than 30 seconds",
    aging_count((value) => value >= 10 && value < 30)
  );
  console.log(
    "Less than 60 seconds",
    aging_count((value) => value >= 30 && value < 60)
  );
  console.log(
    "Less than 10 minutes",
    aging_count((value) => value >= 60 && value < 600)
  );
  console.log(
    "Less than 30 minutes",
    aging_count((value) => value >= 600 && value < 1800)
  );
  console.log(
    "More than 30 minutes",
    aging_count((value) => value >= 1800)
  );
}

function pull_data() {
  superagent
    .get("https://api.at.govt.nz/v2/public/realtime/vehiclelocations")
    .set("Ocp-Apim-Subscription-Key", "d3fc3fa4997b49569eb479e701004670")
    .then((res) => {
      vehicle_response = res.body.response.entity;
      delta = [];
      new_vehicles = [];

      vehicle_response.forEach((element) => {
        if (element.vehicle) {
          if (is_entry_well_formed(element)) {
            var vehicle = element.vehicle;
            if (vehicle.vehicle.id in vehicles) {
              if (
                vehicles[vehicle.vehicle.id][vehicle.timestamp] === undefined
              ) {
                vehicles[vehicle.vehicle.id][vehicle.timestamp] =
                  build_vehicle_entry(vehicle);
                delta.push(vehicle.vehicle.id);
              }
            } else {
              vehicles[vehicle.vehicle.id] = {};
              vehicles[vehicle.vehicle.id][vehicle.timestamp] =
                build_vehicle_entry(vehicle);
              new_vehicles.push(
                vehicles[vehicle.vehicle.id][vehicle.timestamp]
              );
            }
          }
        }
      });
      const ENABLE_REPORTING = false;
      console.log("Data pulled.");
      if (ENABLE_REPORTING) {
        log_delta(delta);
      }

      delta.map((entry) => {
        let timestamps = Object.keys(vehicles[entry]);
        let pos1 = vehicles[entry][timestamps[timestamps.length - 1]];
        let pos2 = vehicles[entry][timestamps[timestamps.length - 2]];
        let dist = measure(pos1.lat, pos1.lon, pos2.lat, pos2.lon);
        let time =
          Number(timestamps[timestamps.length - 1]) -
          Number(timestamps[timestamps.length - 2]);
        let speed = (dist / time) * 3.6; // adjust m/s to km/h

        node_id = anchor_points.query_nearest_point(
          (pos1.lon + pos2.lon) / 2,
          (pos1.lat + pos2.lat) / 2
        );

        bearing = (parseInt(pos1.bearing) + parseInt(pos2.bearing)) / 2;

        bus_route_id = pos1.route;

        console.log(
          "node_id:",
          node_id,
          "time:",
          time,
          "speed:",
          parseInt(speed),
          "bearing:",
          bearing,
          "bus_route_id:",
          bus_route_id
        );
      });
      console.log("");
    })
    .catch((err) => {
      console.log("Error, aborting...");
      console.log(err);
    });
}

console.log("Server Starting...");
pull_routes()
  .then(anchor_points.load)
  .then(pull_data)
  .then(() => {
    setInterval(pull_data, 1000);
  });
