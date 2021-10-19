#!/usr/bin/env node
/******************************************************************************
 (c) 2019-2020  Copyright, Real-Time Innovations, Inc. All rights reserved.
 RTI grants Licensee a license to use, modify, compile, and create derivative
 works of the Software.  Licensee has the right to distribute object form only
 for use with RTI products.  The Software is provided "as is", with no warranty
 of any type, including any warranty for fitness for any purpose. RTI is under
 no obligation to maintain or support the Software.  RTI shall not be liable for
 any incidental or consequential damages arising out of the use or inability to
 use the software.
******************************************************************************/

"use strict";

const util = require('util');

const rlapi = require('./api.js');
const RemoteLauncherAPI = rlapi.RemoteLauncherAPI;
const RPCException = rlapi.RPCException;

const DEFAULT_URL   = "http://localhost:7000";
const APP_NAME = "rtirlc"
const APP_VERSION = "0.1.0-2";
const API_VERSION = "v1"

// The regex to control if a string contains special characters as used by
// fnmatch
const FNMATCH_PATTERN   = /\*?\?/;

// A synch version of a generic sleep() function that takes the delay in mSec
const syncSleep = util.promisify( (a, f) => { setTimeout(f, a) })

const fs = require('fs');
const writeFilePromise = util.promisify(fs.writeFile);
const readFilePromise = util.promisify(fs.readFile);

// The offset from the current stdout|stderr when attaching to a process
const ATTACH_OFFSET_CHARS = 500;

// If set to true, in case of errors prints the full stack trace, can be enabled
// through the command line --debug
var theDebugEnabled = false;

// {{{ parseBoolean
// ----------------------------------------------------------------------------
function parseBoolean(val) {
    if (typeof(val) == 'string') {
        switch(val.toLowerCase()) {
            case "1":
            case "yes":
            case "true":
                return true;

            case "0":
            case "no":
            case "false":
                return false;

            default:
                console.log(`Error: invalid boolean value: ${val}`);
                return undefined;
        }
    }
    if (typeof(val) == 'number') {
        return (val != 0);
    }
    if (typeof(val) == 'boolean') {
        return val;
    }
    console.log(`Error: invalid type for boolean value: ${JSON.stringify(val)}`);
    return undefined;
}
// }}}
// {{{ banner
// ----------------------------------------------------------------------------
function banner() {
    console.log(`RTI Remote Launcher Client - version ${APP_VERSION}`);
    console.log(`Copyright 2020 Real-Time Innovations, inc.`);
}
// }}}
// {{{ usage
// ----------------------------------------------------------------------------
// Show help on the application or on a single command
function usage(cmd) {
    banner();
    console.log(`----------------------------------------------------`);
    // {{{ cmd: ls
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'ls') {
        console.log("Command: Search and list information about host and applications");
        console.log("");
        console.log("Usage: ls [modifier] [<hostPattern>|<appPatern>]");
        console.log("Where [modifier] is one of:");
        console.log("    -l,--long     prints detailed information on app states");
        console.log("");
        console.log("Search path is limited to hostName/appName (no instanceNum)");
        console.log("You can use patterns '*' and '?' in the path string");
        console.log("");
        console.log("Examples:");
        console.log("     ls -l        - Shows all the hosts and apps with details");
        console.log("     ls foo*      - Shows all the hosts running remote launcher that starts with 'foo'");
        console.log("     ls foo/ndds* - Shows all the apps that start with 'ndds' on host 'foo'");
        console.log("     ls */nddsspy - Shows all the host that provide the app 'nddsspy'");
        return;
    }
    // }}}
    // {{{ cmd: info
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'info') {
        console.log("Command: Show Instance Information");
        console.log("");
        console.log("Usage: info <instancePath>");
        console.log("");
        console.log("Example:");
        console.log("     info foo/bar/4 - Shows details of instance 4 of app 'bar' running on host 'foo'");
        return;
    }
    // }}}
    // {{{ cmd: log
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'log') {
        console.log("Command: Retrieve Instance Lifecycle Log");
        console.log("");
        console.log("Usage: log [-f|--file localFile] <instancePath>");
        console.log("");
        console.log("Example:");
        console.log("     log foo/bar/4 - Retrieve the lifecycle log of instance 4 of app 'bar' running on host 'foo'");
        return;
    }
    // }}}
    // {{{ cmd: new
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'new') {
        console.log("Command: Create a new instance");
        console.log("Usage: new [args] <appPath>");
        console.log("Where [args] are:");
        console.log("    -r,--run              - Create the instance and immediately run it");
        console.log("    -u,--user <name>      - Specify the user name for the process");
        console.log("    -c,--cmdline <args>   - Specify command-line arguments for application");
        console.log("    -p,--persistent <val> - Defines the new instance as persistent (val=1|0|true|false)");
        console.log("    -s,--unifystdout <val>- Separate stderr and stdout (val=1|0|true|false)");
        console.log("");
        console.log("Examples:");
        console.log("     new --cmdline '-domain 5' myHost/nddsspy");
        console.log("     new --cmdline '-config myConfig.xml' --persistent myHost/routingservice");
        return;
    }
    // }}}
    // {{{ cmd: modify
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'modify') {
        console.log("Command: Create a new instance");
        console.log("Usage: modify [args] <instancePath>");
        console.log("Where [args] are:");
        console.log("    -c,--cmdline <args> - Specify command-line arguments for application");
        console.log("    -u,--user <name>      - Specify the user name for the process");
        console.log("    -p,--persistent <val> - Defines the new instance as persistent (val=1|0|true|false)");
        console.log("    -s,--unifystdout <val>- Separate stderr and stdout (val=1|0|true|false)");
        console.log("");
        console.log("Example:");
        console.log("     modify -c '-domain 5' myHost/nddsspy");
        return;
    }
    // }}}
    // {{{ cmd: delete
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'delete') {
        console.log("Command: Permanently delete an instance");
        console.log("Usage: delete <instPath>");
        console.log("");
        console.log("Example:");
        console.log("     delete foo/bar/2 - Deletes instance #2 of app 'bar' on host 'foo'");
        return;
    }
    // }}}
    // {{{ cmd: run
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'run') {
        console.log("Command: Starts a stopped instance");
        console.log("Usage: run [args] <instancePath>");
        console.log("Where [args] are:");
        console.log("    -o,--stdout  - Runs application and show stdout");
        console.log("    -e,--stderr  - Runs application and show stderr");
        console.log("");
        console.log("Example:");
        console.log("     run -o myHost/nddsspy/1");
        return;
    }
    // }}}
    // {{{ cmd: attach
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'attach') {
        console.log("Command: Attach stdout/stderr to a running application");
        console.log("Usage: attach [args] <instancePath>");
        console.log("Where [args] are:");
        console.log("    -o,--stdout  - Attach to stdout (default)");
        console.log("    -e,--stderr  - Attach to stderr");
        console.log("");
        console.log("Example:");
        console.log("     attach myHost/nddsspy/1");
        return;
    }
    // }}}
    // {{{ cmd: stop
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'stop') {
        console.log("Command: Stops a running instance");
        console.log("Usage: stop <instancePath>");
        console.log("");
        console.log("Example:");
        console.log("     stop myHost/nddsspy/1");
        return;
    }
    // }}}
    // {{{ cmd: resget
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'resget') {
        console.log("Command: Downloads a resource file from an instance storage area");
        console.log("Usage: resget [-f|--file localFile] <resPath>");
        console.log("");
        console.log("Example:");
        console.log("     resget -f foo.db myHost/nddsspy/1/myOutput.db");
        return;
    }
    // }}}
    // {{{ cmd: resgetio
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'resgetio') {
        console.log("Command: Downloads an I/O file from an instance storage area");
        console.log("Usage: resgetio [args] <instancePath>");
        console.log("Where [args] are:");
        console.log("    -f,--file <file>   saves the retrieved file to <localFile>");
        console.log("    -o,--stdout        Retrieve stdout");
        console.log("    -e,--stderr        Retrieve stderr");
        console.log("    -n,--num <num>     Retrieve IO file from run number <num>");
        console.log("");
        console.log("Example: retrieve the stdout of run number 3 from myHost/nddsspy/1");
        console.log("and save it into local file 'myStdou-3.txt'");
        console.log("     resgetio -f myStdout-3.txt -o -n 3 myHost/nddsspy/1");
        return;
    }
    // }}}
    // {{{ cmd: resput
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'resput') {
        console.log("Command: Upload an local file to an instance storage area");
        console.log("Usage: resput [-f|--file localFile] <resPath>");
        console.log("");
        console.log("Example:");
        console.log("     resput -f foo.db myHost/nddsspy/1/foo.db");
        return;
    }
    // }}}
    // {{{ cmd: resdel
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'resdel') {
        console.log("Command: Deletes a file from an instance storage area");
        console.log("Usage: resdel <resPath>");
        console.log("");
        console.log("Example:");
        console.log("     resdel myHost/nddsspy/1/foo.db");
        return;
    }
    // }}}
    // {{{ cmd: exec
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    if (cmd == 'exec') {
        console.log("Command: Simplified way to run an application on a remote host");
        console.log("Usage: exec <appPath> <arguments>");
        console.log("");
        console.log("Example:");
        console.log("     exec myHost/nddsping -subscriber -domain 55");
        return;
    }
    // }}}

    // Main help
    if (!cmd) {
        console.log(`Usage: ${APP_NAME} [-h | --help] [-u|--url <URL>] <command>`);
        console.log(`If URL is not specified, client will connect to remote launcher at: ${DEFAULT_URL}`);
        console.log("Query commands:");
        console.log("   ls <item>       - Lists remote launchers and supported apps");
        console.log("   info <inst>     - Prints detailed information on an application instance");
        console.log("   log <inst>      - Retrieve the instance lifecycle log");
        console.log("App lifecycle commands:");
        console.log("   new <app>       - Creates a new instance of an application");
        console.log("   modify <inst>   - Modify the parameters of an instance");
        console.log("   delete <inst>   - Deletes an instance");
        console.log("   run <inst>      - Starts a stopped instance");
        console.log("   attach <inst>   - View stdout/stderr of a running app");
        console.log("   stop <inst>     - Starts a running instance");
        console.log("Resource access commands:");
        console.log("   resls <inst>    - Shows list of resources availabe in instance");
        console.log("   resget <path>   - Download a resource file from an instance");
        console.log("   resgetio <inst> - Download the entire stdout/stderr of an instance into a file");
        console.log("   resput <path>   - Upload a resource file from an instance");
        console.log("   resdel <path>   - Delete a resource file from an instance");
        console.log("Simplified command invocation:");
        console.log("   exec <app>      - Single command to synchronously Create+Run+Destroy apps");
        console.log("");
        console.log("To get detailed help on an individual command, enter '<command> -h'");
        console.log("");
        console.log("Entities are identified using the following schema (can be partially defined):");
        console.log("     hostName/appName/instanceNum/resourceName");
        console.log("For example, 'server01/nddsping/3' identify the instance #3 of nddsping running on 'server01'");
        return;
    }

}
// }}}
// {{{ validateResourcePath
// ----------------------------------------------------------------------------
// Breaks down the path into hostName/appId/instanceId/resourceName
// Returns an object with those 4 properties set or undefined if a validation
// error occurred (error are printed to stdout)
//
function validateResourcePath(resPath) {

    let pathList = resPath.split('/');
    if (pathList.length != 4) {
        throw new Error(`Error: instance path is not valid: ${resPath}`);
    }

    let retVal = {
        hostName: pathList[0],
        appId: pathList[1],
        instanceId: Number.parseInt(pathList[2]),
        resName: pathList[3]
    };

    // Validate the path
    if (retVal.hostName.length == 0) {
        console.log(`Error: empty hostName`);
        return;
    }
    if (FNMATCH_PATTERN.test(retVal.hostName)) {
        console.log(`Error: hostName cannot contain pattern-matching characters: ${retVal.hostName}`);
        return;
    }

    if (retVal.appId.length == 0) {
        console.log(`Error: empty appId`);
        return;
    }
    if (FNMATCH_PATTERN.test(retVal.appId)) {
        console.log(`Error: appId cannot contain pattern-matching characters: ${retVal.appId}`);
        return;
    }

    if (Number.isNaN(retVal.instanceId)) {
        console.log(`Error: instanceId is not a number: ${pathList[2]}`);
        return;
    }
    if (retVal.instanceId <= 0) {
        console.log(`Error: invalid instanceId: ${retVal.instanceId}`);
        return;
    }
    if (retVal.resName.length == 0) {
        console.log(`Erro: empty resource name`);
        return;
    }

    // Valid
    return retVal;
}
// }}}
// {{{ validateInstancePath
// ----------------------------------------------------------------------------
// Breaks down the path into hostName/appId/instanceId
// Returns an object with those 3 properties set or undefined if a validation
// error occurred (error are printed to stdout)
//
// NOTE: In an instance path, pattern matching chars are NEVER allowed
function validateInstancePath(instancePath) {

    let pathList = instancePath.split('/');
    if (pathList.length != 3) {
        throw new Error(`Error: instance path is not valid: ${instancePath}`);
    }

    let retVal = {
        hostName: pathList[0],
        appId: pathList[1],
        instanceId: Number.parseInt(pathList[2])
    };

    // Validate the path
    if (retVal.hostName.length == 0) {
        console.log(`Error: empty hostName`);
        return;
    }
    if (FNMATCH_PATTERN.test(retVal.hostName)) {
        console.log(`Error: hostName cannot contain pattern-matching characters: ${retVal.hostName}`);
        return;
    }

    if (retVal.appId.length == 0) {
        console.log(`Error: empty appId`);
        return;
    }
    if (FNMATCH_PATTERN.test(retVal.appId)) {
        console.log(`Error: appId cannot contain pattern-matching characters: ${retVal.appId}`);
        return;
    }

    if (Number.isNaN(retVal.instanceId)) {
        console.log(`Error: instanceId is not a number: ${pathList[2]}`);
        return;
    }
    if (retVal.instanceId <= 0) {
        console.log(`Error: invalid instanceId: ${retVal.instanceId}`);
        return;
    }

    // Valid
    return retVal;
}
// }}}
// {{{ validateAppPath
// ----------------------------------------------------------------------------
// Breaks down the path into hostName/appId (no instanceId)
// Caller can choose to allow or forbit the use of pattern match in host/appId
// Returns an object with those 2 properties set or undefined if a validation
// error occurred (error are printed to stdout)
function validateAppPath(appPath, allowPattern = false) {

    let pathList = appPath.split('/');
    if (pathList.length != 2) {
        throw new Error(`Error: app path is not valid: ${appPath}`);
    }

    let retVal = {
        hostName: pathList[0],
        appId: pathList[1]
    };

    // Validate the path
    if (retVal.hostName.length == 0) {
        console.log(`Error: empty hostName`);
        return;
    }
    if (!allowPattern && FNMATCH_PATTERN.test(retVal.hostName)) {
        console.log(`Error: hostName cannot contain pattern-matching characters: ${retVal.hostName}`);
        return;
    }

    if (retVal.appId.length == 0) {
        console.log(`Error: empty appId`);
        return;
    }
    if (!allowPattern && FNMATCH_PATTERN.test(retVal.appId)) {
        console.log(`Error: appId cannot contain pattern-matching characters: ${retVal.appId}`);
        return;
    }

    // Valid
    return retVal;
}
// }}}
// {{{ printRemoteHostInfo
// ----------------------------------------------------------------------------
// resp is an array of RemoteHostInfo objects
function printRemoteHostInfo(resp, detailed) {
    if (detailed) {
        // Detailed output for each host
        for (let h in resp) {
            let hostInfo = resp[h];
            console.log(`Host: ${hostInfo.hostName} (${hostInfo.arch}) vers. ${hostInfo.version}`);
            for (let a in hostInfo.apps) {
                let appInfo = hostInfo.apps[a];
                console.log(`\tApp: name=${appInfo.name}, class=${appInfo.class}, arch=${appInfo.arch}, vers=${appInfo.version}`);
                // console.log(`\t${appInfo.desc}`);
                if (appInfo.inst.length > 0) {
                    for (let i in appInfo.inst) {
                        let instInfo = appInfo.inst[i];
                        let pidText = (instInfo.state == 'running') ? `(pid=${instInfo.pid})` : "";
                        console.log(`\t\tInstance=${instInfo.num}, state=${instInfo.state} ${pidText}`);
                    }
                }
            }
        }

    } else {
        // Simple output, one-line per host
        for (let i in resp) {
            let hostInfo = resp[i];
            let appDesc = "";
            let sep = "";
            for (let a in hostInfo.apps) {
                let appInfo = hostInfo.apps[a];
                appDesc += sep + appInfo.name;
                sep = ", ";
            }

            console.log(`${hostInfo.hostName}: ${appDesc}`);
        }
    }
}
// }}}
// {{{ printAppInstanceInfo
// ----------------------------------------------------------------------------
// resp is an object of type AppInstanceInfo
function printAppInstanceInfo(resp, hostName, appId) {
    console.log(`${hostName}/${appId}:`);
    console.log(`\tInstance Num : ${resp.num}`);

    let pid = (resp.state == 'running') ? ` (pid=${resp.pid})`:"";
    console.log(`\tState        : ${resp.state}${pid}`);
    console.log(`\tPersistent   : ${resp.persistent}`);
    console.log(`\tUnifyStdout  : ${resp.unifystdout}`);
    console.log(`\tCmdline      : "${resp.cmdline}"`);
    if (resp.user !== undefined) {
        console.log(`\tUser name    : "${resp.user}"`);
    }
}
// }}}
// {{{ attachConsole
// ----------------------------------------------------------------------------
async function attachConsole(api, pathObj, what, pos, pollTimeMsec) {

    async function sendSingleLine(txt) {
        await api.uploadStdin(pathObj.hostName,
                pathObj.appId, 
                pathObj.instanceId, 
                txt);
    }

    process.stdin.on('data', sendSingleLine);
    process.stdin.on('end', process.exit);

    // Polls at periodic interval for the stdout or stderr (or both)
    for (i=0;;++i) {
        let resp = await api.getInstanceInfo(pathObj.hostName, 
                pathObj.appId, 
                pathObj.instanceId, 
                { 
                    what: what,
                    offset: pos
                }
        )
        if (resp.length > 0) {
            pos += resp.length;
            process.stdout.write(resp);
        }
        // is the process still running?
        resp = await api.getInstanceInfo(pathObj.hostName,
                pathObj.appId, 
                pathObj.instanceId);

        if (resp.state != 'running') {
            if (theDebugEnabled) {
                console.log("** Process stopped");
            }
            break;
        }
        await syncSleep(1000);      // TODO: Customize the poll time
    }
}
// }}}

// {{{ runCommand_ls
// ----------------------------------------------------------------------------
async function runCommand_ls(api, args) {
    let detailed = false;
    let path; 
    if ((args[0] == '-l') || (args[0] == '--long')) {
        detailed = true;
        path = args[1];
    } else {
        path = args[0];
    }
    let hostName, appId;
    if (typeof(path) == "string") {
        let pathList = path.split('/');
        hostName = pathList[0];
        appId = pathList[1];
        if (pathList.length > 2) {
            console.log(`Error: invalid path: ${path}`);
            return 1;
        }
    }

    let resp = await api.getAllRemoteLauncherInfo(hostName, appId);
    printRemoteHostInfo(resp, detailed);

    // Success
    return 0;
}
// }}}
// {{{ runCommand_info
// ----------------------------------------------------------------------------
async function runCommand_info(api, args) {
    if (args.length == 0) {
        console.log(`Error: missing required path`);
        return 1;
    }
    
    let path = validateInstancePath(args[0]);
    if (!path) {
        // Validation error
        return 1;
    }
    // Call getInstanceInfo
    let resp = await api.getInstanceInfo(path.hostName, path.appId, path.instanceId);
    printAppInstanceInfo(resp, path.hostName, path.appId);

    // Success
    return 0;
}
// }}}
// {{{ runCommand_new
// ----------------------------------------------------------------------------
async function runCommand_new(api, args) {
    if (args.length == 0) {
        console.log(`Error: missing required path`);
        return 1;
    }
    let params = {}
    for (let i = 0; i < args.length-1; ++i) {
        if (args[i] == '-r' || args[i] == '--run') {
            params.state = "running";
            continue;
        }
        if (args[i] == '-c' || args[i] == '--cmdline') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --cmdline option");
                return 1;
            }
            params.cmdline = args[i];
            continue;
        }
        if (args[i] == '-u' || args[i] == '--user') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --user option");
                return 1;
            }
            params.user = args[i];
            continue;
        }
        if (args[i] == '-p' || args[i] == '--persistent') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --persistent option");
                return 1;
            }
            params.persistent=parseBoolean(args[i]);
            if (params.persistent === undefined) {
                return 1;
            }
            continue;
        }
        if (args[i] == '-s' || args[i] == '--unifystdout') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --unifystdout option");
                return 1;
            }
            params.unifystdout=parseBoolean(args[i]);
            if (params.unifystdout === undefined) {
                return 1;
            }
            continue;
        }
        console.log(`Error: invalid argument: '${args[i]}'`);
        return 1;
    }
    
    let path = validateAppPath(args[args.length-1]);
    if (!path) {
        // Validation error
        return 1;
    }
    // Call createInstance
    let resp = await api.createInstance(path.hostName, 
            path.appId, 
            params);
    printAppInstanceInfo(resp, path.hostName, path.appId);

    // Success
    return 0;
}
// }}}
// {{{ runCommand_modify
// ----------------------------------------------------------------------------
// This is essentially like new, except that the path must contain the 
// instance number
async function runCommand_modify(api, args) {
    if (args.length == 0) {
        console.log(`Error: missing required path`);
        return 1;
    }
    let params = {}
    for (let i = 0; i < args.length-1; ++i) {
        if (args[i] == '-r' || args[i] == '--run') {
            params.state = "running";
            continue;
        }
        if (args[i] == '-c' || args[i] == '--cmdline') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --cmdline option");
                return 1;
            }
            params.cmdline = args[i];
            continue;
        }
        if (args[i] == '-p' || args[i] == '--persistent') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --persistent option");
                return 1;
            }
            params.persistent=parseBoolean(args[i]);
            if (params.persistent === undefined) {
                return 1;
            }
            continue;
        }
        if (args[i] == '-u' || args[i] == '--user') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --user option");
                return 1;
            }
            params.user = args[i];
            continue;
        }
        if (args[i] == '-s' || args[i] == '--unifystdout') {
            if (++i == args.length-1) {
                console.log("Error: missing value for --unifystdout option");
                return 1;
            }
            params.unifystdout=parseBoolean(args[i]);
            if (params.unifystdout === undefined) {
                return 1;
            }
            continue;
        }
        console.log(`Error: invalid argument: '${args[i]}'`);
        return 1;
    }
    
    let path = validateInstancePath(args[args.length-1]);
    if (!path) {
        // Validation error
        return 1;
    }
    let resp = await api.modifyInstance(path.hostName, 
            path.appId, 
            path.instanceId,
            params);
    printAppInstanceInfo(resp, path.hostName, path.appId);

    // Success
    return 0;
}
// }}}
// {{{ runCommand_run
// ----------------------------------------------------------------------------
async function runCommand_run(api, args) {
    if (args.length == 0) {
        console.log(`Error: missing required path`);
        return 1;
    }

    let showStdout = false;
    let showStderr = false;
    let instPath; 
    let pollTimeMsec = 1000;
    for (var i = 0; i < args.length-1; ++i) {
        if ((args[i] == '-o') || (args[i] == '--stdout')) {
            showStdout = true;
            continue;
        }
        if ((args[i] == '-e') || (args[i] == '--stderr')) {
            showStderr = true;
            continue;
        }
        if ((args[i] == '-p') || (args[i] == '--poll')) {
            if (i == args.length-2) {
                console.log("Error: missing value for argument --poll");
                return 1;
            }
            pollTimeMsec = Number.parseInt(args[++i]);
            if (Number.isNaN(pollTimeMsec)) {
                console.log("Error: invalid value for argument --poll");
                return 1;
            }
            continue;
        }
        console.log(`Error: invalid argument: ${args[i]}`);
        return 1;
    }
    if (showStdout && showStderr) {
        // TODO: we could do some interleaved polling, OR we could spawn the 
        //       process with stdout and stderr going to the same file
        console.log("Error: you cannot specify both --stdout and --stderr");
        return 1;
    }
    instPath = args[i];
    
    let pp = validateInstancePath(instPath);
    if (!pp) {
        // Validation error
        return 1;
    }
    let resp = await api.modifyInstance(pp.hostName, 
            pp.appId, 
            pp.instanceId,
            { state: "running"} );
    if (showStdout || showStderr) {
        await attachConsole(api, pp, showStdout ? "stdout" : "stderr", 0, pollTimeMsec);
    } else {
        printAppInstanceInfo(resp, pp.hostName, pp.appId);
    }

    // Success
    return 0;
}
// }}}
// {{{ runCommand_attach
// ----------------------------------------------------------------------------
async function runCommand_attach(api, args) {
    if (args.length == 0) {
        console.log(`Error: missing required path`);
        return 1;
    }

    let showStdout = false;
    let showStderr = false;
    let pollTimeMsec = 1000;
    let instPath; 
    for (var i = 0; i < args.length-1; ++i) {
        if ((args[i] == '-o') || (args[i] == '--stdout')) {
            showStdout = true;
            continue;
        }
        if ((args[i] == '-e') || (args[i] == '--stderr')) {
            showStderr = true;
            continue;
        }
        if ((args[i] == '-p') || (args[i] == '--poll')) {
            if (i == args.length-2) {
                console.log("Error: missing value for argument --poll");
                return 1;
            }
            pollTimeMsec = Number.parseInt(args[++i]);
            if (Number.isNaN(pollTimeMsec)) {
                console.log("Error: invalid value for argument --poll");
                return 1;
            }
            continue;
        }
        console.log(`Error: invalid argument: ${args[i]}`);
        return 1;
    }
    instPath = args[i];
    if (showStdout && showStderr) {
        console.log("Error: you cannot specify both --stdout and --stderr");
        return 1;
    }
    if (!showStdout && !showStderr) {
        // By default, show stdout
        showStdout = true;
    }
    
    let pp = validateInstancePath(instPath);
    if (!pp) {
        // Validation error
        return 1;
    }
    // Query for file information
    let fileInfoArr = await api.getInstanceInfo(pp.hostName, 
            pp.appId,
            pp.instanceId,
            { what:"fileinfo" });
    let fileSize;
    for (let i in fileInfoArr) {
        let fileInfo = fileInfoArr[i];
        if ( (showStdout && (fileInfo.stdout === true)) ||
             (showStderr && (fileInfo.stderr === true)) ) {
            fileSize = fileInfo.size;
            break;
        }
    }
    if (fileSize === undefined) {
        console.log("Error: cannot determine current file size");
        if (theDebugEnabled) {
            console.log(`\tResp is: ${JSON.stringify(fileInfoArr)}`);
        }
        return 1;
    }
        
    if (fileSize > ATTACH_OFFSET_CHARS) {
        fileSize -= ATTACH_OFFSET_CHARS;
    } else {
        fileSize = 0;
    }

    await attachConsole(api, pp, showStdout ? "stdout" : "stderr", fileSize, pollTimeMsec);

    // Success
    return 0;
}
// }}}
// {{{ runCommand_delete
// ----------------------------------------------------------------------------
async function runCommand_delete(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required path");
        return 1;
    }
    if (args.length > 1) {
        console.log("Error: invalid argument");
        return 1;
    }
    
    let path = validateInstancePath(args[args.length-1]);
    if (!path) {
        // Validation error
        return 1;
    }
    let resp = await api.deleteInstance(path.hostName, 
            path.appId, 
            path.instanceId);
    console.log("Instance successfully deleted");

    // Success
    return 0;
}
// }}}
// {{{ runCommand_stop
// ----------------------------------------------------------------------------
async function runCommand_stop(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required path");
        return 1;
    }
    if (args.length > 1) {
        console.log("Error: invalid argument");
        return 1;
    }
    
    let path = validateInstancePath(args[args.length-1]);
    if (!path) {
        // Validation error
        return 1;
    }
    let resp = await api.modifyInstance(path.hostName, 
            path.appId, 
            path.instanceId,
            { state: "stopped"},
            { sync: true} );
    printAppInstanceInfo(resp, path.hostName, path.appId);

    // Success
    return 0;
}
// }}}
// {{{ runCommand_log
// ----------------------------------------------------------------------------
async function runCommand_log(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required resource path");
        return 1;
    }
    let outFile;
    for (var i = 0; i < args.length-1; ++i) {
        if ((args[i] == '-f') || (args[i] == '--file')) {
            if (i == args.length-2) {
                console.log("Error: missing value for argument --out");
                return 1;
            }
            outFile =args[++i];
            continue;
        }
        console.log(`Error: invalid argument: ${args[i]}`);
        return 1;
    }

    let instancePath = args[args.length-1];
    let pp = validateInstancePath(instancePath);
    if (!pp) {
        // Validation error
        return 1;
    }

    let resp = await api.getInstanceInfo(pp.hostName, 
            pp.appId, 
            pp.instanceId,
            { what: "log" });
    if (outFile) {
        await writeFilePromise(outFile, resp);
        console.log(`Requested resource saved in file: ${outFile}`); 
    } else {
        console.log(resp);
    }

    // Success
    return 0;
}
// }}}
// {{{ runCommand_exec
// ----------------------------------------------------------------------------
async function runCommand_exec(api, args) {
    if (args.length == 0) {
        console.log(`Error: missing required path`);
        return 1;
    }
    let appPath = validateAppPath(args.shift());
    if (!appPath) {
        // Validation error
        return 1;
    }

    // NOTE: args, now contains the command line of the target app

    // Create the instance and run it immediately
    let params = {}
    params.state = "running";
    params.persistent = false;
    params.unifystdout = true;
    if (args.length > 0) {
        params.cmdline = args.join(' ');
    }
    if (theDebugEnabled) console.log(`Creating instance of: ${cmd[0]}`);

    let resp = await api.createInstance(appPath.hostName, 
            appPath.appId, 
            params);
    if (theDebugEnabled) {
        printAppInstanceInfo(resp, appPath.hostName, appPath.appId);
    }

    appPath.instanceId = resp.num;

    process.on('SIGINT', () => {
        if (theDebugEnabled) console.log('Received SIGINT, stopping instance');
        api.modifyInstance(appPath.hostName, 
                appPath.appId, 
                appPath.instanceId,
                { state: "stopped"},
                { sync: true} ).then( () => {
                    if (theDebugEnabled) console.log("Instance stopped, deleting...");
                    api.deleteInstance(appPath.hostName, appPath.appId, appPath.instanceId).then( () => {
                        if (theDebugEnabled) console.log("Instance deleted!");
                        process.exit(0);
                    }).catch( (e) => { process.exit(1); });
                }).catch( (e) => { process.exit(1) });
    });

    // Attach to stdout
    await attachConsole(api, appPath, "stdout", 0, 1000);
    if (theDebugEnabled) {
        console.log("App terminated, cleaning up...");
    }
    await api.deleteInstance(appPath.hostName, appPath.appId, appPath.instanceId);
    if (theDebugEnabled) {
        console.log("Instance deleted");
    }

    // Success
    return 0;
}
// }}}

// Resource commands
// {{{ runCommand_resls
// ----------------------------------------------------------------------------
async function runCommand_resls(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required path");
        return 1;
    }
    if (args.length > 1) {
        console.log("Error: invalid argument");
        return 1;
    }
    
    let instancePath = args[args.length-1];
    let pp = validateInstancePath(instancePath);
    if (!pp) {
        // Validation error
        return 1;
    }
    let fileInfoArr = await api.getInstanceInfo(pp.hostName, 
            pp.appId,
            pp.instanceId,
            { what:"fileinfo" });
    if (fileInfoArr.length > 0) {
        console.log(`Resources available for instance: ${instancePath}:`);
        for (let i in fileInfoArr) {
            let fileInfo = fileInfoArr[i];
            let runNumStr = "";
            if (fileInfo.run_num) {
                runNumStr = ` (${fileInfo.run_num})`;
            }
            if (fileInfo.stdout) {
                console.log(`\tstdout${runNumStr}: size=${fileInfo.size} bytes`);
                continue;
            }
            if (fileInfo.stderr) {
                console.log(`\tstderr${runNumStr}: size=${fileInfo.size} bytes`);
                continue;
            }
            if (fileInfo.log) {
                console.log(`\tlog: size=${fileInfo.size} bytes`);
                continue;
            }
            console.log(`\t"${fileInfo.name}": size=${fileInfo.size} bytes`);
        }
    } else {
        console.log("No files available for download");
    }

    // Success
    return 0;
}
// }}}
// {{{ runCommand_resget
// ----------------------------------------------------------------------------
async function runCommand_resget(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required resource path");
        return 1;
    }
    let outFile;
    for (var i = 0; i < args.length-1; ++i) {
        if ((args[i] == '-f') || (args[i] == '--file')) {
            if (i == args.length-2) {
                console.log("Error: missing value for argument --out");
                return 1;
            }
            outFile =args[++i];
            continue;
        }
        console.log(`Error: invalid argument: ${args[i]}`);
        return 1;
    }

    let resourcePath = args[args.length-1];
    let pp = validateResourcePath(resourcePath);
    if (!pp) {
        // Validation error
        return 1;
    }

    let resp = await api.downloadFile(pp.hostName, 
            pp.appId, 
            pp.instanceId,
            pp.resName);
    if (outFile) {
        await writeFilePromise(outFile, resp);
        console.log(`Requested resource saved in file: ${outFile}`); 
    } else {
        console.log(resp);
    }

    // Success
    return 0;
}
// }}}
// {{{ runCommand_resgetio
// ----------------------------------------------------------------------------
async function runCommand_resgetio(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required resource path");
        return 1;
    }
    let outFile;
    let getStdout = false;
    let getStderr = false;
    let run_num;
    for (var i = 0; i < args.length-1; ++i) {
        if ((args[i] == '-f') || (args[i] == '--file')) {
            if (i == args.length-2) {
                console.log("Error: missing value for argument --out");
                return 1;
            }
            outFile =args[++i];
            continue;
        }
        if ((args[i] == '-o') || (args[i] == '--out')) {
            getStdout = true;
            continue;
        }
        if ((args[i] == '-e') || (args[i] == '--err')) {
            getStderr = true;
            continue;
        }
        if ((args[i] == '-n') || (args[i] == '--num')) {
            if (i == args.length-2) {
                console.log("Error: missing value for argument --num");
                return 1;
            }
            run_num = Number(args[++i]);
            continue;
        }
        console.log(`Error: invalid argument: ${args[i]}`);
        return 1;
    }

    if (getStdout && getStderr) {
        console.log("Error: you must specify only one --stdout or --stderr");
        return 1;
    }
    if (!getStdout && !getStderr) {
        getStdout = true;
    }

    let instancePath = args[args.length-1];
    let pp = validateInstancePath(instancePath);
    if (!pp) {
        // Validation error
        return 1;
    }

    let objReq = {
        what: (getStdout ? "stdout" : "stderr")
    }
    if (run_num) {
        objReq.run_num = run_num;
    }

    let resp = await api.getInstanceInfo(pp.hostName, 
            pp.appId, 
            pp.instanceId,
            objReq);
    if (outFile) {
        await writeFilePromise(outFile, resp);
    console.log(`Requested resource saved in file: ${outFile}`); 
    } else {
        console.log(resp);
    }

    // Success
    return 0;
}
// }}}
// {{{ runCommand_resput
// ----------------------------------------------------------------------------
async function runCommand_resput(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required resource path");
        return 1;
    }
    let inFile;
    for (var i = 0; i < args.length-1; ++i) {
        if ((args[i] == '-f') || (args[i] == '--file')) {
            if (i == args.length-2) {
                console.log("Error: missing value for argument --out");
                return 1;
            }
            inFile =args[++i];
            continue;
        }
        console.log(`Error: invalid argument: ${args[i]}`);
        return 1;
    }
    if (!inFile) {
        console.log("Error: you must specify the file to upload with the argument --file");
        return 1;
    }

    let resourcePath = args[args.length-1];
    let pp = validateResourcePath(resourcePath);
    if (!pp) {
        // Validation error
        return 1;
    }

    let buf = await readFilePromise(inFile);

    let resp = await api.uploadFile(pp.hostName, 
            pp.appId, 
            pp.instanceId,
            pp.resName,
            buf);
    console.log(`File ${inFile} uploaded successfully`);

    // Success
    return 0;
}
// }}}
// {{{ runCommand_resdel
// ----------------------------------------------------------------------------
async function runCommand_resdel(api, args) {
    if (args.length == 0) {
        console.log("Error: missing required resource path");
        return 1;
    }

    let resourcePath = args[args.length-1];
    let pp = validateResourcePath(resourcePath);
    if (!pp) {
        // Validation error
        return 1;
    }

    let resp = await api.deleteFile(pp.hostName, 
            pp.appId, 
            pp.instanceId,
            pp.resName);
    console.log(`Resource deleted successfully`);

    // Success
    return 0;
}
// }}}

// {{{ dispatchCommand
// ----------------------------------------------------------------------------
async function dispatchCommand(api, cmd) {
    // Dynamically build the function executor from the command name
    // and invoke it.
    // If the function (derived from the command) is not defined, catch
    // the ReferenceError and print a pretty error message
    try {
        let fnName = `runCommand_${cmd[0]}`;
        let fnRef = eval(fnName); 
        if (typeof(fnRef) != "function") {
            throw new Error(`Error: unexpected target command: ${fnName}`);
        }

        // User request help on the command?
        if (cmd[1] == '-h' || cmd[1] == '--help') {
            usage(cmd[0]);
            return 0;
        }
        // Invoke the function named: `runCommand_${cmd[0]}`
        return await fnRef(api, cmd.slice(1));
    }
    catch(err) {
        if (err instanceof ReferenceError) {
            console.error(`Error: invalid command: ${cmd[0]}`);

        } else if (err instanceof RPCException) {
            console.error(`Remote server responded with the following error:`);
            console.error(`\t${err.message}`);

        } else {
            // Else is another internal error:
            console.error("An error occurred while execuing the remote command:");
            console.error(`\t${err.message}`);
        }

        if (theDebugEnabled) {
            console.error(err.stack);
        }
        return 1;
    }
}
// }}}
// {{{ main
// ----------------------------------------------------------------------------
// Main code starts here
// ----------------------------------------------------------------------------
// argv[0] = 'node'
// argv[1] = <full path to this script>
// argv[2] = <firstArgument>
// argv[3] = <secondArgument>
// ...
let argURL = DEFAULT_URL;
let argInteractive = false;

// Parse command-line
if (process.argv.length < 2) {
    usage();
    process.exit(1);
}
for (var i = 2; i < process.argv.length; ++i) {
    if ((process.argv[i] == '-h') || (process.argv[i] == '--help')) {
        usage();
        process.exit(0);
    }
    if ((process.argv[i] == '--url') || (process.argv[i] == '-u'))  {
        argURL = process.argv[++i];
        continue;
    }
    if (process.argv[i] == '--debug') {
        theDebugEnabled = true;
        continue;
    }
    if (process.argv[i][0] != '-') {
        // Not an argument, interrupt command line parsing
        break;
    }
    usage();
    console.log("Error: Unknown argument: " + process.argv[i]);
    process.exit(1);
}
if (i == process.argv.length) {
    usage();
    process.exit(1);
}

let cmd = process.argv.slice(i);

// Compose the URL according to the current API version
argURL = `${argURL}/api/${API_VERSION}`;

dispatchCommand(new RemoteLauncherAPI(argURL), cmd).then( (rc) => {
    // console.log(`>>> Executing command: ${cmd}`);
    // console.log(`>>> Using URL = ${argURL}`);
    process.exit(rc);
}).catch( (err) => {
    console.error(`Exception caught: ${err.message}`);
    console.errorl(err.stack);
    process.exit(1);
});


// }}}


