var static = require('node-static'); var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
      file.serve(req, res);
    }).listen(8181);

var io = require('socket.io').listen(app);


io.sockets.on('connection', function (socket){

  socket.on('create or join', function (room) {

    socket.join(room);
    let roomMembers = Object.keys( io.sockets.adapter.rooms[room].sockets );

    var index = roomMembers.indexOf(socket.id);
    if (index > -1) {
      roomMembers.splice(index, 1);
    }

    console.log(roomMembers)

    socket.emit('joined', {room: room, members: roomMembers });
  })



  socket.on('message', function (message) {
      // log('S --> got message: ', message);
      if (message == "got user media") {
          socket.emit("message", message)
      } else {
          socket.broadcast.to(message.id).emit('message', { message:  message.message, senderId: socket.id});
      }

    })




})
