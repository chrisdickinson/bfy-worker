module.exports = worker

var prelude = require('./prelude')
  , path = require('path')
  , through = require('through')
  , str = {}.toString
  , make_blob
  , make_url
  , PIDS = 0
  , url

var SIGTERM = 0
  , SIGKILL = 9

// we're just requiring this here to make
// sure it *always* gets into the bundle
var EE = require('events').EventEmitter

switch(true) {
  case typeof Blob !== 'undefined':
    make_blob = function(data) {
      return new Blob([data], {'type': 'text/javascript'})
    }
    break
  case typeof BlobBuilder !== 'undefined':
    make_blob = builder(BlobBuilder)
    break
  case typeof MSBlobBuilder !== 'undefined':
    make_blob = builder(MSBlobBuidler)
    break
  case typeof MozBlobBuilder !== 'undefined':
    make_blob = builder(MozBlobBuidler)
    break
  case typeof WebKitBlobBuilder !== 'undefined':
    make_blob = builder(WebKitBlobBuilder)
    break
}

switch(true) {
  case typeof URL !== 'undefined' && !!URL.createObjectURL:
    make_url = urler(URL)
    break
  case typeof webkitURL !== 'undefined' && !!webkitURL.createObjectURL:
    make_url = urler(webkitURL)
    break
  case typeof msURL !== 'undefined' && !!msURL.createObjectURL:
    make_url = urler(msURL)
    break
  case typeof MozURL !== 'undefined' && !!MozURL.createObjectURL:
    make_url = urler(MozURL)
    break
}

function worker(fn, dir) {
  fn = fn + ''
  var pid = PIDS++
    , worker
    , stream
    , src = url || make_src(fn, dir)
    , blob = url || make_blob(src)

  url = url || make_url(blob)
  worker = new Worker(url)
  stream = fixup(worker, pid)

  worker.postMessage({
    __t: 2
  , __p: {
        filename: path.join(dir, 'worker.js')
      , code: fn
      , pid: pid
    }
  })

  return stream
}

function fixup(worker, pid) {
  var stream = through(write, end)
    , pm
   
  pm = worker.webkitPostMessage || worker.mozPostMessage || worker.postMessage

  stream.webWorker = worker
  stream.shouldTransfer = true
  stream.running = true
  stream.pid = pid

  stream.send = function(data) {
    if(stream.running) {
      worker.postMessage({__t: 0, __p: data})
    }
    stream.pause()
    return stream
  }

  stream.transfer = function(data) {
    if(stream.running) {
      pm.call(worker, data, [data])
    }
    stream.pause()
    return stream
  }

  stream.kill = function(signal) {
    if(stream.running) {
      if(signal === SIGKILL) {
        stream.running = false
        worker.terminate()
        stream.emit('exit', 9)
      } else {
        worker.postMessage({__t: 1, __p: signal === undefined ? SIGTERM : signal})
      }
    }
    return stream
  }
  stream.once('close', function() {
    stream.kill(0)
  })

  worker.addEventListener('message', onmessage, false)
  worker.addEventListener('error', onerror, false)

  return stream

  function write(data) {
    if(str.call(data).indexOf('ArrayBuffer') !== -1 && stream.shouldTransfer) {
      stream.transfer(data)
    } else {
      stream.send(data)
    }

    // pause on every write
    return false
  }

  function end(data) {
    if(arguments.length) {
      if(write(data) === false) {
        stream.once('drain', function() {
          stream.emit('close')
        })
      }
    }

    stream.writable = false
    stream.emit('end')
    if(!arguments.length) {
      stream.emit('close')
    }    
  }

  function onerror(ev) {
    stream.emit('error', ev)
    stream.running = false
    stream.webWorker.terminate()
    stream.emit('exit', 1, ev)
  }

  function onmessage(ev) {
    if(typeof ev.data === 'object' && !('__t' in ev.data)) {
      stream.queue(ev.data)
      stream.resume()
      return
    }

    if(ev.data.__t === 0) {
      stream.queue(ev.data.__p)
      stream.resume()
      return
    }

    if(ev.data.__t === 1) {
      stream.running = false
      stream.webWorker.terminate()
      stream.emit('exit', ev.data.__p)
      return
    }

    if(ev.data.__t === 2) {
      stream.resume()
      return
    } 

    if(ev.data.__t === -1) {
      ev.data.__p.args.unshift('<worker '+stream.pid+'>')
      console[ev.data.__p.type].apply(console, ev.data.__p.args)
    }
  }
}


function builder(type) {
  return function(data) {
    var bb = new type
    bb.append(data)
    return bb.getBlob('text/javascript')
  }
}

function urler(type) {
  return function(blob) {
    return type.createObjectURL(blob)
  }
}

function make_src() {
  var src = [''+prelude.replace('$extensions', '{}')]

  for(var key in require.modules) {
    src.push('require.define('+JSON.stringify(key)+', '+require.modules[key].source+');')
  }

  src.push('require.define("__main__", '+
  'function(require,module,exports,__dirname,__filename,process,global) {' +
  '   !'+worker_setup+'();' +
  '});' +
  'require("__main__");')

  return src.join('')
}

function worker_setup() {
  var EE = require("events").EventEmitter
    , ee = new EE
    , world = this
    , pm = world.webkitPostMessage || world.mozPostMessage ||
           world.msPostMessage || world.postMessage


  process.require = __require
  __require = null

  // "console" is an intentional global
  console = {
      log:    log('log')
    , warn:   log('warn')
    , error:  log('error')
  }

  function log(type) {
    return function() {
      postMessage({__t: -1, __p: {type: type, args: [].slice.call(arguments)}})
    }
  }

  process.send = function(what) {
    postMessage({__t: 0, __p: what})
    return process
  }

  process.exit = function(code) {
    postMessage({__t: 1, __p: code})
    // go into a busy loop until the parent process
    // reaps our process.
    while(1);
  }

  process.transfer = function(what) {
    pm.call(world, what, [what])
    return process
  }

  process.addListener =
  process.on = function(ev, fn) {
    ee.on(ev, fn)
    return process
  }

  process.once = function(ev, fn) {
    ee.once(ev, fn)
    return process
  }

  process.removeListener =
  process.remove = function(ev, fn) {
    ee.remove.apply(ee, arguments)
    return process
  }

  var heartbeat

  heartbeat = setInterval(function() {
    postMessage({__t: 2})
  }, 0)  

  onmessage = function(ev) {
    if(typeof ev.data === 'object' && !('__t' in ev.data)) {
      ee.emit('data', ev.data, ev)
      return
    }

    if(ev.data.__t === 0) {
      ee.emit('data', ev.data.__p, ev)
      return
    }

    if(ev.data.__t === 1) {
      if(!ee.listeners(ev.__p).length) {
        return process.exit(ev.__p)
      }
    }

    // load new file
    if(ev.data.__t === 2) {
      process.pid = ev.data.__p.pid
      process.require.define(
          ev.data.__p.filename
        , fn = new Function('require','module','exports','__dirname','__filename','process','global', '!'+ev.data.__p.code+'()')
      )
      process.require(ev.data.__p.filename)
    }
  }
}
