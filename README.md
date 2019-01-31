# Teleprompter



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




## Creating a loader:
* A loader can be synchronous or asynchronous.
* They have a timeout that will only warn if the callback has not been called after a certain amount of time. This time can be changed in the 'config' file with the property 'timeout'.


### getProj(projID, extra, conf, callback)
* Argument projID is the id of the project and is a string.
* Argument extra is an optional value that can be sent from the client if extra data needs to be sent from the client to the getProj loader.
* Argument conf is the config data for the entire server that is loaded at the start.
* Argument callback is the callback that can be called in asynchronous systems.


### Response
