var net = require('net');

/////////////////////////////////////////////////
// LWR3 protocol client JS implementation
/////////////////////////////////////////////////

function wildCompare(string, search){
    // utility function for wildchar comparison
    var prevIndex = -1,
        array = search.split('*'), // Split the search string up in sections.
        result = true;
    for(var i = 0; i < array.length && result; i++){ // For each search section
        var index = string.indexOf(array[i]); // Find the location of the current search section
        if(index == -1 || index < prevIndex){ // If the section isn't found, or it's placed before the previous section...
            return false;
        }
    }
    return result;
}
class NodeToWatch {
    constructor(client, nodePath, callback){
        this.client = client;
        this.nodePath = nodePath;
        this.callback = callback;
    }
    init() {
        this.client.OPEN(this.nodePath, "*",(x) => {
            this.callback(x.topic, x.payload);
        });
    }
    load() {
        this.client.GET(this.nodePath+'.*', (x) => {
            this.callback(x.topic, x.payload);
        });
    }
}
class PropertyToWatch {
    constructor(client, nodePath, property, callback){
        this.client = client;
        this.nodePath = nodePath;
        this.callback = callback;
        this.property = property;
    }
    init() {
        this.client.OPEN(this.nodePath, this.property, (x)=>{
            this.callback(x.payload);
        });
    }
    load() {
        this.client.GET(this.nodePath+'.'+this.property, (x) => {
            this.callback(x.payload);
        });
    }
}

function Lwr3Client(host, port, waitresponses, initialwait, log_enable, callback) {
    this.host = host;
    this.port = port;
    this.waitresponses = waitresponses;
    this.cmdtosend = [];
    this.watchers = [];
    this.initialwait = initialwait;
    this.callback = callback;
    this.log_enable = log_enable;

    var node = this;

    this.connected = false;
    this.connecting = false;
    this.shutdown = false;
    this.inputbuffer = "";
    this.conn = net.Socket();
    this.conn.setEncoding('utf8');
    this.subscribers = [];
    this.connectionListeners = [];
    this.deviceDriver = null;
    this.firstConnect = true;
    this.addNodeWatcher = function(nodePath, callback) {
        this.watchers.push(new NodeToWatch(node, nodePath, callback));
    }
    this.addPropertyeWatcher = function(nodePath, property, callback) {
        this.watchers.push(new PropertyToWatch(node, nodePath, property, callback));
    }

    //
    // Connection handling routines
    //

    node.conn.on('connect', function() {
        if(node.log_enable) {
            console.log('LW3 connection established succesfully');
        }
        node.connecting = false;
        node.connected = true;
        subscribed = [];
        node.subscribers.forEach(function(i) {
            if (subscribed.indexOf(i.path) == -1)
                node.cmdsend('OPEN '+i.path, function(){});
            subscribed.push(i.path);
        });
        if(node.firstConnect) {
            if (node.callback) {
                node.callback();
            }
            node.firstConnect = false;
            for(let w of node.watchers) {
                w.init();
            }
        }
        for(let w of node.watchers) {
            w.load();
        }
        //TODO call connectionListeners when all watchers ar loaded
        for(let l of node.connectionListeners) {
            l(true);
        }
    });
    node.conn.on('close', function() {
        if(node.log_enable) {
            console.log('LW3 connection was closed');
        }
        const lastConnected = node.connected;
        node.connected = false;
        node.deviceDriver = null;        
        setTimeout(node.startConnect, 1000);
        if(lastConnected) { //only call callbacks, if connected went down (skip when closing already closed client)
            for(let l of node.connectionListeners) {
                l(false);
            }
        }
    });
    node.conn.on('error', function(e) {
        if (node.connecting) {
            if(node.log_enable) {
                console.log('LW3 connection error:' + e.toString());
            }
        }            
    });        
    node.startConnect = function() {
        if (!node.shutdown) {             
            node.connecting = true;
            node.connected = false;
            node.conn.connect(node.port, node.host);            
        }
    };       

    node.startConnect();

    //
    //Incoming buffer handling routines
    //

    this.conn.on('data', function(data) {
        // collecting incoming data into a single buffer and splitting into lines        
        if (data instanceof ArrayBuffer) {
            data = String.fromCharCode.apply(null, new Uint8Array(data));
        }        
        node.inputbuffer += data;        
        lines = node.inputbuffer.split('\n');
        if (lines.length > 1) {
            node.inputbuffer = lines[lines.length-1];
            lines.pop();
            lines.forEach(node.linercv);                
        }
        if (node.inputbuffer.length > 10e3) {
            node.inputbuffer = '';
            console.log('Received data has contained a line with more than 10kbyte data. Maybe it is not LW3 protocol?');
        }
    });

    this.inblock = false;
    this.block = [];
    this.signature = '';
    this.linercv = function(data) {
        if (this.log_enable)
            console.log('<< '+data);
        // a new line has been received.        
        if (!data.length) return;        
        if (data.search('CHG ') === 0) 
            node.chgrcv(data);
        else if (!node.inblock) {
            if (data.charAt(0) == '{') {
                node.inblock = true;
                node.signature = data.substring(1,5);
            } else {
                console.log('Some strange thing has arrived: '+data);
            }
        } else if (data.charAt(0) == '}') {
            node.blockrcv(node.signature, node.block);
            node.block=[];
            node.inblock = false;
        } else {
            node.block.push(data);
        }
    };
    this.addConnectionListener = function(listener) {
        node.connectionListeners.push(listener);
    };

    this.chgrcv = function(data) {
        //a new CHG message has been received        
        data = data.substring(4, data.length-1);
        eq = data.search('=');
        if (eq == -1) {
            console.log('Strange message: '+data);
            return;
        }
        proppath = data.substring(0,eq);
        nodepath = proppath.substring(0,proppath.indexOf('.'));
        propname = proppath.substring(proppath.indexOf('.')+1, proppath.length);            
        value = data.substring(eq+1, data.length); //todo escaping                        
        node.subscribers.forEach(function(i){                
            if (i.path == nodepath) {
                payload = node.convertValue(value);                    
                if ((i.property === '') || (i.property == propname)) {                    
                    if ((i.value == '') || (i.value == payload))
                        i.callback({'topic':propname, 'path':nodepath, 'payload':payload, 'name':node.name});
                } else if (i.property.indexOf('*') != -1) {
                    if (wildCompare(propname, i.property))
                        if ((i.value == '') || (i.value == payload))
                            i.callback({'topic':propname, 'path':nodepath, 'payload':payload, 'name':node.name});
                }
            }
        });
    };

    this.convertValue = function(value) {
        if (Number.isSafeInteger(value))
            value = parseInt(value);
        else if (value.toUpperCase() == 'FALSE')
            value = false;
        else if (value.toUpperCase() == 'TRUE')
            value = true;
        else if (value.indexOf(';') != -1) {
            value = value.split(';');
            if (value.slice(-1)[0] === '')   //remove last item if empty
                value.pop();
        }
        return value;
    };

    this.waitlist = [];
    this.blockrcv = function(signature, data) {
        //a new block of lines have been arrived                        
        for (i=0; i<node.waitlist.length; i++) if (node.waitlist[i].sign == signature) {            
            tmp = node.waitlist[i];
            node.waitlist.splice(i, 1);
            if (node.waitresponses)
                if (node.cmdtosend.length > 0) {
                    data2send = node.cmdtosend.shift();
                    node.conn.write(data2send);                                        
                    if (this.log_enable)
                        console.log('>> '+data2send);
                }
            if (tmp.info !== undefined)
                tmp.callb(data, tmp.info);
            else
                tmp.callb(data);            
            return;
        } 
        console.log('Unexpected response with signature: '+signature);
    };

    //
    // Outgoing buffer handler
    //

    this.signature_counter = 0;
    this.cmdsend = function(cmd, callback, callback_info) {                
        if (!this.connected) return;        
        signature = ((node.signature_counter+0x10000).toString(16).substr(-4).toUpperCase());
        data = signature + '#' + cmd + '\n';
        
        if (!node.waitresponses) {
            node.conn.write(data);                        
            if (this.log_enable)
                console.log('>> '+data);
        } else if (node.waitlist.length == 0) {                        
            //
        } else {
            node.cmdtosend.push(data);        
        }

        
        callback_info = callback_info || undefined;
        node.waitlist.push({'sign': signature, 'callb': callback, 'info':callback_info});            
        node.signature_counter = (node.signature_counter + 1) % 0x10000;
        //todo timeout?
    };

    //
        // LW3 commands and response handlers
        //

        this.SET = function(property, value, callback) {
            //todo escaping
            //todo sanity check
            node.cmdsend('SET '+property+'='+(value.toString()), function(data){
                callback({success: data[0].charAt(1) != 'E', resp: data});
            });
        };

        this.CALL = function(property, value, callback) {
            //todo escaping
            //todo sanity check
            if (callback === null) return;
            node.cmdsend('CALL '+property+'('+value+')', function(data) {
                callback({success: data[0].charAt(1) != 'E', resp: data});
            });
        };


        this.GET = function(property, callback) {
            /* Getting a single or multiple property 
                Path can contain multiple wildchars even in path and propertyname
            */            
            //todo escaping
            //todo sanity check
            if (callback === null) return;
            device = this;

            path = property.split('.');
            if (path.length != 2) {
                console.log("Getting invalid property: "+property);
                return;
            }            

            if (path[0].indexOf("*") == -1) {
                //path contains no wildchar charachter - getting properties.
                command = 'GET '+property;
                if (path[1].indexOf('*') != -1) command = 'GET '+path[0]+'.*'; //if property name contains wildchar, we should search for *                
                node.cmdsend(command, function(data, property)  {
                    path = property.split('.');                    
                    data.forEach(function(data) {                        
                        if (data.charAt(0) != 'p') return;                    //skip methods                        
                        if (data.indexOf(path[0]) == -1) return;              //malformed answer?                        
                        n = data.indexOf('=');                                                
                        if (n==-1) return;                                    //malformed answer?                        

                        response_property = data.split('.')[1].split('=')[0];
                        
                        if (wildCompare(response_property, path[1])) {
                            callback({'payload':device.convertValue(data.substring(n+1, data.length-1)),
                                      'topic':response_property,
                                      'path':path[0],
                                      'name':node.name});                    
                        }
                    });
                }, property);
            } else {
                //path contain wildchar charachters. We need find the required subnodes.
                path_parts = path[0].split("/");
                w_id = -1;
                for (i=0; i<path_parts.length; i++) if (path_parts[i].indexOf("*") != -1) { w_id = i; break; }                
                new_path = path_parts.slice(0, w_id).join("/");       

                node.cmdsend('GET '+new_path, function(data, param) {
                    path_parts_local = param[0];
                    w_id_local = param[1];
                    callback_local = param[2];
                    data.forEach(function(item) {                        
                        if (item.indexOf('n- ') != 0) return;
                        response_path = item.split(' ')[1].slice(0,-1);
                        if (wildCompare(response_path.split('/').slice(-1)[0], path_parts_local[w_id_local])) {
                            str = response_path+'/'+path_parts_local.slice(w_id_local+1).join('/');
                            device.GET(str+'.'+path[1], callback_local);
                        }
                    });                    
                }, [path_parts.slice(), w_id, callback]);
            }
        };

        this.OPEN = function(path, property, callback) {
            if (callback === null) return;
            //todo sanity check
            if (path.indexOf('*') == -1) {  //path has no wildchar
                alreadyOpen = false;
                for (i=0; i<node.subscribers.length; i++) if (node.subscribers[i].path == path) alreadyOpen=true;
                if (!alreadyOpen) {
                    node.cmdsend('OPEN '+path, function(data){
                        try {
                            if (data[0].charAt(0) != 'o') throw 0;
                            if (data[0].search(path) === -1) throw 0;
                        } catch (err) {
                            console.log('Subscribing to node '+path+' was unsuccesful.');                        
                        }
                    });
                }
                if (property.indexOf('=') != -1) {
                    propval = property.split('=')[1];
                    propname = property.split('=')[0];      
                } else {
                    propname = property;
                    propval = '';
                }
                node.subscribers.push({'path': path,
                                       'property': propname,
                                       'value': propval,
                                       'callback': callback});
            } else {    //there are one or more wildchar in path, the tree must be discoveried
                path_parts = path.split("/");
                w_id = -1;
                for (i=0; i<path_parts.length; i++) if (path_parts[i].indexOf("*") != -1) { w_id = i; break; }                
                new_path = path_parts.slice(0, w_id).join("/");       

                node.cmdsend('GET '+new_path, function(data, param) {
                    path_parts_local = param[0];
                    w_id_local = param[1];
                    property_local = param[2];
                    callback_local = param[3];
                    data.forEach(function(item) {                        
                        if (item.indexOf('n- ') != 0) return;
                        response_path = item.split(' ')[1].slice(0,-1);
                        if (wildCompare(response_path.split('/').slice(-1)[0], path_parts_local[w_id_local])) {
                            str = response_path+'/'+path_parts_local.slice(w_id_local+1).join('/');
                            device.OPEN(str, property_local, callback_local);
                        }
                    });                    
                }, [path_parts.slice(), w_id, property, callback]);
            }
        };

        this.removeListener = function(cb) {            
            node.subscribers = node.subscribers.filter(function(item) { return (item.callback) !== (cb.callback); });                        
        };
        return node;
}

/////////////////////////////////////////
// LW3 Noodle-like interface
////////////////////////////////////////

function wrapNode(object){
    // Converts the given dictionary into a function, thus we can create apply proxy around it
    func = function(){};
    for(var prop in object){
        if(object.hasOwnProperty(prop)){
            func[prop] = object[prop];
        }
    }
    return func;
}

var NoodleProxyHandler = {
    apply: async function(target, ctx, args) {
        last = target.path[target.path.length-1];
        pth = '/'+target.path.slice(0,-1).join('/')
        if (last == 'addListener') {            
            target.lw3.OPEN(pth, args[0], (n)=>{args[1](n.name+':'+n.path+'.'+n.topic, n.payload);});
        } else if (last == 'once') {
            target.lw3.OPEN(pth, args[0], function(n) {target.lw3.removeListener(this); args[1](n.name+':'+n.path+'.'+n.topic, n.payload);});
        } else if (last == 'waitFor') {
            //creating a promise
            return new Promise(function(resolve, reject){
                target.lw3.OPEN(pth, args[0], function(n) {target.lw3.removeListener(this); resolve();});
            });
        } else {
            //method invocation            
            return new Promise((resolve, reject) => target.lw3.CALL(pth+':'+last, args.join(','), resolve));
        }
    },

    get: function(target, key) {                
        if (((key == key.toUpperCase()) || (key[0] == key[0].toLowerCase()) || (key.indexOf('__method__')!=-1) || (key.indexOf('__node__')!=-1)) && (key.indexOf('__prop__') == -1)) {  // node or method
            key = key.replace('__method__','').replace('__node__','');
            node = wrapNode(target);
            node.path = target.path.slice().concat(key);
            return new Proxy(wrapNode(node), NoodleProxyHandler);
        } else { // should be a property
            key = key.replace('__prop__','');
            path = '/'+target.path.join('/');                       
            return new Promise((resolve, reject) => {target.lw3.GET(path+'.'+key, (x) => {resolve(x.payload)})});
        }        
    },

    set: function(target, key, value) {      
            key = key.replace('__prop__','');
            path = '/'+target.path.join('/');
            target.lw3.SET(path+'.'+key, value, () => {});
            return true;
    }          
};

exports.Noodle = (conn, callback) => {
    conn.port = conn.port||6107;
    conn.host = conn.host||'127.0.0.1';
    conn.name = conn.name||'default';
    conn.initialwait = conn.initialwait||0;
    conn.waitresponses = conn.waitresponses||false;
    conn.lw3 = Lwr3Client(conn.host, conn.port, conn.waitresponses, conn.initialwait, conn.log, callback);
    conn.lw3.name = conn.name;
    conn.path = [];
    conn.log = conn.log||false;
    conn.root = new Proxy(conn, NoodleProxyHandler);
    return conn;
}
