# RTI Remote Launcher Client

A simple command-line front-end to the RTI Remote Launcher API.

For information on Remote Launcher, please refer to the [GitHub project page](https://github.com/rticommunity/rtiremotelauncher).

NOTE: Currently Remote Launcher is not a public project, and is available only to selected beta tester. If you are interested to install and use RTI Remote Launcher, please contact RTI at: support@rti.com.



## Client Access Library

This npm-ready module exposes a single class to access all the functionality of Remote Launcher through HTTP/REST API. To use it, just create an instance of the contained `RemoteLauncherAPI` class and invoke the promise-based methods:

```javascript
let api = require('rtiremotelauncher-client').RemoteLauncherAPI("http://localhost:7000");
let RPCException = require('rtiremotelauncher-client').RPCException;

// Request list of running remote launchers in the domain:
api.getAllRemoteLauncherInfo().then( (info) => {
    console.log(`Response: ${JSON.stringify(info)}`);
}).catch( (e) => {
    if (e instanceof RPCException) {
        console.err(`Remote server responded with error: ${e.message}`);
    } else {
        console.err(`Failed to perform RPC to remote launcher: ${e.message}`);
    }
});
```

Refer to the command line client source code (`rtirlc.js`) for a complete list of calls and examples.





## Command line client

This client library also includes a command-line client that can be used to invoke any of the RPC commands. Once you install this package in the global space:

```
$ sudo npm install -g rtiremotelauncher-client
```

you can invoke the client with the command `rtirlc`:

```
$ which rtirlc
/usr/local/bin/rtirlc

$ rtirlc --help
RTI Remote Launcher Client - version 0.1.0
Copyright 2020 Real-Time Innovations, inc.
----------------------------------------------------
Usage: rtirlc [-h | --help] [-u|--url <URL>] <command>
If URL is not specified, client will connect to remote launcher at: http://localhost:7000
Query commands:
   ls <item>       - Lists remote launchers and supported apps
   info <inst>     - Prints detailed information on an application instance
   log <inst>      - Retrieve the instance lifecycle log
App lifecycle commands:
   new <app>       - Creates a new instance of an application
   modify <inst>   - Modify the parameters of an instance
   delete <inst>   - Deletes an instance
   run <inst>      - Starts a stopped instance
   attach <inst>   - View stdout/stderr of a running app
   stop <inst>     - Starts a running instance
Resource access commands:
   resls <inst>    - Shows list of resources availabe in instance
   resget <path>   - Download a resource file from an instance
   resgetio <inst> - Download the entire stdout/stderr of an instance into a file
   resput <path>   - Upload a resource file from an instance
   resdel <path>   - Delete a resource file from an instance
Simplified command invocation:
   exec <app>      - Single command to synchronously Create+Run+Destroy apps

To get detailed help on an individual command, enter '<command> -h'

Entities are identified using the following schema (can be partially defined):
     hostName/appName/instanceNum/resourceName
For example, 'server01/nddsping/3' identify the instance #3 of nddsping running on 'server01'
```



The command `rtirlc` is designed to be a test application for the RTI Remote Launcher client API as well as a utility tool to quickly launch run applications on a remote machine (see the `exec`) command,

To invoke a Remote Launcher API method, use the following form:

````
rtirlc [-u remoteLauncherURL] <command> <command_arguments> <resource_URL>
````

For example, to create a new subscriber instance of application `ping` on host `pisa`:

```
rtirlc new -c '-domain 55 -subscriber' -p 1 -s 1 pisa/ping
```



The client offers also a simplified way to run a remote application with a single command (with the `exec` command):

```
rtirlc [-u remoteLauncherURL] exec <resource_URL> <command_arguments>
```

In this case, Remote Launcher Client will automatically perform the following actions with a single command:

* Create a new instance of the application identified by `<resource_URL>` (non-persistent, with unified stdout and stderr) using the arguments specified by `<command_arguments>`
* Run the instance polling for output (and providing a channel for stdin to the process)
* Wait for the user to interrupt the process (by sending a SIGINT, or pressing CTRL+C) then stop and destroy the instance.

For example:

```
$ rtirlc exec pisa/ping -domain 55 -publisher

RTI Connext DDS Ping built with DDS version: 6.0.1 (Core: 1.9a.00, C: 1.9a.00, C++: 1.9a.00)
Copyright 2012 Real-Time Innovations, Inc.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Sending data...   value: 0000000 
Sending data...   value: 0000001 
Sending data...   value: 0000002 
Sending data...   value: 0000003 
Sending data...   value: 0000004 
```

