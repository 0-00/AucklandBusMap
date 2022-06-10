var express = require('express')
var cors = require('cors')
var app = express()

app.use(cors())

const superagent = require('superagent');

var vehicles = {};
var vehicles_payload = [];
var speeds_payload = [];
var routes_lookup = {};

function pull_routes () {
    superagent
    .get('https://api.at.govt.nz/v2/gtfs/routes')
    .set('Ocp-Apim-Subscription-Key', 'd3fc3fa4997b49569eb479e701004670')
    .then(res => {
        routes = res.body.response
        routes.forEach(element => {
            routes_lookup[element.route_id] = element.route_short_name;
        })
        console.log("Routes Pulled.")
    })
}

function measure(lat1, lon1, lat2, lon2){  // generally used geo measurement function
    var R = 6378.137; // Radius of earth in KM
    var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
    var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d * 1000; // meters
}

function arrayMax(arr) {
    var len = arr.length, max = -Infinity;
    while (len--) {
      if (Number(arr[len]) > max) {
        max = Number(arr[len]);
      }
    }
    return max;
  };

function pull_data () {
    superagent
    .get('https://api.at.govt.nz/v2/public/realtime/vehiclelocations')
    .set('Ocp-Apim-Subscription-Key', 'd3fc3fa4997b49569eb479e701004670')
    .then(res => {
      vehicle_response = res.body.response.entity
      var i = 0;
      vehicle_response.forEach(element => {
        //   if (element.vehicle !== undefined) {
        //       vehicle = element.vehicle
        //       console.log(vehicle)
        //       if(vehicle.position !== undefined) {
        //         if (vehicle.position.longitude !== undefined && vehicle.position.latitude !== undefined) {
        //             trip = vehicle.trip !== undefined
        //             bearing = undefined
        //             route = undefined
        //             if (trip && vehicle.trip.route_id !== undefined && routes_lookup[vehicle.trip.route_id] !== undefined) {
        //                 route = routes_lookup[vehicle.trip.route_id]
        //             }
        //             if (vehicle.position.bearing !== undefined){
        //                 bearing = vehicle.position.bearing
        //             }
        //             // console.log(i, vehicle.position.longitude, vehicle.position.latitude, trip);
        //             vehicles_payload.push({lon:vehicle.position.longitude, lat:vehicle.position.latitude, trip:trip, bearing:bearing, route:route});
        //             i++;
        //         }
        //       }
        //   }
        if (element.vehicle) {
            var vehicle = element.vehicle
            if (vehicle.vehicle && vehicle.trip && vehicle.position && vehicle.timestamp) {
                if (vehicles[vehicle.vehicle.id]){
                    if (vehicles[vehicle.vehicle.id][vehicle.timestamp] === undefined){
                        route = undefined
                        bearing = undefined
                        if (vehicle.trip.route_id !== undefined && routes_lookup[vehicle.trip.route_id] !== undefined) {
                            route = routes_lookup[vehicle.trip.route_id]
                        }
                        if (vehicle.position.bearing !== undefined){
                            bearing = vehicle.position.bearing
                        }
                        vehicles[vehicle.vehicle.id][vehicle.timestamp] = {lon:vehicle.position.longitude, lat:vehicle.position.latitude, route:route, bearing:bearing};
                    } else {
                        // console.log("does this fire?");
                        /// ...it fires
                    }
                } else {
                    route = undefined
                    bearing = undefined
                    if (vehicle.trip.route_id !== undefined && routes_lookup[vehicle.trip.route_id] !== undefined) {
                        route = routes_lookup[vehicle.trip.route_id]
                    }
                    if (vehicle.position.bearing !== undefined){
                        bearing = vehicle.position.bearing
                    }
                    vehicles[vehicle.vehicle.id] = {};
                    vehicles[vehicle.vehicle.id][vehicle.timestamp] = {lon:vehicle.position.longitude, lat:vehicle.position.latitude, route:route, bearing:bearing};
                }
            }
        }
        // console.log(vehicles)
      });  

      //NEXT STEP: TAKE MOST RECENT TIMESTAMP (PLUS EXCLUDE THOSE OLDER THAN A FEW MINUTES?) FOR EACH VEHICLE TO BUILD vehicle_payload

      vehicles_payload = []

      Object.keys(vehicles).forEach(e => {

          vehicles_payload.push(vehicles[e][String(arrayMax(Object.keys(vehicles[e])))])
      });

      speeds_payload = [];

      Object.keys(vehicles).forEach(e => {
            var timestamps = Object.keys(vehicles[e]).sort();
            for (var i = 0; i < timestamps.length - 1; i++) {
                var seconds = Number(timestamps[i+1]) - Number(timestamps[i])
                var lat1 = vehicles[e][timestamps[i]].lat
                var lon1 = vehicles[e][timestamps[i]].lon
                var lat2 = vehicles[e][timestamps[i+1]].lat
                var lon2 = vehicles[e][timestamps[i+1]].lon
                var dist = measure(lat1, lon1, lat2, lon2);
                speeds_payload.push({speed:(dist/seconds)*3.6, lat1:lat1, lon1:lon1, lat2:lat2, lon2:lon2, window_measured:seconds});
            }
      });

      console.log("Data pulled.");
    })
    .catch(err => {
        console.log("Error, aborting...")
        console.log(err);
    });
}

console.log("Server Starting...")
pull_routes();
pull_data();
setInterval(pull_data, 1000);

app.get('/buses/', (req, res) => {
    console.log("Buses request received");
    res.send({data: vehicles_payload})
})

app.get('/speeds/', (req, res) => {
    console.log("Speed request received");
    res.send({data: speeds_payload})
})
  
app.listen(8080, function () {
    console.log('Server listening on port 8080')
})