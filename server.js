/*
 * Server.js
 * 
 * The main portion of this project. Contains all the defined routes for express,
 * rules for the websockets, and rules for the MQTT broker.
 * 
 * Refer to the portions surrounded by --- for points of interest
 */
var express   = require('express');
//var pug       = require('pug');
var bodyParser = require('body-parser');
var sockets   = require('socket.io');
var path      = require('path');
var mqtt1 	  = require('mqtt');
var bodyParser = require('body-parser');

var conf      = require(path.join(__dirname, 'config'));
var internals = require(path.join(__dirname, 'internals'));
var mqttClient = mqtt1.connect('mqtt://broker.hivemq.com:1883');
var Subscriptionid = 1234;
var area = [0,0,0,0];

var app = setupExpress();
setupSocket();

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
		//console.log('Message published!', data.topic);
		socket.emit('debug', {
			type: 'PUBLISH', 
			msg: 'Client "' + client.id + '" published "' + JSON.stringify(data) + '"'
		});
	});


	// Called when a client subscribes
	mqtt.on('subscribed', (topic, client) => {
		if (!client) return;

		socket.emit('debug', {
			type: 'SUBSCRIBE',
			msg: 'Client "' + client.id + '" subscribed to "' + topic + '"'
		});
		if(topic=='thres')
			mqttClient.publish('thres','10');
		else if(topic=='count1')
			mqttClient.publish('count1',area[0].toString());
		else if(topic=='count2')
			mqttClient.publish('count2',area[1].toString());
		else if(topic=='count3')
			mqttClient.publish('count3',area[2].toString());
		else if(topic=='count4')
			mqttClient.publish('count4',area[3].toString());
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
	//app.set('view engine', 'pug'); // Set express to use pug for rendering HTML
	
	// Setup the 'public' folder to be statically accessable
	
	var viewsDir = path.join(__dirname, 'views');
	var publicDir = path.join(__dirname, 'public');
	var app = express();
	app.use(express.static(publicDir));
	//app.use(bodyParser());
	
	app.engine('html', require('ejs').renderFile);
	app.set('view engine', 'html');
	app.use(bodyParser.urlencoded({ extended: true }));
	// Setup the paths (Insert any other needed paths here)
	// ------------------------------------------------------------------------
	// Home page
	app.get('/', (req, res) => {
		res.render('taasweb.html', { root: '.' });
	});

	app.post('/sleepIrregular', function(req,res) {
		res.send('200 OK');
	});
	app.post('/medicineIrregular', function(req, res) {
		//console.log('received inc post request printing body');
		//console.log(req.body.area);
	  	if(!req.body.hasOwnProperty('area')){
	    	res.statusCode = 400;
	    	return res.send('Error 400: Post syntax incorrect.');
	  	}
	  	mqttClient.publish(req.body.area, '1');
	  	res.send('200 OK');

	 }); 

	 app.post('/medicineSkip', function(req, res) {
		/*for (var propName in req.query) {
	    	if (req.query.hasOwnProperty(propName)) {
	    	    console.log(propName, req.query[propName]);
		    }
		}*/
		io.sockets.emit('debug', req.body.toString());
		res.send('200 OK');
	 });

	app.post('/', function(request, response){
    	console.log('req');
    	console.log(request);
    	console.log('req, json');
    	console.log(request.body.jsonhello.toString());
    	console.log('duration is:' + JSON.parse(request.body.jsonhello.toString()).duration);
    	//console.log('req, body');
    	//console.log(request.body);
    	console.log('res ');
    	//console.log(response);
    	response.send('Subscription id is: '+ Subscriptionid);
	});
	
	app.post('/sideEffect', function(request, response){
    	console.log(request.body);
    	console.log(response);
    	response.send('200 OK');
	});

	 app.get('/getTDL', function(req,res){
	 	console.log('Received TDL get request!');
	 	var tdl = require('./TDL.json');
	 	console.log('Sending '+tdl);
	 	res.send(tdl);
	 });

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
	/*app.use((err, req, res, next) => {
		console.log("Error found: ", err);
		res.status(err.status || 500);

		res.render('error', {title: 'Error', error: err.message});
	});*/

	app.use(function(err, req, res, next)
	{
		console.log(err.stack);
		res.status(err.status || 500);

		res.sendFile('/views/error.html', { root: '.' });
	});
	// ------------------------------------------------------------------------

	// Handle killing the server
	process.on('SIGINT', () => {
		internals.stop();
		process.kill(process.pid);
	});

	/*app.listen(8080, function() {
  		console.log('Server running at 8080/');
	});*/
	return app;
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

mqttClient.on('connect', function () {
	mqttClient.subscribe('timesaday');
 	mqttClient.subscribe('medicineName');
 	mqttClient.subscribe('startDay');
 	mqttClient.subscribe('endDay');
 	mqttClient.subscribe('specifytime');
 	mqttClient.subscribe('aspect');
 	mqttClient.subscribe('duration');
 	mqttClient.subscribe('quantity');
});

mqttClient.on('message', function (topic, message) {
 	console.log(topic, 'message is: '+ message);
 	io.sockets.emit('debug', message.toString());
 	if(topic == 'duration'){
 		io.sockets.emit('duration', message.toString());
 	}else if(topic == 'aspect'){
 		io.sockets.emit('aspect', message.toString()); 		
 	}else if(topic == 'medicineName'){
 		io.sockets.emit('medicineName', message.toString()); 	
 	}else if(topic == 'timesaday'){
 		io.sockets.emit('timesaday', message.toString()); 		
 	}else if(topic == 'quantity'){
 		io.sockets.emit('quantity', message.toString());  		
 	}else if(topic == 'startDay'){
 		io.sockets.emit('startDay', message.toString());
 	}else if(topic == 'endDay'){
 		io.sockets.emit('endDay', message.toString()); 		
 	}

});