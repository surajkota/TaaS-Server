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
var fs = require('fs');
var io;

var app = setupExpress();
setupSocket();

function socket_handler(socket, mqtt) {
	// Called when a client connects
	mqtt.on('clientConnected', client => {
		
	});

	// Called when a client disconnects
	mqtt.on('clientDisconnected', client => {
		
	});

	// Called when a client publishes data

	mqtt.on('published', (data, client) => {
		if (!client) return;
		//console.log('Message published!', data.topic);
	});


	// Called when a client subscribes
	mqtt.on('subscribed', (topic, client) => {
		if (!client) return;
	});

	// Called when a client unsubscribes
	mqtt.on('unsubscribed', (topic, client) => {
		if (!client) return;

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

	app.get('/food1', (req, res) => {
		res.send({ name: 'Pizza', ingredients: ['onions','capsicums'] });
	});
	app.get('/food2', (req, res) => {
		res.send({ name: 'Lasagna', ingredients: ['cheese','peanuts'] });
	});
	app.get('/food3', (req, res) => {
		res.send({ name: 'Veg Burger', ingredients: ['tomatoes','carrots'] });
	});

	app.post('/sleepIrregular', function(req,res) {
		console.log("sleepIrregular "+JSON.stringify(req.body));
		io.sockets.emit('debug', JSON.stringify(req.body));
		res.send('200 OK');
	});
	app.post('/medicineIrregular', function(req, res) {
		//console.log('received inc post request printing body');
		//console.log(req.body.area);
		console.log("medicineIrregular "+ JSON.stringify(req.body));
	  	io.sockets.emit('debug', "Medicine intake at improper times!\n"+JSON.stringify(req.body));
	  	res.send('200 OK');

	 });

	 app.post('/medicineSkip', function(req, res) {
		/*for (var propName in req.query) {
	    	if (req.query.hasOwnProperty(propName)) {
	    	    console.log(propName, req.query[propName]);
		    }
		}*/
		console.log("medicineSkip "+JSON.stringify(req.body))
		io.sockets.emit('debug', "Skipped medication\n"+JSON.stringify(req.body));
		res.send('200 OK');
	 });

	app.post('/sideEffect', function(request, response){
    	console.log("sideEffect"+JSON.stringify(request.body));
    	io.sockets.emit('debug', "Side effect\n"+JSON.stringify(request.body))
    	response.send('200 OK');
	});

	app.post('/', function(request, response){
    	console.log('req');
    	console.log(request);
    	console.log('req, json');
    	console.log(request.body.jsonhello.toString());
    	var receivedjson = JSON.parse(request.body.jsonhello.toString());
    	receivedjson.treatmentId = Subscriptionid;
    	
    	console.log('duration is:' + receivedjson.treatmentId);
    	
		fs.writeFile(Subscriptionid+'.json', JSON.stringify(receivedjson), function(err) {
		    if(err) {
		        return console.log(err);
		    }

		    console.log("The file was saved!");
		});
		Subscriptionid=Subscriptionid+1;
    	//console.log('req, body');
    	//console.log(request.body);
    	console.log('res ');
    	//console.log(response);
    	response.send('Subscription id is: '+ Subscriptionid);
	});
	
	app.get('/getTDL', function(req,res){
	 	console.log('Received TDL get request!');
	 	var idrequired = req.query['id'];
	 	//var tdl = require('./TDL.json');
	 	var tdl;
	 	fs.readFile('./'+idrequired+'.json', 'utf8', function (err,data) {
		  if (err) {
		    return console.log(err);
		  }
		  data;
		  res.send(data);
		  console.log(data);
		});
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
 	mqttClient.subscribe('minsleep');
 	mqttClient.subscribe('maxsleep');
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
 	}else if(topic == 'minsleep'){
 		io.sockets.emit('minsleep', message.toString());
 	}else if(topic == 'maxsleep'){
 		io.sockets.emit('maxsleep', message.toString());
 	}

});