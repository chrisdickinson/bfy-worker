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
  stream.paused = true
  stream.process = worker
  worker.send({
    __t: 2
  , __p: {
      filename: dir
    , code: fn+''
    }
  })

  worker
    .on('message', ondata)
    .on('exit', onexit)

  stream.kill = worker.kill.bind(worker)

  stream.transfer =
  stream.send = function(data) {
    worker.send({__t: 0, __p: data})
    return stream
  }  

  return stream

  function write(data) {
    stream.pause()
    stream.send(data)
  }

  function end(data) {
    worker.send({__t: 3})
  }

  function ondata(data) {
    if(data.__t === 0) {
      stream.queue(data.__p)
      stream.resume()
      return
    }

    if(data.__t === 2) {
      stream.resume()
      return
    } 
  }

  function onexit(code) {
    stream.emit('exit', code)
    stream.writable
    stream.readable = false
    stream.emit('end')
    stream.emit('close')
    stream.closed = true
  }
}
