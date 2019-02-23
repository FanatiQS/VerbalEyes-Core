# Teleprompter
This project is very much a work in progress!!!
The documentation is far from thought trough.





## Config system
* The input for the config property can be either an object or a string to a json file.
* If the string doesn't contain a file extension, '.json' will automatically be added at the end.
* If the string is something other than a '.json' file, the system will throw an error.
* If the argument is not defined or false, the default value of './config.json' will be used.
* If a file can't be found at the path provided, a new file will be created.
	* An event listener can be created to listen for when a new config file is created. It has two arguments, an error object and the path to the new file.
	* If there was an error creating the new config file and no event listeners have been added, the error will be thrown and crash the server (not able to be caught). If there is an event listener, the error will be passed to the listener instead.
* Getters and setters are supported but have some limitations.
	* The internal observers can't be added to properties that doesn't have a setter.
	* If a properties value is updated from something other than the setter, the internal observers will have no idea that the value has been updated.
	* If a property doesn't have a getter, the system watching for file changes won't know the value and think that it is undefined.
* Setting a property to not be configurable is not supported.
	* When a property with an observer is set to not be configurable, the system will crash.
	* If a property is not supposed to be changed, adding it as a locked property instead is recommended.

### Errors (crashes the entire prompter server):
* "Unable to setup config, 'confInput1' needs to be an object or a string path to a JSON file"
* "Wrong file extension for '" + path + "', it needs to be a " + type + " file"
* "Error parsing config file:" confInput1
* "Error getting config file:" confInput1



### Watching config file
* The config file will be watched for changes.
* To close the config watcher, at any time run the 'close' function in the '_ watcher' property on the config object.
* Properties starting with underscore will be ignored.

#### Errors:
* "Error reading contents of watched JSON file" (ERROR)
* "Unable to parse file:", path (ERROR)
* "Unable to add property '" + key + "' to:", path (ERROR)
* "Unable to update property '" + key + "' in:", path (ERROR)
* "Unable to update locked property '" + key + "' in:", path



### Locked properties
A locked property is a property in the config object that can not be changed or deleted from the config object itself. It can still be changed from the argument object. Deleting the argument property will not delete the locked property so a locked property can never be unlocked.

These are for properties that a developer doesn't want an administrator to be able to change.

* The input for the locked config properties can only be an object. Everything else will be ignored.
* Deleting a property from the argument will not remove the property on the config object.
* Getters are supported.
* A property on the config object with the same name as the locked property will be written over.
* Observers will work on the argument properties the same way they do on normal config objects.
* Setting properties to not be configurable is not supported. Same reasons as for the config object.
* The properties in the config object will only have a getter and therefore if the config objects property is being updated when in strict mode, an error will be thrown.

#### Errors:
* "Unable to add locked properties from:", confInput2



### Config properties:
When some properties are updated, they will do stuff...





## Custom Loaders:
Custom scripts are javascript files that load the projects and its documents...

* A custom loader contains functions to load different types of things.
* Loader functions can be either synchronous or asynchronous.
* The first argument in the callback is always an error object.
* If the server has not received a response from the loader after a set amount of time, the server will display a timeout. This does not prevent the server from receiving the data but is for... Default timeout is 1 second but can be changed in the config object with the property 'timeout'.
* The server can only receive data once. If callbacks are called multiple times or if anything other than undefined is returned, the server will only accept the first data received.

### Loader properties:
* 'getProj' required
* 'getProjs' optional

### Errors:
#### Init:
* "Invalid type, 'customLoader' in config needs to be a string path or object:", input
* "Property '" + prop + "' in custom script has to be a function: " + func
* "Missing property '" + prop + "' in custom script"

#### getProjs:
* "Timed out getting projects to preload"
* "List of projects to preload has already been received"
* "Custom loader got an error in 'getProjs' when trying to get projects list"
* "Returned value from 'getProjs' needs to be an array:", list

#### getProj:
* "Timed out getting project settings for:", projID
* "Settings for '" + projID + "' has already been received"
* "Custom loader got an error when trying to load proj:", projID
* "Returned value from 'getProj' needs to be an object:", settings



## Server:
This is what is used for communication between the server and the clients. The argument can be formatted in many different ways.
1. Undefined/false:
	This will use the port number property in the config object or the default port. It creates a new websocket server.
2. A number:
	This will be used as a port number. It creates a new websocket server.
3. An http/https server:
	This will use the server for communication over websockets. It creates a new websocket server with the http server.
4. A websocket server (from nodejs module 'ws'):
	This will use the websocket server for communication. It only creates new listeners to the 'connections' event.
5. A websocket server argument (for nodejs module 'ws')
	This will be used as is as an argument for creating a new websocket. Check documentation for 'ws' for more details. It creates a new websocket server.
6. 'custom' as a string:
	This will return a function to create a new Client and is used to handle all communication outside the teleprompter server.
* An event listener, 'socketOpen', can be added for when a new websocket server is created (applies to 1,2,3,5 only).





## ERROR CODES:
* 1000:		Data received failed to parse to json.
* 1001:		Data received from client is not an object.

### Authentication
* 2000:		Property 'id' in object is false/missing and autologin is disabled.
* 2001:		No projects matching requested ID.
* 2002:		Property 'pwd' is required and missing.
* 2003:		Property 'pwd' does not match stored hash.

* 3000:		Property 'id' in object is not a string.
* 3001:		Property 'id' in object is a string that is longer than 128 characters.
* 3002:		Unable to hash password!!!!!



## Creating a custom loader:
* A loader can be synchronous or asynchronous.
* They have a timeout that will only warn if the callback has not been called after a certain amount of time. This time can be changed in the 'config' file with the property 'timeout'.
* The callback function can only be called once. Calls after the first one will be ignored.



### getProjs(list)


### getProj(projID, extra, conf, callback)
* Argument projID is the id of the project and is a string.
* Argument extra is an optional value that can be sent from the client if extra data needs to be sent from the client to the getProj loader.
* Argument conf is the config data for the entire server that is loaded at the start.
* Argument callback is the callback that can be called in asynchronous systems.


### Response



## Event listeners:
* Event listeners can be added using the 'on' method.
* It has two arguments, an 'event' string and a callback function. If any of them are the wrong type, a 'TypeError' will be thrown.

### Events
* createConf:
	* An event that is called if the config file didn't exist and was created. If no listeners exist and the server fails to create the new config file, the server will crash instead.
	* It has three arguments, err, config object and the path to the file.
	* If it gets an error, then the config object will not have a file watched to receive updates on properties from. The config object can still be updated manually. Everything else should work as normal.
* socketOpen:
	* Called when the server finishes creating a new websocket server.
	* No arguments.
* preload:
	* Called when preloading projects is complete.
	* It has one argument, an object with all the connected projects.

### Errors:
* "Event needs to be a string: " + event
* "Callback needs to be a function: " + callback
* "No listener for event: " + event
