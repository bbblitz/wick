var WickEditor = (function () {

	var wickEditor = { version: 'pre-alpha' };

/*****************************
	Settings
*****************************/
	
	var SHOW_PAGE_LEAVE_WARNING = true;
	var LOAD_UNIT_TEST_PROJECT = false;
	var UNIT_TEST_PROJECT_PATH = "tests/multi-object-symbol-test.json";

/*****************************
	Setup editor vars
*****************************/

	/* Current project in editor */
	var project;

	/* Current object being edited */
	var currentObject;

	/* Handles all the Fabric.js stuff */
	var fabricCanvas;

	/* Handles all the paper.js stuff */
	var paperCanvas;

	/* Scripting IDE */
	var scriptingIDE;

	/* Variables for script editor */
	var currentScript;

	/* Mouse and keyboard input variables */
	var mouse = {};
	var keys;

/*****************************
	Setup editor
*****************************/

	wickEditor.setup = function() {

		console.log("WickEditor rev " + wickEditor.version);

		// Create a new project
		project = new WickProject();
		currentObject = project.rootObject;

		// Setup fabric
		fabricCanvas = new FabricCanvas();

		// Setup paper
		paperCanvas = new PaperCanvas();

		// Setup scripting IDE
		scriptingIDE = new WickScriptingIDE();

		// Set the GUI to an initial state
		updateTimelineGUI();

		// Load the 'unit test' project
		if(LOAD_UNIT_TEST_PROJECT) {
			var devTestProjectJSON = WickFileUtils.downloadFile(UNIT_TEST_PROJECT_PATH);
			loadProjectFromJSON(devTestProjectJSON);
		}

/**********************************
	DOM stuff
**********************************/

	// Setup mouse move event

		document.addEventListener( 'mousemove', function ( event ) {

			mouse.x = event.clientX;
			mouse.y = event.clientY;

		}, false );


	// Setup right click events

		document.addEventListener('contextmenu', function(e) {
			e.preventDefault();
		}, false);

	// Setup keypress events

		keys = [];

		document.getElementById("editorCanvasContainer").addEventListener("keydown", function (e) {
			keys[e.keyCode] = true;

			// Backspace: delete selected objects
			if(keys[8]) {
				e.preventDefault();
				deleteActiveObject();
			}
			
			// Right arrow
			if (keys[39]) {
				
			}

			// Left arrow
			if (keys[37]) {
				
			}

			// Tilde: log project state to canvas
			if(keys[192]) {
				console.log(project);
				console.log(fabricCanvas);
			}

		});

		document.getElementById("editorCanvasContainer").addEventListener("keyup", function (e) {
			keys[e.keyCode] = false;
		});


	// Setup drag/drop events

		$("#editorCanvasContainer").on('dragover', function(e) {
			fabricCanvas.showDragToImportFileAlert();
			return false;
		});
		$("#editorCanvasContainer").on('dragleave', function(e) {
			fabricCanvas.hideDragToImportFileAlert();
			return false;
		});
		$("#editorCanvasContainer").on('drop', function(e) {
			// prevent browser from opening the file
			e.stopPropagation();
			e.preventDefault();

			importFilesDroppedIntoEditor(e.originalEvent.dataTransfer.files);
			fabricCanvas.hideDragToImportFileAlert();

			return false;
		});

	// Setup leave page warning event

		if(SHOW_PAGE_LEAVE_WARNING) {
			window.addEventListener("beforeunload", function (e) {
				var confirmationMessage = 'Warning: All unsaved changes will be lost!';

				(e || window.event).returnValue = confirmationMessage; //Gecko + IE
				return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
			});
		}

	// Setup window resize event

		var resizeWindow = function () {
			resizeCanvasAndGUI();
		}
		window.addEventListener('resize', resizeWindow, false);
		resizeWindow();

/********************************************************
	Other methods that should be moved somewhere else
********************************************************/

		$("#convertToSymbolButton").on("click", function (e) {
			convertActiveObjectToSymbol();
		});

		$("#bringToFrontButton").on("click", function (e) {
			console.error("Fix! Uses old fabric canvas");
			//fabricCanvas.bringToFront(fabricCanvas.getActiveObject());
			closeRightClickMenu();
		});
		$("#sendToBackButton").on("click", function (e) {
			console.error("Fix! Uses old fabric canvas");
			//fabricCanvas.sendToBack(fabricCanvas.getActiveObject());
			closeRightClickMenu();
		});
		$("#deleteButton").on("click", function (e) {
			deleteActiveObject();
			closeRightClickMenu();
		});

		$("#editObjectButton").on("click", function (e) {
			moveInsideObject(fabricCanvas.getActiveObject().wickObject);
			closeRightClickMenu();
		});
		$("#editScriptsButton").on("click", function (e) {
			openScriptingGUI();
			closeRightClickMenu();
		});

		$("#finishEditingObjectButton").on("click", function (e) {
			moveOutOfObject();
			closeRightClickMenu();
		});

		$("#clearFrameButton").on("click", function (e) {
			fabricCanvas.clear();
			closeRightClickMenu();
		});
	
	// Setup scripting GUI events

		$("#onLoadButton").on("click", function (e) {
			changeCurrentScript('onLoad');
		});

		$("#onClickButton").on("click", function (e) {
			changeCurrentScript('onClick');
		});

		$("#onUpdateButton").on("click", function (e) {
			changeCurrentScript('onUpdate');
		});

		$("#closeScriptingGUIButton").on("click", function (e) {
			closeScriptingGUI();
		});

		// Update selected objects scripts when script editor text changes
		scriptingIDE.aceEditor.getSession().on('change', function(e) {
			if(fabricCanvas.getActiveObject().wickObject.isSymbol) {
				fabricCanvas.getActiveObject().wickObject.wickScripts[currentScript] = scriptingIDE.aceEditor.getValue();
			}
		});

		// Load scripts into the script editor GUI
		fabricCanvas.getCanvas().on('object:selected', function(e) {
			reloadScriptingGUI();
		});

		// Clear scripting bar when object deselected
		fabricCanvas.getCanvas().on('selection:cleared', function(e) {
			closeScriptingGUI();
		});

	// Path to wick object conversion
	// This should not be here, the current drawing system is temporary though, so get rid of it later

		// When a path is done being drawn, create a wick object out of it.
		// This is to get around the player currently not supporting paths.
		//
		// Later on, we will rasterize the path drawn by fabric, and vectorize it using potrace.
		// The vectors can then be edited with paper.js.
		//
		fabricCanvas.getCanvas().on('object:added', function(e) {
			if(e.target.type === "path") {
				e.target.cloneAsImage(function(clone) {

					var fileImage = new Image();
					fileImage.src = clone._element.currentSrc || clone._element.src;

					fileImage.onload = function() {
						var obj = new WickObject();

						obj.setDefaultPositioningValues();
						obj.width = fileImage.width;
						obj.height = fileImage.height;
						obj.left = e.target.left - clone.width/2;
						obj.top = e.target.top - clone.height/2;

						obj.parentObject = currentObject;
						obj.dataURL = fileImage.src;

						fabricCanvas.addWickObjectToCanvas(obj);
					}
				});

				fabricCanvas.getCanvas().remove(e.target);
			}
		});

	// The extended version of the fabric canvas fires off a mouse:down event on right clicks
	// We use this here to select an item with a right click

		fabricCanvas.getCanvas().on('mouse:down', function(e) {
			if(e.e.button == 2) {

				if (e.target && e.target.wickObject) {
					var id = fabricCanvas.getCanvas().getObjects().indexOf(e.target);
					fabricCanvas.getCanvas().setActiveObject(fabricCanvas.getCanvas().item(id));
				}

				if(!e.target) {
					fabricCanvas.getCanvas().deactivateAll().renderAll();
				}
				openRightClickMenu();

			} else {
				closeRightClickMenu();
			}
		});

	}

/**********************************
	Right-click menu 
**********************************/

	var openRightClickMenu = function () {

		// Make rightclick menu visible
		$("#rightClickMenu").css('visibility', 'visible');
		// Attach it to the mouse
		$("#rightClickMenu").css('top', mouse.y+'px');
		$("#rightClickMenu").css('left', mouse.x+'px');

		// Update right click menu depending on what type of wickobject is selected
		$("#commonObjectButtons").css('display', 'none');
		$("#symbolButtons").css('display', 'none');
		$("#staticObjectButtons").css('display', 'none');
		$("#finishEditingObjectButton").css('display', 'none');

		// Only show "Finish Editing Object" button if we're not in root
		if(currentObject.parentObject) {
			$("#finishEditingObjectButton").css('display', 'inline');
		}

		var selectedObject = fabricCanvas.getCanvas().getActiveObject() || fabricCanvas.getCanvas().getActiveGroup();
		if(selectedObject) {
			$("#commonObjectButtons").css('display', 'inline');
			if(selectedObject.wickObject && selectedObject.wickObject.isSymbol) {
				$("#symbolButtons").css('display', 'inline');
			} else {
				$("#staticObjectButtons").css('display', 'inline');
			}
		}
	}

	var closeRightClickMenu = function () {
		// Hide rightclick menu
		$("#rightClickMenu").css('visibility', 'hidden');
		$("#rightClickMenu").css('top', '0px');
		$("#rightClickMenu").css('left','0px');
	}

/*****************************
	Timeline
*****************************/

	wickEditor.addEmptyFrame = function () {

		// Add an empty frame
		currentObject.addEmptyFrame(currentObject.frames.length);

		// Move to that new frame
		gotoFrame(currentObject.frames.length-1);

		// Update GUI
		resizeCanvasAndGUI();
		updateTimelineGUI();

	}

	// Moves playhead to specified frame and updates the canvas and project.
	var gotoFrame = function (newFrameIndex) {

		// Store changes made to current frame in the project
		currentObject.frames[currentObject.currentFrame].wickObjects = fabricCanvas.getWickObjectsInCanvas();

		// move playhead
		currentObject.currentFrame = newFrameIndex;

		// Load wickobjects in the frame we moved to into the canvas
		fabricCanvas.storeObjectsIntoCanvas( currentObject.getCurrentFrame().wickObjects );

		updateTimelineGUI();

	}

	// 
	var moveOutOfObject = function () {

		// Store changes made to current frame in the project
		currentObject.frames[currentObject.currentFrame].wickObjects = fabricCanvas.getWickObjectsInCanvas();

		// Set the editor to be editing the parent object
		currentObject = currentObject.parentObject;

		// Load wickobjects in the frame we moved to into the canvas
		fabricCanvas.storeObjectsIntoCanvas( currentObject.getCurrentFrame().wickObjects );

		updateTimelineGUI();

	}

	// 
	var moveInsideObject = function (object) {

		// Store changes made to current frame in the project
		currentObject.frames[currentObject.currentFrame].wickObjects = fabricCanvas.getWickObjectsInCanvas();

		// Set the editor to be editing this object at its first frame
		currentObject = object;
		currentObject.currentFrame = 0;

		// Load wickobjects in the frame we moved to into the canvas
		fabricCanvas.storeObjectsIntoCanvas( currentObject.getCurrentFrame().wickObjects );

		updateTimelineGUI();

	}

/***********************************
	Public editor action methods
***********************************/

	wickEditor.newProject = function () {

		if(confirm("Create a new project? All unsaved changes to the current project will be lost!")) {
			project = new WickProject();
			currentObject = project.rootObject;
			fabricCanvas.storeObjectsIntoCanvas( currentObject.getCurrentFrame().wickObjects );
			updateTimelineGUI();
		}

	}

	wickEditor.saveProject = function () {

		WickFileUtils.saveProjectAsJSONFile(getProjectAsJSON());

	}

	wickEditor.openProject = function () {
		WickFileUtils.readJSONFromFileChooser(
			document.getElementById("importButton"), 
			loadProjectFromJSON
		);
	}

	wickEditor.exportProject = function () {

		WickFileUtils.saveProjectAsHTMLFile(getProjectAsJSON());

	}

	wickEditor.startDrawingMode = function () {
		fabricCanvas.startDrawingMode();
	}

	wickEditor.stopDrawingMode = function () {
		fabricCanvas.stopDrawingMode();	
	}

	var deleteActiveObject = function () {

		if (fabricCanvas.getCanvas().getActiveGroup()) {
			fabricCanvas.getCanvas().getActiveGroup().forEachObject(function(o) { 
				fabricCanvas.getCanvas().remove(o);
			});
			fabricCanvas.getCanvas().discardActiveGroup().renderAll();
		} else {
			fabricCanvas.getCanvas().remove(fabricCanvas.getCanvas().getActiveObject());
		}
		
	}

	var convertActiveObjectToSymbol = function () {

		var symbol = new WickObject();

		var selectedObject = fabricCanvas.getCanvas().getActiveObject() || fabricCanvas.getCanvas().getActiveGroup();

		symbol.parentObject = currentObject;
		symbol.left = 0//selectedObject.left;
		symbol.top = 0//selectedObject.top;
		symbol.setDefaultPositioningValues();
		symbol.setDefaultSymbolValues();

		if (selectedObject._objects) {
			// Multiple objects are selected, put them all in the new symbol
			for(var i = 0; i < selectedObject._objects.length; i++) {
				console.log(selectedObject._objects[i].wickObject);
				symbol.frames[0].wickObjects[i] = selectedObject._objects[i].wickObject;
				symbol.frames[0].wickObjects[i].parentObject = symbol;
				symbol.frames[0].wickObjects[i].left = 0;
				symbol.frames[0].wickObjects[i].top = 0;
			}
			while(selectedObject._objects.length > 0) {
				selectedObject._objects[0].remove();
			}
		} else {
			// Only one object is selected
			symbol.frames[0].wickObjects[0] = selectedObject.wickObject;
			symbol.frames[0].wickObjects[0].parentObject = symbol;
			symbol.frames[0].wickObjects[0].left = 0;
			symbol.frames[0].wickObjects[0].top = 0;

			selectedObject.remove();
		}

		fabricCanvas.addWickObjectToCanvas(symbol);

		gotoFrame(currentObject.currentFrame);
		closeRightClickMenu();

	}

/*****************************
	GUI
*****************************/

	var openScriptingGUI = function () {
		$("#scriptingGUI").css('visibility', 'visible');
		reloadScriptingGUI();
	};

	var reloadScriptingGUI = function() {
		changeCurrentScript('onLoad');
	};

	var changeCurrentScript = function(scriptString) {
		currentScript = scriptString;
		reloadScriptingGUITextArea();
	};

	var reloadScriptingGUITextArea = function() {
		var activeObj = fabricCanvas.getActiveObject();
		if(activeObj && activeObj.wickObject.wickScripts && activeObj.wickObject.wickScripts[currentScript]) {
			var script = fabricCanvas.getActiveObject().wickObject.wickScripts[currentScript];
			scriptingIDE.aceEditor.setValue(script, -1);
		}

		document.getElementById("onLoadButton").className = (currentScript == 'onLoad' ? "button buttonInRow activeScriptButton" : "button buttonInRow");
		document.getElementById("onUpdateButton").className = (currentScript == 'onUpdate' ? "button buttonInRow activeScriptButton" : "button buttonInRow");
		document.getElementById("onClickButton").className = (currentScript == 'onClick' ? "button buttonInRow activeScriptButton" : "button buttonInRow");
	};

	var closeScriptingGUI = function() {
		$("#scriptingGUI").css('visibility', 'hidden');
	};

	var resizeCanvasAndGUI = function () {
		// Resize canvas
		fabricCanvas.resize(
			project.resolution.x, 
			project.resolution.y
		);

		// Also center timeline
		var GUIWidth = parseInt($("#timelineGUI").css("width")) / 2;
		var timelineOffset = window.innerWidth/2 - GUIWidth;
		$("#timelineGUI").css('left', timelineOffset+'px');
	}

	var updateTimelineGUI = function () {

		// Update the paper canvas inside the fabric canvas

		fabricCanvas.reloadPaperCanvas(paperCanvas.getCanvas());

		// Reset the timeline div

		var timeline = document.getElementById("timeline");
		timeline.innerHTML = "";
		timeline.style.width = currentObject.frames.length*23 + 6 + "px";

		for(var i = 0; i < currentObject.frames.length; i++) {

			// Create the frame element
			var frameDiv = document.createElement("span");
			frameDiv.id = "frame" + i;
			frameDiv.innerHTML = i;
			if(currentObject.currentFrame == i) {
				frameDiv.className = "timelineFrame active";
			} else {
				frameDiv.className = "timelineFrame";
			}
			timeline.appendChild(frameDiv);

			// Add mousedown event to the frame element so we can go to that frame when its clicked
			document.getElementById("frame" + i).addEventListener("mousedown", function(index) {
				return function () {
					gotoFrame(index);
				};
			}(i), false);
		}

	}

/*****************************
	Import content
*****************************/

	var importFilesDroppedIntoEditor = function(files) {
		// Retrieve uploaded files data
		for (var i = 0; i < files.length; i++) {
			var file = files[i];

			// Read file as data URL
			var reader = new FileReader();
			reader.onload = (function(theFile) {
				return function(e) {
					// TODO: Check filetype for image/sound/video/etc.
					importImage(theFile.name, e.target.result)
				};
			})(file);
			reader.readAsDataURL(file);
		}
	}

	var importImage = function (name, data) {

		var fileImage = new Image();
		fileImage.src = data;

		fileImage.onload = function() {
			// Create a new wick object with that data
			var obj = new WickObject();

			obj.parentObject = currentObject;
			obj.objectName = name;
			obj.dataURL = data;

			obj.setDefaultPositioningValues();
			obj.width = fileImage.width;
			obj.height = fileImage.height;
			if(currentObject.isRoot) {
				obj.left = window.innerWidth/2 - obj.width/2;
				obj.top = window.innerHeight/2 - obj.height/2;
			} else {
				obj.left = 0;
				obj.top = 0;
			}

			// Put that wickobject in the fabric canvas
			fabricCanvas.addWickObjectToCanvas(obj);
		}

	}

	var importSound = function (name, data) {

	}

	var importVectors = function (name, data) {

	}

/**********************************
	Import/Export JSON projects
**********************************/
	
	var getProjectAsJSON = function () {
		// Store changes made to current frame in the project
		currentObject.frames[currentObject.currentFrame].wickObjects = fabricCanvas.getWickObjectsInCanvas();

		// Remove parent object references 
		// (can't JSONify objects with circular references, player doesn't need them anyway)
		project.rootObject.removeParentObjectRefences();

		// Encode scripts to avoid JSON format problems
		WickSharedUtils.encodeScripts(project.rootObject);

		var JSONProject = JSON.stringify(project);

		// Put parent object references back in all objects
		project.rootObject.regenerateParentObjectReferences();

		// Decode scripts back to human-readble and eval()-able format
		WickSharedUtils.decodeScripts(project.rootObject);

		return JSONProject;
	}

	var loadProjectFromJSON = function (jsonString) {
		// Replace current project with project in JSON
		project = JSON.parse(jsonString);

		// Put prototypes back on object ('class methods'), they don't get JSONified on project export.
		putPrototypeBackOnObject(project.rootObject);

		// Regenerate parent object references
		// These were removed earlier because JSON can't handle infinitely recursive objects (duh)
		project.rootObject.regenerateParentObjectReferences();

		// Decode scripts back to human-readble and eval()-able format
		WickSharedUtils.decodeScripts(project.rootObject);

		// Start editing the first frame of root
		// TODO: Projects should store the current place they were in when last saved
		currentObject = project.rootObject;
		currentObject.currentFrame = 0;

		// Load wickobjects in the frame we moved to into the canvas
		fabricCanvas.storeObjectsIntoCanvas( currentObject.getCurrentFrame().wickObjects );

		updateTimelineGUI();

		console.log("loaded project:");
		console.log(project);
	}

	// This is supposedly a nasty thing to do - think about possible alternatives for IE and stuff
	var putPrototypeBackOnObject = function (obj) {

		// Put the prototype back on this object
		obj.__proto__ = WickObject.prototype;

		// Recursively put the prototypes back on the children objects
		if(obj.isSymbol) {
			WickSharedUtils.forEachChildObject(obj, function(currObj) {
				putPrototypeBackOnObject(currObj);
			});
		}
	}

/****************************************
	Run projects with builtin player
*****************************************/

	wickEditor.runProject = function () {
		// Hide the editor, show the player
		document.getElementById("editor").style.display = "none";
		document.getElementById("builtinPlayer").style.display = "block";

		// JSONify the project and have the builtin player run it
		var JSONProject = getProjectAsJSON();
		WickPlayer.runProject(JSONProject);
	}

	wickEditor.closeBuiltinPlayer = function() {
		// Show the editor, hide the player
		document.getElementById("builtinPlayer").style.display = "none";
		document.getElementById("editor").style.display = "block";

		// Clean up player
		WickPlayer.stopRunningCurrentProject();
	}

	return wickEditor;

})();