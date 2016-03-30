//--------------------------------------//
//                                      //
//     Communication Client Serveur     //
//                                      //
//--------------------------------------//

socket.on('UpdateCamera', function(data){		
	MakeImage(data);
	DrawingCanvas();
});

socket.on('Log', function(data){		
	log = document.getElementById('log');
	log.innerHTML += data;
});

function SendData(){
	vitesse++;
	if ( vitesse > 10 )
		vitesse = 10;
	else {
		data = { MGsens : modeG, MGspeed : vitesse, MDsens : modeD, MDspeed : vitesse };
		socket.emit('MotorControl', data);
		log = document.getElementById('log');
		log.innerHTML += cptlog++ + '. ' + data.MGsens + ' | ' + data.MGspeed + ' | ' + data.MDsens + ' | ' + data.MDspeed + '<br>';
		log.scrollTop = log.scrollHeight;
		datasend = true;
	}
}

function restartpicam(){
	socket.emit('RestartRaspicam');
}

//--------------------------------------//
//                                      //
//           Gestion de l'IHM           //
//                                      //
//--------------------------------------//


//--------------------------------------//
//                                      //
//          Traitement d'image          //
//                                      //
//--------------------------------------//

function MakeImage(data){
		contenu = document.getElementById('camera');
		contenu.innerHTML = "<img id='flux' src='data:image/jpeg;base64," + data + "'>";
		contenu.style.visibility = "hidden";
		contenu.style.height = "0";	
}

function DrawingCanvas(){
	c=document.getElementById("cnvs");
	img=document.getElementById("flux");

	c.width = img.width;
    c.height = img.height;

	ctx=c.getContext("2d");

	ctx.drawImage(img,0,0,640,360);
	ctx.scale(-1, -1);

	imageData=ctx.getImageData(0,0,640,360);
	if ( ( colortracked != undefined ) && ( ctracking ) ){
        imageData.data = DetectColorsAlgo(imageData.data);
    }
	ctx.putImageData(imageData,0,0);
}

// Couleur défini lors de l'étalonnage par clic. Valeur R,G,B et Ratio R,G,B
color = function(r,g,b){
    this.r = r;
    this.g = g;
    this.b = b;
    if ( ( r > b ) && ( r > g ) ) {
        this.max = 0;
        this.rr = 1; 
        this.rg =  g / r;    
        this.rb =  b / r;
    } else {
        if ( ( g > r ) && ( g > b ) ){
            this.max = 1;
            this.rr =  r / g; 
            this.rg =  1;    
            this.rb =  b / g;
        } else {
            this.max = 2;
            this.rr =  r / b; 
            this.rg =  g / b;    
            this.rb =  1;
        }
    }
}

function setColor(event){

    event.preventDefault();
    event.stopPropagation();

    if ( !colortracked ){

        DOMelem = document.getElementById("cnvs");
        
        // Permet de définir la différence entre l'endroit du clic et celui du calcul ( ce dernier se faisant à partir de window.innerHeight = window.innerWidth = 0)
        var positionX = event.clientX;
        var positionY = event.clientY;
        while ( DOMelem.offsetParent ){
            positionX -= DOMelem.offsetLeft;
            positionY -= DOMelem.offsetTop;
            DOMelem = DOMelem.offsetParent;
        }
        
        // marge autour du colortracked ( 10 = 5 à droite, 5 en haut, 5 à gauche, 5 en bas ) pour lequel les pixels sont analysés pour définir un "couleur moyenne"
        var taille_selection = 4;
        var pixelnumber = ( positionY * imageData.width ) + positionX;
        var moy_sel_R = 0, moy_sel_G = 0, moy_sel_B = 0;
        var i = 0;
        for (h = -(taille_selection/2), v = -(taille_selection/2); v < ((taille_selection/2)+1); i++) {
            moy_sel_R += imageData.data[(( pixelnumber + h + ( v * imageData.width) ) * 4)];
            moy_sel_G += imageData.data[(( pixelnumber + h + ( v * imageData.width) ) * 4)+1];
            moy_sel_B += imageData.data[(( pixelnumber + h + ( v * imageData.width) ) * 4)+2];
            h++;
            if ( h == 6 ){
                h = -5;
                v++;
            }
            
        };

        colortracked = new color(Math.floor(moy_sel_R / i),Math.floor(moy_sel_G / i),Math.floor(moy_sel_B / i));
    }

}

function ColorMatch(tampon, R, G, B){  
    if ( ( R >= (tampon.rr - seuil_ratio) ) && R <= (tampon.rr + seuil_ratio) ){
        if ( ( G >= (tampon.rg - seuil_ratio) ) && G <= (tampon.rg + seuil_ratio) ){
            if ( ( B >= (tampon.rb - seuil_ratio) ) && B <= (tampon.rb + seuil_ratio) ){
                return true;
            }
        }
    }
    return false;
}

function NotBlackOrWhite(r,g,b){
    var seuil_extrem = 150;

    if ( (r + g + b) > seuil_extrem ){
        if ((r + g + b) < (765 - seuil_extrem)){
            return true;
        }
    }
    return false;
}

function DetectColorsAlgo(data){

    var nbpixel = 8; // pixels traités = 1 / ( nbpixel / 4 )
    var PixelColored = new Array();
    var PixelColored_index = 0;

        zstart = 0;
        zend = data.length;

    // Parcour de l'image pixel par pixel ( ou 1/3 par défaut )
    for (var i = zstart; i < zend; i=i+nbpixel) { 

        // définition du ratio RGB du pixel en fonction de la couleur du colortracked
        rouge = data[i] / data[i+colortracked.max];
        vert = data[i+1] / data[i+colortracked.max];
        bleu = data[i+2] / data[i+colortracked.max];

        // Vérification de la concordance
        if ( ( ColorMatch( colortracked, rouge, vert, bleu) == true ) && ( NotBlackOrWhite(data[i], data[i+1], data[i+2]) ) ) {
            // Facultatif : Coloration des pixels "positifs"
            data[i] = 0;
            data[i+1] = 255;
            data[i+2] = 0;
            // Ajout des pixels positifs dans un tableau pour traitement ultérieur
            PixelColored[PixelColored_index] = ( i >>> 2);
            PixelColored_index++;
        }
    };

    // marge d'erreur de la detection de la couleur du colortracked
    if ( PixelColored_index > 20){
        Color1 = DefinePosition(PixelColored);
        console.log(Color1);
        if ( Color1.horizontal < 0.35 ){
            modeD = 'd';
            modeG = 'u';
            vitesse = 4;
            SendData();
        } else if ( Color1.horizontal > 0.65){
            modeD = 'u';
            modeG = 'd';
            vitesse = 4;
            SendData();
            setTimeout(function(){vitesse = -1; modeD = '0'; modeG = '0'; SendData('0');}, 500);
        } else {
            vitesse = -1;
            modeD = '0';
            modeG = '0';
            SendData('0');
        }
    } else {
        zend = data.length;
        zstart = 0;
    }   
    return data;
}

function DefinePosition(pixel_tab){
    coordx = 0,
    coordy = 0;
    DOMelem = document.getElementById("cnvs");
    // Somme des coordonnées X,Y des pixels
    for (var i = 0; i < pixel_tab.length; i++) {
        coordx += pixel_tab[i] - ( (Math.floor(pixel_tab[i] / DOMelem.width)) * DOMelem.width);
        coordy += Math.floor(pixel_tab[i] / DOMelem.width);
    };

    // Moyenne des coordonnées X,Y des pixels
    coordx = (Math.floor( coordx / pixel_tab.length )*( window.innerWidth / DOMelem.width));
    coordy = (Math.floor( coordy / pixel_tab.length )*(  window.innerHeight / DOMelem.height));

    return {horizontal : (coordx / window.innerWidth) , vertical : (coordy / window.innerHeight) };
}

//--------------------------------------//
//                                      //
//        Gestion Controle Moteur       //
//                                      //
//--------------------------------------//

var ckeyboard = false;
var cxboxpad = false;
var ctracking = false;
var cmobile = false;
var cptlog = 1;

var datasend = false;
var vitesse=0;
var modeG, modeD;
var cdstart = false;
document.onkeydown = keyboard;
document.onkeyup = keyboard;
window.addEventListener("deviceorientation", mobiledevice, true);

function mobiledevice(event){
	window.eventmob = event;
	if ( cmobile && !cdstart ){
		window.moteur = setInterval(controlgyro,300);
		cdstart = true;
	}
	if ( !cmobile ){
		clearInterval(moteur);
		cdstart = false;
	}

}

function controlgyro(){
		gamma = -Math.floor(Math.abs(eventmob.gamma)/10)+5;
		beta = Math.floor((eventmob.beta)/10);
		log = document.getElementById('log');
		log.innerHTML += cptlog++ + '. ' + gamma + '-' + beta + '<br>';
		log.scrollTop = log.scrollHeight;
}

var moteur;

function keyboard(event){
	event.preventDefault();
	if ( ckeyboard ){
    	if ( event.type == 'keydown' && datasend == false){
        	if ( event.keyCode == 38 ){
        		modeD = 'u';
        		modeG = 'u';
        		SendData();
        		moteur = setInterval(SendData,300);
        	}

        	if ( event.keyCode == 40 ){
        		modeD = 'd';
        		modeG = 'd';
        		SendData();
        		moteur = setInterval(SendData,300);
        	}

        	if ( event.keyCode == 37 ){
        		modeD = 'd';
        		modeG = 'u';
        		SendData();
        		moteur = setInterval(SendData,300);
        	}

	    	if ( event.keyCode == 39 ){
	    		modeD = 'u';
        		modeG = 'd';
        		SendData();
        		moteur = setInterval(SendData,300);
        	}
    	}

    	if ( event.type == 'keyup' ){
    		clearInterval(moteur);
    		vitesse = -1;
    		modeD = '0';
        	modeG = '0';
    		SendData();
    		datasend = false;
    	}
    }
}

function stopmovement(){
    vitesse = -1;
    modeD = '0';
    modeG = '0';
    SendData('0');
}