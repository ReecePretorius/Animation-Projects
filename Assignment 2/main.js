var canvas;
var gl;

var program;

var near = 1;
var far = 100;


var left = -6.0;
var right = 6.0;
var ytop =6.0;
var bottom = -6.0;


var lightPosition2 = vec4(100.0, 100.0, 100.0, 1.0 );
var lightPosition = vec4(0.0, 0.0, 100.0, 1.0 );

var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0 );
var lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var materialAmbient = vec4( 1.0, 0.0, 1.0, 1.0 );
var materialDiffuse = vec4( 1.0, 0.8, 0.0, 1.0 );
var materialSpecular = vec4( 0.4, 0.4, 0.4, 1.0 );
var materialShininess = 30.0;

var ambientColor, diffuseColor, specularColor;

var modelMatrix, viewMatrix, modelViewMatrix, projectionMatrix, normalMatrix;
var modelViewMatrixLoc, projectionMatrixLoc, normalMatrixLoc;
var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

var RX = 0;
var RY = 0;
var RZ = 0;

var MS = []; // The modeling matrix stack
var TIME = 0.0; // Realtime
var dt = 0.0
var prevTime = 0.0;
var resetTimerFlag = true;
var animFlag = false;
var controller;

// These are used to store the current state of objects.
// In animation it is often useful to think of an object as having some DOF
// Then the animation is simply evolving those DOF over time.
var bezierRotation = [0,0,0];

var useTextures = 1;
var texSize = 64;

// Setting up array for texture images
var img = new Array()
for (var i =0; i<texSize; i++)  img[i] = new Array();
for (var i =0; i<texSize; i++)
for ( var j = 0; j < texSize; j++)
img[i][j] = new Float32Array(4);
for (var i =0; i<texSize; i++) for (var j=0; j<texSize; j++) {
    var c = (((i & 0x8) == 0) ^ ((j & 0x8)  == 0));
    img[i][j] = [c, c, c, 1];
}

//Convert the image to u-int8 rather than float
var img_converted = new Uint8Array(4*texSize*texSize);
for ( var i = 0; i < texSize; i++ )
for ( var j = 0; j < texSize; j++ )
for(var k =0; k<4; k++)
img_converted[4*texSize*i+4*j+k] = 255*img[i][j][k];

//making a texture image procedurally
//Let's start with a 1-D array
var imageCheckerBoardData = new Array();

// Now for each entry of the array make another array
// 2D array now!
for (var i =0; i<texSize; i++)
	imageCheckerBoardData[i] = new Array();

// Now for each entry in the 2D array make a 4 element array (RGBA! for colour)
for (var i =0; i<texSize; i++)
	for ( var j = 0; j < texSize; j++)
		imageCheckerBoardData[i][j] = new Float32Array(4);

// Now for each entry in the 2D array let's set the colour.
// We could have just as easily done this in the previous loop actually
for (var i =0; i<texSize; i++) 
	for (var j=0; j<texSize; j++) {
		var c = (i + j ) % 2;
		imageCheckerBoardData[i][j] = [c, c, c, 1];
}

//Convert the image to u-int8 rather than float.
var imageCheckerboard = new Uint8Array(4*texSize*texSize);

for (var i = 0; i < texSize; i++)
	for (var j = 0; j < texSize; j++)
	   for(var k =0; k<4; k++)
			imageCheckerboard[4*texSize*i+4*j+k] = 255*imageCheckerBoardData[i][j][k];
		
// For this example we are going to store a few different textures here
var textureArray = [] ;

// Setting the colour which is needed during illumination of a surface
function setColor(c)
{
    ambientProduct = mult(lightAmbient, c);
    diffuseProduct = mult(lightDiffuse, c);
    specularProduct = mult(lightSpecular, materialSpecular);
    
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "ambientProduct"),flatten(ambientProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "diffuseProduct"),flatten(diffuseProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "specularProduct"),flatten(specularProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "lightPosition"),flatten(lightPosition) );
    gl.uniform1f( gl.getUniformLocation(program, 
                                        "shininess"),materialShininess );
}

// We are going to asynchronously load actual image files this will check if that call if an async call is complete
// You can use this for debugging
function isLoaded(im) {
    if (im.complete) {
        console.log("loaded") ;
        return true ;
    }
    else {
        console.log("still not loaded!!!!") ;
        return false ;
    }
}

// Helper function to load an actual file as a texture
// NOTE: The image is going to be loaded asynchronously (lazy) which could be
// after the program continues to the next functions. OUCH!
function loadFileTexture(tex, filename)
{
	//create and initialize a web-gl texture object.
    tex.textureWebGL  = gl.createTexture();
    tex.image = new Image();
    tex.image.src = filename ;
    tex.isTextureReady = false ;
    tex.image.onload = function() { handleTextureLoaded(tex); }
}

// Once the above image file loaded with loadFileTexture is actually loaded,
// this function is the on-load handler and will be called.
function handleTextureLoaded(textureObj) {
	//Binds a texture to a target. Target is then used in future calls.
		//Targets:
			// TEXTURE_2D           - A two-dimensional texture.
			// TEXTURE_CUBE_MAP     - A cube-mapped texture.
			// TEXTURE_3D           - A three-dimensional texture.
			// TEXTURE_2D_ARRAY     - A two-dimensional array texture.
    gl.bindTexture(gl.TEXTURE_2D, textureObj.textureWebGL);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // otherwise the image would be flipped upsdide down
	
	//texImage2D(Target, internalFormat, width, height, border, format, type, ImageData source)
    //Internal Format: What type of format is the data in? We are using a vec4 with format [r,g,b,a].
        //Other formats: RGB, LUMINANCE_ALPHA, LUMINANCE, ALPHA
    //Border: Width of image border. Adds padding.
    //Format: Similar to Internal format. But this responds to the texel data, or what kind of data the shader gets.
    //Type: Data type of the texel data
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureObj.image);
	
	//Set texture parameters.
    //texParameteri(GLenum target, GLenum pname, GLint param);
    //pname: Texture parameter to set.
        // TEXTURE_MAG_FILTER : Texture Magnification Filter. What happens when you zoom into the texture
        // TEXTURE_MIN_FILTER : Texture minification filter. What happens when you zoom out of the texture
    //param: What to set it to.
        //For the Mag Filter: gl.LINEAR (default value), gl.NEAREST
        //For the Min Filter: 
            //gl.LINEAR, gl.NEAREST, gl.NEAREST_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR (default value), gl.LINEAR_MIPMAP_LINEAR.
    //Full list at: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
	
	//Generates a set of mipmaps for the texture object.
        /*
            Mipmaps are used to create distance with objects. 
        A higher-resolution mipmap is used for objects that are closer, 
        and a lower-resolution mipmap is used for objects that are farther away. 
        It starts with the resolution of the texture image and halves the resolution 
        until a 1x1 dimension texture image is created.
        */
    gl.generateMipmap(gl.TEXTURE_2D);
	
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //Prevents s-coordinate wrapping (repeating)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); //Prevents t-coordinate wrapping (repeating)
    gl.bindTexture(gl.TEXTURE_2D, null);
    console.log(textureObj.image.src) ;
    
    textureObj.isTextureReady = true ;
}

// Takes an array of textures and calls render if the textures are created/loaded
// This is useful if you have a bunch of textures, to ensure that those files are
// actually loaded from disk you can wait and delay the render function call
// Notice how we call this at the end of init instead of just calling requestAnimFrame like before
function waitForTextures(texs) {
    setTimeout(
		function() {
			   var n = 0 ;
               for ( var i = 0 ; i < texs.length ; i++ )
               {
                    console.log(texs[i].image.src) ;
                    n = n+texs[i].isTextureReady ;
               }
               wtime = (new Date()).getTime() ;
               if( n != texs.length )
               {
               		console.log(wtime + " not ready yet") ;
               		waitForTextures(texs) ;
               }
               else
               {
               		console.log("ready to render") ;
					render(0);
               }
		},
	5) ;
}

// This will use an array of existing image data to load and set parameters for a texture
// We'll use this function for procedural textures, since there is no async loading to deal with
function loadImageTexture(tex, image) {
	//create and initialize a web-gl texture object.
    tex.textureWebGL  = gl.createTexture();
    tex.image = new Image();

	//Binds a texture to a target. Target is then used in future calls.
		//Targets:
			// TEXTURE_2D           - A two-dimensional texture.
			// TEXTURE_CUBE_MAP     - A cube-mapped texture.
			// TEXTURE_3D           - A three-dimensional texture.
			// TEXTURE_2D_ARRAY     - A two-dimensional array texture.
    gl.bindTexture(gl.TEXTURE_2D, tex.textureWebGL);

	//texImage2D(Target, internalFormat, width, height, border, format, type, ImageData source)
    //Internal Format: What type of format is the data in? We are using a vec4 with format [r,g,b,a].
        //Other formats: RGB, LUMINANCE_ALPHA, LUMINANCE, ALPHA
    //Border: Width of image border. Adds padding.
    //Format: Similar to Internal format. But this responds to the texel data, or what kind of data the shader gets.
    //Type: Data type of the texel data
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize, texSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
	
	//Generates a set of mipmaps for the texture object.
        /*
            Mipmaps are used to create distance with objects. 
        A higher-resolution mipmap is used for objects that are closer, 
        and a lower-resolution mipmap is used for objects that are farther away. 
        It starts with the resolution of the texture image and halves the resolution 
        until a 1x1 dimension texture image is created.
        */
    gl.generateMipmap(gl.TEXTURE_2D);
	
	//Set texture parameters.
    //texParameteri(GLenum target, GLenum pname, GLint param);
    //pname: Texture parameter to set.
        // TEXTURE_MAG_FILTER : Texture Magnification Filter. What happens when you zoom into the texture
        // TEXTURE_MIN_FILTER : Texture minification filter. What happens when you zoom out of the texture
    //param: What to set it to.
        //For the Mag Filter: gl.LINEAR (default value), gl.NEAREST
        //For the Min Filter: 
            //gl.LINEAR, gl.NEAREST, gl.NEAREST_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR (default value), gl.LINEAR_MIPMAP_LINEAR.
    //Full list at: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //Prevents s-coordinate wrapping (repeating)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); //Prevents t-coordinate wrapping (repeating)
    gl.bindTexture(gl.TEXTURE_2D, null);

    tex.isTextureReady = true;
}

// This just calls the appropriate texture loads for this example adn puts the textures in an array
function initTexturesForExample() {
    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"sunset.bmp"); // 0
    
    textureArray.push({});
    loadImageTexture(textureArray[textureArray.length-1],imageCheckerboard); // 1

    textureArray.push({});
    loadImageTexture(textureArray[textureArray.length-1],img_converted); // 2

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/moon.jpg"); // 3

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/earth.jpg"); // 4

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/north_pole.png"); // 5

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/solar_panel.jpg"); // 6

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/sat_body.jpg"); // 7

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/sat_arms.jpg"); // 8

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/ufo_window.jpg"); // 9

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/ufo_body.jpg"); // 10

    textureArray.push({});
    loadFileTexture(textureArray[textureArray.length-1],"textures/space.png"); // 11
}

// Changes which texture is active in the array of texture examples (see initTexturesForExample)
function toggleTextures() {
//    useTextures = (useTextures + 1) % 2
    useTextures = 1 - useTextures;
	gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
}

window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.5, 0.5, 1.0, 1.0 );
    
    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );


    setColor(materialDiffuse);
	
	// Initialize some shapes, note that the curved ones are procedural which allows you to parameterize how nice they look
	// Those number will correspond to how many sides are used to "estimate" a curved surface. More = smoother
    Cube.init(program);
    Cylinder.init(20,program);
    Cone.init(20,program);
    Sphere.init(36,program);

    gl.uniform1i( gl.getUniformLocation(program, "useTextures"), useTextures );
	
	// We're going to initialize a new shape that will sort of look like a terrain for fun
    //	p1 = [[vec3(-3,-3,0), vec3(-1,-3,0), vec3(1,-3,0), vec3(3,-3,0)],
    //		 [vec3(-3,-1,0), vec3(-1,-1,3), vec3(1,-1,3), vec3(3,-1,0)],
    //		 [vec3(-3,1,0), vec3(-1,1,3), vec3(1,1,3), vec3(3,1,0)],
    //		 [vec3(-3,3,0), vec3(-1,3,0), vec3(1,3,0), vec3(3,3,0)]] ;
    //	gBezierPatch1 = new BezierPatch3(2.0,p1,program) ;

    // Matrix uniforms
    modelViewMatrixLoc = gl.getUniformLocation( program, "modelViewMatrix" );
    normalMatrixLoc = gl.getUniformLocation( program, "normalMatrix" );
    projectionMatrixLoc = gl.getUniformLocation( program, "projectionMatrix" );
    
    // Lighting Uniforms
    gl.uniform4fv( gl.getUniformLocation(program, 
       "ambientProduct"),flatten(ambientProduct) );
    gl.uniform4fv( gl.getUniformLocation(program, 
       "diffuseProduct"),flatten(diffuseProduct) );
    gl.uniform4fv( gl.getUniformLocation(program, 
       "specularProduct"),flatten(specularProduct) );	
    gl.uniform4fv( gl.getUniformLocation(program, 
       "lightPosition"),flatten(lightPosition) );
    gl.uniform1f( gl.getUniformLocation(program, 
       "shininess"),materialShininess );


    document.getElementById("animToggleButton").onclick = function() {
        if( animFlag ) {
            animFlag = false;
        }
        else {
            animFlag = true  ;
            resetTimerFlag = true ;
            window.requestAnimFrame(render);
        }
    };
    
    document.getElementById("textureToggleButton").onclick = function() {
        toggleTextures() ;
        window.requestAnimFrame(render);
    };

    var controller = new CameraController(canvas);
    controller.onchange = function(xRot,yRot) {
        RX = xRot ;
        RY = yRot ;
        window.requestAnimFrame(render); };
	
	
	// Helper function to load the set of textures
    initTexturesForExample() ;

    waitForTextures(textureArray);
}

// Sets the modelview and normal matrix in the shaders
function setMV() {
    modelViewMatrix = mult(viewMatrix,modelMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    normalMatrix = inverseTranspose(modelViewMatrix);
    gl.uniformMatrix4fv(normalMatrixLoc, false, flatten(normalMatrix) );
}

// Sets the projection, modelview and normal matrix in the shaders
function setAllMatrices() {
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix) );
    setMV();   
}

// Draws a 2x2x2 cube center at the origin
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawCube() {
    setMV();
    Cube.draw();
}

// Draws a sphere centered at the origin of radius 1.0.
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawSphere() {
    setMV();
    Sphere.draw();
}

// Draws a cylinder along z of height 1 centered at the origin
// and radius 0.5.
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawCylinder() {
    setMV();
    Cylinder.draw();
}

// Draws a cone along z of height 1 centered at the origin
// and base radius 1.0.
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawCone() {
    setMV();
    Cone.draw();
}

// Draw a Bezier patch
function drawB3(b) {
	setMV() ;
	b.draw() ;
}

// Post multiples the modelview matrix with a translation matrix
// and replaces the modeling matrix with the result
function gTranslate(x,y,z) {
    modelMatrix = mult(modelMatrix,translate([x,y,z]));
}

// Post multiples the modelview matrix with a rotation matrix
// and replaces the modeling matrix with the result
function gRotate(theta,x,y,z) {
    modelMatrix = mult(modelMatrix,rotate(theta,[x,y,z]));
}

// Post multiples the modelview matrix with a scaling matrix
// and replaces the modeling matrix with the result
function gScale(sx,sy,sz) {
    modelMatrix = mult(modelMatrix,scale(sx,sy,sz));
}

// Pops MS and stores the result as the current modelMatrix
function gPop() {
    modelMatrix = MS.pop();
}

// pushes the current modelViewMatrix in the stack MS
function gPush() {
    MS.push(modelMatrix);
}

/**
/ FUNCTIONS AND VARS FOR DISPLAYING FRAME-RATE IN THE CONSOLE.
*/

var fps = 0

function printFPS() {
    console.log("Frame-rate: " + Math.round(fps/2)) // divide fps by 2
    fps = 0
}
var frame_rate = setInterval(printFPS, 2000) // Print FPS to console every 2000ms (2 seconds)


/**
/ FUNCTIONS FOR DRAWING OBJECTS IN WORLD.
*/

function drawBackground() {
    gPush()
    {
        setColor(vec4(0.0,0.0,0.0,1.0)) // set color as black
        gScale(15, 15, 15)

        gl.bindTexture(gl.TEXTURE_2D, textureArray[11].textureWebGL)
        gl.uniform1i(gl.getUniformLocation(program, "spaceTexture"), 0)

        drawCube()
    }
    gPop()
}

function drawPlanet() {
    gPush()
    {
        gTranslate(0,0,0); // Initial position
        gRotate(20*TIME,0,0,1); // Z Axis Rotation over TIME
        s = 2.5; // Scale factor
        gScale(s, s, s);

        setColor(vec4(1.0,0.0,0.0,1.0));

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureArray[4].textureWebGL);
        gl.uniform1i(gl.getUniformLocation(program, "earthTexture"), 0);

        d = 8
        drawSphere(); // Earth

        gPush()
        {
            gPush()
            {
                gTranslate(0,0,1.04);
                gScale(0.08, 0.08, 0.4);

                gl.bindTexture(gl.TEXTURE_2D, textureArray[5].textureWebGL);
                gl.uniform1i(gl.getUniformLocation(program, "poleTexture"), 0);

                drawCylinder(); // North Pole
            }
            gPop()

            drawMoon();

            drawSatelliteBig();

            drawSatelliteSmall();
        }
        gPop()
    }
    gPop()
}

function drawMoon() {
    gPush()
    {
        gRotate(60*-TIME,0,0,1); // Rotation/Orbit of the Moon

        gl.bindTexture(gl.TEXTURE_2D, textureArray[3].textureWebGL)
        gl.uniform1i(gl.getUniformLocation(program, "moonTexture"), 0)

        gPush()
        {
            gTranslate(d/3,0,0) ;
            gScale(s/10, s/10, s/10)
            drawSphere() // Moon
        }
        gPop()
    }
    gPop()
}

function drawSatelliteBig() {
    gPush()
    {
        gRotate(24*TIME,0,0,1); // Rotation/Orbit around the earth.
        setColor(vec4(1.0,0.0,0.0,1.0));

        gPush()
        {
            gTranslate(d/6,0,0);
            gScale(s/18, s/18, s/12);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[7].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "bodyTexture"), 0);

            drawCylinder(); // Satellite Body
        }
        gPop()

        gPush()
        {
            gRotate(90,1,0,0);
            gTranslate(d/6,0,0);
            gScale(s/40, s/40, s/4);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[8].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "armTexture"), 0);

            drawCylinder(); // Satellite Arms

            gPush()
            {
                var theta = 20 * (Math.cos((TIME - 1 - (i * 0.6 * Math.PI)) * 2) + 0) // Back and forth rotation of the solar panels about the arms.
                gTranslate(0,0.6,0.34);
                gRotate(theta,0,0,1);
                gScale(s/1.6, s/30, s/30);

                gl.bindTexture(gl.TEXTURE_2D, textureArray[6].textureWebGL);
                gl.uniform1i(gl.getUniformLocation(program, "panelTexture"), 0);

                drawCube(); // Satellite Arm Panel (Left)
            }
            gPop()

            gPush()
            {
                gRotate(-20,0,0,1); // Initial Position/Angle
                var theta = 20 * (Math.cos((TIME - 0.4 - (i * 0.6 * Math.PI)) * 2) + 1) // Back and forth rotation of the solar panels about the arms.
                gTranslate(0,0.6,-0.34);
                gRotate(theta,0,0,1);
                gScale(s/1.6, s/30, s/30);

                gl.bindTexture(gl.TEXTURE_2D, textureArray[6].textureWebGL);
                gl.uniform1i(gl.getUniformLocation(program, "panelTexture"), 0);

                drawCube(); // Satellite Arm Panel (Right)
            }
            gPop()
        }
        gPop()
    }
    gPop()
}

function drawSatelliteSmall() {
    gPush()
    {
        gRotate(30*TIME,0,1,0); // Rotation/Orbit around the earth.
        setColor(vec4(1.0,0.0,0.0,1.0));

        gPush()
        {
            gTranslate(d/6,0,0); // Initial Position/Angle
            gScale(s/24, s/24, s/18);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[7].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "bodyTexture"), 0);

            drawCylinder(); // Satellite Body
        }
        gPop()

        gPush()
        {
            gRotate(90,1,0,0); // Initial Position/Angle
            gTranslate(d/6,0,0);
            gScale(s/46, s/46, s/10);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[8].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "armTexture"), 0);

            drawCylinder(); // Satellite Arms

            gPush()
            {
                var theta = 20 * (Math.cos((TIME - 1 - (i * 0.6 * Math.PI)) * 2) + 1) // Back and forth rotation of the solar panels about the arms.
                gTranslate(0,0.6,0.34); // set to correct Position
                gRotate(theta,0,0,1);
                gScale(s/1.6, s/36, s/36);

                gl.bindTexture(gl.TEXTURE_2D, textureArray[6].textureWebGL);
                gl.uniform1i(gl.getUniformLocation(program, "panelTexture"), 0);

                drawCube(); // Satellite Arm Panel (Left)
            }
            gPop()

            gPush()
            {
                gRotate(-20,0,0,1); // Initial Position/Angle
                var theta = 20 * (Math.cos((TIME - 0.4 - (i * 0.6 * Math.PI)) * 2) + 1) // Back and forth rotation of the solar panels about the arms.
                gTranslate(0,0.6,-0.34);
                gRotate(theta,0,0,1);
                gScale(s/1.6, s/36, s/36);

                gl.bindTexture(gl.TEXTURE_2D, textureArray[6].textureWebGL);
                gl.uniform1i(gl.getUniformLocation(program, "panelTexture"), 0);

                drawCube(); // Satellite Arm Panel (Right)
            }
            gPop()
        }
        gPop()
    }
    gPop()
}

function drawUFOClose() {
    gPush()
    {
        gTranslate(4,-14,4);
        s=1.6; // Scale factor
        gScale(s,s,s/3);
        gTranslate(8*-TIME,7*TIME,0);

        gPush()
        {
            gRotate(80*TIME,0,0,1); // Body rotates/spins as the ship flies.

            gl.bindTexture(gl.TEXTURE_2D, textureArray[10].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "UfoBodyTexture"), 0);

            drawSphere(); // UFO Body
        }
        gPop()

        gPush()
        {
            gTranslate(0,0,1.2);
            gScale(s/3,s/3,s/3);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[9].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "UfoWindowTexture1"), 0);

            drawSphere(); // UFO Window
        }
        gPop()

        gPush()
        {
            gTranslate(0,0,0.76);
            gScale(s/1.5,s/1.5,s/2);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[8].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "UfoWindowTexture2"), 0);

            drawCylinder(); // Window Edge
        }
        gPop()

    }
    gPop()
}

function drawUFOFar() {
    gPush()
    {
        gTranslate(-32,3,3);
        gRotate(-20,1,0,0);
        s=1;
        gScale(s,s,s/3);
        gTranslate(8*TIME,0,0);

        gPush()
        {
            gRotate(80*TIME,0,0,1); // Body rotates/spins as the ship flies.

            gl.bindTexture(gl.TEXTURE_2D, textureArray[10].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "UfoBodyTexture"), 0);

            drawSphere(); // UFO Body
        }
        gPop()

        gPush()
        {
            gTranslate(0,0,1.2);
            gScale(s/3,s/3,s/3);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[9].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "UfoWindowTexture1"), 0);

            drawSphere(); // UFO Window
        }
        gPop()

        gPush()
        {
            gTranslate(0,0,0.76);
            gScale(s/1.5,s/1.5,s/2);

            gl.bindTexture(gl.TEXTURE_2D, textureArray[8].textureWebGL);
            gl.uniform1i(gl.getUniformLocation(program, "UfoWindowTexture2"), 0);

            drawCylinder(); // Window Edge
        }
        gPop()

    }
    gPop()
}

function render(timestamp) {
    
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    eye = vec3(0,-10,10);
    MS = []; // Initialize modeling matrix stack
	
	// initialize the modeling matrix to identity
    modelMatrix = mat4();
    
    // set the camera matrix
    viewMatrix = lookAt(eye, at, up);
   
    // set the projection matrix
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);

    if (TIME < 20) { // 360 Camera Fly Around Using lookAt() and setMV()
        RY = TIME*10
        rot = 1*(Math.sin(TIME/5))
    }
    setMV();
    gRotate(RZ,0,0,1);
    gRotate(RY,0,1,0);
    gRotate(RX,1,0,0);
    
    // set all the matrices
    setAllMatrices();

    var curTime;
	if( animFlag )
    {
		// dt is the change in time or delta time from the last frame to this one
		// in animation typically we have some property or degree of freedom we want to evolve over time
		// For example imagine x is the position of a thing.
		// To get the new position of a thing we do something called integration
		// the simpelst form of this looks like:
		// x_new = x + v*dt
		// That is the new position equals the current position + the rate of of change of that position (often a velocity or speed), times the change in time
		// We can do this with angles or positions, the whole x,y,z position or just one dimension. It is up to us!
		// dt = (timestamp - prevTime) / 1000.0;
		// prevTime = timestamp;
        curTime = (new Date()).getTime() / 1000 ;
        if(resetTimerFlag) {
            prevTime = curTime ;
            resetTimerFlag = false ;
        }
        TIME = TIME + curTime - prevTime ; // Real Time.
        prevTime = curTime ;
	}

	drawBackground(); // Draws the background cube with the stars texture on it

	drawPlanet(); // Also draws north pole, moon, and satellites

	drawUFOClose(); // Draws and animates the UFO that fly's by close to the "Camera"

	drawUFOFar(); // Draws the UFO that is flying behind all the other objects and further away from the camera

	fps++; // counter for the fps display function
    
    if( animFlag )
        window.requestAnimFrame(render);
}

// A simple camera controller which uses an HTML element as the event
// source for constructing a view matrix. Assign an "onchange"
// function to the controller as follows to receive the updated X and
// Y angles for the camera:
//
//   var controller = new CameraController(canvas);
//   controller.onchange = function(xRot, yRot) { ... };
//
// The view matrix is computed elsewhere.
function CameraController(element) {
	var controller = this;
	this.onchange = null;
	this.xRot = 0;
	this.yRot = 0;
	this.scaleFactor = 3.0;
	this.dragging = false;
	this.curX = 0;
	this.curY = 0;
	
	// Assign a mouse down handler to the HTML element.
	element.onmousedown = function(ev) {
		controller.dragging = true;
		controller.curX = ev.clientX;
		controller.curY = ev.clientY;
	};
	
	// Assign a mouse up handler to the HTML element.
	element.onmouseup = function(ev) {
		controller.dragging = false;
	};
	
	// Assign a mouse move handler to the HTML element.
	element.onmousemove = function(ev) {
		if (controller.dragging) {
			// Determine how far we have moved since the last mouse move
			// event.
			var curX = ev.clientX;
			var curY = ev.clientY;
			var deltaX = (controller.curX - curX) / controller.scaleFactor;
			var deltaY = (controller.curY - curY) / controller.scaleFactor;
			controller.curX = curX;
			controller.curY = curY;
			// Update the X and Y rotation angles based on the mouse motion.
			controller.yRot = (controller.yRot + deltaX) % 360;
			controller.xRot = (controller.xRot + deltaY);
			// Clamp the X rotation to prevent the camera from going upside
			// down.
			if (controller.xRot < -90) {
				controller.xRot = -90;
			} else if (controller.xRot > 90) {
				controller.xRot = 90;
			}
			// Send the onchange event to any listener.
			if (controller.onchange != null) {
				controller.onchange(controller.xRot, controller.yRot);
			}
		}
	};
}
