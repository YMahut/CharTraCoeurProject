//----------------------------------------------//
//                                              //
//                 Char TraCoeur                //
//                                              //
//               MahBou Productions             //
//                                              //
//----------------------------------------------//




//-----------------------------------//
//                                   //
//     Dépendances des modules       //
//                                   //
//-----------------------------------//


var express = require('express')
  , http = require('http')
  , path = require('path')
  , fs = require('fs')
  , RaspiCam = require("raspicam")
  , gpio = require("pi-gpio")
  , io = require("socket.io");



//-----------------------------------//
//                                   //
//      Gestion du serveur Web       //
//                                   //
//-----------------------------------//

var app = express();
app.set('port', process.env.PORT || 80);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  res.sendfile("public/index.html");
});

var httpserver = http.createServer(app).listen(app.get('port'), function(){
  console.log('Char TraCoeur Controls on port : ' + app.get('port'));
});


//--------------------------------------//
//                                      //
//  Gestion de la communication client  //
//                                      //
//--------------------------------------//

var client = null;
var io = io.listen(httpserver);
io.set('log level', 1);
io.sockets.on('connection', function(socket){
	client = socket;
    socket.on('RestartRaspicam', function(){
      RestartRaspicam();
    });
    socket.on('MotorControl', function(data){
      MotorControl(data);
    });
});


//--------------------------------------//
//                                      //
//  Gestion Stream Raspicam Timelapse   //
//                                      //
//--------------------------------------//

var img;
var camera = new RaspiCam({
  mode: "timelapse",
  output: "public/timelapse/image_%06d.jpg", // image_000001.jpg, image_000002.jpg,...
  encoding: "jpg",
  width : 640,
  height : 360,
  quality : 20,
  timelapse: 500, 
  timeout: 600000, // 10min
  nopreview : true
});

camera.on("start", function( err, timestamp ){
  console.log("RaspiCam Timelapse Starting");
});

camera.on("read", function( err, timestamp, filename ){
  	if ( filename.charAt(filename.length-1) != '~' ){
		  chemin = "public/timelapse/" + filename;
  		if ( client ) {
  			fs.readFile(chemin, function (err, data) {
  				if (err)
  					console.log(err);
  				else {
  					client.emit('UpdateCamera',new Buffer(data).toString('base64'));
          }
				});
      }
    }
});

camera.on("exit", function( timestamp ){
  console.log("RaspiCam Timelapse stopped");
});

camera.on("stop", function( err, timestamp ){
  console.log("RaspiCam Timelapse stopped");
});

camera.start();

function RestartRaspicam() {
  camera.stop();
  camera.start();
}


//--------------------------------------//
//                                      //
//            Control Moteur            //
//                                      //
//--------------------------------------//

// moteur 1
gpio.open(11, "output");
gpio.open(12, "output");
gpio.open(18, "output");
// moteur 2
gpio.open(15, "output");
gpio.open(16, "output");
gpio.open(22, "output");

function GPH(){
  gpio.write(18,0);
  setTimeout(GPL,pwmg);
}

function DPH(){
  gpio.write(22,0);
  setTimeout(DPL,pwmd);
}

function GPL(){
  gpio.write(18,1);
}

function DPL(){
  gpio.write(22,1);
}

function GSens(mode) {
      if ( mode == 'u'){
        gpio.write(11, 1);
        gpio.write(12, 0);
      } else if ( mode == 'd' ){
        gpio.write(11, 0);
        gpio.write(12, 1);
      } else {
        gpio.write(11, 1);
        gpio.write(12, 1);
      }
} 

function DSens(mode) {
      if ( mode == 'u'){
        gpio.write(15, 1);
        gpio.write(16, 0);
      } else if ( mode == 'd' ){
        gpio.write(15, 0);
        gpio.write(16, 1);
      } else {
        gpio.write(15, 1);
        gpio.write(16, 1);
      }
}

var pwmd = 10;
var pwmg = 10;
var intervalG = setInterval(GPH,10);
var intervalD = setInterval(DPH,10);

function MotorControl(data){
  DSens(data.MDsens);
  GSens(data.MGsens);
  pwmd = data.MDspeed;
  pwmg = data.MGspeed;

}
