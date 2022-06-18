const express = require('express')
const cors = require('cors')
const db = require('../src/db_interface.js')
const anchor_points = require('../src/point_interface.js')
const app = express()
app.use(cors())
const superagent = require('superagent');
const {measure} = require('../src/geo_utils.js');

var vehicles = {};
var routes_lookup = {};

function pull_routes () {
    return superagent
    .get('https://api.at.govt.nz/v2/gtfs/routes')
    .set('Ocp-Apim-Subscription-Key', 'd3fc3fa4997b49569eb479e701004670')
    .then(res => {
        routes = res.body.response
        routes.forEach(element => {
            routes_lookup[element.route_id] = element.route_short_name;
        })
        console.log("Routes Pulled.")
    })
    .catch(err => {
        console.log("Error, aborting...")
        console.log(err);
    });
}

const is_entry_well_formed = (element) => {
    return element.vehicle.vehicle && element.vehicle.trip && element.vehicle.position && element.vehicle.timestamp
}

const build_vehicle_entry = (vehicle) => {
    route = undefined
    bearing = undefined
    if (vehicle.trip.route_id !== undefined && routes_lookup[vehicle.trip.route_id] !== undefined) {
        route = routes_lookup[vehicle.trip.route_id]
    }
    if (vehicle.position.bearing !== undefined){
        bearing = vehicle.position.bearing
    }
    return {lon:vehicle.position.longitude, lat:vehicle.position.latitude, route:route, bearing:bearing};
}


function pull_data () {
    superagent
    .get('https://api.at.govt.nz/v2/public/realtime/vehiclelocations')
    .set('Ocp-Apim-Subscription-Key', 'd3fc3fa4997b49569eb479e701004670')
    .then(res => {

      vehicle_response = res.body.response.entity
      var i = 0;
      delta = {}
      new_vehicles = []
      
      vehicle_response.forEach(element => {
        if (element.vehicle) {
            if (is_entry_well_formed(element)) {
                var vehicle = element.vehicle;
                if (vehicle.vehicle.id in vehicles){
                    if (vehicles[vehicle.vehicle.id][vehicle.timestamp] === undefined){
                        vehicles[vehicle.vehicle.id][vehicle.timestamp] = build_vehicle_entry(vehicle)
                        delta[vehicle.vehicle.id] = vehicles[vehicle.vehicle.id][vehicle.timestamp];
                    }
                } else {
                    vehicles[vehicle.vehicle.id] = {};
                    vehicles[vehicle.vehicle.id][vehicle.timestamp] = build_vehicle_entry(vehicle)
                    new_vehicles.push(vehicles[vehicle.vehicle.id][vehicle.timestamp]);
                }
            }
        }
      });

      const moved_vehicles = Object.keys(delta).length;

      const vehicle_distances = Object.keys(delta).map((entry)=>{
        let timestamps = Object.keys(vehicles[entry]);
        let pos1 = vehicles[entry][timestamps[timestamps.length-1]]
        let pos2 = vehicles[entry][timestamps[timestamps.length-2]]
        return measure(pos1.lat, pos1.lon, pos2.lat, pos2.lon);
      });

      const vehicle_times = Object.keys(delta).map((entry)=>{
        let timestamps = Object.keys(vehicles[entry]);
        return Number(timestamps[timestamps.length-1]) - Number(timestamps[timestamps.length-2]);
      });

      const zip = (a, b) => a.map((k, i) => [k, b[i]]);

      const vehicle_speeds = zip(vehicle_distances, vehicle_times).map((entry) => {
        return (entry[0] / entry[1]) * 3.6;
      })

      const avg = (values) => {
        return values.reduce((partialSum, a) => partialSum + a, 0) / moved_vehicles;
      }

      console.log("Data pulled.");
      console.log("Update for", moved_vehicles, "vehicles");
      console.log("Average time since last update for these was", avg(vehicle_times), "seconds");
      console.log("Average distance travelled since last update for these was", avg(vehicle_distances), "metres");
      console.log("Average speed since last update for these was", avg(vehicle_speeds), "kmh");
      console.log(new_vehicles.length, "new vehicles discovered\n");
    })
    .catch(err => {
        console.log("Error, aborting...")
        console.log(err);
    });
}

console.log("Server Starting...");
pull_routes().then(pull_data).then(() => {setInterval(pull_data, 1000)});
