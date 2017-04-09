/*
 * Server.js
 * 
 * The main portion of this project. Contains all the defined routes for express,
 * rules for the websockets, and rules for the MQTT broker.
 * 
 * Refer to the portions surrounded by --- for points of interest
 */
var express   = require('express'),
	app       = express();
var pug       = require('pug');

var sockets   = require('socket.io');
var path      = require('path');
var http      = require('http');
var mqttc 	  = require('mqtt'),
 mqttclient = mqttc.connect('mqtt://192.168.0.8:1883');

var conf      = require(path.join(__dirname, 'config'));
var internals = require(path.join(__dirname, 'internals'));
var myParser = require("body-parser");

var area1 = 0;
var area2 = 0;
var area3 = 0;
var area4 = 0;

// -- Setup the application
setupExpress();
setupSocket();




// -- Socket Handler
// Here is where you should handle socket/mqtt events
// The mqtt object should allow you to interface with the MQTT broker through 
// events. Refer to the documentation for more info 
// -> https://github.com/mcollina/mosca/wiki/Mosca-basic-usage
// ----------------------------------------------------------------------------
function socket_handler(socket, mqtt) {
	// Called when a client connects
	mqtt.on('clientConnected', client => {
		socket.emit('debug', {
			type: 'CLIENT', msg: 'New client connected: ' + client.id
		});
	});

	// Called when a client disconnects
	mqtt.on('clientDisconnected', client => {
		socket.emit('debug', {
			type: 'CLIENT', msg: 'Client "' + client.id + '" has disconnected'
		});
	});


	// Called when a client publishes data
	mqtt.on('published', (data, client) => {
		if (!client) return;
		
		socket.emit('debug', {
			type: 'PUBLISH', 
			msg: 'Client "' + client.id + '" published "' + JSON.stringify(data) + '"'
		});
	});

	// Called when a client subscribes
	mqtt.on('subscribed', (topic, client) => {
		if (!client) return;
		mqttclient.publish('count1',area1.toString());
		mqttclient.publish('count2',area2.toString());
		mqttclient.publish('count3',area3.toString());
		mqttclient.publish('count4',area4.toString());
		socket.emit('debug', {
			type: 'SUBSCRIBE',
			msg: 'Client "' + client.id + '" subscribed to "' + topic + '"'
		});
	});

	// Called when a client unsubscribes
	mqtt.on('unsubscribed', (topic, client) => {
		if (!client) return;

		socket.emit('debug', {
			type: 'SUBSCRIBE',
			msg: 'Client "' + client.id + '" unsubscribed from "' + topic + '"'
		});
	});
}
// ----------------------------------------------------------------------------

// Helper functions
function setupExpress() {
	app.set('view engine', 'pug'); // Set express to use pug for rendering HTML

	// Setup the 'public' folder to be statically accessable
	var publicDir = path.join(__dirname, 'public');
	app.use(express.static(publicDir));

	// Setup the paths (Insert any other needed paths here)
	// ------------------------------------------------------------------------
	// Home page
	app.get('/', (req, res) => {
		res.render('index', {title: 'MQTT Tracker'});
	});

	app.use(myParser.urlencoded({extended : true}));
	app.post("/incheat", function(request, response) {
       console.log('inc' + request.body.area);
       mqttclient.publish(request.body.area.toString(),'1');
       console.log('exe');
       response.send('node to android i response');
 	});

	app.post("/decheat", function(request, response) {
       console.log('dec' + request.body.area);
       //inc_heatmap(usesocket,request.body.area,0); //This is what happens when a POST request is sent to /registeruser
       mqttclient.publish(request.body.area.toString(),'0');
       response.send('node to android d response');
 	});	

	app.get('/area1', function(req,res){
		res.send({count: area1});
	});

	app.get('/area2', function(req,res){
		res.send({count: area2});
	});

	app.get('/area3', function(req,res){
		res.send({count: area3});
	});

	app.get('/area4', function(req,res){
		res.send({count: area4});
	})


	// Basic 404 Page
	app.use((req, res, next) => {
		var err = {
			stack: {},
			status: 404,
			message: "Error 404: Page Not Found '" + req.path + "'"
		};

		// Pass the error to the error handler below
		next(err);
	});

	// Error handler
	app.use((err, req, res, next) => {
		console.log("Error found: ", err);
		res.status(err.status || 500);

		res.render('error', {title: 'Error', error: err.message});
	});
	// ------------------------------------------------------------------------

	// Handle killing the server
	process.on('SIGINT', () => {
		internals.stop();
		process.kill(process.pid);
	});
}

var io;
function setupSocket() {
	var server = require('http').createServer(app);
	io = sockets(server);

	// Setup the internals
	internals.start(mqtt => {
		io.on('connection', socket => {
			socket_handler(socket, mqtt)
		});
	});

	server.listen(conf.PORT, conf.HOST, () => { 
		console.log("Listening on: " + conf.HOST + ":" + conf.PORT);
	});
}

mqttclient.on('connect', function () {
mqttclient.subscribe('0x101010101000');  
mqttclient.subscribe('0x101010101001');
mqttclient.subscribe('0x101010101010');
mqttclient.subscribe('0x101010101011');
});

mqttclient.on('message', function (topic, message) {
// message is Buffer 
	var areaid = topic;
	if(areaid == '0x101010101010' || areaid == '0x101010101000' ||areaid == '0x101010101001' ||areaid == '0x101010101011' )
	{
		var vraw = parseInt(message.toString()); 
		console.log(topic);
		console.log(vraw);

		//inc_heatmap(data.topic, data.payload.toString('utf8').charAt(0));
		
		var incordec = vraw;
		
		if(areaid == '0x101010101010'){
			console.log('in area3');
			if(incordec == 0){
				area3 = Math.max(0,(area3 - 1));
				console.log('3dcounter' + area3);
				io.sockets.emit('area3', { msg:area3 });
				mqttclient.publish('count3',area3.toString());
			}else{
				area3 = area3 + 1;
				console.log('3counter' + area3);
				io.sockets.emit('area3', { msg:area3 });
				mqttclient.publish('count3',area3.toString());

			}
		}else if(areaid == '0x101010101011'){
			console.log('in area4');
			if(incordec == 0){
				area4 = Math.max(0,(area4 - 1));
				console.log('4dcounter' + area4);
				io.sockets.emit('area4', { msg:area4 });
				mqttclient.publish('count4',area4.toString());
			}else{
				console.log('4counter' + area4);
				area4 = area4 + 1;
				io.sockets.emit('area4', { msg:area4 });
				mqttclient.publish('count4',area4.toString());
			}
		}else if(areaid == '0x101010101001'){
			console.log('in area2');
			if(incordec == 0){
				area2 = Math.max(0,(area2 - 1));
				console.log('2dcounter' + area2);
				io.sockets.emit('area2', { msg:area2 });
				mqttclient.publish('count2',area2.toString());
			}else{
				console.log('2counter' + area2);
				area2 = area2 + 1;
				io.sockets.emit('area2', { msg:area2 });
				mqttclient.publish('count2',area2.toString());
			}
		}
		else if(areaid == '0x101010101000'){
			console.log('in area1');
			if(incordec == 0){
				area1 = Math.max(0,(area1 - 1));
				console.log('1dcounter' + area1);
				io.sockets.emit('area1', { msg:area1 });
				mqttclient.publish('count1',area1.toString());
			}else{
				console.log('1counter' + area1);
				area1 = area1 + 1;
				io.sockets.emit('area1', { msg:area1 });
				mqttclient.publish('count1',area1.toString());
			}
		}
	}
});