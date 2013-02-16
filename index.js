var path = require('path')
  , fork = require('child_process').fork
  , through = require('through')
  , execfile = path.join(__dirname, 'execfile.js')

module.exports = worker

function worker(fn, dir) {
  var worker = fork(execfile)
    , stream = through(write, end)

  stream.pid = worker.pid
  stream.running = true
  stream.process = worker
  worker.send({
    __t: 2
  , __p: {
      filename: dir
    , code: fn+''
    }
  })

  worker
    .on('data', ondata)
    .on('exit', onexit)

  stream.kill = worker.kill.bind(worker)

  stream.transfer =
  stream.send = function(data) {
    worker.send({__t: 0, __p: data})
    return stream
  }  

  return stream

  function write(data) {
    stream.send(data)
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

  function ondata(data) {
    if(ev.data.__t === 0) {
      stream.queue(ev.data.__p)
      stream.resume()
      return
    }

    if(ev.data.__t === 2) {
      stream.resume()
      return
    } 
  }

  function onexit(code) {
    stream.emit('exit', code)
    stream.queue(null)
  }
}
