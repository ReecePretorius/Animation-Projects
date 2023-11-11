
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

var rockPositions = [[-0.35, -3.7, 0.0], [0.5, -3.4, 0.0]];
var rockSizes = [[0.3, 0.3, 0.3], [0.6, 0.6, 0.6]];

var seaweedPositions_xy = [[-0.0, -3.4], [0.5, -2.8], [1.0, -3.4]]

// These are used to store the current state of objects.
// In animation it is often useful to think of an object as having some DOF
// Then the animation is simply evolving those DOF over time.
var sphereRotation = [0,0,0];
var spherePosition = [-4,0,0];

var cubeRotation = [0,0,0];
var cubePosition = [-1,0,0];

var cylinderRotation = [0,0,0];
var cylinderPosition = [1.1,0,0];

var coneRotation = [0,0,0];
var conePosition = [3,0,0];

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
            animFlag = true;
            resetTimerFlag = true;
            window.requestAnimFrame(render);
        }
        //console.log(animFlag);
		
		controller = new CameraController(canvas);
		controller.onchange = function(xRot,yRot) {
			RX = xRot;
			RY = yRot;
			window.requestAnimFrame(render); };
    };

    render(0);
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


function create_seaweed() {
    var amplitude = 1.5
    var phase = -0.6
    for(var j = 0; j < 3; j++) {
        var coordinates = seaweedPositions_xy[j]
        for(var i = 0; i < 10; i++) {
            gPush();
            {
                // Tried to use the cosine equation to get the seaweed to wiggle like in the exaple but they stay straight, was unable to figure it out.
                gTranslate((coordinates[0] - Math.cos(amplitude * TIME + phase) * i * 0.1), (coordinates[1] + i * 0.54), 0.0); // x(timestamp) = A * Math.cos(w * timestamp + h)
                gRotate(10 * Math.cos(amplitude * TIME + phase), (coordinates[0] - Math.cos(amplitude * TIME + phase) * i * 0.1), 0.0, 1.0);
                gTranslate(0.0, 0.3, 0.0);

                // Color, Scale, and Draw
                gScale(0.14, 0.3, 0.2);
                setColor(vec4(0.1, 0.6, 0.1, 0.6));
                setColor(vec4(0.1, 0.6, 0.1, 0.6));
                drawSphere();
            }
            gPop();
        }
    }
}


function create_fish() {
    var y_speed = TIME * 1.6;
    var theta = -TIME * 180 / Math.PI // Theta for fish rotation about the y axis

    // head
    gPush();
    {
        gRotate(theta, 0.0, 1.0, 0.0); // Rotate part about y axis
        gTranslate(2.5, Math.cos(y_speed), 0.0)	// Moves part further away from the origin

        // Color, Scale, and Draw
        setColor(vec4(0.6, 0.6, 0.6, 0.0));
        gScale(0.5, 0.5, 0.5);
        drawCone() ;
    }
    gPop();

    // body
    gPush();
    {
        gRotate(theta, 0.0, 1.0, 0.0); // Rotate part about y axis
        gTranslate(2.5, Math.cos(y_speed), -1.25); // Moves part further away from the origin

        // Color, Scale, and Draw
        setColor(vec4(0.6, 0.1, 0.1, 0.0));
        gScale(0.5, 0.5, -2.0);
        drawCone() ;
    }
    gPop();

    // Top tail fin
    gPush();
    {
        gRotate(theta, 0.0, 1.0, 0.0); // Rotate part about y axis
        gTranslate(2.5, 0.34 + Math.cos(y_speed), -2.4); // Moves part further away from the origin
        gRotate(40, 1.0, 0.0, 0.0);

        // Color, Scale, and Draw
        setColor(vec4(0.6, 0.1, 0.1, 0.0));
        gScale(0.2, 0.2, -1.0);
        drawCone() ;
    }
    gPop();

    // Bottom tail fin
    gPush();
    {
        gRotate(theta, 0.0, 1.0, 0.0);	// Rotate part about y axis
        gTranslate(2.5, -0.2 + Math.cos(y_speed), -2.3)	// Moves part further away from the origin
        gRotate(-45, 1.0, 0.0, 0.0)

        // Color, Scale, and Draw
        setColor(vec4(0.6, 0.1, 0.1, 0.0));
        gScale(0.2, 0.2, -0.7);
        drawCone() ;
    }
    gPop();

    // Eye(s)
    for(i = 0; i < 2; i++){
    	gPush();
        {
            gRotate(theta, 0.0, 1.0, 0.0); // Rotate part about y axis
            gTranslate(2.25 + (i * 0.5), 0.2 + Math.cos(y_speed), 0.0); // Moves part further away from the origin

            // Color, Scale, and Draw
            setColor(vec4(1.0, 1.0, 1.0, 0.0));
            gScale(0.1, 0.1, 0.1);
            drawSphere();
        }
        gPop();

        gPush();
        {
            gRotate(theta, 0.0, 1.0, 0.0); // Rotate part about y axis
            gTranslate(2.25 + (i * 0.5), 0.2 + Math.cos(y_speed), 0.075); // Moves part further away from the origin

            // Color, Scale, and Draw
            setColor(vec4(0.0, 0.0, 0.0, 0.0));
            gScale(0.05, 0.05, 0.05);
            drawSphere();
        }
    	gPop();
    }
}


function create_person() {
    var x_speed = TIME / 12;
    var y_speed = TIME / 8;

    // Head
    gPush();
    {
        gTranslate(2.5 * Math.cos(x_speed), (2 * Math.cos(y_speed)) + 2.2, -4); // x and y movement
        gRotate(-16, 0.0, 1.0, 0.0);

        // Color, Scale, and Draw
        gScale(0.3, 0.3, 0.3);
        setColor(vec4(0.6, 0.4, 1.0, 0.0));
        drawSphere();
    }
    gPop();

    // Body
    gPush();
    {
        gTranslate(2.5 * Math.cos(x_speed), (2 * Math.cos(y_speed)) + 1, -4); // x and y movement
        gRotate(-16, 0.0, 1.0, 0.0);

        // Color, Scale, and Draw
        gScale(0.6, 0.9, 0.5);
        setColor(vec4(0.6, 0.4, 1.0, 0.0));
        drawCube();
    }
    gPop();

    // For loop for both legs
    for(i = 0; i < 2; i++){
        // Theta for leg kicking rotation
        var theta = 30 * (Math.cos((TIME - 0.8 - (i * 0.6 * Math.PI)) * 2) + 1)

        // Top part of legs
        gPush();
        {
            gTranslate((2.5 * Math.cos(x_speed)) + 0.2 - (i * 0.6), (2 * Math.cos(y_speed)) + 0.16, -4); // x and y movement
            gRotate(-16, 0.0, 1.0, 0.0);

            gRotate(theta, 1, 0, 0); // Back and forth rotation
            gTranslate(0.0, -0.6, 0.0); // Adjust rotation point

            // Color, Scale, and Draw
            gScale(0.1, 0.6, 0.1);
            setColor(vec4(0.6, 0.4, 1.0, 0.0));
            drawCube();
        }
        gPop();

        // Bottom part of legs
        gPush();
        {
            gTranslate((2.5 * Math.cos(x_speed)) + 0.2 - (i * 0.6), (2 * Math.cos(y_speed)) + 0.16, -4); // x and y movement
            gRotate(-16, 0.0, 1.0, 0.0);

            gRotate(theta, 1, 0, 0); // Back and forth rotation
            gTranslate(0.0, -0.9, 0.0); // Adjust rotation point

            gRotate(theta, 1, 0, 0); // Back and forth rotation
            gTranslate(0.0, -0.8, 0.0); // Adjust rotation point

            // Color, Scale, and Draw
            gScale(0.1, 0.5, 0.1);
            setColor(vec4(0.6, 0.4, 1.0, 0.0));
            drawCube();
        }
        gPop();

        // Feet
        gPush();
        {
            gTranslate((2.5 * Math.cos(x_speed)) + 0.2 - (i * 0.6), (2 * Math.cos(y_speed)) + 0.16, -4); // x and y movement
            gRotate(-16, 0.0, 1.0, 0.0);

            gRotate(theta, 1, 0, 0); // Back and forth rotation
            gTranslate(0.0, -0.9, 0.0); // Adjust rotation point

            gRotate(theta, 1, 0, 0); // Back and forth rotation
            gTranslate(0.0, -1.3, 0.3); // Adjust rotation point

            // Color, Scale, and Draw
            gScale(0.1, 0.08, 0.4);
            setColor(vec4(0.6, 0.4, 1.0, 0.0));
            drawCube();
        }
        gPop();
    }
}


function render(timestamp) {
    
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    eye = vec3(0,0,10);
    MS = []; // Initialize modeling matrix stack
	
	// initialize the modeling matrix to identity
    modelMatrix = mat4();
    
    // set the camera matrix
    viewMatrix = lookAt(eye, at , up);
   
    // set the projection matrix
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);
    
    
    // set all the matrices
    setAllMatrices();

    var currentTime;
	if(animFlag)
    {
		// dt is the change in time or delta time from the last frame to this one
		// in animation typically we have some property or degree of freedom we want to evolve over time
		// For example imagine x is the position of a thing.
		// To get the new position of a thing we do something called integration
		// the simplest form of this looks like:
		// x_new = x + v*dt
		// That is the new position equals the current position + the rate of of change of that position (often a velocity or speed), times the change in time
		// We can do this with angles or positions, the whole x,y,z position or just one dimension. It is up to us!
//		dt = (timestamp - prevTime) / 1000.0;
//		prevTime = timestamp;
        currentTime = (new Date()).getTime() / 1000;
        if(resetTimerFlag) {
            prevTime = currentTime;
            resetTimerFlag = false;
        }
        TIME = TIME + currentTime - prevTime;
        prevTime = currentTime;
	}

	// Ground box.
	gPush();
    {
    	gTranslate(0,-5,0);
    	gScale(6, 1, 4);
        setColor(vec4(0.0,0.0,0.0,0.0));
        drawCube();
    }
    gPop();

    // Rocks.
    for(var i = 0; i < 2; i++) {
        var coordinates = rockPositions[i];
        var scale = rockSizes[i];
        gPush();
        {
        	gTranslate(coordinates[0], coordinates[1], coordinates[2]);
        	gScale(scale[0], scale[1], scale[2]);
            setColor(vec4(0.5,0.4,0.4,0.0));
            drawSphere();
        }
        gPop();
    }

    // Helper function to draw the three strands of seaweed.
    create_seaweed();

    // Helper function to draw the fish and animate its motion.
    create_fish();

    // Helper function to draw the person and animate his path + leg motion.
    create_person();
    
    if(animFlag)
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
