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

'use strict';

const axios = require('axios');
const path = require('path');

/**
 * A custom exception that is thrown from this API when the remote launcher 
 * daemon respond with an error code.
 *
 * This exception contains additional information that can be used by the
 * caller to understand better the error:
 *  - status: the status error code (e.g. 400)
 *  - statusText: the status error string (e.g. "Bad request")
 *  - body: the message containing the error detail (e.g. "Invalid ID")
 */
class RPCException extends Error {
    constructor(err) {
        super();
        /*
        // Maintains proper stack trace for where our error was thrown 
        // (only available on V8, comment out if planning to run inside a browser)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RPCException);
        }
        */

        this.name = 'RPCException';
        this.message = `${err.response.status} ${err.response.statusText}: ${err.response.data}`;
        // Custom debugging information
        this.status = err.response.status;
        this.statusText = err.response.statusText;
        this.body = err.response.data;
    }
}


class RemoteLauncherAPI {
    // {{{ constructor
    // -------------------------------------------------------------------------
    // id can be either a Buffer<8> or a string of its hex representation
    constructor(url) {
        this.m_url = url;
    }
    // }}}

    // {{{ getAllRemoteLauncherInfo
    // -------------------------------------------------------------------------
    // Returns an array of RemoteHostInfo objects
    async getAllRemoteLauncherInfo(host, appId) {

        // let url = path.join(this.m_url
        let url = "/";

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                params: {
                    host: host,
                    app: appId
                },
                method: 'GET'
            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ getInstanceInfo
    // -------------------------------------------------------------------------
    // Returns an AppInstanceInfo object or a text file containing the
    // stdout|stderr
    async getInstanceInfo(host, appId, instanceId, params) {
        let url = path.join(host, appId, String(instanceId));

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                params: params,
                method: 'GET'
            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ createInstance
    // -------------------------------------------------------------------------
    // Returns an AppInstanceInfo object
    async createInstance(host, appId, appInfoParams) {
        let url = path.join(host, appId);

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                method: 'PUT',
                data: appInfoParams,
                headers: { 'Content-Type': 'application/json' },

            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ modifyInstance
    // -------------------------------------------------------------------------
    // Returns an AppInstanceInfo object
    async modifyInstance(host, appId, instanceId, appInfoParams, reqParams) {
        let url = path.join(host, appId, String(instanceId));

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                method: 'POST',
                params: reqParams,
                data: appInfoParams,
                headers: { 'Content-Type': 'application/json' },
            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ deleteInstance
    // -------------------------------------------------------------------------
    async deleteInstance(host, appId, instanceId, appInfoParams) {
        let url = path.join(host, appId, String(instanceId));

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                method: 'DELETE'
            })

            return true;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ downloadFile
    // -------------------------------------------------------------------------
    async downloadFile(host, appId, instanceId, resName) {
        let url = path.join(host, appId, String(instanceId), resName);

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                method: 'GET'
            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ uploadFile
    // -------------------------------------------------------------------------
    async uploadFile(host, appId, instanceId, resName, buf) {
        let url = path.join(host, appId, String(instanceId), resName);

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                method: 'PUT',
                data: buf,
                headers: { 'Content-Type': 'application/octet-stream' },
            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ deleteFile
    // -------------------------------------------------------------------------
    async deleteFile(host, appId, instanceId, resName) {
        let url = path.join(host, appId, String(instanceId), resName);

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                method: 'DELETE'
            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}
    // {{{ uploadStdin
    // -------------------------------------------------------------------------
    async uploadStdin(host, appId, instanceId, txt) {
        let url = path.join(host, appId, String(instanceId));

        try {
            let res = await axios({
                baseURL: this.m_url,
                url: url,
                method: 'POST',
                params: {
                    stdin:true
                },
                data: txt,
                headers: { 'Content-Type': 'application/octet-stream' },
            })

            return res.data;

        } catch (err) {
            if (err.isAxiosError && err.response) {
                throw new RPCException(err);
            }
            throw err; // Re-throw
        }
    }
    // }}}

}

module.exports = { 
    RemoteLauncherAPI: RemoteLauncherAPI,
    RPCException: RPCException
};

